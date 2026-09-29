from __future__ import annotations

import os
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]


def data_dir() -> Path:
    """Submissions as the CSEs hand them over, written by `pnpm simulate`."""
    return Path(os.environ.get("LEDGER_DATA_DIR", REPO / "data" / "demo"))


def warehouse_dir() -> Path:
    """The Parquet warehouse DuckDB queries, written by `ledger-api ingest`."""
    return Path(os.environ.get("LEDGER_WAREHOUSE_DIR", data_dir() / "parquet"))
