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


EXPORTS = ("alerts", "cases", "escalations", "assets", "log_sources", "analysts", "rules")


def connect(warehouse: Path) -> duckdb.DuckDBPyConnection:
    con = duckdb.connect()
    for name in EXPORTS:
        if (warehouse / name).exists():
            _view(con, warehouse, name)
    return con


def quarters(con: duckdb.DuckDBPyConnection, entity: str) -> list[str]:
    """Every quarter the entity submitted any export for, oldest first.
    An entity may leave an export out, so no single table answers this."""
    views = [r[0] for r in con.execute("select view_name from duckdb_views() where not internal").fetchall() if r[0] in EXPORTS]
    if not views:
        return []
    union = " union ".join(f"select distinct quarter from {v} where entity = $entity" for v in views)
    return [r[0] for r in con.execute(f"select quarter from ({union}) order by quarter", {"entity": entity}).fetchall()]


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


# The exports each metric needs in the attested quarter, the same lists as `requires` in
# packages/claims/src/metrics. Without one of them the claim is insufficient evidence,
# not a measured zero, so the metric is left out.
REQUIRES: dict[str, tuple[str, ...]] = {
    "p1_escalated_to_l2_within_30m": ("cases", "escalations", "rules", "assets"),
    "p1_mean_time_to_close": ("cases", "rules", "assets"),
    "p1_mean_time_to_acknowledge": ("alerts",),
    "p2_closed_within_sla": ("cases",),
    "ot_critical_assets_monitored": ("assets", "alerts", "log_sources"),
    "l1_analysts_on_roster": ("analysts",),
}


def submitted(con: duckdb.DuckDBPyConnection, entity: str, quarter: str) -> set[str]:
    """The exports that hold at least one record for this entity and quarter."""
    views = [r[0] for r in con.execute("select view_name from duckdb_views() where not internal").fetchall() if r[0] in EXPORTS]
    params = {"entity": entity, "quarter": quarter}
    return {v for v in views if con.execute(f"select 1 from {v} where entity = $entity and quarter = $quarter limit 1", params).fetchone()}


def recompute(con: duckdb.DuckDBPyConnection, entity: str, quarter: str) -> list[Recomputed]:
    out = []
    present = submitted(con, entity, quarter)
    for metric, sql in QUERIES.items():
        if not set(REQUIRES[metric]) <= present:
            continue
        row = con.execute(sql, {"entity": entity, "quarter": quarter}).fetchone()
        # No records to measure, such as a share of zero critical OT assets, is no evidence, not NaN.
        if row is None or row[0] is None or not row[2]:
            continue
        out.append(Recomputed(metric, float(row[0]), None if row[1] is None else int(row[1]), int(row[2])))
    return out
