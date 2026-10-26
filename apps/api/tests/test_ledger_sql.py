from __future__ import annotations

import json
import math

import pytest
from fastapi.testclient import TestClient

import ledger_api.app as service
from ledger_api.ingest import ingest
from ledger_api.ledger import QUERIES, REQUIRES, connect, quarters, recompute, submitted
from ledger_api.paths import data_dir


@pytest.fixture(scope="module")
def warehouse(tmp_path_factory):
    wh = tmp_path_factory.mktemp("parquet")
    ingest(data_dir(), wh)
    return wh


@pytest.fixture
def client(warehouse, monkeypatch):
    monkeypatch.setattr(service, "warehouse_dir", lambda: warehouse)
    return TestClient(service.app)


def every_entity() -> list[str]:
    return sorted(p.name for p in data_dir().iterdir() if p.is_dir() and len(p.name) == 4 and p.name[1] == "-")


@pytest.mark.parametrize("code", every_entity())
def test_every_entity_recomputes_in_sql_for_its_latest_quarter(client, code):
    r = client.get(f"/entities/{code}/ledger/sql")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["entity"] == code and body["quarter"] == "FY27-Q1"
    assert all(math.isfinite(m["value"]) and m["population"] > 0 for m in body["metrics"])


def test_a_metric_with_no_population_is_left_out_not_reported_as_nan(warehouse):
    # G-04 holds no critical OT assets, so the OT monitoring share has nothing to divide by.
    got = {r.metric: r for r in recompute(connect(warehouse), "G-04", "FY27-Q1")}
    assert "ot_critical_assets_monitored" not in got
    assert all(math.isfinite(r.value) for r in got.values())


def test_a_metric_whose_export_was_not_submitted_is_left_out(warehouse):
    # G-04 did not submit escalations, so escalation to L2 cannot be recomputed.
    got = {r.metric for r in recompute(connect(warehouse), "G-04", "FY27-Q1")}
    assert "p1_escalated_to_l2_within_30m" not in got
    assert "p1_mean_time_to_close" in got


def test_sql_recomputes_exactly_the_claims_the_typescript_engine_can_recompute(warehouse):
    con = connect(warehouse)
    for code in every_entity():
        a = json.loads((data_dir() / "derived" / "entities" / f"{code}.json").read_text())["assessment"]
        ts = {e["claim"]["metric"] for e in a["evaluations"] if e["recomputed"] is not None} & set(QUERIES)
        sql = {r.metric for r in recompute(con, code, a["quarter"]["id"])}
        assert sql == ts, code


def test_every_query_names_the_exports_it_needs():
    assert set(REQUIRES) == set(QUERIES)


def test_submitted_lists_only_exports_with_records(warehouse):
    con = connect(warehouse)
    assert "escalations" not in submitted(con, "G-04", "FY27-Q1")
    assert {"cases", "alerts", "assets"} <= submitted(con, "G-04", "FY27-Q1")
    assert submitted(con, "Z-99", "FY27-Q1") == set()


def test_quarters_come_from_every_export_in_order(warehouse):
    con = connect(warehouse)
    assert quarters(con, "P-04") == ["FY26-Q2", "FY26-Q3", "FY26-Q4", "FY27-Q1"]
    assert quarters(con, "Z-99") == []


def test_an_entity_with_no_submissions_is_a_404_with_or_without_a_quarter(client):
    for url in ("/entities/Z-99/ledger/sql", "/entities/Z-99/ledger/sql?quarter=FY27-Q1"):
        r = client.get(url)
        assert r.status_code == 404, url
        assert r.json()["detail"] == "no submissions for Z-99"


def test_a_quarter_the_entity_never_submitted_is_a_404(client):
    r = client.get("/entities/P-04/ledger/sql", params={"quarter": "FY20-Q1"})
    assert r.status_code == 404
    assert r.json()["detail"] == "no FY20-Q1 submission for P-04, it submitted FY26-Q2, FY26-Q3, FY26-Q4, FY27-Q1"


def test_an_earlier_quarter_recomputes_from_its_own_records(client):
    body = client.get("/entities/P-04/ledger/sql", params={"quarter": "FY26-Q4"}).json()
    assert body["quarter"] == "FY26-Q4"
    assert body["metrics"]


def test_without_a_warehouse_the_route_asks_for_an_ingest(tmp_path, monkeypatch):
    monkeypatch.setattr(service, "warehouse_dir", lambda: tmp_path / "none")
    r = TestClient(service.app).get("/entities/P-04/ledger/sql")
    assert r.status_code == 503
    assert r.json()["detail"] == "no warehouse yet, POST /ingest first"
