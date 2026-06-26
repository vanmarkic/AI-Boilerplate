"""JsonlFileSink — an append-only JSON-Lines :class:`ExternalSink`.

This is the **reference sink implementation** for the audit-framework plugin
system: the simplest possible adapter, written so a customer can copy it as the
template for their own sink (Splunk HEC, Elasticsearch, syslog, …). The recipe
every sink follows:

1.  Expose a stable :pyattr:`sink_name` (matched against ``AuditPolicy.sinks``).
2.  Implement ``async emit(event, context)`` — forward one event, best-effort.
3.  Implement ``async health_check()`` — report whether the downstream is usable.
4.  Register the class in a ``register(registry)`` function (see ``plugin.py``).

This sink appends one compact JSON object per line to a file. Writes are
serialised with an :class:`asyncio.Lock` and offloaded with
:func:`asyncio.to_thread`, so concurrent ``emit`` calls neither interleave nor
block the event loop. Optional rotation is supported by date (one file per UTC
day) and/or by size (roll the current file aside once it would exceed a byte
threshold).

Only the standard library is used here; the ``audit_framework`` import is for
type hints and is part of this plugin's declared dependency.
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Optional

from audit_framework.core.models import AuditEvent, PipelineContext

__all__ = ["JsonlFileSink"]


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class JsonlFileSink:
    """Appends each audit event as one JSON line to a file.

    Parameters
    ----------
    path:
        Destination file (its parent directories are created on demand).
    name:
        The :pyattr:`sink_name` used for per-policy sink filtering.
    daily:
        When True, write to a date-stamped file ``<stem>-YYYY-MM-DD<suffix>``
        so each UTC day gets its own file.
    max_bytes:
        When set, roll the current file aside (``<stem>.<timestamp><suffix>``)
        before a write that would push it past this size. Composes with
        ``daily``.
    clock:
        Injectable time source (returns an aware :class:`datetime`); used for
        rotation stamps. Defaults to ``datetime.now(timezone.utc)``.
    """

    def __init__(
        self,
        path: str | os.PathLike[str],
        *,
        name: str = "file_jsonl",
        daily: bool = False,
        max_bytes: Optional[int] = None,
        clock: Callable[[], datetime] = _utc_now,
    ) -> None:
        self._base = Path(path)
        self._name = name
        self._daily = daily
        self._max_bytes = max_bytes
        self._clock = clock
        self._lock = asyncio.Lock()

    @property
    def sink_name(self) -> str:
        """Stable identifier matched against ``AuditPolicy.sinks``."""
        return self._name

    async def emit(self, event: AuditEvent, context: PipelineContext) -> None:
        """Append ``event`` (as one JSON line) to the current target file.

        Best-effort and serialised: a raised OSError propagates so the
        ``SinkFanOutMiddleware`` can record the failure, but it never corrupts a
        concurrent write (the lock guarantees one writer at a time).
        """
        line = json.dumps(
            event.to_dict(), separators=(",", ":"), ensure_ascii=False, default=str
        )
        async with self._lock:
            await asyncio.to_thread(self._write, line)

    async def health_check(self) -> bool:
        """Return True if the target directory exists (or can be) and is writable."""
        return await asyncio.to_thread(self._check_writable)

    # ----------------------------------------------------------------- #
    # Blocking helpers (run inside asyncio.to_thread)                    #
    # ----------------------------------------------------------------- #
    def _write(self, line: str) -> None:
        path = self._target_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        if self._max_bytes is not None and path.exists():
            projected = path.stat().st_size + len(line.encode("utf-8")) + 1
            if projected > self._max_bytes:
                self._rollover(path)
        with path.open("a", encoding="utf-8") as fh:
            fh.write(line + "\n")

    def _check_writable(self) -> bool:
        try:
            parent = self._base.parent
            parent.mkdir(parents=True, exist_ok=True)
            return os.access(parent, os.W_OK)
        except OSError:
            return False

    def _target_path(self) -> Path:
        if not self._daily:
            return self._base
        stamp = self._clock().strftime("%Y-%m-%d")
        return self._base.with_name(f"{self._base.stem}-{stamp}{self._base.suffix}")

    def _rollover(self, path: Path) -> None:
        stamp = self._clock().strftime("%Y%m%dT%H%M%S")
        target = path.with_name(f"{path.stem}.{stamp}{path.suffix}")
        suffix = 0
        while target.exists():  # never clobber an existing rolled file
            suffix += 1
            target = path.with_name(f"{path.stem}.{stamp}.{suffix}{path.suffix}")
        path.rename(target)
