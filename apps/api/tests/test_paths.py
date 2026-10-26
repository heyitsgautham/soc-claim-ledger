from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from ledger_api.app import app
from ledger_api.paths import REPO, data_dir, warehouse_dir


@pytest.mark.parametrize("value", ["", "   "])
def test_an_empty_data_dir_falls_back_to_the_demo_data(monkeypatch, value):
    monkeypatch.setenv("LEDGER_DATA_DIR", value)
    monkeypatch.delenv("LEDGER_WAREHOUSE_DIR", raising=False)
    assert data_dir() == REPO / "data" / "demo"
    assert warehouse_dir() == REPO / "data" / "demo" / "parquet"


def test_an_empty_warehouse_dir_falls_back_to_the_data_dir(monkeypatch, tmp_path):
    monkeypatch.setenv("LEDGER_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("LEDGER_WAREHOUSE_DIR", "")
    assert warehouse_dir() == tmp_path / "parquet"


def test_set_directories_are_used_as_given(monkeypatch, tmp_path):
    monkeypatch.setenv("LEDGER_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("LEDGER_WAREHOUSE_DIR", str(tmp_path / "wh"))
    assert data_dir() == Path(tmp_path / "data")
    assert warehouse_dir() == Path(tmp_path / "wh")


def test_the_api_serves_the_demo_data_when_the_data_dir_is_empty(monkeypatch):
    monkeypatch.setenv("LEDGER_DATA_DIR", "")
    r = TestClient(app).get("/entities")
    assert r.status_code == 200
    assert len(r.json()) == 12
