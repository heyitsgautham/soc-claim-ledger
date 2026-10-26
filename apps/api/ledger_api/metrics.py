"""Service metrics in the Prometheus text format, served at GET /metrics.

The service keeps its own registry, so the numbers describe this API alone and a test can
read them without the process-wide defaults. Routes are labelled by their template, such
as /entities/{code}/ledger, so one entity code per series cannot grow the label set."""

from __future__ import annotations

from prometheus_client import CONTENT_TYPE_LATEST, CollectorRegistry, Counter, Histogram, generate_latest

REGISTRY = CollectorRegistry()

REQUESTS = Counter(
    "ledger_api_requests_total",
    "HTTP requests answered, by method, route template and status code.",
    ["method", "route", "status"],
    registry=REGISTRY,
)

LATENCY = Histogram(
    "ledger_api_request_duration_seconds",
    "Time to answer an HTTP request, by method and route template.",
    ["method", "route"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0),
    registry=REGISTRY,
)

INGESTED_ROWS = Counter(
    "ledger_api_ingested_rows_total",
    "Rows written to the Parquet warehouse through POST /ingest, by export.",
    ["export"],
    registry=REGISTRY,
)

REFUSED_EXPORTS = Counter(
    "ledger_api_refused_exports_total",
    "Ingest runs refused because an export did not match its manifest.",
    registry=REGISTRY,
)

# A path that matched no route is labelled once, whatever was asked for.
UNMATCHED = "unmatched"

CONTENT_TYPE = CONTENT_TYPE_LATEST


def observe(method: str, route: str, status: int, seconds: float) -> None:
    REQUESTS.labels(method, route, str(status)).inc()
    LATENCY.labels(method, route).observe(seconds)


def render() -> bytes:
    return generate_latest(REGISTRY)
