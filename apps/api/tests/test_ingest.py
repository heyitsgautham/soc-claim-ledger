from __future__ import annotations

import gzip
import json
import shutil

import duckdb
import pytest

from ledger_api.ingest import IngestError, ingest, reader, sha256, submissions
from ledger_api.paths import data_dir


def copy_submission(tmp_path, entity="S-03", quarter="FY27-Q1"):
    dst = tmp_path / entity / quarter
    shutil.copytree(data_dir() / entity / quarter, dst)
    return dst


def rewrite(dst, name, path, rows):
    """Point the manifest's entry for one export at a new file."""
    manifest = json.loads((dst / "manifest.json").read_text())
    entry = manifest["exports"][name]
    entry["file"], entry["sha256"], entry["rows"] = path.name, sha256(path), rows
    (dst / "manifest.json").write_text(json.dumps(manifest))


@pytest.mark.parametrize(
    ("name", "fn"),
    [
        ("cases.csv", "read_csv"),
        ("cases.csv.gz", "read_csv"),
        ("cases.ndjson", "read_json"),
        ("cases.jsonl.gz", "read_json"),
        ("cases.json", "read_json"),
    ],
)
def test_the_reader_is_chosen_by_file_name(tmp_path, name, fn):
    src = reader(tmp_path / name)
    assert src.startswith(f"{fn}(")
    assert ("compression = 'gzip'" in src) == name.endswith(".gz")


def test_a_file_that_is_neither_csv_nor_ndjson_is_refused(tmp_path):
    with pytest.raises(IngestError, match="not a CSV or newline-delimited JSON export"):
        reader(tmp_path / "cases.xlsx")


def test_a_quote_in_the_path_cannot_break_out_of_the_sql_string(tmp_path):
    src = reader(tmp_path / "it's" / "cases.csv")
    assert "it''s" in src


def test_submissions_are_found_in_order_and_stray_folders_ignored(tmp_path):
    copy_submission(tmp_path, "S-03", "FY27-Q1")
    copy_submission(tmp_path, "P-04", "FY26-Q4")
    (tmp_path / "derived").mkdir()
    (tmp_path / "P-04" / "FY99-Q9").mkdir()
    (tmp_path / "P-04" / "FY27-Q1").mkdir()  # no manifest, not handed over yet
    got = [(p.parent.name, p.name) for p in submissions(tmp_path)]
    assert got == [("P-04", "FY26-Q4"), ("S-03", "FY27-Q1")]


def test_ingest_writes_parquet_partitioned_by_entity_and_quarter(tmp_path):
    copy_submission(tmp_path)
    wh = tmp_path / "parquet"
    done = ingest(tmp_path, wh)
    assert {d.export for d in done} >= {"alerts", "cases", "assets"}
    cases = next(d for d in done if d.export == "cases")
    path = wh / "cases" / "entity=S-03" / "quarter=FY27-Q1" / "data.parquet"
    assert path.exists()
    assert duckdb.connect().execute(f"select count(*) from read_parquet('{path}')").fetchone()[0] == cases.rows


def test_a_row_count_that_differs_from_the_manifest_is_refused(tmp_path):
    dst = copy_submission(tmp_path)
    manifest = json.loads((dst / "manifest.json").read_text())
    manifest["exports"]["analysts"]["rows"] += 1
    (dst / "manifest.json").write_text(json.dumps(manifest))
    with pytest.raises(IngestError, match=r"analysts\.ndjson\.gz: \d+ rows, the manifest declares \d+"):
        ingest(tmp_path, tmp_path / "parquet")


def test_an_uncompressed_ndjson_export_ingests_like_its_gzipped_twin(tmp_path):
    dst = copy_submission(tmp_path)
    src = dst / "analysts.ndjson.gz"
    plain = dst / "analysts.ndjson"
    plain.write_bytes(gzip.decompress(src.read_bytes()))
    src.unlink()
    rows = len(plain.read_text().splitlines())
    rewrite(dst, "analysts", plain, rows)
    got = {d.export: d.rows for d in ingest(tmp_path, tmp_path / "parquet")}
    assert got["analysts"] == rows


def test_a_quote_in_a_folder_name_survives_ingest_and_the_sql_ledger(tmp_path):
    from ledger_api.ledger import connect, recompute

    data = tmp_path / "o'brien" / "data"
    shutil.copytree(data_dir() / "S-03" / "FY27-Q1", data / "S-03" / "FY27-Q1")
    wh = tmp_path / "o'brien" / "parquet"
    done = ingest(data, wh)
    assert {d.export for d in done} >= {"cases", "alerts"}
    got = {r.metric for r in recompute(connect(wh), "S-03", "FY27-Q1")}
    assert "p1_mean_time_to_close" in got


def test_sql_path_doubles_quotes_inside_one_literal(tmp_path):
    from ledger_api.ingest import sql_path

    assert sql_path(tmp_path / "a'b" / "c.csv") == f"'{tmp_path}/a''b/c.csv'"
