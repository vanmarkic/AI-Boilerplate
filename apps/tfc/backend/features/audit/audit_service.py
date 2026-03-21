from features.audit.audit_model import AuditEntry
from features.audit.audit_repository import AuditRepository
from features.audit.audit_schema import AuditEntryResponse, CreateAuditEntry


class AuditService:
    def __init__(self, repository: AuditRepository) -> None:
        self.repository = repository

    async def log(self, request: CreateAuditEntry) -> AuditEntryResponse:
        entry = AuditEntry(
            exercise_id=request.exercise_id,
            entry_type=request.entry_type,
            action=request.action,
            actor_id=request.actor_id,
            actor_name=request.actor_name,
            target_type=request.target_type,
            target_id=request.target_id,
            play_time_ms=request.play_time_ms,
            real_time_ms=request.real_time_ms,
            details=request.details,
        )
        created = await self.repository.create(entry)
        return AuditEntryResponse.model_validate(created)

    async def get_exercise_log(
        self,
        exercise_id: int,
        entry_type: str | None = None,
    ) -> list[AuditEntryResponse]:
        entries = await self.repository.list_by_exercise(
            exercise_id,
            entry_type=entry_type,
        )
        return [AuditEntryResponse.model_validate(e) for e in entries]

    async def log_engine_changes(
        self,
        exercise_id: int,
        changes: list[dict],
        play_time_ms: float,
        real_time_ms: float,
    ) -> None:
        """Batch-log engine state changes to the audit trail."""
        for change in changes:
            change_type = change.get("type", "unknown")
            # Derive a human-readable action from the change type
            action = change.get("action") or change.get("lifecycle")
            if not action:
                if change_type == "decision_closed":
                    action = "decided"
                elif change_type == "decision_opened":
                    action = "opened"
                elif change_type == "score_change":
                    action = "scored"
                else:
                    action = "unknown"
            entry = AuditEntry(
                exercise_id=exercise_id,
                entry_type=change_type,
                action=action,
                target_type=change_type.replace("_change", "").replace("_closed", "").replace("_opened", ""),
                target_id=change.get("decision_id") or change.get("event_id") or change.get("issue_id"),
                play_time_ms=play_time_ms,
                real_time_ms=real_time_ms,
                details=change,
            )
            self.repository.session.add(entry)
