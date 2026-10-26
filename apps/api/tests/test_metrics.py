from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from prometheus_client.parser import text_string_to_metric_families

import ledger_api.app as service
from ledger_api import metrics
from ledger_api.ingest import Ingested, IngestError


def scrape(client: TestClient) -> dict[tuple[str, tuple[tuple[str, str], ...]], float]:
    """Every sample /metrics serves, keyed by name and sorted labels."""
    r = client.get("/metrics")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/plain")
    out = {}
    for family in text_string_to_metric_families(r.text):
        for s in family.samples:
            out[(s.name, tuple(sorted(s.labels.items())))] = s.value
    return out


def requests(samples, method: str, route: str, status: str) -> float:
    return samples.get(("ledger_api_requests_total", (("method", method), ("route", route), ("status", status))), 0.0)


@pytest.fixture
def client():
    return TestClient(service.app)


def test_requests_are_counted_by_route_template_not_by_path(client):
    before = scrape(client)
    client.get("/entities/P-04/ledger")
    client.get("/entities/S-03/ledger")
    client.get("/entities/Z-99/ledger")
    after = scrape(client)
    route = "/entities/{code}/ledger"
    assert requests(after, "GET", route, "200") - requests(before, "GET", route, "200") == 2
    assert requests(after, "GET", route, "404") - requests(before, "GET", route, "404") == 1
    assert not any("P-04" in dict(labels).get("route", "") for _, labels in after)


def test_a_path_with_no_route_is_one_series(client):
    before = scrape(client)
    client.get("/nothing/here")
    client.get("/or/here")
    after = scrape(client)
    assert requests(after, "GET", metrics.UNMATCHED, "404") - requests(before, "GET", metrics.UNMATCHED, "404") == 2


def test_latency_is_observed_per_route(client):
    key = ("ledger_api_request_duration_seconds_count", (("method", "GET"), ("route", "/health")))
    before = scrape(client).get(key, 0.0)
    client.get("/health")
    assert scrape(client)[key] - before == 1


def test_a_failed_handler_counts_as_a_500(monkeypatch):
    monkeypatch.setattr(service, "ingest", lambda *_: (_ for _ in ()).throw(RuntimeError("disk full")))
    c = TestClient(service.app, raise_server_exceptions=False)
    before = scrape(c)
    assert c.post("/ingest").status_code == 500
    assert requests(scrape(c), "POST", "/ingest", "500") - requests(before, "POST", "/ingest", "500") == 1


def test_ingest_counts_rows_by_export_and_refusals(client, monkeypatch):
    monkeypatch.setattr(service, "ingest", lambda *_: [Ingested("P-04", "FY27-Q1", "cases", 120), Ingested("S-03", "FY27-Q1", "cases", 30)])
    before = scrape(client)
    client.post("/ingest")
    rows = ("ledger_api_ingested_rows_total", (("export", "cases"),))
    assert scrape(client)[rows] - before.get(rows, 0.0) == 150

    def refused(*_):
        raise IngestError("cases.ndjson.gz: SHA-256 does not match the manifest")

    monkeypatch.setattr(service, "ingest", refused)
    refusals = ("ledger_api_refused_exports_total", ())
    before = scrape(client).get(refusals, 0.0)
    assert client.post("/ingest").status_code == 422
    assert scrape(client)[refusals] - before == 1


def test_metrics_stay_out_of_the_openapi_schema(client):
    assert "/metrics" not in client.get("/openapi.json").json()["paths"]
