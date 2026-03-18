/**
 * Comprehensive state-matrix e2e tests for the landing page flow.
 *
 * Tests ALL visual states across /home, /waiting-room, and /join —
 * every combination of lobby presence, participant fill-level,
 * game mode, and join state that a user can encounter.
 */
import { test, expect, mockParticipant } from "../fixtures/base.fixture";

// ── Shared fixtures ───────────────────────────────────────────────────

const TWO_ROLES = [
  { id: "co", label: "Commanding Officer (CO)", player_type: "decision_maker" },
  { id: "nav", label: "Navigator (NAV)", player_type: "advisor" },
];

const THREE_ROLES = [
  ...TWO_ROLES,
  {
    id: "pwo",
    label: "Principal Warfare Officer (PWO)",
    player_type: "advisor",
  },
];

const SCENARIO = {
  id: 1,
  title: "Test Scenario",
  description: "A scenario for testing.",
  domain_id: null,
  content: {
    roles: TWO_ROLES,
    game_mode: "simple_collaborative",
    phases: [],
    events: [],
    issues: [],
    decision_templates: [],
    default_time_factor: 1.0,
    briefing: "Test",
    objectives: [],
    rules: [],
    decision_sequence: [],
  },
  version: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function joinable(overrides: Record<string, unknown> = {}) {
  const gm = overrides["game_mode"] ?? "simple_collaborative";
  const roles = (overrides["roles"] ?? TWO_ROLES) as typeof TWO_ROLES;
  const requiresGm = gm === "classic";
  return {
    exercise: {
      id: 42,
      title: "Active Exercise",
      game_mode: gm,
      scenario_id: 1,
    },
    participants: overrides["participants"] ?? [],
    roles,
    max_players:
      overrides["max_players"] ?? roles.length + (requiresGm ? 1 : 0),
    requires_gm: overrides["requires_gm"] ?? requiresGm,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// /home — Three mutually exclusive visual states
// ═══════════════════════════════════════════════════════════════════════

test.describe("/home — Menu state (no lobby, no picker) @home", () => {
  test("shows all 3 menu cards", async ({ page, mockApi }) => {
    await mockApi.install();
    await page.goto("/home");

    await expect(page.getByText("Run Exercise")).toBeVisible();
    await expect(page.getByText("Build Scenario")).toBeVisible();
    await expect(page.getByText("Review Results")).toBeVisible();
  });

  test("does NOT show lobby or picker", async ({ page, mockApi }) => {
    await mockApi.install();
    await page.goto("/home");

    await expect(page.locator("tfc-lobby-preview")).not.toBeAttached();
    await expect(page.locator("tfc-scenario-picker")).not.toBeAttached();
  });
});

test.describe("/home — Picker state @home @scenario-builder", () => {
  test('clicking "Run Exercise" shows picker, hides menu', async ({
    page,
    mockApi,
  }) => {
    mockApi.seedScenario(SCENARIO);
    await mockApi.install();
    await page.goto("/home");

    await page.getByText("Run Exercise").click();

    await expect(page.getByText("Test Scenario")).toBeVisible();
    await expect(page.getByText("Run Exercise")).not.toBeVisible();
  });

  test("empty scenario list shows empty message", async ({ page, mockApi }) => {
    await mockApi.install();
    await page.goto("/home");

    await page.getByText("Run Exercise").click();

    await expect(page.getByText("No scenarios available.")).toBeVisible();
  });

  test("scenario card shows role count and game mode", async ({
    page,
    mockApi,
  }) => {
    mockApi.seedScenario(SCENARIO);
    await mockApi.install();
    await page.goto("/home");

    await page.getByText("Run Exercise").click();

    await expect(page.getByText("2 roles")).toBeVisible();
    await expect(
      page.getByText("Collaborative", { exact: true }),
    ).toBeVisible();
  });

  test("multiple scenarios all rendered", async ({ page, mockApi }) => {
    mockApi.seedScenario(SCENARIO);
    mockApi.seedScenario({ ...SCENARIO, id: 2, title: "Second Scenario" });
    await mockApi.install();
    await page.goto("/home");

    await page.getByText("Run Exercise").click();

    await expect(page.getByText("Test Scenario")).toBeVisible();
    await expect(page.getByText("Second Scenario")).toBeVisible();
  });

  test("back button returns to menu", async ({ page, mockApi }) => {
    mockApi.seedScenario(SCENARIO);
    await mockApi.install();
    await page.goto("/home");

    await page.getByText("Run Exercise").click();
    await page.getByText("Back").click();

    await expect(page.getByText("Run Exercise")).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// /home — Lobby state: participant fill-level × game mode × join status
// ═══════════════════════════════════════════════════════════════════════

test.describe("/home — Lobby: empty, collaborative, not joined @home @waiting-room", () => {
  test("shows role slots as Open, name input, Join button", async ({
    page,
    mockApi,
  }) => {
    mockApi.seedJoinable(joinable());
    await mockApi.install();
    await page.goto("/home");

    await expect(page.getByText("0 / 2 players")).toBeVisible();
    await expect(page.getByText("Commanding Officer (CO)")).toBeVisible();
    await expect(page.getByText("Navigator (NAV)")).toBeVisible();
    const openSlots = page.getByText("Open", { exact: true });
    await expect(openSlots).toHaveCount(2);
    await expect(page.locator("input#lobby-name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Join" })).toBeVisible();
    await expect(page.getByText("Joined")).not.toBeVisible();
  });

  test("no GM slot visible", async ({ page, mockApi }) => {
    mockApi.seedJoinable(joinable());
    await mockApi.install();
    await page.goto("/home");

    await expect(page.getByText("Game Master (Trainer)")).not.toBeVisible();
  });
});

test.describe("/home — Lobby: empty, classic, not joined @home @waiting-room", () => {
  test("shows GM slot + role slots, all Open", async ({ page, mockApi }) => {
    mockApi.seedJoinable(joinable({ game_mode: "classic" }));
    await mockApi.install();
    await page.goto("/home");

    await expect(page.getByText("Game Master (Trainer)")).toBeVisible();
    await expect(page.getByText("0 / 3 players")).toBeVisible();
    const openSlots = page.getByText("Open", { exact: true });
    await expect(openSlots).toHaveCount(3); // co + nav + gm
  });
});

test.describe("/home — Lobby: partial fill (1/2) @home @waiting-room", () => {
  test("shows 1 participant badge, 1 Open slot, correct counter", async ({
    page,
    mockApi,
  }) => {
    const alice = mockParticipant({ display_name: "Alice", role: "co" });
    mockApi.seedJoinable(joinable({ participants: [alice] }));
    await mockApi.install();
    await page.goto("/home");

    await expect(page.getByText("Alice")).toBeVisible();
    await expect(page.getByText("1 / 2 players")).toBeVisible();
    await expect(page.getByText("Open", { exact: true })).toHaveCount(1);
  });
});

test.describe("/home — Lobby: full (2/2) @home @waiting-room", () => {
  test("shows all participants, no Open slots, correct counter", async ({
    page,
    mockApi,
  }) => {
    const alice = mockParticipant({ display_name: "Alice", role: "co" });
    const bob = mockParticipant({ display_name: "Bob", role: "nav" });
    mockApi.seedJoinable(joinable({ participants: [alice, bob] }));
    await mockApi.install();
    await page.goto("/home");

    await expect(page.getByText("Alice")).toBeVisible();
    await expect(page.getByText("Bob")).toBeVisible();
    await expect(page.getByText("2 / 2 players")).toBeVisible();
    await expect(page.getByText("Open", { exact: true })).toHaveCount(0);
  });
});

test.describe("/home — Lobby: start button logic @home @waiting-room", () => {
  test("not joined → no start button visible (join form shown instead)", async ({
    page,
    mockApi,
  }) => {
    mockApi.seedJoinable(joinable());
    await mockApi.install();
    await page.goto("/home");

    // Before joining, only the join form is visible, not start/leave
    await expect(
      page.getByRole("button", { name: /Start Exercise/ }),
    ).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Leave" })).not.toBeVisible();
    await expect(page.locator("input#lobby-name")).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// /home — Lobby: 3-role scenario to test larger slot grids
// ═══════════════════════════════════════════════════════════════════════

test.describe("/home — Lobby: 3-role scenario @home @waiting-room", () => {
  test("shows 3 role slots for a 3-role scenario", async ({
    page,
    mockApi,
  }) => {
    mockApi.seedJoinable(
      joinable({
        roles: THREE_ROLES,
        max_players: 3,
      }),
    );
    await mockApi.install();
    await page.goto("/home");

    await expect(page.getByText("Commanding Officer (CO)")).toBeVisible();
    await expect(page.getByText("Navigator (NAV)")).toBeVisible();
    await expect(
      page.getByText("Principal Warfare Officer (PWO)"),
    ).toBeVisible();
    await expect(page.getByText("0 / 3 players")).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// /waiting-room — Scenario roles vs fallback
// ═══════════════════════════════════════════════════════════════════════

test.describe("/waiting-room — with scenario roles @waiting-room", () => {
  const exerciseId = 500;

  function wrUrl(pid: string) {
    return `/waiting-room?exerciseId=${exerciseId}&participantId=${pid}`;
  }

  test("scenario roles shown as claimable slots", async ({ page, mockApi }) => {
    const me = mockParticipant({ display_name: "Alice", role: "co" });
    mockApi.seed(exerciseId, [me], "simple_collaborative");
    // Override with specific scenario roles
    mockApi.seedExercise(exerciseId, "simple_collaborative", 1);
    mockApi.seedScenario({
      ...SCENARIO,
      id: 1,
      content: { ...SCENARIO.content, game_mode: "simple_collaborative" },
    });
    await mockApi.install();
    await page.goto(wrUrl(me.id));

    await expect(page.getByText("Commanding Officer (CO)")).toBeVisible();
    await expect(page.getByText("Navigator (NAV)")).toBeVisible();
  });

  test("collaborative mode shows collaborative message", async ({
    page,
    mockApi,
  }) => {
    const me = mockParticipant({ display_name: "Alice", role: "co" });
    mockApi.seed(exerciseId, [me], "simple_collaborative");
    mockApi.seedExercise(exerciseId, "simple_collaborative", 1);
    mockApi.seedScenario({
      ...SCENARIO,
      id: 1,
      content: { ...SCENARIO.content, game_mode: "simple_collaborative" },
    });
    await mockApi.install();
    await page.goto(wrUrl(me.id));

    await expect(page.getByText("Collaborative exercise")).toBeVisible();
  });

  test("classic mode shows assign roles message", async ({ page, mockApi }) => {
    const me = mockParticipant({ display_name: "Alice", role: "co" });
    mockApi.seed(exerciseId, [me], "classic");
    mockApi.seedExercise(exerciseId, "classic", 1);
    mockApi.seedScenario({
      ...SCENARIO,
      id: 1,
      content: { ...SCENARIO.content, game_mode: "classic" },
    });
    await mockApi.install();
    await page.goto(wrUrl(me.id));

    await expect(page.getByText("Assign roles")).toBeVisible();
  });

  test("classic mode shows GM slot", async ({ page, mockApi }) => {
    const me = mockParticipant({ display_name: "Alice", role: "co" });
    mockApi.seed(exerciseId, [me], "classic");
    mockApi.seedExercise(exerciseId, "classic", 1);
    mockApi.seedScenario({
      ...SCENARIO,
      id: 1,
      content: { ...SCENARIO.content, game_mode: "classic" },
    });
    await mockApi.install();
    await page.goto(wrUrl(me.id));

    await expect(page.getByText("Game Master (Trainer)")).toBeVisible();
  });
});

test.describe("/waiting-room — without scenario (fallback) @waiting-room", () => {
  const exerciseId = 600;

  test("shows error message when no scenario roles defined", async ({
    page,
    mockApi,
  }) => {
    const me = mockParticipant({ display_name: "Alice", role: "player" });
    mockApi.rooms.set(exerciseId, [me]);
    mockApi.seedExercise(exerciseId, "classic", null);
    await mockApi.install();
    await page.goto(
      `/waiting-room?exerciseId=${exerciseId}&participantId=${me.id}`,
    );

    // No scenario → error state
    await expect(page.getByText("Scenario has no roles defined")).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// /join — collaborative mode
// ═══════════════════════════════════════════════════════════════════════

test.describe("/join — collaborative mode", () => {
  const exerciseId = 700;

  test("joining collaborative exercise shows waiting room", async ({
    page,
    mockApi,
  }) => {
    const me = mockParticipant({ display_name: "Alice", role: "co" });
    mockApi.seed(exerciseId, [me], "simple_collaborative");
    await mockApi.install();

    await page.goto(
      `/waiting-room?exerciseId=${exerciseId}&participantId=${me.id}&gameMode=simple_collaborative`,
    );

    await expect(page.getByText("Collaborative exercise")).toBeVisible();
    await expect(page.getByText("Alice")).toBeVisible();
  });
});
