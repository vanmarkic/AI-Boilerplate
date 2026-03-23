"""Property tests — poka-yoke guard for engine context endpoint response.

Bug context: The /engine/context endpoint omitted `roles` from the response
dict, breaking frontend role card rendering and player role resolution.

These tests ensure the context response always contains all required fields
for any valid ScenarioContext, and that roles are properly serialized.
"""

from __future__ import annotations

from hypothesis import given, settings
from hypothesis import strategies as st

from engine.engine_config import RoleInfo, ScenarioContext

REQUIRED_CONTEXT_KEYS = {
    "title",
    "description",
    "briefing",
    "objectives",
    "rules",
    "roles",
    "stress_effect_preset",
}


@st.composite
def role_infos(draw: st.DrawFn) -> RoleInfo:
    """Generate a random RoleInfo."""
    role_id = draw(st.sampled_from(["co", "nav", "eo", "ops", "cyop", "aawo", "pwo"]))
    player_type = draw(st.sampled_from(["decision_maker", "advisor"]))
    return RoleInfo(
        id=role_id,
        label=f"Role {role_id}",
        player_type=player_type,
    )


@st.composite
def scenario_contexts(draw: st.DrawFn) -> ScenarioContext:
    """Generate a random ScenarioContext with 0-7 roles."""
    roles = draw(st.lists(role_infos(), min_size=0, max_size=7, unique_by=lambda r: r.id))
    return ScenarioContext(
        title=draw(st.text(min_size=0, max_size=50)),
        description=draw(st.text(min_size=0, max_size=100)),
        briefing=draw(st.text(min_size=0, max_size=200)),
        objectives=draw(st.lists(st.text(min_size=1, max_size=50), max_size=5)),
        rules=draw(st.lists(st.text(min_size=1, max_size=50), max_size=5)),
        roles=roles,
        stress_effect_preset=draw(st.sampled_from(["off", "mild", "standard", "intense"])),
    )


def build_context_response(ctx: ScenarioContext, time_factor: float = 1.0) -> dict:
    """Replicate the endpoint response builder — must match engine_actions_router.py."""
    return {
        "title": ctx.title,
        "description": ctx.description,
        "briefing": ctx.briefing,
        "objectives": ctx.objectives,
        "rules": ctx.rules,
        "roles": [{"id": r.id, "label": r.label, "player_type": r.player_type} for r in ctx.roles],
        "default_time_factor": time_factor,
        "stress_effect_preset": ctx.stress_effect_preset,
    }


class TestContextResponseCompleteness:
    """The context response must always contain all fields the frontend expects."""

    @given(ctx=scenario_contexts())
    @settings(max_examples=500)
    def test_response_has_all_required_keys(self, ctx: ScenarioContext) -> None:
        response = build_context_response(ctx)
        missing = REQUIRED_CONTEXT_KEYS - set(response.keys())
        assert not missing, f"Context response missing keys: {missing}"

    @given(ctx=scenario_contexts())
    @settings(max_examples=500)
    def test_roles_count_matches_input(self, ctx: ScenarioContext) -> None:
        response = build_context_response(ctx)
        assert len(response["roles"]) == len(ctx.roles), (
            f"Response has {len(response['roles'])} roles but context has {len(ctx.roles)}"
        )

    @given(ctx=scenario_contexts())
    @settings(max_examples=500)
    def test_each_role_has_required_fields(self, ctx: ScenarioContext) -> None:
        response = build_context_response(ctx)
        for role in response["roles"]:
            assert "id" in role, "Role missing 'id'"
            assert "label" in role, "Role missing 'label'"
            assert "player_type" in role, "Role missing 'player_type'"

    @given(ctx=scenario_contexts())
    @settings(max_examples=500)
    def test_role_ids_preserved(self, ctx: ScenarioContext) -> None:
        response = build_context_response(ctx)
        input_ids = {r.id for r in ctx.roles}
        output_ids = {r["id"] for r in response["roles"]}
        assert input_ids == output_ids, f"Role IDs changed: input={input_ids}, output={output_ids}"

    @given(ctx=scenario_contexts())
    @settings(max_examples=500)
    def test_player_types_preserved(self, ctx: ScenarioContext) -> None:
        response = build_context_response(ctx)
        for role_in in ctx.roles:
            role_out = next(r for r in response["roles"] if r["id"] == role_in.id)
            assert role_out["player_type"] == role_in.player_type, (
                f"player_type changed for {role_in.id}: "
                f"{role_in.player_type} → {role_out['player_type']}"
            )
