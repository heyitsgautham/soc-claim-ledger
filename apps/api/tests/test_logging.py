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
    r = TestClient(service.app, raise_server_exceptions=False).post("/ingest", headers={"X-Request-ID": "exam-42"})
    assert r.status_code == 500
    assert r.json() == {"error": "internal_error", "detail": "POST /ingest failed, see the service log for request exam-42", "request_id": "exam-42"}
    assert r.headers["x-request-id"] == "exam-42"
    (entry,) = [e for e in lines() if e["msg"] == "request failed"]
    assert entry["level"] == "error" and entry["status"] == 500 and entry["path"] == "/ingest"
    assert entry["exc_type"] == "RuntimeError" and "disk full" in entry["exc"]
    assert entry["request_id"] == "exam-42"


def test_a_refused_export_is_a_422_with_the_reason(lines, monkeypatch):
    def refused(*_):
        raise IngestError("cases.ndjson.gz: SHA-256 does not match the manifest")

    monkeypatch.setattr(service, "ingest", refused)
    r = TestClient(service.app).post("/ingest")
    assert r.status_code == 422
    assert r.json() == {
        "error": "export_refused",
        "detail": "cases.ndjson.gz: SHA-256 does not match the manifest",
        "request_id": r.headers["x-request-id"],
    }
    assert any(e["msg"] == "export refused" and "SHA-256" in e["reason"] for e in lines())


def test_every_response_carries_a_new_request_id_when_the_caller_sends_none():
    c = TestClient(service.app)
    a, b = c.get("/health").headers["x-request-id"], c.get("/health").headers["x-request-id"]
    assert len(a) == 32 and int(a, 16) >= 0
    assert a != b


def test_the_callers_request_id_is_kept_and_stamped_on_its_log_lines(lines):
    r = TestClient(service.app).get("/health", headers={"X-Request-ID": "trace.7-a_b"})
    assert r.headers["x-request-id"] == "trace.7-a_b"
    (entry,) = [e for e in lines() if e["msg"] == "request"]
    assert entry["request_id"] == "trace.7-a_b"


@pytest.mark.parametrize("sent", ["", "x" * 65, "two words", 'quote"d', "line\tbreak"])
def test_a_request_id_that_is_not_short_and_plain_is_replaced(sent):
    got = TestClient(service.app).get("/health", headers={"X-Request-ID": sent}).headers["x-request-id"]
    assert got != sent and len(got) == 32


def test_lines_logged_inside_a_handler_carry_the_request_id(lines, monkeypatch):
    def noisy(*_):
        logging.getLogger(f"{LOGGER}.ingest").info("export ingested", extra={"ctx": {"export": "cases"}})
        return []

    monkeypatch.setattr(service, "ingest", noisy)
    TestClient(service.app).post("/ingest", headers={"X-Request-ID": "ingest-1"})
    ingested = [e for e in lines() if e["msg"] == "export ingested"]
    assert [e["request_id"] for e in ingested] == ["ingest-1"]


def test_a_line_logged_outside_a_request_has_no_request_id(lines):
    configure()
    logging.getLogger(LOGGER).info("startup")
    (entry,) = [e for e in lines() if e["msg"] == "startup"]
    assert "request_id" not in entry
