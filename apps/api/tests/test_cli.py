from __future__ import annotations

import json
import shutil
import sys

import pytest

from ledger_api import __main__ as cli
from ledger_api.paths import data_dir


@pytest.fixture
def data(tmp_path, monkeypatch):
    """One entity's latest submission in a data dir of its own, with its warehouse beside it."""
    shutil.copytree(data_dir() / "S-03" / "FY27-Q1", tmp_path / "S-03" / "FY27-Q1")
    monkeypatch.setenv("LEDGER_DATA_DIR", str(tmp_path))
    monkeypatch.delenv("LEDGER_WAREHOUSE_DIR", raising=False)
    return tmp_path


def run(monkeypatch, *args: str) -> None:
    monkeypatch.setattr(sys, "argv", ["ledger-api", *args])
    cli.main()


def test_ingest_reports_what_it_wrote(data, monkeypatch, capsys):
    run(monkeypatch, "ingest")
    out = capsys.readouterr().out
    assert out.startswith("ingested ") and f"rows into {data / 'parquet'}" in out
    assert (data / "parquet" / "cases" / "entity=S-03" / "quarter=FY27-Q1" / "data.parquet").exists()


def test_ledger_prints_one_json_object_per_metric(data, monkeypatch, capsys):
    run(monkeypatch, "ingest")
    capsys.readouterr()
    run(monkeypatch, "ledger", "S-03", "--quarter", "FY27-Q1")
    rows = [json.loads(line) for line in capsys.readouterr().out.splitlines()]
    assert {r["metric"] for r in rows} >= {"p1_mean_time_to_close", "l1_analysts_on_roster"}
    assert all(set(r) == {"metric", "value", "matched", "population"} for r in rows)


def test_serve_runs_uvicorn_on_this_machine_without_its_access_log(monkeypatch):
    import uvicorn

    seen = {}
    monkeypatch.setattr(uvicorn, "run", lambda app, **kw: seen.update(app=app, **kw))
    run(monkeypatch, "serve", "--port", "9001")
    assert seen == {"app": "ledger_api.app:app", "host": "127.0.0.1", "port": 9001, "access_log": False}


def test_a_command_is_required(monkeypatch):
    with pytest.raises(SystemExit) as exit_:
        run(monkeypatch)
    assert exit_.value.code == 2
