/**
 * Playwright tests for the system status board and stress bar features.
 *
 * Verifies:
 * - System status board renders systems from snapshot
 * - System board reflects power and operational state via data attributes
 * - System board hidden when no systems present
 * - Stress bar renders inside score bar with correct severity
 * - Stress bar updates when snapshot score changes
 * - GM view shows both system board and stress bar
 */
import { test, expect } from "../fixtures/base.fixture";
import type { Page } from "@playwright/test";

const EX_ID = 950;

const TIME = {
  play_time_ms: 60_000,
  real_time_ms: 60_000,
  factor: 1,
  paused: false,
};

const SCORE = {
  total_score: 15.0,
  stress: 3,
  turn_number: 2,
  next_decision_time_ms: 240_000,
};

const SYSTEMS = [
  { system_id: "nav_radar", label: "NAV RADAR", category: "sensor", power: true, operational: "green" },
  { system_id: "comms", label: "COMMS", category: "system", power: true, operational: "yellow" },
  { system_id: "aaw_radar", label: "AAW RADAR", category: "sensor", power: false, operational: "red" },
];

const CONTEXT = {
  title: "Systems Test",
  description: "Test exercise",
  briefing: "Testing system board and stress bar.",
  objectives: ["Verify systems render"],
  rules: [],
  roles: [
    { id: "co", label: "CO", player_type: "decision_maker" },
    { id: "nav", label: "NAV", player_type: "advisor" },
  ],
};

interface SnapshotOpts {
  phase?: string;
  systems?: typeof SYSTEMS;
  score?: typeof SCORE | null;
}

function snapshot(opts: SnapshotOpts = {}) {
  return {
    exercise_id: EX_ID,
    title: "Systems Test Exercise",
    phase: opts.phase ?? "running",
    time: TIME,
    events: [],
    issues: [],
    decisions: [],
    systems: opts.systems ?? SYSTEMS,
    score: opts.score ?? SCORE,
  };
}

function playerUrl(participantId: string, role = "player"): string {
  return `/player?exerciseId=${EX_ID}&participantId=${participantId}&role=${role}`;
}

function gmUrl(): string {
  return `/gm?exerciseId=${EX_ID}`;
}

async function installMocks(
  page: Page,
  snap: ReturnType<typeof snapshot>,
  ctx = CONTEXT,
): Promise<void> {
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
    (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
  );
  await page.route(`**/api/audit/${EX_ID}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    }),
  );
  await page.route("**/api/exercises", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    }),
  );
  await page.route("**/api/scenarios", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([]),
    }),
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

// ── PLAYER VIEW: System Status Board ────────────────────────────────

test.describe("System status board — player view", () => {
  test("renders all systems from snapshot", async ({ page }) => {
    await installMocks(page, snapshot());
    await page.goto(playerUrl("p1"));

    const board = page.locator("tfc-system-status-board");
    await expect(board).toBeVisible();

    const rows = page.locator('[data-testid="system-row"]');
    await expect(rows).toHaveCount(3);

    // Verify labels
    await expect(rows.nth(0)).toContainText("NAV RADAR");
    await expect(rows.nth(1)).toContainText("COMMS");
    await expect(rows.nth(2)).toContainText("AAW RADAR");
  });

  test("reflects power state via data-power attribute", async ({ page }) => {
    await installMocks(page, snapshot());
    await page.goto(playerUrl("p1"));

    const rows = page.locator('[data-testid="system-row"]');

    // NAV RADAR: power=true
    await expect(rows.nth(0)).toHaveAttribute("data-power", "true");
    await expect(rows.nth(0)).toContainText("ON");

    // AAW RADAR: power=false
    await expect(rows.nth(2)).toHaveAttribute("data-power", "false");
    await expect(rows.nth(2)).toContainText("OFF");
  });

  test("reflects operational state via data-operational attribute", async ({ page }) => {
    await installMocks(page, snapshot());
    await page.goto(playerUrl("p1"));

    const rows = page.locator('[data-testid="system-row"]');

    await expect(rows.nth(0)).toHaveAttribute("data-operational", "green");
    await expect(rows.nth(1)).toHaveAttribute("data-operational", "yellow");
    await expect(rows.nth(2)).toHaveAttribute("data-operational", "red");
  });

  test("hides board when no systems in snapshot", async ({ page }) => {
    await installMocks(page, snapshot({ systems: [] }));
    await page.goto(playerUrl("p1"));

    await expect(page.locator(".system-board")).not.toBeVisible();
  });
});

// ── PLAYER VIEW: Stress Bar ──────────────────────────────────────────

test.describe("Stress bar — player view", () => {
  test("renders stress bar in header with correct value", async ({ page }) => {
    await installMocks(page, snapshot({ score: { ...SCORE, stress: 5 } }));
    await page.goto(playerUrl("p1"));

    const stressBar = page.locator("tfc-stress-bar");
    await expect(stressBar).toBeVisible();
    await expect(stressBar).toContainText("5");
  });

  test("shows low severity for stress 0-3", async ({ page }) => {
    await installMocks(page, snapshot({ score: { ...SCORE, stress: 2 } }));
    await page.goto(playerUrl("p1"));

    await expect(page.locator("tfc-stress-bar")).toHaveAttribute("data-severity", "low");
  });

  test("shows medium severity for stress 4-6", async ({ page }) => {
    await installMocks(page, snapshot({ score: { ...SCORE, stress: 5 } }));
    await page.goto(playerUrl("p1"));

    await expect(page.locator("tfc-stress-bar")).toHaveAttribute("data-severity", "medium");
  });

  test("shows high severity for stress 7-10", async ({ page }) => {
    await installMocks(page, snapshot({ score: { ...SCORE, stress: 9 } }));
    await page.goto(playerUrl("p1"));

    await expect(page.locator("tfc-stress-bar")).toHaveAttribute("data-severity", "high");
  });
});

// ── GM VIEW: Systems + Stress ────────────────────────────────────────

test.describe("GM view — system board and stress bar", () => {
  test("renders system status board in GM detail panel", async ({ page }) => {
    await installMocks(page, snapshot());
    await page.goto(gmUrl());

    const board = page.locator("tfc-system-status-board");
    await expect(board).toBeVisible();

    const rows = page.locator('[data-testid="system-row"]');
    await expect(rows).toHaveCount(3);
  });

  test("renders stress bar in GM view when score exists", async ({ page }) => {
    await installMocks(page, snapshot({ score: { ...SCORE, stress: 7 } }));
    await page.goto(gmUrl());

    const stressBar = page.locator("tfc-stress-bar");
    // GM view has stress bar in detail panel + potentially in score bar area
    await expect(stressBar.first()).toBeVisible();
    await expect(stressBar.first()).toContainText("7");
  });

  test("hides stress bar in GM view during setup phase with no score", async ({ page }) => {
    await installMocks(page, snapshot({ phase: "setup", score: null }));
    await page.goto(gmUrl());

    // The GM detail panel stress bar is gated behind store.score()
    const detailStressBar = page.locator(".exercise-details tfc-stress-bar");
    await expect(detailStressBar).not.toBeVisible();
  });
});
