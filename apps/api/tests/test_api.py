from __future__ import annotations

import json
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from ledger_api.app import app
from ledger_api.ingest import IngestError, ingest
from ledger_api.ledger import connect, recompute
from ledger_api.paths import data_dir


@pytest.fixture(scope="session")
def warehouse(tmp_path_factory) -> Path:
    wh = tmp_path_factory.mktemp("parquet")
    ingest(data_dir(), wh)
    return wh


def derived(code: str) -> dict:
    return json.loads((data_dir() / "derived" / "entities" / f"{code}.json").read_text())


def entities() -> list[str]:
    return sorted(p.name for p in data_dir().iterdir() if p.is_dir() and len(p.name) == 4 and p.name[1] == "-")


def measure(m: dict) -> float:
    if m["kind"] == "percent":
        return m["value"]
    if m["kind"] == "duration":
        return m["seconds"]
    if m["kind"] == "fraction":
        return 100.0 * m["numerator"] / m["denominator"]
    return m["value"]


def test_sql_ledger_matches_the_typescript_engine_for_every_entity(warehouse):
    con = connect(warehouse)
    checked = 0
    for code in entities():
        a = derived(code)["assessment"]
        by_metric = {e["claim"]["metric"]: e for e in a["evaluations"] if e["recomputed"]}
        for r in recompute(con, code, a["quarter"]["id"]):
            e = by_metric.get(r.metric)
            if e is None:
                continue
            assert r.value == pytest.approx(measure(e["recomputed"]), abs=1.0 if e["kind"] == "duration" else 1e-6), f"{code} {r.metric}"
            if r.matched is not None and e["matched"] is not None:
                assert r.matched == e["matched"], f"{code} {r.metric}"
            checked += 1
    assert checked >= 50


def test_p04_hero_numbers_in_sql(warehouse):
    got = {r.metric: r for r in recompute(connect(warehouse), "P-04", "FY27-Q1")}
    assert got["p1_escalated_to_l2_within_30m"].matched == 84
    assert got["p1_escalated_to_l2_within_30m"].population == 138
    assert round(got["p1_mean_time_to_close"].value / 60) == 60
    assert got["ot_critical_assets_monitored"].matched == 0


def test_a_tampered_export_is_refused(tmp_path):
    src = data_dir() / "S-03" / "FY27-Q1"
    dst = tmp_path / "S-03" / "FY27-Q1"
    shutil.copytree(src, dst)
    f = dst / "analysts.ndjson.gz"
    f.write_bytes(f.read_bytes() + b"\0")
    with pytest.raises(IngestError, match="SHA-256"):
        ingest(tmp_path, tmp_path / "parquet")


def test_a_csv_export_ingests_like_its_json_twin(tmp_path):
    import duckdb

    from ledger_api.ingest import reader, sha256

    src = data_dir() / "S-03" / "FY27-Q1"
    dst = tmp_path / "S-03" / "FY27-Q1"
    shutil.copytree(src, dst)
    manifest = json.loads((dst / "manifest.json").read_text())
    entry = manifest["exports"]["cases"]
    json_file = dst / entry["file"]
    csv_file = dst / "cases.csv"
    con = duckdb.connect()
    want = [r[0] for r in con.execute(f"describe select * from {reader(json_file)}").fetchall()]
    con.execute(f"copy (select * from {reader(json_file)}) to '{csv_file}' (header, delimiter ',')")
    json_file.unlink()
    entry["file"], entry["sha256"] = csv_file.name, sha256(csv_file)
    (dst / "manifest.json").write_text(json.dumps(manifest))
    wh = tmp_path / "parquet"
    got = {i.export: i.rows for i in ingest(tmp_path, wh)}
    assert got["cases"] == entry["rows"]
    got_cols = [r[0] for r in con.execute(f"describe select * from read_parquet('{wh}/cases/*/*/data.parquet', hive_partitioning = false)").fetchall()]
    assert got_cols == want


def test_http_surface():
    c = TestClient(app)
    assert c.get("/health").json()["network"] == "none required"
    assert len(c.get("/entities").json()) == 12
    assert c.get("/entities/P-04/ledger").json()["entity"]["code"] == "P-04"
