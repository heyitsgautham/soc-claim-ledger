"""Ingest. Every export a manifest lists is checked against its SHA-256 and row count, then
written to Parquet partitioned by entity and quarter. A file that does not match its
manifest is refused, so the warehouse only ever holds records exactly as submitted.
Exports may be newline-delimited JSON or CSV with a header row, either one gzipped or not."""

from __future__ import annotations

import hashlib
import json
import logging
import re
from dataclasses import dataclass
from pathlib import Path

import duckdb

ENTITY = re.compile(r"^[A-Z]-\d{2}$")
QUARTER = re.compile(r"^FY\d{2}-Q[1-4]$")

log = logging.getLogger("ledger_api.ingest")


class IngestError(Exception):
    pass


@dataclass
class Ingested:
    entity: str
    quarter: str
    export: str
    rows: int


def submissions(data: Path) -> list[Path]:
    out = []
    for entity in sorted(p for p in data.iterdir() if p.is_dir() and ENTITY.match(p.name)):
        out.extend(sorted(q for q in entity.iterdir() if q.is_dir() and QUARTER.match(q.name) and (q / "manifest.json").exists()))
    return out


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def reader(src: Path) -> str:
    """The DuckDB table function that reads one export, chosen by its file name."""
    path = str(src).replace("'", "''")
    name = src.name.removesuffix(".gz")
    compression = "gzip" if src.name.endswith(".gz") else "none"
    if name.endswith(".csv"):
        return f"read_csv('{path}', header = true, auto_detect = true, compression = '{compression}')"
    if name.endswith((".ndjson", ".jsonl", ".json")):
        return f"read_json('{path}', format = 'newline_delimited', compression = '{compression}', sample_size = -1)"
    raise IngestError(f"{src}: not a CSV or newline-delimited JSON export")


def ingest(data: Path, warehouse: Path) -> list[Ingested]:
    con = duckdb.connect()
    done: list[Ingested] = []
    for sub in submissions(data):
        manifest = json.loads((sub / "manifest.json").read_text())
        entity, quarter = manifest["entity"]["code"], manifest["quarter"]["id"]
        for name, entry in manifest["exports"].items():
            src = sub / entry["file"]
            if sha256(src) != entry["sha256"]:
                raise IngestError(f"{src}: SHA-256 does not match the manifest")
            dest = warehouse / name / f"entity={entity}" / f"quarter={quarter}" / "data.parquet"
            dest.parent.mkdir(parents=True, exist_ok=True)
            rows = con.execute(f"select count(*) from {reader(src)}").fetchone()[0]
            if rows != entry["rows"]:
                raise IngestError(f"{src}: {rows} rows, the manifest declares {entry['rows']}")
            con.execute(f"copy (select * from {reader(src)}) to '{dest}' (format parquet, compression zstd)")
            done.append(Ingested(entity, quarter, name, rows))
            log.info("export ingested", extra={"ctx": {"entity": entity, "quarter": quarter, "export": name, "rows": rows}})
    return done
