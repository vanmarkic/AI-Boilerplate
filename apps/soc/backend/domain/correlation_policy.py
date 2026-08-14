"""Correlation and deduplication keys.

The correlation key decides whether two findings belong to the same
investigation. It is order-insensitive over observables and bucketed in time,
so the same campaign hitting the same host converges on one case instead of
opening dozens.
"""

import hashlib
from collections.abc import Sequence
from datetime import datetime

from domain.case_entity import TERMINAL_STATUSES, Case
from domain.event_entity import NormalizedEvent
from domain.observable_entity import Observable
from domain.verdict_entity import Disposition, TriageVerdict

DEFAULT_BUCKET_HOURS = 24


def _time_bucket(moment: datetime, bucket_hours: int) -> str:
    """Return a stable label for the time window a moment falls in."""
    if bucket_hours <= 0:
        return moment.isoformat()
    epoch_hours = int(moment.timestamp()) // 3600
    return str(epoch_hours // bucket_hours)


def _observable_fingerprint(observables: Sequence[Observable]) -> str:
    """Return an order-insensitive fingerprint of a set of observables."""
    return ",".join(sorted(str(o) for o in set(observables)))


def correlation_key(
    event: NormalizedEvent,
    verdict: TriageVerdict,
    bucket_hours: int = DEFAULT_BUCKET_HOURS,
) -> str:
    """Return the key grouping findings into one investigation.

    Only observables that actually matched intel take part: unmatched noise
    would make otherwise-identical findings look distinct.
    """
    material = "|".join(
        (
            event.host or "",
            event.category,
            _observable_fingerprint(verdict.matched),
            _time_bucket(event.occurred_at, bucket_hours),
        )
    )
    return hashlib.sha256(material.encode()).hexdigest()


def should_open_case(verdict: TriageVerdict, existing: Case | None) -> bool:
    """Return True if this verdict warrants opening a new case.

    An open case for the same correlation key absorbs the finding instead.
    """
    if verdict.disposition is not Disposition.ESCALATE:
        return False
    if existing is None:
        return True
    return existing.status in TERMINAL_STATUSES
