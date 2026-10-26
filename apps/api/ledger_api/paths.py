from __future__ import annotations

import os
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]


def _setting(name: str) -> str | None:
    """A variable set to an empty string, as a copied .env file leaves it, counts as unset."""
    value = os.environ.get(name, "").strip()
    return value or None


def data_dir() -> Path:
    """Submissions as the CSEs hand them over, written by `pnpm simulate`."""
    return Path(_setting("LEDGER_DATA_DIR") or REPO / "data" / "demo")


def warehouse_dir() -> Path:
    """The Parquet warehouse DuckDB queries, written by `ledger-api ingest`."""
    return Path(_setting("LEDGER_WAREHOUSE_DIR") or data_dir() / "parquet")
