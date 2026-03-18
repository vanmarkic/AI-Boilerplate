#!/usr/bin/env python3
"""Lightweight mutation tester for TFC engine tests.

Applies targeted mutations to source files, runs the test suite, and
reports which mutations were killed (test failed) vs survived (test passed).

Usage:
    python mutation_test.py

A surviving mutant means our tests don't detect that code change — a gap.
"""

from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

# ── Configuration ────────────────────────────────────────────────────────

TEST_CMD = [
    sys.executable,
    "-m",
    "pytest",
    "features/exercise/engine_state_machine_test.py",
    "features/exercise/engine_decision_chain_test.py",
    "features/exercise/engine_lifecycle_e2e_test.py",
    "features/exercise/engine_broadcast_test.py",
    "features/exercise/engine_game_mode_test.py",
    "-x",
    "-q",
    "--tb=no",
    "--no-header",
]


@dataclass
class Mutation:
    """A single mutation to apply."""

    file: str
    description: str
    original: str
    mutated: str


MUTATIONS: list[Mutation] = [
    # ── exercise_engine.py: State machine guard mutations ────────────────
    Mutation(
        file="engine/exercise_engine.py",
        description="start(): remove SETUP from allowed phases (should break start-from-setup)",
        original="if self._phase not in {EnginePhase.SETUP, EnginePhase.PAUSED}:",
        mutated="if self._phase not in {EnginePhase.PAUSED}:",
    ),
    Mutation(
        file="engine/exercise_engine.py",
        description="start(): remove PAUSED from allowed phases (should break resume)",
        original="if self._phase not in {EnginePhase.SETUP, EnginePhase.PAUSED}:",
        mutated="if self._phase not in {EnginePhase.SETUP}:",
    ),
    Mutation(
        file="engine/exercise_engine.py",
        description="pause(): allow pause from any phase (remove guard)",
        original="if self._phase != EnginePhase.RUNNING:",
        mutated="if False:",
    ),
    Mutation(
        file="engine/exercise_engine.py",
        description="complete(): allow complete from SETUP (weaken guard)",
        original="if self._phase in {EnginePhase.COMPLETED, EnginePhase.SETUP}:",
        mutated="if self._phase in {EnginePhase.COMPLETED}:",
    ),
    Mutation(
        file="engine/exercise_engine.py",
        description="complete(): set phase to PAUSED instead of COMPLETED",
        original="self._phase = EnginePhase.COMPLETED\n        self._time.pause()",
        mutated="self._phase = EnginePhase.PAUSED\n        self._time.pause()",
    ),
    Mutation(
        file="engine/exercise_engine.py",
        description="start(): set phase to PAUSED instead of RUNNING",
        original="self._phase = EnginePhase.RUNNING\n        self._time.start()",
        mutated="self._phase = EnginePhase.PAUSED\n        self._time.start()",
    ),
    Mutation(
        file="engine/exercise_engine.py",
        description="reset(): set phase to RUNNING instead of SETUP",
        original="self._phase = EnginePhase.SETUP\n        self._time.reset()",
        mutated="self._phase = EnginePhase.RUNNING\n        self._time.reset()",
    ),
    # ── exercise_engine.py: Decision-on-pause mutation ──────────────────
    Mutation(
        file="engine/exercise_engine.py",
        description="should_pause_on_decision: negate the check (classic won't pause)",
        original="if self._config.game_mode.should_pause_on_decision():",
        mutated="if not self._config.game_mode.should_pause_on_decision():",
    ),
    # ── decision_manager.py mutations ───────────────────────────────────
    Mutation(
        file="engine/decision_manager.py",
        description="open_decision: set status to 'closed' instead of 'open'",
        original='status="open",',
        mutated='status="closed",',
    ),
    Mutation(
        file="engine/decision_manager.py",
        description="close_decision: skip setting status to closed",
        original='decision.status = "closed"',
        mutated='pass  # decision.status = "closed"',
    ),
    # ── simple_collaborative.py mutations ───────────────────────────────
    Mutation(
        file="engine/game_modes/simple_collaborative.py",
        description="on_decision_closed: don't accumulate penalty",
        original="self.accumulated_penalty_ms += penalty_ms",
        mutated="pass  # self.accumulated_penalty_ms += penalty_ms",
    ),
    Mutation(
        file="engine/game_modes/simple_collaborative.py",
        description="on_decision_closed: don't add to total_score",
        original="self.total_score += selected_score",
        mutated="pass  # self.total_score += selected_score",
    ),
    Mutation(
        file="engine/game_modes/simple_collaborative.py",
        description="on_decision_closed: don't advance current_index (breaks chaining)",
        original="self.current_index += 1",
        mutated="pass  # self.current_index += 1",
    ),
    Mutation(
        file="engine/game_modes/simple_collaborative.py",
        description="should_pause_on_decision: return True (should break collab mode)",
        original="    def should_pause_on_decision(self) -> bool:\n        return False",
        mutated="    def should_pause_on_decision(self) -> bool:\n        return True",
    ),
    Mutation(
        file="engine/game_modes/simple_collaborative.py",
        description="requires_gm: return True (should break collab mode test)",
        original="    def requires_gm(self) -> bool:\n        return False",
        mutated="    def requires_gm(self) -> bool:\n        return True",
    ),
    # ── classic.py mutations ────────────────────────────────────────────
    Mutation(
        file="engine/game_modes/classic.py",
        description="should_pause_on_decision: return False (should break classic mode)",
        original="    def should_pause_on_decision(self) -> bool:\n        return True",
        mutated="    def should_pause_on_decision(self) -> bool:\n        return False",
    ),
    Mutation(
        file="engine/game_modes/classic.py",
        description="requires_gm: return False (should break classic mode test)",
        original="    def requires_gm(self) -> bool:\n        return True",
        mutated="    def requires_gm(self) -> bool:\n        return False",
    ),
    # ── forced card mutation ────────────────────────────────────────────
    Mutation(
        file="engine/game_modes/simple_collaborative.py",
        description="on_decision_closed_v2: skip forced card enforcement",
        original="forced_ids = forced_option_ids or []",
        mutated="forced_ids = []",
    ),
]


def run_mutation(mutation: Mutation) -> tuple[str, bool]:
    """Apply mutation, run tests, restore. Returns (description, killed)."""
    path = Path(mutation.file)
    original_content = path.read_text()

    if mutation.original not in original_content:
        return mutation.description, False  # can't apply — treat as survived

    mutated_content = original_content.replace(
        mutation.original,
        mutation.mutated,
        1,
    )
    path.write_text(mutated_content)

    try:
        result = subprocess.run(
            TEST_CMD,
            capture_output=True,
            timeout=60,
        )
        killed = result.returncode != 0
    except subprocess.TimeoutExpired:
        killed = True  # timeout counts as killed
    finally:
        path.write_text(original_content)

    return mutation.description, killed


def main() -> None:
    print(f"Running {len(MUTATIONS)} mutations against behavioral tests...\n")
    killed = 0
    survived = 0
    _not_applicable = 0
    survivors: list[str] = []

    for i, mutation in enumerate(MUTATIONS, 1):
        desc, was_killed = run_mutation(mutation)
        status = "KILLED" if was_killed else "SURVIVED"
        icon = "✓" if was_killed else "✗"
        source = mutation.file.split("/")[-1]
        print(f"  [{i:2d}/{len(MUTATIONS)}] {icon} {status}: {source}: {desc}")
        if was_killed:
            killed += 1
        else:
            survived += 1
            survivors.append(f"  - {source}: {desc}")

    total = killed + survived
    score = (killed / total * 100) if total > 0 else 0

    print(f"\n{'=' * 60}")
    print(f"Mutation score: {killed}/{total} killed ({score:.0f}%)")
    print(f"  Killed:   {killed}")
    print(f"  Survived: {survived}")

    if survivors:
        print("\nSurviving mutants (test gaps):")
        for s in survivors:
            print(s)

    sys.exit(0 if survived == 0 else 1)


if __name__ == "__main__":
    main()
