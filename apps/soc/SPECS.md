# SOC Platform — Specification

## Glossary
- **Observable** — an artefact seen in telemetry (IP, domain, URL, hash, email).
  Always stored canonical: refanged, lowercased, no trailing dot.
- **Indicator** — an observable *we* have decided something about. Distinct from
  what an intel source claims, which is **IndicatorIntel**.
- **Event** — one record from a log source. **RawEvent** as received,
  **NormalizedEvent** once understood.
- **Verdict** — the scored triage decision for an event, with every contributing
  reason recorded.
- **Alert** — a persisted, actionable finding. Created unless the disposition is
  DROP.
- **Case** — an investigation. Ours; mirrored into an external case system via an
  opaque **CaseRef**.
- **Playbook run** — a record of an automated response action.
- **dedup_key** — identifies an *event*, so a replay raises no second alert.
- **correlation_key** — identifies an *investigation*, so related alerts converge
  on one case. Deliberately a different key.

## Business Rules

### Triage
- An event from an unconfigured source is rejected, never guessed at.
- Severity is additive and fully explained: every contribution appends a reason.
- Score is clamped to 0–100 so an allowlist penalty cannot produce nonsense.
- An observable on the allowlist suppresses the finding regardless of intel
  confidence; if every observable is allowlisted, the disposition is DROP.
- Crown-jewel assets escalate one severity band earlier than everything else.
- A dropped event is still indexed. Dropping is a triage decision, not data loss.
- A replayed event returns the existing alert rather than raising a second one.

### Enrichment
- Local-first: what we already hold is authoritative and always available.
- An unreachable intel source degrades the verdict and marks it degraded; it never
  fails ingestion.
- On merge, confidence takes the maximum. A source lowering its score must not
  erase a higher-confidence assessment from another. Only decay reduces confidence.
- Allowlisted and revoked indicators are human decisions; decay never overrides them.
- Confidence halves every half-life after a grace period, floored at a configured
  minimum, and expires below a threshold.

### Cases
- Only an ESCALATE disposition opens a case automatically.
- An open case with the same correlation key absorbs the finding instead.
- Closing is terminal: a recurrence afterwards is a new investigation.
- Case severity ratchets upward only.
- The local case is saved before the external system is called. A case-manager
  outage costs a mirror, never the investigation.

### Response
- The highest-priority matching playbook rule wins; ties break by playbook id, so
  selection is deterministic.
- Orchestrators provide no idempotency, so the core supplies its own key and
  enforces it before launching. Containment fires once.
- An alert matching no rule is recorded as skipped, with the reason.

## Known Gaps
- **Persistence is in-memory.** PostgreSQL models, repositories and Alembic
  migrations are not yet written, so state does not survive a restart. The
  repository ports and their contract suites exist, so a relational
  implementation is a drop-in that must pass the same contracts. The target
  schema — six tables, and which constraint makes which rule above structural —
  is specified in `SCHEMA.md`.
- **The dedup and correlation rules are enforced by a read-then-write**, so
  under concurrency two callers can both read "absent" and both insert. The
  `UNIQUE` and partial-unique constraints in `SCHEMA.md` are what make them
  real. "Containment fires once" has a second hole that persistence does *not*
  close: `adapters/resilient_client.py` retries `POST` on transport errors, so
  a timed-out launch can start a workflow twice below the idempotency guard.
- Endpoints are not yet behind `Depends(get_current_user)`; `core/auth.py` is in
  place but not applied to routers.
- Threat-intel sync and the scheduled confidence-decay sweep have use-case-level
  designs but no endpoints or schedulers.
