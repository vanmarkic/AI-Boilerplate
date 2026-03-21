# Scenario Builder Property Tests + Visual Snapshots

**Date**: 2026-03-21
**Status**: Draft
**Scope**: `apps/tfc/frontend/e2e/`

## Problem

The scenario builder has 3 hand-crafted Playwright tests checking basic page presence
(title input, description input, create button). These don't cover the new layout:

1. **No state coverage** — tests don't load scenarios, toggle views, or exercise dirty state
2. **No random generation** — sidebar counts, walkthrough navigation, and cross-reference linking are untested
3. **No visual regression** — layout restructure (sidebar, sections, action bar) has no visual baseline
4. **Bounded coverage** — 3 tests covering 0 of ~2,400 meaningful content × view × dirty combinations

## Solution

Add fast-check for property-based testing and Playwright's built-in
`toHaveScreenshot()` for visual regression. Keep existing 3 tests untouched as
pinned regressions.

## Deliverables

### 1. `e2e/helpers/scenario-builder-arbitraries.ts` — State Generators

7-dimension arbitrary producing `{ content, viewMode, scenarioLoaded, dirty }`:

| Dimension | Arbitrary | Values |
|-----------|-----------|--------|
| Roles | `fc.array(roleArb, {minLength:0, maxLength:4})` | 0-4 roles with id, label, player_type |
| Events | `fc.array(eventArb, {minLength:0, maxLength:5})` | 0-5 events with type, scheduled_pt_ms, triggered_issues |
| Issues | `fc.array(issueArb, {minLength:0, maxLength:3})` | 0-3 issues with trigger_mode, trigger_event_id |
| Decision templates | `fc.array(dtArb, {minLength:0, maxLength:3})` | 0-3 templates with issue_id, target_roles, question_type |
| Turns | `fc.array(turnArb, {minLength:0, maxLength:5})` | 0-5 turns with inject_ids, stress_delta |
| View mode | `fc.constantFrom('global', 'walkthrough')` | global or walkthrough |
| Scenario loaded | `fc.boolean()` | new (null id) or loaded (with id + snapshot) |

**Constraint filtering** (`fc.filter`):
- Decision template `target_roles` must be subset of defined role IDs
- Event `triggered_issues` must be subset of defined issue IDs
- Issue `trigger_event_id` (when event-based) must reference a defined event ID
- Turn `inject_ids` must be subset of defined event IDs
- At least 1 role with `player_type: "decision_maker"` when roles.length > 0

### Primitive arbitraries

```typescript
const playerTypeArb = fc.constantFrom("decision_maker", "advisor");

const roleArb = fc.record({
  id: fc.stringMatching(/^[a-z]{2,6}$/),
  label: fc.string({ minLength: 1, maxLength: 20 }),
  player_type: playerTypeArb,
});

const eventTypeArb = fc.constantFrom("informational", "operational", "decision");

const eventArb = fc.record({
  id: fc.stringMatching(/^evt-[0-9]{1,3}$/),
  title: fc.string({ minLength: 1, maxLength: 30 }),
  description: fc.string({ maxLength: 50 }),
  event_type: eventTypeArb,
  scheduled_pt_ms: fc.integer({ min: 0, max: 900_000 }),
  duration_ms: fc.option(fc.integer({ min: 1_000, max: 60_000 }), { nil: null }),
  dependencies: fc.constant([]),
  triggered_issues: fc.constant([]),  // filled by constraint step
  target_roles: fc.constant([]),
  role_descriptions: fc.constant({}),
});

const triggerModeArb = fc.constantFrom("manual", "time-based", "event-based");

const issueArb = fc.record({
  id: fc.stringMatching(/^iss-[0-9]{1,3}$/),
  title: fc.string({ minLength: 1, maxLength: 30 }),
  description: fc.string({ maxLength: 50 }),
  trigger_mode: triggerModeArb,
  trigger_time_pt_ms: fc.option(fc.integer({ min: 0, max: 600_000 }), { nil: null }),
  trigger_event_id: fc.constant(null),  // filled by constraint step
  auto_resolve_ms: fc.integer({ min: 0, max: 300_000 }),
});

const questionTypeArb = fc.constantFrom("single_choice", "multi_choice", "free_text");

const dtArb = fc.record({
  id: fc.stringMatching(/^dt-[0-9]{1,3}$/),
  title: fc.string({ minLength: 1, maxLength: 30 }),
  description: fc.string({ maxLength: 50 }),
  issue_id: fc.constant(""),  // filled by constraint step
  question_type: questionTypeArb,
  options: fc.constant([]),
  completion_mode: fc.constant("first_response"),
  target_roles: fc.constant([]),  // filled by constraint step
});

const turnArb = fc.record({
  turn_index: fc.integer({ min: 0, max: 15 }),
  title: fc.string({ minLength: 0, maxLength: 20 }),
  facilitator_prompt: fc.option(fc.string({ maxLength: 50 }), { nil: null }),
  has_decisions: fc.boolean(),
  inject_ids: fc.constant([]),  // filled by constraint step
  decision_template_id: fc.option(fc.constant(null)),
  base_stress_delta: fc.integer({ min: -3, max: 3 }),
});
```

### Composed state + cross-reference wiring

```typescript
export interface BuilderState {
  content: ScenarioContent;
  viewMode: "global" | "walkthrough";
  scenarioLoaded: boolean;
  title: string;
}

export const builderStateArb: fc.Arbitrary<BuilderState> = fc
  .record({
    roles: fc.array(roleArb, { maxLength: 4 }),
    events: fc.array(eventArb, { maxLength: 5 }),
    issues: fc.array(issueArb, { maxLength: 3 }),
    dts: fc.array(dtArb, { maxLength: 3 }),
    turns: fc.array(turnArb, { maxLength: 5 }),
    viewMode: fc.constantFrom("global", "walkthrough"),
    scenarioLoaded: fc.boolean(),
    title: fc.string({ minLength: 1, maxLength: 30 }),
  })
  .map(({ roles, events, issues, dts, turns, viewMode, scenarioLoaded, title }) => {
    // Wire cross-references
    const eventIds = events.map((e) => e.id);
    const issueIds = issues.map((i) => i.id);
    const roleIds = roles.map((r) => r.id);

    // Wire triggered_issues on events (subset of issue IDs)
    const wiredEvents = events.map((e, i) => ({
      ...e,
      triggered_issues: issueIds.slice(0, Math.min(i, issueIds.length)),
      target_roles: roleIds.slice(0, Math.min(1, roleIds.length)),
    }));

    // Wire trigger_event_id on event-based issues
    const wiredIssues = issues.map((iss, i) => ({
      ...iss,
      trigger_event_id: iss.trigger_mode === "event-based" && eventIds.length > 0
        ? eventIds[i % eventIds.length]
        : null,
    }));

    // Wire target_roles and issue_id on decision templates
    const wiredDts = dts.map((dt, i) => ({
      ...dt,
      issue_id: issueIds.length > 0 ? issueIds[i % issueIds.length] : "none",
      target_roles: roleIds.slice(0, Math.min(2, roleIds.length)),
    }));

    // Wire inject_ids on turns
    const wiredTurns = turns.map((t, i) => ({
      ...t,
      turn_index: i,
      inject_ids: eventIds.slice(0, Math.min(i + 1, eventIds.length)),
    }));

    // Ensure at least one decision_maker if roles exist
    const ensuredRoles = roles.length > 0 && !roles.some((r) => r.player_type === "decision_maker")
      ? [{ ...roles[0], player_type: "decision_maker" as const }, ...roles.slice(1)]
      : roles;

    return {
      content: {
        phases: [],
        events: wiredEvents,
        issues: wiredIssues,
        decision_templates: wiredDts,
        default_time_factor: 1.0,
        briefing: "Test briefing",
        objectives: [],
        rules: [],
        roles: ensuredRoles,
        turns: wiredTurns,
        initial_system_states: [],
      },
      viewMode,
      scenarioLoaded,
      title,
    } satisfies BuilderState;
  });
```

### 2. `e2e/tests/scenario-builder-properties.spec.ts` — 10 Properties × 30 Runs

Each property: mock API → navigate → load state into store → assert invariant.

| # | Property | Assertion |
|---|----------|-----------|
| P1 | Sidebar always visible in global view | `tfc-scenario-sidebar-nav` visible when viewMode is global |
| P2 | Sidebar section counts match content | Badge text for each section equals array length |
| P3 | All 6 sections rendered in global view | `#section-roles`, `#section-events`, `#section-issues`, `#section-decisions`, `#section-turns`, `#section-settings` all visible |
| P4 | Walkthrough shows no sections | Section elements not visible when viewMode is walkthrough |
| P5 | Walkthrough event count correct | "Event X of Y" where Y = events.length (when events > 0) |
| P6 | Walkthrough events sorted by time | Displayed event is the one with lowest `scheduled_pt_ms` |
| P7 | Previous disabled on first walkthrough event | Previous button has `disabled` attribute at index 0 |
| P8 | Action bar always visible | `tfc-scenario-builder-actions` visible in both view modes |
| P9 | Save as Copy visible iff scenario loaded | "Save as Copy" button visible ↔ scenarioLoaded is true |
| P10 | View toggle text matches mode | Button text is "Walkthrough" when global, "Global" when walkthrough |

Each property: generate state → mock API → navigate → inject state → assert.
30 runs per property (configurable via `PROP_RUNS` env var).

### 3. `e2e/tests/scenario-builder-snapshots.spec.ts` — 8 Visual Snapshots

Deterministic curated states with `toHaveScreenshot()`:

| # | State | Purpose |
|---|-------|---------|
| S1 | Empty new scenario, no content | Blank slate |
| S2 | Global view, 3 roles, 4 events, 2 issues, 2 decisions, 3 turns | Full content |
| S3 | Walkthrough view, 4 events at varying times | Walkthrough first event |
| S4 | Walkthrough view, 4 events, navigated to event 3 of 4 | Mid-walkthrough |
| S5 | Loaded scenario, dirty (title changed) | Dirty state with Revert visible |
| S6 | Loaded scenario, clean | Save as Copy + Update visible |
| S7 | Validation errors displayed (no roles) | Error alert styling |
| S8 | Sidebar with high counts (10 events, 5 issues, 8 decisions) | Sidebar overflow |

Baselines committed to `e2e/tests/scenario-builder-snapshots.spec.ts-snapshots/`.
Regenerate with `--update-snapshots`.

## Mock Strategy

The scenario builder loads data via `ScenarioApiService`. Mock pattern:

```typescript
async function installScenarioMocks(page: Page, scenarios: MockScenario[]): Promise<void> {
  await page.route("**/api/scenarios", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(scenarios),
      });
    }
    return route.fallback();
  });
  await page.route("**/api/domain-configs", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route("**/ws*", (route) => route.abort("connectionrefused"));
}
```

For loaded scenarios, mock `GET /api/scenarios/:id` to return the generated content.
For store injection (dirty state, view mode), use `page.evaluate()` to access
the Angular component instance and call store methods.

## File Structure

```
e2e/
  helpers/
    arbitraries.ts                          ← EXISTING (untouched)
    scenario-builder-arbitraries.ts         ← NEW: builder state generators
  tests/
    scenario-builder.spec.ts                ← EXISTING (untouched)
    scenario-builder-properties.spec.ts     ← NEW: fast-check properties
    scenario-builder-snapshots.spec.ts      ← NEW: visual regression
```

## Dependencies

- `fast-check` — already installed (used by player view property tests)
- `@playwright/test` — already installed, `toHaveScreenshot()` built-in

## CI Constraints

- Property tests: 30 runs × 10 properties × ~150ms = ~45s
- Visual snapshots: 8 states × ~500ms = ~4s
- Total new test time: ~49s (within 2-minute budget)

## Decisions

- **Separate arbitraries file** over extending existing: builder state space is disjoint from player state space
- **30 runs** default: matches player view convention
- **No fast-check for snapshots**: deterministic baselines are easier to maintain
- **Store injection via page.evaluate**: avoids duplicating API response → store loading logic
- **Cross-reference wiring in map()**: ensures generated states have valid internal links without filter-based rejection (which would slow generation)
