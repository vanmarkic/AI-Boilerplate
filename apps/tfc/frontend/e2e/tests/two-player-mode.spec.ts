/**
 * Property-style Playwright tests for 2-player mode.
 *
 * Tests the waiting room toggle + role selector, and the player view
 * behaviour when the all_advisors synthetic role is active.
 *
 * Invariants verified:
 * - 2 Players button visible only in simple_collaborative
 * - Clicking 2 Players button shows role selectors with Decision Maker / All Advisors
 * - Start disabled until exactly 2 participants with one of each role
 * - All-advisors player sees tabbed all-advisors-panel, NOT advisor panel
 * - All-advisors player sees all open decisions (bypasses target_roles)
 * - Decision-maker sees composite-key advisor bubbles with role labels
 * - Footer text matches synthetic role
 */
import { test, expect, mockParticipant } from "../fixtures/base.fixture";
import type { Page } from "@playwright/test";

const EX_ID = 1100;

const SCENARIO_ROLES = [
  {
    id: "co",
    label: "Commanding Officer",
    player_type: "decision_maker" as const,
  },
  { id: "nav", label: "Navigator", player_type: "advisor" as const },
  { id: "ops", label: "Operations", player_type: "advisor" as const },
  { id: "cyops", label: "CyOps", player_type: "advisor" as const },
];

function seedScenarioWithRoles(
  mockApi: import("../fixtures/base.fixture").MockApi,
  gameMode: string,
): void {
  if (!mockApi.exerciseMap.has(EX_ID)) {
    mockApi.seedExercise(EX_ID, gameMode, EX_ID);
  }
  if (!mockApi.scenarios.find((s) => s.id === EX_ID)) {
    mockApi.seedScenario({
      id: EX_ID,
      title: "Test Scenario",
      description: "",
      domain_id: null,
      content: { roles: SCENARIO_ROLES, game_mode: gameMode },
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
}

// ── State building blocks ─────────────────────────────────────────────

const TIME = {
  play_time_ms: 120_000,
  real_time_ms: 120_000,
  factor: 1,
  paused: false,
};

const SCORE = {
  total_score: 10.0,
  stress: 0,
  turn_number: 2,
  next_decision_time_ms: 180_000,
};

const CONTEXT = {
  title: "Silent Wake",
  description: "Naval cyber exercise",
  briefing: "You are aboard the USS Sentinel.",
  objectives: ["Defend the ship"],
  rules: ["Time is critical"],
  roles: SCENARIO_ROLES,
};

const DECISION_OPEN = {
  id: "dec1",
  event_id: "e1",
  issue_id: "iss1",
  title: "Evasive Action",
  description: "Choose a maneuver.",
  question_type: "single_choice",
  options: [
    { id: "opt-a", label: "Hard starboard", score: 10 },
    { id: "opt-b", label: "All stop", score: 5 },
    { id: "opt-c", label: "Maintain course", score: -2 },
  ],
  completion_mode: "first_response",
  target_roles: [] as string[],
  timeout_ms: 300_000,
  status: "open",
  opened_at_pt_ms: 60_000,
  closed_at_pt_ms: null,
  recommendations: {},
};

const DECISION_TARGETED_CO = {
  ...DECISION_OPEN,
  id: "dec-co",
  title: "CO Only Decision",
  target_roles: ["co"],
};

const DECISION_WITH_COMPOSITE_RECS = {
  ...DECISION_OPEN,
  id: "dec-recs",
  title: "Decision With Role Recs",
  recommendations: {
    "all-adv-01:nav": "opt-a",
    "all-adv-01:ops": "opt-b",
    "all-adv-01:cyops": "opt-c",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────

interface SnapshotOpts {
  phase?: string;
  decisions?: (typeof DECISION_OPEN)[];
  score?: typeof SCORE | null;
}

function snapshot(opts: SnapshotOpts = {}) {
  return {
    exercise_id: EX_ID,
    title: "Test Exercise",
    phase: opts.phase ?? "running",
    time: TIME,
    events: [],
    issues: [],
    decisions: opts.decisions ?? [],
    score: opts.score ?? null,
  };
}

function playerUrl(participantId: string, role: string): string {
  return `/player?exerciseId=${EX_ID}&participantId=${participantId}&role=${role}`;
}

async function installPlayerMocks(
  page: Page,
  snap: ReturnType<typeof snapshot>,
  ctx = CONTEXT,
): Promise<void> {
  const decisions = snap.decisions ?? [];
  await page.route(`**/api/exercises/${EX_ID}/engine/snapshot`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(snap),
    }),
  );
  await page.route(`**/api/exercises/${EX_ID}/engine/context`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(ctx),
    }),
  );
  await page.route("**/api/decisions*", async (route) => {
    if (route.request().url().includes("/engine/")) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    });
  });
  await page.route(
    `**/api/exercises/${EX_ID}/engine/decisions`,
    async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(decisions),
        });
      } else {
        await route.fallback();
      }
    },
  );
  await page.route("**/ws?*", (route) => route.abort("connectionrefused"));
  await page.route("**/ws", (route) => route.abort("connectionrefused"));
  await page.route("**/api/domain-configs", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    }),
  );
}

function collabWaitingRoomUrl(participantId: string): string {
  return `/waiting-room?exerciseId=${EX_ID}&participantId=${participantId}`;
}

// ── 1. WAITING ROOM — 2 PLAYER MODE TOGGLE ──────────────────────────
//    Checkbox visible only in simple_collaborative mode.
//    Hidden in classic mode.

test.describe("Waiting room — 2 Players button visibility @waiting-room @two-player", () => {
  test("2 Players button visible in simple_collaborative mode", async ({
    page,
    mockApi,
  }) => {
    const me = mockParticipant({ display_name: "Alice", role: "co" });
    mockApi.seed(EX_ID, [me], "simple_collaborative");
    seedScenarioWithRoles(mockApi, "simple_collaborative");
    await mockApi.install();

    await page.goto(collabWaitingRoomUrl(me.id));

    await expect(
      page.getByRole("button", { name: "2 Players" }),
    ).toBeVisible();
  });

  test("2 Players button NOT visible in classic mode", async ({ page, mockApi }) => {
    const me = mockParticipant({ display_name: "Alice", role: "co" });
    mockApi.seed(EX_ID, [me], "classic");
    seedScenarioWithRoles(mockApi, "classic");
    await mockApi.install();

    await page.goto(`/waiting-room?exerciseId=${EX_ID}&participantId=${me.id}`);

    await expect(
      page.getByRole("button", { name: "2 Players" }),
    ).not.toBeVisible();
  });
});

// ── 2. WAITING ROOM — ROLE SELECTOR ACTIVATION ─────────────────────
//    Toggling checkbox shows role dropdowns with Decision Maker / All Advisors.
//    Untoggled shows role-slot-list (no dropdowns).

test.describe("Waiting room — role selector after 2 Players click @waiting-room @two-player", () => {
  test("toggling on shows 2-player role options", async ({ page, mockApi }) => {
    const alice = mockParticipant({ display_name: "Alice", role: "co" });
    const bob = mockParticipant({ display_name: "Bob", role: "nav" });
    mockApi.seed(EX_ID, [alice, bob], "simple_collaborative");
    seedScenarioWithRoles(mockApi, "simple_collaborative");
    await mockApi.install();

    await page.goto(collabWaitingRoomUrl(alice.id));

    // Toggle on
    await page.getByRole("button", { name: "2 Players" }).click();

    // 2-player role dropdowns visible with correct options
    const selects = page.locator("select");
    await expect(selects.first()).toBeVisible();
    const options = selects.first().locator("option");
    await expect(options).toHaveCount(2);
    await expect(options.nth(0)).toHaveText("Commanding Officer");
    await expect(options.nth(1)).toHaveText("Crew Members");
  });

  test("clicking Full Team hides 2-player role dropdowns", async ({
    page,
    mockApi,
  }) => {
    const me = mockParticipant({ display_name: "Alice", role: "co" });
    mockApi.seed(EX_ID, [me], "simple_collaborative");
    seedScenarioWithRoles(mockApi, "simple_collaborative");
    await mockApi.install();

    await page.goto(collabWaitingRoomUrl(me.id));

    // Select 2 Players — selects visible
    await page.getByRole("button", { name: "2 Players" }).click();
    const firstSelect = page.locator("select").first();
    await expect(firstSelect).toBeVisible();
    const opts = firstSelect.locator("option");
    await expect(opts.nth(0)).toHaveText("Commanding Officer");

    // Switch to Full Team — selects gone
    await page.getByRole("button", { name: "Full Team" }).click();
    // Select dropdowns should no longer be visible
    await expect(page.locator("select")).not.toBeVisible();
  });
});

// ── 3. WAITING ROOM — START BUTTON CONSTRAINTS ─────────────────────
//    In 2-player mode, start requires exactly 2 participants
//    with one decision_maker and one all_advisors.

test.describe("Waiting room — 2-player start constraints @waiting-room @two-player", () => {
  test("start disabled when both have same role", async ({ page, mockApi }) => {
    const alice = mockParticipant({
      display_name: "Alice",
      role: "decision_maker",
    });
    const bob = mockParticipant({
      display_name: "Bob",
      role: "decision_maker",
    });
    mockApi.seed(EX_ID, [alice, bob], "simple_collaborative");
    seedScenarioWithRoles(mockApi, "simple_collaborative");
    await mockApi.install();

    await page.goto(collabWaitingRoomUrl(alice.id));
    await page.getByRole("button", { name: "2 Players" }).click();

    await expect(
      page.getByRole("button", { name: /Start Exercise/ }),
    ).toBeDisabled();
  });

  test("start enabled with one decision_maker and one all_advisors", async ({
    page,
    mockApi,
  }) => {
    const alice = mockParticipant({
      display_name: "Alice",
      role: "decision_maker",
    });
    const bob = mockParticipant({ display_name: "Bob", role: "all_advisors" });
    mockApi.seed(EX_ID, [alice, bob], "simple_collaborative");
    seedScenarioWithRoles(mockApi, "simple_collaborative");
    await mockApi.install();

    await page.goto(collabWaitingRoomUrl(alice.id));
    await page.getByRole("button", { name: "2 Players" }).click();

    await expect(
      page.getByRole("button", { name: /Start Exercise/ }),
    ).toBeEnabled();
  });

  test("start disabled with only one participant in 2-player mode", async ({
    page,
    mockApi,
  }) => {
    const me = mockParticipant({
      display_name: "Alice",
      role: "decision_maker",
    });
    mockApi.seed(EX_ID, [me], "simple_collaborative");
    seedScenarioWithRoles(mockApi, "simple_collaborative");
    await mockApi.install();

    await page.goto(collabWaitingRoomUrl(me.id));
    await page.getByRole("button", { name: "2 Players" }).click();

    await expect(
      page.getByRole("button", { name: /Start Exercise/ }),
    ).toBeDisabled();
  });

  test("start disabled with 3 participants in 2-player mode", async ({
    page,
    mockApi,
  }) => {
    const alice = mockParticipant({
      display_name: "Alice",
      role: "decision_maker",
    });
    const bob = mockParticipant({ display_name: "Bob", role: "all_advisors" });
    const charlie = mockParticipant({
      display_name: "Charlie",
      role: "all_advisors",
    });
    mockApi.seed(EX_ID, [alice, bob, charlie], "simple_collaborative");
    seedScenarioWithRoles(mockApi, "simple_collaborative");
    await mockApi.install();

    await page.goto(collabWaitingRoomUrl(alice.id));
    await page.getByRole("button", { name: "2 Players" }).click();

    await expect(
      page.getByRole("button", { name: /Start Exercise/ }),
    ).toBeDisabled();
  });
});

// ── 3b. WAITING ROOM — ERROR STATE WHEN NO ROLES ────────────────────
//    If scenario has no roles (broken scenario), show error message
//    and disable start button.

test.describe("Waiting room — missing roles error state @waiting-room @two-player", () => {
  test("shows error message when no scenario roles loaded", async ({
    page,
    mockApi,
  }) => {
    const me = mockParticipant({ display_name: "Alice", role: "player" });
    // Only seed participants, explicitly set exercise with no scenario
    mockApi.rooms.set(EX_ID, [me]);
    mockApi.seedExercise(EX_ID, "simple_collaborative", null);
    await mockApi.install();

    await page.goto(collabWaitingRoomUrl(me.id));

    await expect(page.getByText("Scenario has no roles defined")).toBeVisible();
  });

  test("start button disabled when no roles loaded", async ({
    page,
    mockApi,
  }) => {
    const me = mockParticipant({ display_name: "Alice", role: "player" });
    mockApi.rooms.set(EX_ID, [me]);
    mockApi.seedExercise(EX_ID, "simple_collaborative", null);
    await mockApi.install();

    await page.goto(collabWaitingRoomUrl(me.id));

    await expect(
      page.getByRole("button", { name: /Start Exercise/ }),
    ).toBeDisabled();
  });
});

// ── 4. PLAYER VIEW — ALL-ADVISORS PANEL VISIBILITY ─────────────────
//    all_advisors role sees tfc-all-advisors-panel, NOT tfc-decision-panel with [Advisor] prefix.
//    Tabs correspond to scenario advisor roles.

test.describe("Player view — all-advisors panel @player @two-player", () => {
  test("all-advisors player sees tabbed panel", async ({ page }) => {
    await installPlayerMocks(page, snapshot({ decisions: [DECISION_OPEN] }));
    await page.goto(playerUrl("all-adv-01", "all_advisors"));

    await expect(page.locator("tfc-all-advisors-panel")).toBeVisible();
    // Should NOT see the single-advisor [Advisor] prefix
    await expect(page.getByText("[Advisor] Evasive Action")).not.toBeVisible();
  });

  test("all-advisors panel has tabs for each advisor role", async ({
    page,
  }) => {
    await installPlayerMocks(page, snapshot({ decisions: [DECISION_OPEN] }));
    await page.goto(playerUrl("all-adv-01", "all_advisors"));

    // CONTEXT has 3 advisor roles: Navigator, Operations, CyOps
    await expect(page.getByRole("button", { name: "Navigator" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Operations" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "CyOps" })).toBeVisible();
  });

  test("no all-advisors-panel when no open decision", async ({ page }) => {
    await installPlayerMocks(page, snapshot({ decisions: [] }));
    await page.goto(playerUrl("all-adv-01", "all_advisors"));

    await expect(page.locator("tfc-all-advisors-panel")).not.toBeVisible();
    await expect(page.locator("tfc-decision-panel")).not.toBeVisible();
  });
});

// ── 5. PLAYER VIEW — ALL-ADVISORS BYPASSES TARGET ROLES ────────────
//    all_advisors sees all decisions, even those targeted at specific roles.

test.describe("Player view — all-advisors decision targeting @player @two-player", () => {
  test("all-advisors sees targeted CO decision", async ({ page }) => {
    await installPlayerMocks(
      page,
      snapshot({ decisions: [DECISION_TARGETED_CO] }),
    );
    await page.goto(playerUrl("all-adv-01", "all_advisors"));

    await expect(page.locator("tfc-all-advisors-panel")).toBeVisible();
    await expect(page.getByText("CO Only Decision")).toBeVisible();
  });

  test("regular nav advisor does NOT see CO-targeted decision", async ({
    page,
  }) => {
    await installPlayerMocks(
      page,
      snapshot({ decisions: [DECISION_TARGETED_CO] }),
    );
    await page.goto(playerUrl("nav-01", "nav"));

    await expect(page.locator("tfc-decision-panel")).not.toBeVisible();
  });
});

// ── 6. PLAYER VIEW — COMPOSITE KEY ADVISOR BUBBLES ──────────────────
//    Decision-maker sees role labels (not raw keys) when recs use composite keys.
//    Count badge matches number of per-role recommendations.

test.describe("Player view — composite-key advisor bubbles @player @two-player", () => {
  test("decision-maker sees role labels from composite keys", async ({
    page,
  }) => {
    await installPlayerMocks(
      page,
      snapshot({ decisions: [DECISION_WITH_COMPOSITE_RECS] }),
    );
    await page.goto(playerUrl("co-01", "co"));

    await expect(page.locator("tfc-advisor-bubbles")).toBeVisible();
    // 3 composite-key recommendations → 3 role labels
    await expect(page.locator(".advisor-bubble__count")).toContainText("3");
    // Role names resolved from context
    await expect(page.getByText("Navigator")).toBeVisible();
    await expect(page.getByText("Operations")).toBeVisible();
    await expect(page.getByText("CyOps")).toBeVisible();
  });

  test("decision-maker does NOT see raw composite key format", async ({
    page,
  }) => {
    await installPlayerMocks(
      page,
      snapshot({ decisions: [DECISION_WITH_COMPOSITE_RECS] }),
    );
    await page.goto(playerUrl("co-01", "co"));

    // Should not show the raw "all-adv-01:nav" format
    await expect(page.getByText("all-adv-01:nav")).not.toBeVisible();
    await expect(page.getByText("all-adv-01:ops")).not.toBeVisible();
    await expect(page.getByText("all-adv-01:cyops")).not.toBeVisible();
  });
});

// ── 7. PLAYER VIEW — FOOTER TEXT FOR SYNTHETIC ROLES ────────────────
//    all_advisors → "You are the All Advisors player"
//    decision_maker (synthetic) → "You are the Decision Maker"

test.describe("Player view — footer text for 2-player roles @player @two-player", () => {
  test("all-advisors player sees correct footer text", async ({ page }) => {
    await installPlayerMocks(page, snapshot());
    await page.goto(playerUrl("all-adv-01", "all_advisors"));

    await expect(
      page.getByText("You are the All Advisors player"),
    ).toBeVisible();
    await expect(
      page.getByText("You are the Decision Maker"),
    ).not.toBeVisible();
    await expect(page.getByText("You are an Advisor")).not.toBeVisible();
  });

  test("decision-maker with synthetic role sees correct footer text", async ({
    page,
  }) => {
    await installPlayerMocks(page, snapshot());
    await page.goto(playerUrl("dm-01", "decision_maker"));

    await expect(page.getByText("You are the Decision Maker")).toBeVisible();
    await expect(
      page.getByText("You are the All Advisors player"),
    ).not.toBeVisible();
  });
});

// ── 8. COMBINED — FULL 2-PLAYER STATE ───────────────────────────────
//    All invariants hold simultaneously in a realistic 2-player scenario.

test.describe("Combined — full 2-player scenario @player @two-player", () => {
  test("all-advisors player: score + decision + tabbed panel", async ({
    page,
  }) => {
    await installPlayerMocks(
      page,
      snapshot({
        score: SCORE,
        decisions: [DECISION_OPEN],
      }),
    );
    await page.goto(playerUrl("all-adv-01", "all_advisors"));

    // Header always visible
    await expect(page.locator(".player-header__title")).toBeVisible();

    // Score visible
    await expect(page.locator("tfc-score-bar")).toBeVisible();

    // All-advisors panel visible with tabs
    await expect(page.locator("tfc-all-advisors-panel")).toBeVisible();
    await expect(page.getByRole("button", { name: "Navigator" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Operations" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "CyOps" })).toBeVisible();

    // No regular advisor panel or bubbles
    await expect(page.locator("tfc-advisor-bubbles")).not.toBeVisible();
    await expect(page.getByText("[Advisor]")).not.toBeVisible();

    // Footer
    await expect(
      page.getByText("You are the All Advisors player"),
    ).toBeVisible();
  });

  test("decision-maker: score + composite recs + bubbles", async ({ page }) => {
    await installPlayerMocks(
      page,
      snapshot({
        score: SCORE,
        decisions: [DECISION_WITH_COMPOSITE_RECS],
      }),
    );
    await page.goto(playerUrl("co-01", "co"));

    // Header always visible
    await expect(page.locator(".player-header__title")).toBeVisible();

    // Score visible
    await expect(page.locator("tfc-score-bar")).toBeVisible();

    // Decision panel visible (DM style, no [Advisor] prefix)
    await expect(page.locator("tfc-decision-panel")).toBeAttached();
    await expect(page.getByText("[Advisor]")).not.toBeAttached();

    // Composite-key advisor bubbles with role labels
    await expect(page.locator("tfc-advisor-bubbles")).toBeAttached();
    await expect(page.locator(".advisor-bubble__count")).toContainText("3");
    await expect(page.getByText("Navigator")).toBeVisible();
    await expect(page.getByText("Operations")).toBeVisible();
    await expect(page.getByText("CyOps")).toBeVisible();

    // No raw composite keys
    await expect(page.getByText("all-adv-01:")).not.toBeVisible();

    // Footer — co role resolves to "Commanding Officer" label
    await expect(
      page.getByText("You are the Commanding Officer"),
    ).toBeVisible();
  });
});
