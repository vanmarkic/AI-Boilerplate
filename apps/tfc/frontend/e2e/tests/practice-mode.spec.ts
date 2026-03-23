/**
 * Playwright tests for practice (single-player) mode.
 *
 * Tests the waiting room player-count selector, solo join flow,
 * and the two-phase decision flow (advise → decide).
 *
 * Invariants verified:
 * - Practice (Solo) button visible only in simple_collaborative
 * - Selecting Practice shows single "All Roles — You" slot
 * - Start enabled with 1 participant in practice mode
 * - Solo player sees AllAdvisorsPanel first (Phase 1)
 * - "Proceed to Decision" transitions to Phase 2
 * - Phase 2 shows decision panel with advisor bubbles
 * - Footer shows "Practice Mode — playing all roles"
 */
import { test, expect, mockParticipant } from "../fixtures/base.fixture";
import type { Page } from "@playwright/test";

const EX_ID = 1200;

const SCENARIO_ROLES = [
  {
    id: "co",
    label: "Commanding Officer",
    player_type: "decision_maker" as const,
  },
  { id: "nav", label: "Navigator", player_type: "advisor" as const },
  { id: "ops", label: "Operations", player_type: "advisor" as const },
];

function seedScenarioWithRoles(
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

const TIME = {
  play_time_ms: 120_000,
  real_time_ms: 120_000,
  factor: 1,
  paused: false,
};

const CONTEXT = {
  title: "Practice Scenario",
  description: "Solo practice exercise",
  briefing: "You are practicing all roles.",
  objectives: ["Complete all decisions"],
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
  ],
  completion_mode: "first_response",
  target_roles: [],
  timeout_ms: 450_000,
  status: "open",
  opened_at_pt_ms: 60_000,
  closed_at_pt_ms: null,
  recommendations: {},
};

const DECISION_WITH_PRACTICE_RECS = {
  ...DECISION_OPEN,
  id: "dec-recs",
  title: "Decision With Practice Recs",
  recommendations: {
    "solo-01:nav": "opt-a",
    "solo-01:ops": "opt-b",
  },
};

interface SnapshotOpts {
  phase?: string;
  decisions?: (typeof DECISION_OPEN)[];
  score?: object | null;
}

function snapshot(opts: SnapshotOpts = {}) {
  return {
    exercise_id: EX_ID,
    title: "Practice Exercise",
    phase: opts.phase ?? "running",
    time: TIME,
    events: [],
    issues: [],
    decisions: opts.decisions ?? [],
    score: opts.score ?? null,
  };
}

function practicePlayerUrl(participantId: string): string {
  return `/player?exerciseId=${EX_ID}&participantId=${participantId}&role=solo_player&gameMode=simple_collaborative&practiceMode=true`;
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

// ── 1. WAITING ROOM — PRACTICE BUTTON VISIBILITY ─────────────────────

test.describe("Waiting room — Practice (Solo) button @waiting-room @practice", () => {
  test("Practice button visible in simple_collaborative", async ({
    page,
    mockApi,
  }) => {
    const me = mockParticipant({ display_name: "Solo", role: "solo_player" });
    mockApi.seed(EX_ID, [me], "simple_collaborative");
    seedScenarioWithRoles(mockApi);
    await mockApi.install();

    await page.goto(collabWaitingRoomUrl(me.id));

    await expect(
      page.getByRole("button", { name: "Practice (Solo)" }),
    ).toBeVisible();
  });

  test("Practice button NOT visible in classic mode", async ({
    page,
    mockApi,
  }) => {
    const me = mockParticipant({ display_name: "Solo", role: "player" });
    mockApi.seed(EX_ID, [me], "classic");
    seedScenarioWithRoles(mockApi);
    await mockApi.install();

    await page.goto(
      `/waiting-room?exerciseId=${EX_ID}&participantId=${me.id}`,
    );

    await expect(
      page.getByRole("button", { name: "Practice (Solo)" }),
    ).not.toBeVisible();
  });
});

// ── 2. WAITING ROOM — PRACTICE MODE ACTIVATION ──────────────────────

test.describe("Waiting room — practice mode UI @waiting-room @practice", () => {
  test("clicking Practice shows solo slot text", async ({ page, mockApi }) => {
    const me = mockParticipant({ display_name: "Solo", role: "solo_player" });
    mockApi.seed(EX_ID, [me], "simple_collaborative");
    seedScenarioWithRoles(mockApi);
    await mockApi.install();

    await page.goto(collabWaitingRoomUrl(me.id));
    await page.getByRole("button", { name: "Practice (Solo)" }).click();

    await expect(
      page.getByText("Practice mode: you'll handle all roles solo."),
    ).toBeVisible();
  });

  test("start enabled with 1 participant in practice mode", async ({
    page,
    mockApi,
  }) => {
    const me = mockParticipant({ display_name: "Solo", role: "solo_player" });
    mockApi.seed(EX_ID, [me], "simple_collaborative");
    seedScenarioWithRoles(mockApi);
    await mockApi.install();

    await page.goto(collabWaitingRoomUrl(me.id));
    await page.getByRole("button", { name: "Practice (Solo)" }).click();

    await expect(
      page.getByRole("button", { name: /Deploy/ }),
    ).toBeEnabled();
  });
});

// ── 3. PLAYER VIEW — PRACTICE MODE TWO-PHASE FLOW ───────────────────

test.describe("Player view — practice mode phases @player @practice", () => {
  test("solo player sees all-advisors panel first (Phase 1)", async ({
    page,
  }) => {
    await installPlayerMocks(page, snapshot({ decisions: [DECISION_OPEN] }));
    await page.goto(practicePlayerUrl("solo-01"));

    await expect(page.locator("tfc-all-advisors-panel")).toBeVisible();
    // Should see advisor role tabs
    await expect(page.getByRole("button", { name: "Navigator" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Operations" }),
    ).toBeVisible();
  });

  test("Proceed to Decision button visible in Phase 1", async ({ page }) => {
    await installPlayerMocks(page, snapshot({ decisions: [DECISION_OPEN] }));
    await page.goto(practicePlayerUrl("solo-01"));

    await expect(
      page.getByRole("button", { name: "Proceed to Decision" }),
    ).toBeVisible();
  });

  test("clicking Proceed shows decision panel (Phase 2)", async ({ page }) => {
    await installPlayerMocks(
      page,
      snapshot({ decisions: [DECISION_WITH_PRACTICE_RECS] }),
    );
    await page.goto(practicePlayerUrl("solo-01"));

    // Phase 1 → click proceed
    await page.getByRole("button", { name: "Proceed to Decision" }).click();

    // Phase 2: decision panel visible
    await expect(page.locator("tfc-decision-panel")).toBeVisible();
    // Advisor bubbles with role labels
    await expect(page.locator("tfc-advisor-bubbles")).toBeVisible();
  });
});

// ── 4. PLAYER VIEW — FOOTER TEXT ────────────────────────────────────

test.describe("Player view — practice mode footer @player @practice", () => {
  test("footer shows Practice Mode text", async ({ page }) => {
    await installPlayerMocks(page, snapshot());
    await page.goto(practicePlayerUrl("solo-01"));

    await expect(
      page.getByText("Practice Mode — playing all roles"),
    ).toBeVisible();
  });

  test("footer does NOT show advisor or GM text", async ({ page }) => {
    await installPlayerMocks(page, snapshot());
    await page.goto(practicePlayerUrl("solo-01"));

    await expect(
      page.getByText("You are the All Advisors player"),
    ).not.toBeVisible();
    await expect(page.getByText("Waiting for")).not.toBeVisible();
  });
});
