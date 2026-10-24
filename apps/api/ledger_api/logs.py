"""Structured logs. Every line on stderr is one JSON object, so jq or a log shipper on the
examiner's machine can filter by field. Context goes in `extra={"ctx": {...}}`."""

from __future__ import annotations

import json
import logging
import sys
from datetime import UTC, datetime

LOGGER = "ledger_api"


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, object] = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname.lower(),
            "logger": record.name,
            "msg": record.getMessage(),
        }
        ctx = getattr(record, "ctx", None)
        if isinstance(ctx, dict):
            entry.update(ctx)
        if record.exc_info:
            entry["exc_type"] = record.exc_info[0].__name__ if record.exc_info[0] else None
            entry["exc"] = self.formatException(record.exc_info)
        return json.dumps(entry, default=str)


def configure(level: int | str = logging.INFO) -> logging.Logger:
    """Send the service's logs to stderr as JSON. Safe to call more than once."""
    log = logging.getLogger(LOGGER)
    if not any(isinstance(h.formatter, JsonFormatter) for h in log.handlers):
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(JsonFormatter())
        log.addHandler(handler)
    log.setLevel(level)
    log.propagate = False
    return log
