from __future__ import annotations

import io
import json
import logging

import pytest
from fastapi.testclient import TestClient

import ledger_api.app as service
from ledger_api.ingest import IngestError
from ledger_api.logs import LOGGER, JsonFormatter, configure


@pytest.fixture
def lines():
    """Every JSON line the service logs while the test runs."""
    buf = io.StringIO()
    handler = logging.StreamHandler(buf)
    handler.setFormatter(JsonFormatter())
    log = logging.getLogger(LOGGER)
    log.addHandler(handler)
    yield lambda: [json.loads(line) for line in buf.getvalue().splitlines()]
    log.removeHandler(handler)


def test_a_record_becomes_one_json_object_with_its_context():
    record = logging.LogRecord("ledger_api.test", logging.WARNING, __file__, 1, "export %s refused", ("cases",), None)
    record.ctx = {"entity": "P-04", "rows": 12}
    out = json.loads(JsonFormatter().format(record))
    assert out["level"] == "warning"
    assert out["logger"] == "ledger_api.test"
    assert out["msg"] == "export cases refused"
    assert out["entity"] == "P-04" and out["rows"] == 12
    assert out["ts"].endswith("+00:00")


def test_configure_twice_keeps_one_handler():
    configure()
    configure()
    handlers = [h for h in logging.getLogger(LOGGER).handlers if isinstance(h.formatter, JsonFormatter)]
    assert len(handlers) == 1


def test_each_request_logs_its_method_path_status_and_duration(lines):
    TestClient(service.app).get("/health")
    (entry,) = [e for e in lines() if e["msg"] == "request"]
    assert entry["method"] == "GET" and entry["path"] == "/health" and entry["status"] == 200
    assert entry["ms"] >= 0


def test_an_unhandled_error_returns_a_typed_500_and_logs_the_cause(lines, monkeypatch):
    def broken(*_):
        raise RuntimeError("disk full")

    monkeypatch.setattr(service, "ingest", broken)
    r = TestClient(service.app, raise_server_exceptions=False).post("/ingest")
    assert r.status_code == 500
    assert r.json() == {"error": "internal_error", "detail": "POST /ingest failed, see the service log"}
    (entry,) = [e for e in lines() if e["msg"] == "request failed"]
    assert entry["level"] == "error" and entry["status"] == 500 and entry["path"] == "/ingest"
    assert entry["exc_type"] == "RuntimeError" and "disk full" in entry["exc"]


def test_a_refused_export_is_a_422_with_the_reason(lines, monkeypatch):
    def refused(*_):
        raise IngestError("cases.ndjson.gz: SHA-256 does not match the manifest")

    monkeypatch.setattr(service, "ingest", refused)
    r = TestClient(service.app).post("/ingest")
    assert r.status_code == 422
    assert r.json() == {"error": "export_refused", "detail": "cases.ndjson.gz: SHA-256 does not match the manifest"}
    assert any(e["msg"] == "export refused" and "SHA-256" in e["reason"] for e in lines())
