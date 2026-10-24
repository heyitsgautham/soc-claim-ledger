"""python -m ledger_api ingest | ledger P-04 | serve"""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict

from .ingest import ingest
from .ledger import connect, recompute
from .logs import configure
from .paths import data_dir, warehouse_dir


def main() -> None:
    p = argparse.ArgumentParser(prog="ledger-api")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("ingest", help="verify submissions and write the Parquet warehouse")
    lg = sub.add_parser("ledger", help="recompute an entity's claims in SQL")
    lg.add_argument("entity")
    lg.add_argument("--quarter", default="FY27-Q1")
    sv = sub.add_parser("serve", help="serve the API on this machine")
    sv.add_argument("--port", type=int, default=8157)
    sv.add_argument("--host", default="127.0.0.1")
    a = p.parse_args()
    configure()

    if a.cmd == "ingest":
        done = ingest(data_dir(), warehouse_dir())
        print(f"ingested {len(done)} exports, {sum(d.rows for d in done):,} rows into {warehouse_dir()}")
    elif a.cmd == "ledger":
        for r in recompute(connect(warehouse_dir()), a.entity, a.quarter):
            print(json.dumps(asdict(r)))
    else:
        import uvicorn

        # The app logs each request as JSON, so uvicorn's own access log would only repeat it.
        uvicorn.run("ledger_api.app:app", host=a.host, port=a.port, access_log=False)


if __name__ == "__main__":
    main()
