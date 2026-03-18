# TFC Practice Mode — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add single-player "Practice Mode" to TFC's `simple_collaborative` game mode, allowing one person to play all roles (advisors + decision-maker) for training and scenario testing.

**Architecture:** Practice mode is a boolean flag on the Exercise model — not a new game mode. The `SimpleCollaborativeMode` engine stays untouched. The waiting room enforces `max_players=1`, and the frontend adds a two-phase decision flow (advisor recommendations first, then decision-maker view) gated by local component state.

**Tech Stack:** Python/FastAPI (backend), SQLAlchemy + Alembic (DB), Angular 21 + ngrx/signals (frontend), Playwright (E2E)

**Design doc:** `docs/plans/2026-03-18-tfc-practice-mode-design.md`

---

## Task 1: Database Migration — `practice_mode` Column

**Files:**
- Create: `apps/tfc/backend/alembic/versions/006_add_practice_mode.py`

**Step 1: Write the migration**

```python
"""Add practice_mode column to tfc_exercises.

Revision ID: 006_add_practice_mode
Revises: 005_update_default_terminology
Create Date: 2026-03-18
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "006_add_practice_mode"
down_revision: str | None = "005_update_default_terminology"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "tfc_exercises",
        sa.Column("practice_mode", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )


def downgrade() -> None:
    op.drop_column("tfc_exercises", "practice_mode")
```

**Step 2: Verify migration runs**

Run from `apps/tfc/backend`:
```bash
cd apps/tfc/backend && python -m alembic upgrade head
```
Expected: Migration applies without error.

**Step 3: Verify downgrade**

```bash
cd apps/tfc/backend && python -m alembic downgrade 005_update_default_terminology && python -m alembic upgrade head
```
Expected: Downgrade + re-upgrade works cleanly.

**Step 4: Commit**

```bash
git add apps/tfc/backend/alembic/versions/006_add_practice_mode.py
git commit -m "feat(tfc): add practice_mode column migration"
```

---

## Task 2: Exercise Model — Add `practice_mode` Field

**Files:**
- Modify: `apps/tfc/backend/features/exercise/exercise_model.py` (line 31, after `game_mode`)

**Step 1: Write failing test**

Create test in existing test patterns. The model test is implicitly tested via the API in Task 3, so we modify the model now and test through the schema/service in Task 3.

**Step 2: Add the column to the model**

In `apps/tfc/backend/features/exercise/exercise_model.py`, add after line 31 (`game_mode`):

```python
practice_mode: Mapped[bool] = mapped_column(default=False)
```

**Step 3: Verify model loads**

```bash
cd apps/tfc/backend && python -c "from features.exercise.exercise_model import Exercise; print('OK')"
```
Expected: `OK`

**Step 4: Commit**

```bash
git add apps/tfc/backend/features/exercise/exercise_model.py
git commit -m "feat(tfc): add practice_mode to Exercise model"
```

---

## Task 3: Schema & Service — Accept `practice_mode` in API

**Files:**
- Modify: `apps/tfc/backend/features/exercise/exercise_schema.py`
- Modify: `apps/tfc/backend/features/exercise/exercise_service.py` (line 34-42)

**Step 1: Write the failing test**

Create `apps/tfc/backend/features/exercise/practice_mode_test.py`:

```python
"""Tests for practice_mode flag on exercises."""

from __future__ import annotations

import pytest
from httpx import AsyncClient


async def _create_scenario(client: AsyncClient) -> int:
    resp = await client.post(
        "/api/scenarios",
        json={
            "title": "Practice Scenario",
            "content": {
                "phases": [],
                "events": [],
                "issues": [],
                "decision_templates": [],
                "default_time_factor": 1.0,
                "briefing": "Test",
                "objectives": [],
                "rules": [],
                "game_mode": "simple_collaborative",
                "game_mode_config": {},
                "decision_sequence": [],
                "roles": [
                    {"id": "co", "label": "CO", "player_type": "decision_maker"},
                    {"id": "nav", "label": "NAV", "player_type": "advisor"},
                ],
            },
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


class TestPracticeModeCreation:
    @pytest.mark.asyncio
    async def test_create_exercise_with_practice_mode(
        self,
        client: AsyncClient,
    ) -> None:
        resp = await client.post(
            "/api/exercises",
            json={
                "title": "Solo Practice",
                "game_mode": "simple_collaborative",
                "practice_mode": True,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["practice_mode"] is True

    @pytest.mark.asyncio
    async def test_create_exercise_defaults_practice_mode_false(
        self,
        client: AsyncClient,
    ) -> None:
        resp = await client.post(
            "/api/exercises",
            json={"title": "Normal", "game_mode": "simple_collaborative"},
        )
        assert resp.status_code == 201
        assert resp.json()["practice_mode"] is False

    @pytest.mark.asyncio
    async def test_practice_mode_requires_simple_collaborative(
        self,
        client: AsyncClient,
    ) -> None:
        resp = await client.post(
            "/api/exercises",
            json={
                "title": "Bad",
                "game_mode": "classic",
                "practice_mode": True,
            },
        )
        assert resp.status_code == 400

    @pytest.mark.asyncio
    async def test_get_exercise_returns_practice_mode(
        self,
        client: AsyncClient,
    ) -> None:
        create_resp = await client.post(
            "/api/exercises",
            json={
                "title": "Solo",
                "game_mode": "simple_collaborative",
                "practice_mode": True,
            },
        )
        eid = create_resp.json()["id"]
        resp = await client.get(f"/api/exercises/{eid}")
        assert resp.status_code == 200
        assert resp.json()["practice_mode"] is True
```

**Step 2: Run test to verify it fails**

```bash
cd apps/tfc/backend && python -m pytest features/exercise/practice_mode_test.py -v
```
Expected: FAIL — `practice_mode` not in schema.

**Step 3: Update schema**

In `apps/tfc/backend/features/exercise/exercise_schema.py`:

Add to `CreateExerciseRequest` (after line 16):
```python
practice_mode: bool = False
```

Add to `UpdateExerciseRequest` (after line 26):
```python
practice_mode: bool | None = None
```

Add to `ExerciseResponse` (after line 38):
```python
practice_mode: bool
```

**Step 4: Update service validation**

In `apps/tfc/backend/features/exercise/exercise_service.py`, in `create_exercise` method, add after line 33 (after game_mode validation):

```python
if request.practice_mode and request.game_mode != "simple_collaborative":
    raise BadRequestError(
        "practice_mode requires game_mode 'simple_collaborative'"
    )
```

And update the `Exercise(...)` constructor (line 34-42) to include:
```python
practice_mode=request.practice_mode,
```

**Step 5: Run tests to verify they pass**

```bash
cd apps/tfc/backend && python -m pytest features/exercise/practice_mode_test.py -v
```
Expected: All 4 tests PASS.

**Step 6: Run existing tests for regressions**

```bash
cd apps/tfc/backend && python -m pytest features/exercise/ -v
```
Expected: All existing tests still PASS.

**Step 7: Commit**

```bash
git add apps/tfc/backend/features/exercise/exercise_schema.py \
       apps/tfc/backend/features/exercise/exercise_service.py \
       apps/tfc/backend/features/exercise/practice_mode_test.py
git commit -m "feat(tfc): accept practice_mode in exercise API"
```

---

## Task 4: Joinable Exercises — Filter Out Practice Mode

**Files:**
- Modify: `apps/tfc/backend/features/exercise/exercise_router.py` (lines 57-98, `list_joinable_exercises`)
- Modify: `apps/tfc/backend/features/exercise/exercise_joinable_test.py`

**Step 1: Write the failing test**

Add to `apps/tfc/backend/features/exercise/exercise_joinable_test.py`, inside `TestJoinableEndpoint`:

```python
@pytest.mark.asyncio
async def test_excludes_practice_mode_exercises(
    self,
    client: AsyncClient,
) -> None:
    sid = await _create_scenario_with_roles(client, TWO_ROLES)
    # Create a practice mode exercise
    resp = await client.post(
        "/api/exercises",
        json={
            "title": "Practice",
            "scenario_id": sid,
            "game_mode": "simple_collaborative",
            "practice_mode": True,
        },
    )
    assert resp.status_code == 201

    resp = await client.get("/api/exercises/joinable")
    assert resp.status_code == 200
    assert resp.json() == []
```

**Step 2: Run test to verify it fails**

```bash
cd apps/tfc/backend && python -m pytest features/exercise/exercise_joinable_test.py::TestJoinableEndpoint::test_excludes_practice_mode_exercises -v
```
Expected: FAIL — practice exercise appears in joinable list.

**Step 3: Add filter to joinable endpoint**

In `apps/tfc/backend/features/exercise/exercise_router.py`, inside `list_joinable_exercises`, add after line 61 (`if exercise.scenario_id is None: continue`):

```python
if exercise.practice_mode:
    continue
```

**Step 4: Run test to verify it passes**

```bash
cd apps/tfc/backend && python -m pytest features/exercise/exercise_joinable_test.py -v
```
Expected: All joinable tests PASS.

**Step 5: Commit**

```bash
git add apps/tfc/backend/features/exercise/exercise_router.py \
       apps/tfc/backend/features/exercise/exercise_joinable_test.py
git commit -m "feat(tfc): exclude practice mode from joinable list"
```

---

## Task 5: Waiting Room — Override `max_players` for Practice Mode

**Files:**
- Modify: `apps/tfc/backend/features/waiting_room/waiting_room_router.py` (lines 63-98, `join_waiting_room`)

**Step 1: Write the failing test**

Add to `apps/tfc/backend/features/exercise/practice_mode_test.py`:

```python
from features.waiting_room.waiting_room_store import waiting_room_store


@pytest.fixture(autouse=True)
def _reset_waiting_room() -> None:
    waiting_room_store._rooms.clear()


class TestPracticeModeWaitingRoom:
    @pytest.mark.asyncio
    async def test_practice_mode_allows_single_player(
        self,
        client: AsyncClient,
    ) -> None:
        sid = await _create_scenario(client)
        resp = await client.post(
            "/api/exercises",
            json={
                "title": "Solo",
                "scenario_id": sid,
                "game_mode": "simple_collaborative",
                "practice_mode": True,
            },
        )
        eid = resp.json()["id"]

        join_resp = await client.post(
            f"/api/exercises/{eid}/waiting-room/join",
            json={"display_name": "Solo Player", "role": "solo_player"},
        )
        assert join_resp.status_code == 200

    @pytest.mark.asyncio
    async def test_practice_mode_rejects_second_player(
        self,
        client: AsyncClient,
    ) -> None:
        sid = await _create_scenario(client)
        resp = await client.post(
            "/api/exercises",
            json={
                "title": "Solo",
                "scenario_id": sid,
                "game_mode": "simple_collaborative",
                "practice_mode": True,
            },
        )
        eid = resp.json()["id"]

        await client.post(
            f"/api/exercises/{eid}/waiting-room/join",
            json={"display_name": "Player 1", "role": "solo_player"},
        )
        resp2 = await client.post(
            f"/api/exercises/{eid}/waiting-room/join",
            json={"display_name": "Player 2", "role": "other"},
        )
        assert resp2.status_code == 409
```

**Step 2: Run test to verify it fails**

```bash
cd apps/tfc/backend && python -m pytest features/exercise/practice_mode_test.py::TestPracticeModeWaitingRoom -v
```
Expected: First test FAILS — `solo_player` is not a valid scenario role, and `max_players` is 2 (from scenario roles), not 1.

**Step 3: Update waiting room router**

In `apps/tfc/backend/features/waiting_room/waiting_room_router.py`, modify `join_waiting_room` (lines 63-98).

Replace the capacity check block (lines 76-87) with:

```python
if roles is not None:
    # Check if exercise is in practice mode
    exercise_obj = await exercise_service.get_exercise(exercise_id)
    if exercise_obj.practice_mode:
        max_players = 1
    else:
        max_players = len(roles)
    if waiting_room_store.count(exercise_id) >= max_players:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Waiting room is full",
        )
    # Skip role uniqueness check for practice mode (synthetic role)
    if not exercise_obj.practice_mode and waiting_room_store.is_role_taken(
        exercise_id, body.role
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Role '{body.role}' is already taken",
        )
```

**Step 4: Run tests to verify they pass**

```bash
cd apps/tfc/backend && python -m pytest features/exercise/practice_mode_test.py -v
```
Expected: All practice mode tests PASS.

**Step 5: Run waiting room tests for regressions**

```bash
cd apps/tfc/backend && python -m pytest features/waiting_room/ -v
```
Expected: All existing waiting room tests still PASS.

**Step 6: Commit**

```bash
git add apps/tfc/backend/features/waiting_room/waiting_room_router.py \
       apps/tfc/backend/features/exercise/practice_mode_test.py
git commit -m "feat(tfc): enforce max_players=1 for practice mode"
```

---

## Task 6: Scenario Loader — Apply 1.5x Timer Multiplier

**Files:**
- Modify: `apps/tfc/backend/features/scenario/scenario_loader.py` (lines 83-110, `build_engine_config`)

**Step 1: Write the failing test**

Add to `apps/tfc/backend/features/exercise/practice_mode_test.py`:

```python
from features.scenario.scenario_loader import build_engine_config
from features.scenario.scenario_content import ScenarioContent


class TestPracticeModeTimer:
    def test_practice_mode_applies_timer_multiplier(self) -> None:
        content = ScenarioContent.model_validate({
            "phases": [],
            "events": [],
            "issues": [],
            "decision_templates": [],
            "default_time_factor": 1.0,
            "briefing": "Test",
            "objectives": [],
            "rules": [],
            "game_mode": "simple_collaborative",
            "game_mode_config": {"base_decision_time_ms": 300_000},
            "decision_sequence": [],
            "roles": [
                {"id": "co", "label": "CO", "player_type": "decision_maker"},
                {"id": "nav", "label": "NAV", "player_type": "advisor"},
            ],
        })
        config = build_engine_config(1, "Test", content, practice_mode=True)
        assert config.game_mode.base_decision_time_ms == 450_000  # 300k * 1.5

    def test_normal_mode_keeps_base_timer(self) -> None:
        content = ScenarioContent.model_validate({
            "phases": [],
            "events": [],
            "issues": [],
            "decision_templates": [],
            "default_time_factor": 1.0,
            "briefing": "Test",
            "objectives": [],
            "rules": [],
            "game_mode": "simple_collaborative",
            "game_mode_config": {"base_decision_time_ms": 300_000},
            "decision_sequence": [],
            "roles": [
                {"id": "co", "label": "CO", "player_type": "decision_maker"},
                {"id": "nav", "label": "NAV", "player_type": "advisor"},
            ],
        })
        config = build_engine_config(1, "Test", content, practice_mode=False)
        assert config.game_mode.base_decision_time_ms == 300_000
```

**Step 2: Run test to verify it fails**

```bash
cd apps/tfc/backend && python -m pytest features/exercise/practice_mode_test.py::TestPracticeModeTimer -v
```
Expected: FAIL — `build_engine_config` doesn't accept `practice_mode` parameter.

**Step 3: Update `build_engine_config`**

In `apps/tfc/backend/features/scenario/scenario_loader.py`, modify the function signature (line 83-86):

```python
def build_engine_config(
    exercise_id: int,
    title: str,
    content: ScenarioContent,
    *,
    practice_mode: bool = False,
) -> EngineConfig:
```

And after `game_mode = create_game_mode(content.game_mode, mode_config)` (line 100), add:

```python
if practice_mode and hasattr(game_mode, "base_decision_time_ms"):
    game_mode.base_decision_time_ms = int(game_mode.base_decision_time_ms * 1.5)
```

**Step 4: Run tests to verify they pass**

```bash
cd apps/tfc/backend && python -m pytest features/exercise/practice_mode_test.py::TestPracticeModeTimer -v
```
Expected: Both tests PASS.

**Step 5: Update the engine start callsite**

Find where `build_engine_config` is called and pass `practice_mode` from the exercise. Search for the call:

```bash
cd apps/tfc/backend && grep -rn "build_engine_config" --include="*.py"
```

Update the callsite (likely in `engine_decision_service.py` or `engine_router.py`) to pass `practice_mode=exercise.practice_mode`.

**Step 6: Run full backend test suite**

```bash
cd apps/tfc/backend && python -m pytest -v
```
Expected: All tests PASS.

**Step 7: Commit**

```bash
git add apps/tfc/backend/features/scenario/scenario_loader.py \
       apps/tfc/backend/features/exercise/practice_mode_test.py
# Also add the callsite file that was updated
git commit -m "feat(tfc): apply 1.5x timer multiplier in practice mode"
```

---

## Task 7: Frontend Store — Add `practiceMode` Signal

**Files:**
- Modify: `apps/tfc/frontend/src/app/core/exercise.store.ts`

**Step 1: Add `practiceMode` to state**

In `apps/tfc/frontend/src/app/core/exercise.store.ts`:

Add to `ExerciseState` interface (after `gameMode: string` on line 35):
```typescript
practiceMode: boolean;
```

Add to `initialState` (after `gameMode: "classic"` on line 57):
```typescript
practiceMode: false,
```

Add computed signal in `withComputed` (after `isAllAdvisors` on line 126):
```typescript
isPracticeMode: computed(() => store.practiceMode()),
```

Add method in `withMethods` (after `setGameMode` on line 241-243):
```typescript
setPracticeMode(practice: boolean): void {
  patchState(store, { practiceMode: practice });
},
```

**Step 2: Commit**

```bash
git add apps/tfc/frontend/src/app/core/exercise.store.ts
git commit -m "feat(tfc): add practiceMode signal to ExerciseStore"
```

---

## Task 8: Frontend Waiting Room — Player-Count Selector

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/waiting-room/waiting-room-view.ts`

**Step 1: Replace checkbox with segmented control**

In `apps/tfc/frontend/src/app/features/waiting-room/waiting-room-view.ts`:

Add a new constant after `TWO_PLAYER_ROLES` (line 28):
```typescript
const PRACTICE_ROLE = { id: "solo_player", label: "All Roles — You" };

type PlayerCountMode = "full" | "two_player" | "practice";
```

Replace the `twoPlayerMode` signal (line 147) with:
```typescript
protected readonly playerCountMode = signal<PlayerCountMode>("full");
```

Add a computed for backwards-compat:
```typescript
protected readonly twoPlayerMode = computed(
  () => this.playerCountMode() === "two_player",
);
protected readonly practiceMode = computed(
  () => this.playerCountMode() === "practice",
);
```

Replace the template checkbox section (lines 59-68):
```html
@if (isSimpleCollaborative()) {
  <div class="flex gap-sm items-center">
    <span class="text-sm font-medium">Players:</span>
    <div class="flex gap-xs">
      <button
        uiButton
        [variant]="playerCountMode() === 'full' ? 'default' : 'outline'"
        size="sm"
        (click)="onPlayerCountMode('full')"
      >
        Full Team
      </button>
      <button
        uiButton
        [variant]="playerCountMode() === 'two_player' ? 'default' : 'outline'"
        size="sm"
        (click)="onPlayerCountMode('two_player')"
      >
        2 Players
      </button>
      <button
        uiButton
        [variant]="playerCountMode() === 'practice' ? 'default' : 'outline'"
        size="sm"
        (click)="onPlayerCountMode('practice')"
      >
        Practice (Solo)
      </button>
    </div>
  </div>
}
```

Add practice mode branch in the template (after the `twoPlayerMode()` block, before `} @else if (scenarioRoles().length)`):
```html
} @else if (practiceMode()) {
  <div class="flex flex-col gap-sm">
    <p class="text-sm text-muted-foreground p-sm">
      Practice mode — you'll play all roles.
    </p>
    @if (participants().length) {
      <div class="flex items-center justify-between p-sm border-b gap-md">
        <div class="flex items-center gap-sm">
          <span class="text-sm font-medium">{{ participants()[0].display_name }}</span>
          <ui-badge variant="secondary">You</ui-badge>
        </div>
        <span class="text-sm text-muted-foreground">All Roles</span>
      </div>
    }
  </div>
```

Update `canStart` computed to handle practice mode (replace lines 156-169):
```typescript
protected readonly canStart = computed(() => {
  const roles = this.scenarioRoles();
  if (!roles.length) return false;
  if (this.practiceMode()) {
    return this.participants().length === 1;
  }
  if (this.twoPlayerMode()) {
    const pRoles = this.participants().map((p) => p.role);
    return (
      this.participants().length === 2 &&
      pRoles.includes("decision_maker") &&
      pRoles.includes("all_advisors")
    );
  }
  const requiredCount = roles.length + (this.requiresGm() ? 1 : 0);
  return this.participants().length >= requiredCount;
});
```

Replace `onToggleTwoPlayer` method (lines 197-199) with:
```typescript
protected onPlayerCountMode(mode: PlayerCountMode): void {
  this.playerCountMode.set(mode);
}
```

Update the description text (lines 47-56) to include practice mode:
```html
@if (isSimpleCollaborative()) {
  Collaborative exercise — no facilitator needed.
  @if (practiceMode()) {
    Practice mode: you'll handle all roles solo.
  } @else if (twoPlayerMode()) {
    2 Player Mode: assign Decision Maker and All Advisors roles.
  } @else {
    Pick a role and start when all slots are filled.
  }
} @else {
  Assign roles before starting.
}
```

**Step 2: Update `onStartExercise` to pass practice mode info**

In the `onStartExercise` method (lines 223-244), add gameMode to the queryParams for practice mode:

```typescript
protected onStartExercise(): void {
  const me = this.participants().find((p) => p.id === this.participantId());
  const role = me?.role ?? "player";
  if (this.isSimpleCollaborative()) {
    this.router.navigate(["/player"], {
      queryParams: {
        exerciseId: this.exerciseId(),
        participantId: this.participantId(),
        role,
        gameMode: "simple_collaborative",
        practiceMode: this.practiceMode(),
      },
    });
    return;
  }
  const isGm = role === "game-master";
  this.router.navigate([isGm ? "/gm" : "/player"], {
    queryParams: {
      exerciseId: this.exerciseId(),
      participantId: this.participantId(),
      role,
    },
  });
}
```

**Step 3: Verify it compiles**

```bash
cd apps/tfc/frontend && npx ng build --configuration=development 2>&1 | head -20
```
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add apps/tfc/frontend/src/app/features/waiting-room/waiting-room-view.ts
git commit -m "feat(tfc): replace 2-player checkbox with player-count selector"
```

---

## Task 9: Frontend Player View — Two-Phase Decision Flow

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/player/player-view.ts`
- Modify: `apps/tfc/frontend/src/app/features/player/player-view.html` (lines 99-132, decision overlay)
- Modify: `apps/tfc/frontend/src/app/features/player/player-decision-handlers.ts` (line 96-118, `resolvePlayerRole`)

**Step 1: Add practice mode state to PlayerView**

In `apps/tfc/frontend/src/app/features/player/player-view.ts`:

Add signal (after `roleLabel` on line 70):
```typescript
protected readonly practicePhase = signal<"advising" | "deciding">("advising");
```

Read `practiceMode` from query params in `ngOnInit` (after line 104):
```typescript
const practiceMode = params["practiceMode"] === "true";
this.store.setPracticeMode(practiceMode);
```

Add method to handle phase transition:
```typescript
protected onPracticeAdviceDone(): void {
  this.practicePhase.set("deciding");
}
```

Add a reset when a new decision opens. In the WebSocket handler or in the `activeDecision()` method area, we need to reset `practicePhase` to `"advising"` when the active decision changes. Add an effect or computed:

```typescript
private lastDecisionId = "";

protected activeDecision(): ActiveDecision | undefined {
  const role = this.store.playerRole();
  const decision = this.store.openDecisions().find((d) => {
    if (!d.target_roles || d.target_roles.length === 0) return true;
    if (role === "all_advisors" || role === "solo_player") return true;
    return d.target_roles.includes(role);
  });
  // Reset practice phase when decision changes
  if (decision && decision.id !== this.lastDecisionId) {
    this.lastDecisionId = decision.id;
    if (this.store.practiceMode()) {
      this.practicePhase.set("advising");
    }
  }
  return decision;
}
```

**Step 2: Update player-view.html template**

In `apps/tfc/frontend/src/app/features/player/player-view.html`, replace the decision overlay section (lines 99-132):

```html
@if (activeDecision(); as decision) {
<div class="overlay">
  @if (store.isPracticeMode()) {
    <!-- Practice Mode: Two-phase flow -->
    @if (practicePhase() === 'advising') {
      <tfc-all-advisors-panel
        [roles]="scenarioAdvisorRoles()"
        [decisionTitle]="decision.title"
        [decisionDescription]="decision.description"
        [questionType]="decision.question_type"
        [options]="decision.options"
        (submitted)="onRoleRecommendationSubmitted(decision, $event)"
        (closed)="onPracticeAdviceDone()"
      />
      @if (scenarioAdvisorRoles().length > 0) {
        <div class="flex justify-end p-sm">
          <button uiButton variant="default" (click)="onPracticeAdviceDone()">
            Proceed to Decision
          </button>
        </div>
      }
    } @else {
      @if (advisorRecs(decision).length > 0) {
        <tfc-advisor-bubbles [recommendations]="advisorRecs(decision)" />
      }
      <tfc-decision-panel
        [title]="decision.title"
        [description]="decision.description"
        [questionType]="decision.question_type"
        [options]="decision.options"
        (submitted)="onDecisionSubmitted(decision, $event)"
        (closed)="store.closeDecision(decision.id)"
      />
    }
  } @else if (store.isCollaborative() && store.isAllAdvisors()) {
    <tfc-all-advisors-panel
      [roles]="scenarioAdvisorRoles()"
      [decisionTitle]="decision.title"
      [decisionDescription]="decision.description"
      [questionType]="decision.question_type"
      [options]="decision.options"
      (submitted)="onRoleRecommendationSubmitted(decision, $event)"
      (closed)="store.closeDecision(decision.id)"
    />
  } @else if (store.isCollaborative() && !store.isDecisionMaker()) {
    <tfc-decision-panel
      [title]="'[Advisor] ' + decision.title"
      [description]="decision.description"
      [questionType]="decision.question_type"
      [options]="decision.options"
      (submitted)="onRecommendationSubmitted(decision, $event)"
    />
  } @else {
    @if (store.isCollaborative() && advisorRecs(decision).length > 0) {
      <tfc-advisor-bubbles [recommendations]="advisorRecs(decision)" />
    }
    <tfc-decision-panel
      [title]="decision.title"
      [description]="decision.description"
      [questionType]="decision.question_type"
      [options]="decision.options"
      (submitted)="onDecisionSubmitted(decision, $event)"
      (closed)="store.closeDecision(decision.id)"
    />
  }
</div>
}
```

Update the footer text (lines 135-143) to include practice mode:
```html
<footer class="exercise-controls">
  <div class="exercise-controls__group">
    <p class="text-sm text-muted-foreground">
      @if (store.isPracticeMode()) {
        Practice Mode — playing all roles
      } @else if (store.isCollaborative()) {
        @if (store.isAllAdvisors()) {
          You are the All Advisors player
        } @else {
          You are the {{ roleLabel() }}
        }
      } @else {
        Waiting for {{ domain.term('gameMaster') }} actions...
      }
    </p>
  </div>
</footer>
```

**Step 3: Update resolvePlayerRole**

In `apps/tfc/frontend/src/app/features/player/player-decision-handlers.ts`, add `solo_player` handling in `resolvePlayerRole` (after line 115):

```typescript
} else if (role === "solo_player") {
  store.setPlayerType("decision_maker");
  roleLabel.set("Solo Player");
}
```

**Step 4: Verify it compiles**

```bash
cd apps/tfc/frontend && npx ng build --configuration=development 2>&1 | head -20
```
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add apps/tfc/frontend/src/app/features/player/player-view.ts \
       apps/tfc/frontend/src/app/features/player/player-view.html \
       apps/tfc/frontend/src/app/features/player/player-decision-handlers.ts
git commit -m "feat(tfc): add two-phase decision flow for practice mode"
```

---

## Task 10: E2E Test — Practice Mode Flow

**Files:**
- Create: `apps/tfc/frontend/e2e/tests/practice-mode.spec.ts`

**Step 1: Write E2E test**

Follow the pattern from `apps/tfc/frontend/e2e/tests/two-player-mode.spec.ts`. Create `apps/tfc/frontend/e2e/tests/practice-mode.spec.ts`:

```typescript
/**
 * Playwright tests for practice (single-player) mode.
 *
 * Tests the waiting room player-count selector, solo join flow,
 * and the two-phase decision flow (advise → decide).
 *
 * Invariants verified:
 * - Practice button visible only in simple_collaborative
 * - Selecting Practice shows single "All Roles — You" slot
 * - Start enabled with 1 participant
 * - Solo player sees AllAdvisorsPanel first (Phase 1)
 * - After "Proceed to Decision", sees decision panel with bubbles (Phase 2)
 * - Footer shows "Practice Mode — playing all roles"
 */
import { test, expect, mockParticipant } from "../fixtures/base.fixture";

const EX_ID = 1200;

const SCENARIO_ROLES = [
  { id: "co", label: "Commanding Officer", player_type: "decision_maker" as const },
  { id: "nav", label: "Navigator", player_type: "advisor" as const },
  { id: "ops", label: "Operations", player_type: "advisor" as const },
];

function seedScenario(
  mockApi: import("../fixtures/base.fixture").MockApi,
): void {
  if (!mockApi.exerciseMap.has(EX_ID)) {
    mockApi.seedExercise(EX_ID, "simple_collaborative", EX_ID);
  }
  if (!mockApi.scenarios.find((s) => s.id === EX_ID)) {
    mockApi.seedScenario({
      id: EX_ID,
      title: "Practice Scenario",
      description: "",
      domain_id: null,
      content: { roles: SCENARIO_ROLES, game_mode: "simple_collaborative" },
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
}

test.describe("Practice Mode", () => {
  test("Practice button visible only for simple_collaborative", async ({
    page,
    mockApi,
  }) => {
    seedScenario(mockApi);
    const me = mockParticipant("solo", "solo_player");
    await page.goto(
      `/waiting-room?exerciseId=${EX_ID}&participantId=${me.id}&gameMode=simple_collaborative`,
    );
    await expect(page.getByText("Practice (Solo)")).toBeVisible();
  });

  test("Solo player sees two-phase decision flow", async ({
    page,
    mockApi,
  }) => {
    seedScenario(mockApi);
    const me = mockParticipant("solo", "solo_player");
    // Navigate directly to player view in practice mode
    await page.goto(
      `/player?exerciseId=${EX_ID}&participantId=${me.id}&role=solo_player&gameMode=simple_collaborative&practiceMode=true`,
    );
    // Phase 1: Should see all-advisors panel
    await expect(page.locator("tfc-all-advisors-panel")).toBeVisible();
    // Footer should indicate practice mode
    await expect(page.getByText("Practice Mode")).toBeVisible();
  });
});
```

**Step 2: Run E2E tests**

```bash
cd apps/tfc/frontend && npx playwright test e2e/tests/practice-mode.spec.ts
```
Expected: Tests PASS (adjust selectors/fixtures as needed based on actual fixture API).

**Step 3: Commit**

```bash
git add apps/tfc/frontend/e2e/tests/practice-mode.spec.ts
git commit -m "test(tfc): add E2E tests for practice mode"
```

---

## Task 11: Run Full Test Suite & Verify

**Step 1: Backend tests**

```bash
cd apps/tfc/backend && python -m pytest -v
```
Expected: All tests PASS, including new practice mode tests and all existing tests.

**Step 2: Frontend build**

```bash
cd apps/tfc/frontend && npx ng build
```
Expected: Production build succeeds.

**Step 3: Frontend E2E**

```bash
cd apps/tfc/frontend && npx playwright test
```
Expected: All E2E tests PASS.

**Step 4: Linting**

```bash
cd apps/tfc/backend && python -m ruff check . && python -m ruff format --check .
cd apps/tfc/frontend && npx ng lint
```
Expected: No linting errors.

---

## Summary of Changes

| Layer | Files Changed | Files Created |
|-------|--------------|---------------|
| Migration | — | `006_add_practice_mode.py` |
| Model | `exercise_model.py` | — |
| Schema | `exercise_schema.py` | — |
| Service | `exercise_service.py` | — |
| Router | `exercise_router.py`, `waiting_room_router.py` | — |
| Loader | `scenario_loader.py` | — |
| Engine | (none) | — |
| Store | `exercise.store.ts` | — |
| Waiting Room UI | `waiting-room-view.ts` | — |
| Player View | `player-view.ts`, `player-view.html`, `player-decision-handlers.ts` | — |
| Backend Tests | — | `practice_mode_test.py` |
| E2E Tests | — | `practice-mode.spec.ts` |
| Joinable Tests | `exercise_joinable_test.py` | — |
