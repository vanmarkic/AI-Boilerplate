/**
 * Playwright e2e tests for player view — gaps 3, 5, 6.
 *
 * Gap 3: Participant identity wired end-to-end
 * Gap 5: Score persisted in snapshot on reconnect
 * Gap 6: PlayerType resolved from scenario roles
 */
import { test, expect, mockParticipant } from "../fixtures/base.fixture";

const exerciseId = 800;

const baseSnapshot = {
  exercise_id: exerciseId,
  title: "Test Exercise",
  phase: "running",
  time: {
    play_time_ms: 60_000,
    real_time_ms: 60_000,
    factor: 1,
    paused: false,
  },
  events: [],
  issues: [],
  decisions: [],
  score: null,
};

const snapshotWithScore = {
  ...baseSnapshot,
  score: {
    total_score: 25.0,
    penalty_ms: 400.0,
    turn_number: 3,
    next_decision_time_ms: 299_600,
  },
};

const contextWithRoles = {
  title: "Silent Wake",
  description: "Naval cyber exercise",
  briefing: "You are aboard...",
  objectives: ["Defend the ship"],
  rules: ["No cheating"],
  roles: [
    { id: "co", label: "Commanding Officer", player_type: "decision_maker" },
    { id: "nav", label: "Navigator", player_type: "advisor" },
    { id: "ops", label: "Operations", player_type: "advisor" },
  ],
};

function playerUrl(participantId: string, role = "player"): string {
  return `/player?exerciseId=${exerciseId}&participantId=${participantId}&role=${role}`;
}

async function installPlayerMocks(
  page: import("@playwright/test").Page,
  snapshot = baseSnapshot,
  context = contextWithRoles,
): Promise<void> {
  const decisions = (snapshot as Record<string, unknown>)["decisions"] ?? [];

  // Mock engine snapshot
  await page.route(
    `**/api/exercises/${exerciseId}/engine/snapshot`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(snapshot),
      });
    },
  );

  // Mock engine context
  await page.route(
    `**/api/exercises/${exerciseId}/engine/context`,
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(context),
      });
    },
  );

  // Mock decisions list (skip engine sub-paths)
  await page.route(`**/api/decisions*`, async (route) => {
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

  // Mock engine decisions
  await page.route(
    `**/api/exercises/${exerciseId}/engine/decisions`,
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

  // Swallow WebSocket
  await page.route("**/ws?*", (route) => route.abort("connectionrefused"));
  await page.route("**/ws", (route) => route.abort("connectionrefused"));
}

// ── Gap 5: Score in snapshot ──────────────────────────────────────────

test.describe("Gap 5 — Score in snapshot @player", () => {
  test("displays score from snapshot on load", async ({ page }) => {
    await installPlayerMocks(page, snapshotWithScore);
    await page.goto(playerUrl("alice-01"));

    // Turn banner should show turn 3
    await expect(page.locator("tfc-turn-banner")).toContainText("Turn 3");
  });

  test("no score shown when snapshot has null score", async ({ page }) => {
    await installPlayerMocks(page, baseSnapshot);
    await page.goto(playerUrl("alice-01"));

    // No turn banner should appear
    await expect(page.getByText(/Turn \d/)).not.toBeVisible();
  });
});

// ── Gap 6: PlayerType from scenario roles ─────────────────────────────

test.describe("Gap 6 — PlayerType from scenario roles @player", () => {
  test("decision-maker sees role label in footer", async ({ page }) => {
    await installPlayerMocks(page, baseSnapshot, contextWithRoles);
    await page.goto(playerUrl("co-01", "co"));

    await expect(
      page.getByText("You are the Commanding Officer"),
    ).toBeVisible();
  });

  test("advisor sees role label in footer", async ({ page }) => {
    await installPlayerMocks(page, baseSnapshot, contextWithRoles);
    await page.goto(playerUrl("nav-01", "nav"));

    await expect(page.getByText("You are the Navigator")).toBeVisible();
  });
});

// ── Gap 3: Participant identity ───────────────────────────────────────

test.describe("Gap 3 — Participant identity @player @waiting-room", () => {
  test("waiting room passes participantId and role to player view", async ({
    page,
    mockApi,
  }) => {
    const alice = mockParticipant({
      id: "alice-99",
      display_name: "Alice",
      role: "player",
    });
    mockApi.seed(exerciseId, [alice], "simple_collaborative");
    await mockApi.install();

    // Mock engine endpoints for player view
    await installPlayerMocks(page);

    // Navigate from waiting room to player view
    await page.goto(
      `/waiting-room?exerciseId=${exerciseId}&participantId=${alice.id}&gameMode=simple_collaborative`,
    );
    await page.getByRole("button", { name: /Start Exercise/ }).click();

    // Verify URL contains participantId and role
    await expect(page).toHaveURL(/\/player/);
    await expect(page).toHaveURL(/participantId=alice-99/);
    await expect(page).toHaveURL(/role=player/);
  });
});
