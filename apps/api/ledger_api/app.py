"""HTTP surface. Local only: it binds to 127.0.0.1 by default and calls nothing outside."""

from __future__ import annotations

import json
import logging
import re
import time
import uuid
from collections.abc import Awaitable, Callable
from dataclasses import asdict
from typing import Annotated, Any

from fastapi import FastAPI, HTTPException, Path, Query, Request
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from . import __version__, metrics
from .ingest import ENTITY, QUARTER, IngestError, ingest
from .ledger import connect, quarters, recompute
from .logs import LOGGER, configure, request_id
from .paths import data_dir, warehouse_dir

configure()
log = logging.getLogger(f"{LOGGER}.http")

app = FastAPI(title="SOC Claim Ledger", version=__version__)

EntityCode = Annotated[str, Path(pattern=ENTITY.pattern, description="Entity code, such as P-04")]
QuarterId = Annotated[str | None, Query(pattern=QUARTER.pattern, description="Quarter, such as FY27-Q1")]


# A caller's own request ID is kept when it is short and plain, so it cannot inject into a log line.
REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


class ErrorBody(BaseModel):
    error: str
    detail: str
    request_id: str | None = None


class Health(BaseModel):
    status: str
    version: str
    network: str


class RecomputedMetric(BaseModel):
    metric: str
    value: float
    matched: int | None
    population: int


class SqlLedger(BaseModel):
    entity: str
    quarter: str
    metrics: list[RecomputedMetric]


class IngestResult(BaseModel):
    exports: int
    rows: int


@app.middleware("http")
async def log_requests(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
    """One log line per request, and a typed 500 with the cause logged when a handler fails.
    Every request gets an ID, the caller's X-Request-ID or a new one, echoed in the response."""
    start = time.perf_counter()
    incoming = request.headers.get("x-request-id", "")
    rid = incoming if REQUEST_ID.match(incoming) else uuid.uuid4().hex
    token = request_id.set(rid)
    ctx: dict[str, object] = {"method": request.method, "path": request.url.path}
    try:
        try:
            response = await call_next(request)
        except Exception:
            ctx.update(status=500, ms=round((time.perf_counter() - start) * 1000, 1))
            log.exception("request failed", extra={"ctx": ctx})
            detail = f"{request.method} {request.url.path} failed, see the service log for request {rid}"
            response = JSONResponse(ErrorBody(error="internal_error", detail=detail, request_id=rid).model_dump(), status_code=500)
        else:
            ctx.update(status=response.status_code, ms=round((time.perf_counter() - start) * 1000, 1))
            log.info("request", extra={"ctx": ctx})
    finally:
        request_id.reset(token)
    route = getattr(request.scope.get("route"), "path", metrics.UNMATCHED)
    metrics.observe(request.method, route, response.status_code, time.perf_counter() - start)
    response.headers["X-Request-ID"] = rid
    return response


@app.exception_handler(IngestError)
async def refused_export(request: Request, exc: IngestError) -> JSONResponse:
    """A submission that does not match its manifest is the caller's data, not a server fault."""
    metrics.REFUSED_EXPORTS.inc()
    log.warning("export refused", extra={"ctx": {"path": request.url.path, "reason": str(exc)}})
    return JSONResponse(ErrorBody(error="export_refused", detail=str(exc), request_id=request_id.get()).model_dump(), status_code=422)


def _derived(name: str) -> Any:
    path = data_dir() / "derived" / name
    if not path.exists():
        raise HTTPException(503, f"{path} is missing, run pnpm analyse")
    return json.loads(path.read_text())


@app.get("/health")
def health() -> Health:
    return Health(status="ok", version=__version__, network="none required")


@app.get("/metrics", include_in_schema=False)
def prometheus_metrics() -> Response:
    """Request counts and latencies by route, and ingest totals, for a local Prometheus to scrape."""
    return Response(metrics.render(), media_type=metrics.CONTENT_TYPE)


@app.get("/entities")
def entities() -> Any:
    return _derived("portfolio.json")["entries"]


@app.get("/entities/{code}/ledger")
def ledger(code: EntityCode) -> Any:
    if code not in {e["code"] for e in _derived("portfolio.json")["entries"]}:
        raise HTTPException(404, f"no entity {code}")
    return _derived(f"entities/{code}.json")["assessment"]


@app.get("/entities/{code}/ledger/sql")
def ledger_sql(code: EntityCode, quarter: QuarterId = None) -> SqlLedger:
    wh = warehouse_dir()
    if not wh.exists():
        raise HTTPException(503, "no warehouse yet, POST /ingest first")
    con = connect(wh)
    submitted = quarters(con, code)
    if not submitted:
        raise HTTPException(404, f"no submissions for {code}")
    q = quarter or submitted[-1]
    if q not in submitted:
        raise HTTPException(404, f"no {q} submission for {code}, it submitted {', '.join(submitted)}")
    return SqlLedger(entity=code, quarter=q, metrics=[RecomputedMetric(**asdict(r)) for r in recompute(con, code, q)])


@app.get("/calibration")
def calibration() -> Any:
    return _derived("calibration.json")


@app.post("/ingest")
def run_ingest() -> IngestResult:
    done = ingest(data_dir(), warehouse_dir())
    for d in done:
        metrics.INGESTED_ROWS.labels(d.export).inc(d.rows)
    return IngestResult(exports=len(done), rows=sum(d.rows for d in done))
