/**
 * Visual regression tests for the player view.
 *
 * 10 curated representative states with Playwright's built-in
 * toHaveScreenshot() for pixel-diff visual regression detection.
 *
 * Regenerate baselines: npx playwright test player-view-snapshots --update-snapshots
 */
import { test, expect } from "../fixtures/base.fixture";
import type { Page } from "@playwright/test";
import { CONTEXT, EX_ID } from "../helpers/arbitraries";

// ── State building blocks ────────────────────────────────────────────

const TIME = {
  play_time_ms: 120_000,
  real_time_ms: 120_000,
  factor: 1,
  paused: false,
};

const SCORE = {
  total_score: 25.0,
  stress: 3,
  turn_number: 3,
  next_decision_time_ms: 299_600,
};

const EVENT_RUNNING = {
  id: "e1",
  title: "NAV Report",
  description: "Navigation update",
  event_type: "narrative",
  scheduled_pt_ms: 10_000,
  duration_ms: null,
  dependencies: [],
  lifecycle: "running",
  started_at_pt_ms: 10_000,
  completed_at_pt_ms: null,
  execution_mode: "automatic",
  triggered_issues: [] as string[],
  target_roles: [] as string[],
  role_descriptions: {} as Record<string, string>,
  system_effects: [] as unknown[],
};

const EVENT_COMPLETED = {
  id: "e2",
  title: "EO Sighting",
  description: "Object spotted",
  event_type: "narrative",
  scheduled_pt_ms: 5_000,
  duration_ms: 5_000,
  dependencies: [],
  lifecycle: "completed",
  started_at_pt_ms: 5_000,
  completed_at_pt_ms: 10_000,
  execution_mode: "automatic",
  triggered_issues: [] as string[],
  target_roles: [] as string[],
  role_descriptions: {} as Record<string, string>,
  system_effects: [] as unknown[],
};

const EVENT_SCHEDULED = {
  id: "e3",
  title: "Future Inject",
  description: "Not yet",
  event_type: "narrative",
  scheduled_pt_ms: 999_000,
  duration_ms: null,
  dependencies: [],
  lifecycle: "scheduled",
  started_at_pt_ms: null,
  completed_at_pt_ms: null,
  execution_mode: "automatic",
  triggered_issues: [] as string[],
  target_roles: [] as string[],
  role_descriptions: {} as Record<string, string>,
  system_effects: [] as unknown[],
};

const ISSUE_ACTIVE = {
  id: "iss1",
  title: "Radar Failure",
  description: "Radar is down.",
  trigger_mode: "event-based",
  auto_resolve_pt_ms: 0,
  auto_resolve_rt_ms: 0,
  lifecycle: "active",
  activated_at_pt_ms: 20_000,
  activated_at_rt_ms: null,
  resolved_at_pt_ms: null,
  released: true,
};

const ISSUE_RESOLVED = {
  id: "iss2",
  title: "Comms Restored",
  description: "Fixed.",
  trigger_mode: "event-based",
  auto_resolve_pt_ms: 0,
  auto_resolve_rt_ms: 0,
  lifecycle: "resolved",
  activated_at_pt_ms: 10_000,
  activated_at_rt_ms: null,
  resolved_at_pt_ms: 50_000,
  released: true,
};

const DECISION_WITH_RECS = {
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
  recommendations: {
    "nav-advisor": "opt-a",
    "ops-advisor": "opt-b",
  },
};

const DECISION_TARGETED_NAV = {
  ...DECISION_WITH_RECS,
  id: "dec-nav",
  title: "Navigation Check",
  target_roles: ["nav"],
  recommendations: {},
};

const SYSTEMS_HEALTHY = [
  { system_id: "nav_radar", label: "NAV RADAR", category: "sensor", power: true, operational: "green" },
  { system_id: "comms", label: "COMMS", category: "system", power: true, operational: "green" },
];

const SYSTEMS_DEGRADED = [
  { system_id: "nav_radar", label: "NAV RADAR", category: "sensor", power: true, operational: "yellow" },
  { system_id: "comms", label: "COMMS", category: "system", power: false, operational: "red" },
  { system_id: "aaw_radar", label: "AAW RADAR", category: "sensor", power: true, operational: "red" },
];

// ── Helpers ──────────────────────────────────────────────────────────

interface SnapOpts {
  phase?: string;
  score?: typeof SCORE | null;
  events?: unknown[];
  issues?: unknown[];
  decisions?: unknown[];
  systems?: unknown[];
}

function snap(opts: SnapOpts = {}) {
  return {
    exercise_id: EX_ID,
    title: "Visual Test Exercise",
    phase: opts.phase ?? "running",
    time: opts.phase === "paused" ? { ...TIME, paused: true } : TIME,
    events: opts.events ?? [],
    issues: opts.issues ?? [],
    decisions: opts.decisions ?? [],
    systems: opts.systems ?? [],
    score: opts.score ?? null,
  };
}

function playerUrl(participantId: string, role: string, practiceMode = false): string {
  const base = `/player?exerciseId=${EX_ID}&participantId=${participantId}&role=${role}&gameMode=simple_collaborative`;
  return practiceMode ? `${base}&practiceMode=true` : base;
}

async function installMocks(
  page: Page,
  snapshot: ReturnType<typeof snap>,
  ctx = CONTEXT,
): Promise<void> {
  const decisions = (snapshot.decisions ?? []) as Array<Record<string, unknown>>;
  await page.route(`**/api/exercises/${EX_ID}/engine/snapshot`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(snapshot),
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

// ── Visual Snapshots ─────────────────────────────────────────────────

test.describe("Visual: player view representative states @visual", () => {
  test("S1: full state — CO with score, events, issues, decision+recs", async ({ page }) => {
    await installMocks(
      page,
      snap({
        score: SCORE,
        events: [EVENT_RUNNING, EVENT_COMPLETED],
        issues: [ISSUE_ACTIVE],
        decisions: [DECISION_WITH_RECS],
        systems: SYSTEMS_HEALTHY,
      }),
    );
    await page.goto(playerUrl("co-01", "co"));
    await expect(page.locator(".player-header__title")).toBeVisible();
    await expect(page).toHaveScreenshot("s1-full-state-co.png", { fullPage: true, maxDiffPixelRatio: 0.02, mask: [page.locator("tfc-ambient-background"), page.locator("tfc-clock-display")] });
  });

  test("S2: advisor perspective — NAV with same data", async ({ page }) => {
    await installMocks(
      page,
      snap({
        score: SCORE,
        events: [EVENT_RUNNING, EVENT_COMPLETED],
        issues: [ISSUE_ACTIVE],
        decisions: [DECISION_WITH_RECS],
        systems: SYSTEMS_HEALTHY,
      }),
    );
    await page.goto(playerUrl("nav-01", "nav"));
    await expect(page.locator(".player-header__title")).toBeVisible();
    await expect(page).toHaveScreenshot("s2-advisor-nav.png", { fullPage: true, maxDiffPixelRatio: 0.02, mask: [page.locator("tfc-ambient-background"), page.locator("tfc-clock-display")] });
  });

  test("S3: briefing phase — CO, no score, no decisions", async ({ page }) => {
    await installMocks(page, snap({ phase: "briefing" }));
    await page.goto(playerUrl("co-01", "co"));
    await expect(page.locator("tfc-phase-badge")).toContainText("briefing");
    await expect(page).toHaveScreenshot("s3-briefing-co.png", { fullPage: true, maxDiffPixelRatio: 0.02, mask: [page.locator("tfc-ambient-background"), page.locator("tfc-clock-display")] });
  });

  test("S4: paused — NAV with score, no decisions", async ({ page }) => {
    await installMocks(
      page,
      snap({ phase: "paused", score: SCORE, systems: SYSTEMS_HEALTHY }),
    );
    await page.goto(playerUrl("nav-01", "nav"));
    await expect(page.locator("tfc-phase-badge")).toContainText("paused");
    await expect(page).toHaveScreenshot("s4-paused-nav.png", { fullPage: true, maxDiffPixelRatio: 0.02, mask: [page.locator("tfc-ambient-background"), page.locator("tfc-clock-display")] });
  });

  test("S5: completed — CO with score", async ({ page }) => {
    await installMocks(
      page,
      snap({ phase: "completed", score: SCORE }),
    );
    await page.goto(playerUrl("co-01", "co"));
    await expect(page.locator("tfc-phase-badge")).toContainText("completed");
    await expect(page).toHaveScreenshot("s5-completed-co.png", { fullPage: true, maxDiffPixelRatio: 0.02, mask: [page.locator("tfc-ambient-background"), page.locator("tfc-clock-display")] });
  });

  test("S6: empty setup — CO, no data", async ({ page }) => {
    await installMocks(page, snap({ phase: "setup" }));
    await page.goto(playerUrl("co-01", "co"));
    await expect(page.locator("tfc-phase-badge")).toContainText("setup");
    await expect(page).toHaveScreenshot("s6-setup-empty.png", { fullPage: true, maxDiffPixelRatio: 0.02, mask: [page.locator("tfc-ambient-background"), page.locator("tfc-clock-display")] });
  });

  test("S7: systems degraded — CO with red/yellow systems and decision", async ({ page }) => {
    await installMocks(
      page,
      snap({
        score: { ...SCORE, stress: 7 },
        events: [EVENT_RUNNING],
        issues: [ISSUE_ACTIVE],
        decisions: [DECISION_WITH_RECS],
        systems: SYSTEMS_DEGRADED,
      }),
    );
    await page.goto(playerUrl("co-01", "co"));
    await expect(page.locator("tfc-system-status-board")).toBeVisible();
    await expect(page).toHaveScreenshot("s7-systems-degraded.png", { fullPage: true, maxDiffPixelRatio: 0.02, mask: [page.locator("tfc-ambient-background"), page.locator("tfc-clock-display")] });
  });

  test("S8: practice mode — NAV advisor with score", async ({ page }) => {
    await installMocks(
      page,
      snap({ score: SCORE, systems: SYSTEMS_HEALTHY }),
    );
    await page.goto(playerUrl("nav-01", "nav", true));
    await expect(page.locator(".player-header__title")).toBeVisible();
    await expect(page).toHaveScreenshot("s8-practice-nav.png", { fullPage: true, maxDiffPixelRatio: 0.02, mask: [page.locator("tfc-ambient-background"), page.locator("tfc-clock-display")] });
  });

  test("S9: clean running — CO, no events/issues/decisions", async ({ page }) => {
    await installMocks(
      page,
      snap({ score: SCORE, systems: SYSTEMS_HEALTHY }),
    );
    await page.goto(playerUrl("co-01", "co"));
    await expect(page.locator(".player-header__title")).toBeVisible();
    await expect(page).toHaveScreenshot("s9-clean-running-co.png", { fullPage: true, maxDiffPixelRatio: 0.02, mask: [page.locator("tfc-ambient-background"), page.locator("tfc-clock-display")] });
  });

  test("S10: busy but no decision for CO — targeted to NAV", async ({ page }) => {
    await installMocks(
      page,
      snap({
        score: SCORE,
        events: [EVENT_RUNNING, EVENT_COMPLETED, EVENT_SCHEDULED],
        issues: [ISSUE_ACTIVE, ISSUE_RESOLVED],
        decisions: [DECISION_TARGETED_NAV],
        systems: SYSTEMS_DEGRADED,
      }),
    );
    await page.goto(playerUrl("co-01", "co"));
    await expect(page.locator(".player-header__title")).toBeVisible();
    await expect(page).toHaveScreenshot("s10-busy-no-decision-co.png", { fullPage: true, maxDiffPixelRatio: 0.02, mask: [page.locator("tfc-ambient-background"), page.locator("tfc-clock-display")] });
  });
});
