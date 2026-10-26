from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

import ledger_api.app as service
from ledger_api.paths import data_dir


@pytest.fixture
def client():
    return TestClient(service.app)


def derived(name: str) -> dict:
    return json.loads((data_dir() / "derived" / name).read_text())


def test_entities_lists_the_portfolio_in_attention_order(client):
    body = client.get("/entities").json()
    assert [e["code"] for e in body] == [e["code"] for e in derived("portfolio.json")["entries"]]
    assert [e["rank"] for e in body] == sorted(e["rank"] for e in body)
    assert {"code", "sector", "risk", "gaps", "missingExports"} <= set(body[0])


def test_an_entity_ledger_is_its_assessment_for_the_attested_quarter(client):
    body = client.get("/entities/G-04/ledger").json()
    assert body == derived("entities/G-04.json")["assessment"]
    escalation = next(e for e in body["evaluations"] if e["claim"]["metric"] == "p1_escalated_to_l2_within_30m")
    assert escalation["status"] == "insufficient_evidence"
    assert escalation["reason"] == {"kind": "missing_export", "exports": ["escalations"], "quarters": ["FY27-Q1"]}


def test_calibration_serves_the_detector_record(client):
    body = client.get("/calibration").json()
    assert body == derived("calibration.json")
    assert {"cycles", "rows", "verdicts", "audit"} <= set(body)


@pytest.mark.parametrize("url", ["/entities", "/entities/P-04/ledger", "/calibration"])
def test_without_the_analysis_each_route_is_a_503_that_names_the_command(client, monkeypatch, tmp_path, url):
    monkeypatch.setattr(service, "data_dir", lambda: tmp_path)
    r = client.get(url)
    assert r.status_code == 503
    assert r.json()["detail"].endswith("is missing, run pnpm analyse")


def test_an_entity_in_the_portfolio_with_no_analysis_file_is_a_503(client, monkeypatch, tmp_path):
    (tmp_path / "derived").mkdir()
    (tmp_path / "derived" / "portfolio.json").write_text(json.dumps({"entries": [{"code": "P-04"}]}))
    monkeypatch.setattr(service, "data_dir", lambda: tmp_path)
    r = client.get("/entities/P-04/ledger")
    assert r.status_code == 503
    assert "entities/P-04.json is missing" in r.json()["detail"]


def test_health_needs_no_data_and_no_network(client, monkeypatch, tmp_path):
    monkeypatch.setattr(service, "data_dir", lambda: tmp_path)
    body = client.get("/health").json()
    assert body["status"] == "ok" and body["network"] == "none required"
    assert body["version"] == service.__version__


def test_the_openapi_schema_types_each_json_response(client):
    spec = client.get("/openapi.json").json()
    ok = lambda path, method="get": spec["paths"][path][method]["responses"]["200"]["content"]["application/json"]["schema"]  # noqa: E731
    assert ok("/health") == {"$ref": "#/components/schemas/Health"}
    assert ok("/entities/{code}/ledger/sql") == {"$ref": "#/components/schemas/SqlLedger"}
    assert ok("/ingest", "post") == {"$ref": "#/components/schemas/IngestResult"}
    metric = spec["components"]["schemas"]["RecomputedMetric"]
    assert metric["required"] == ["metric", "value", "matched", "population"]


@pytest.mark.parametrize("name", ["../portfolio.json", "entities/../../P-04/FY27-Q1/manifest.json", "/etc/hosts"])
def test_a_derived_name_cannot_reach_outside_the_analysis(name):
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as refused:
        service._derived(name)
    assert refused.value.status_code == 404
    assert refused.value.detail == f"{name} is not part of the analysis"


def test_a_derived_name_inside_the_analysis_still_reads():
    assert service._derived("entities/../portfolio.json")["cycle"] == derived("portfolio.json")["cycle"]
