"""The claim-to-query mapping in SQL. Each metric is one DuckDB query over the Parquet
warehouse, written independently of the TypeScript engine that drives the interface.
The parity test holds the two to the same numbers for every entity."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import duckdb


@dataclass
class Recomputed:
    metric: str
    value: float
    matched: int | None
    population: int


def _view(con: duckdb.DuckDBPyConnection, warehouse: Path, name: str) -> None:
    con.execute(f"create or replace view {name} as select * from read_parquet('{warehouse / name}/**/*.parquet', hive_partitioning = true)")


def connect(warehouse: Path) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    for name in ("alerts", "cases", "escalations", "assets", "log_sources", "analysts"):
        if (warehouse / name).exists():
            _view(con, warehouse, name)
    return con


def _ts(col: str) -> str:
    return f"epoch(cast({col} as timestamptz))"


QUERIES: dict[str, str] = {
    # Share of critical (P1) alerts whose case reached L2 within 30 minutes of opening.
    "p1_escalated_to_l2_within_30m": f"""
        with p1 as (select id, {_ts("opened_at")} as opened from cases where entity = $entity and quarter = $quarter and priority = 'P1'),
        l2 as (
          select case_id, min({_ts("escalated_at")}) as at from escalations
          where entity = $entity and quarter = $quarter and from_level = 'L1' and to_level = 'L2' group by case_id
        )
        select 100.0 * count(*) filter (where l2.at - p1.opened <= 1800) / count(*), count(*) filter (where l2.at - p1.opened <= 1800), count(*)
        from p1 left join l2 on l2.case_id = p1.id
    """,
    # Mean time to triage, in seconds, over the closed cases of critical (P1) alerts.
    "p1_mean_time_to_close": f"""
        select avg({_ts("closed_at")} - {_ts("opened_at")}), null, count(*)
        from cases where entity = $entity and quarter = $quarter and priority = 'P1' and closed_at is not null
    """,
    # Mean time to acknowledge, in seconds, over acknowledged P1 alerts.
    "p1_mean_time_to_acknowledge": f"""
        select avg({_ts("acknowledged_at")} - {_ts("created_at")}), null, count(*)
        from alerts where entity = $entity and quarter = $quarter and priority = 'P1' and acknowledged_at is not null
    """,
    # Share of closed P2 cases closed within the SLA the case carries.
    "p2_closed_within_sla": f"""
        select 100.0 * count(*) filter (where {_ts("closed_at")} - {_ts("opened_at")} <= sla_close_minutes * 60) / count(*),
               count(*) filter (where {_ts("closed_at")} - {_ts("opened_at")} <= sla_close_minutes * 60), count(*)
        from cases where entity = $entity and quarter = $quarter and priority = 'P2' and closed_at is not null
    """,
    # Critical OT assets seen by the SIEM across this quarter and the one before.
    "ot_critical_assets_monitored": """
        with q as (select distinct quarter from assets where entity = $entity and quarter <= $quarter order by quarter desc limit 2),
        inv as (select id, log_source_id from assets where entity = $entity and quarter = $quarter and asset_class = 'ot' and criticality = 'critical'),
        seen_alert as (select distinct asset_id from alerts where entity = $entity and quarter in (select quarter from q)),
        seen_src as (select id from log_sources where entity = $entity and quarter in (select quarter from q) group by id having sum(days_reporting) > 0)
        select 100.0 * count(*) filter (where a.asset_id is not null or s.id is not null) / count(*),
               count(*) filter (where a.asset_id is not null or s.id is not null), count(*)
        from inv left join seen_alert a on a.asset_id = inv.id left join seen_src s on s.id = inv.log_source_id
    """,
    "l1_analysts_on_roster": """
        select count(*) filter (where level = 'L1'), count(*) filter (where level = 'L1'), count(*)
        from analysts where entity = $entity and quarter = $quarter
    """,
}


def recompute(con: duckdb.DuckDBPyConnection, entity: str, quarter: str) -> list[Recomputed]:
    out = []
    for metric, sql in QUERIES.items():
        try:
            row = con.execute(sql, {"entity": entity, "quarter": quarter}).fetchone()
        except duckdb.CatalogException:
            continue  # the export this metric needs was not submitted
        if row is None or row[0] is None:
            continue
        out.append(Recomputed(metric, float(row[0]), None if row[1] is None else int(row[1]), int(row[2])))
    return out
