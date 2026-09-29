"""HTTP surface. Local only: it binds to 127.0.0.1 by default and calls nothing outside."""

from __future__ import annotations

import json
from dataclasses import asdict

from fastapi import FastAPI, HTTPException

from . import __version__
from .ingest import ingest
from .ledger import connect, recompute
from .paths import data_dir, warehouse_dir

app = FastAPI(title="SOC Claim Ledger", version=__version__)


def _derived(name: str):
    path = data_dir() / "derived" / name
    if not path.exists():
        raise HTTPException(503, f"{path} is missing, run pnpm analyse")
    return json.loads(path.read_text())


@app.get("/health")
def health():
    return {"status": "ok", "version": __version__, "network": "none required"}


@app.get("/entities")
def entities():
    return _derived("portfolio.json")["entries"]


@app.get("/entities/{code}/ledger")
def ledger(code: str):
    return _derived(f"entities/{code}.json")["assessment"]


@app.get("/entities/{code}/ledger/sql")
def ledger_sql(code: str, quarter: str | None = None):
    wh = warehouse_dir()
    if not wh.exists():
        raise HTTPException(503, "no warehouse yet, POST /ingest first")
    con = connect(wh)
    q = quarter or con.execute("select max(quarter) from cases where entity = ?", [code]).fetchone()[0]
    if q is None:
        raise HTTPException(404, f"no submissions for {code}")
    return {"entity": code, "quarter": q, "metrics": [asdict(r) for r in recompute(con, code, q)]}


@app.get("/calibration")
def calibration():
    return _derived("calibration.json")


@app.post("/ingest")
def run_ingest():
    done = ingest(data_dir(), warehouse_dir())
    return {"exports": len(done), "rows": sum(d.rows for d in done)}
