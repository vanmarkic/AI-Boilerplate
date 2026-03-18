"""Shared broadcast helpers for engine routers."""
from __future__ import annotations

from features.exercise.adapters.connection_manager import ConnectionManager


def split_targeted_changes(
    changes: list[dict],
) -> tuple[list[tuple[list[str], list[dict]]], list[dict]]:
    """Split changes into role-targeted decisions and general changes."""
    general: list[dict] = []
    by_roles: dict[tuple[str, ...], list[dict]] = {}
    for change in changes:
        target_roles = change.get("target_roles", [])
        if change.get("type") == "decision_opened" and target_roles:
            key = tuple(sorted(target_roles))
            by_roles.setdefault(key, []).append(change)
        else:
            general.append(change)
    targeted = [(list(k), v) for k, v in by_roles.items()]
    return targeted, general


async def broadcast_to_roles(
    mgr: ConnectionManager,
    exercise_id: int,
    roles: list[str],
    changes: list[dict],
) -> None:
    """Broadcast changes to specific roles + always to gm."""
    msg = {"type": "state_changes", "changes": changes}
    for role in roles:
        await mgr.broadcast_to_role(exercise_id, role, msg)
    if "gm" not in roles:
        await mgr.broadcast_to_role(exercise_id, "gm", msg)


async def broadcast_changes(
    mgr: ConnectionManager,
    exercise_id: int,
    changes: list[dict],
) -> None:
    """Broadcast changes, splitting role-targeted decisions."""
    targeted, general = split_targeted_changes(changes)
    if general:
        await mgr.broadcast(exercise_id, {"type": "state_changes", "changes": general})
    for roles, role_changes in targeted:
        await broadcast_to_roles(mgr, exercise_id, roles, role_changes)
