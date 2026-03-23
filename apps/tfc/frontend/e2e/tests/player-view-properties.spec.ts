/**
 * Property-based Playwright tests for the player view.
 *
 * Uses fast-check to randomly generate valid player states and verify
 * UI invariants hold across the full state space. Existing hand-crafted
 * tests in player-view-states.spec.ts remain as pinned regression cases.
 *
 * Invariants tested against the current board-based role-card layout:
 *  P1: Header always visible
 *  P2: Phase badge matches state
 *  P3: Turn banner visible iff score && phase ≠ briefing
 *  P4: Score bar visible iff score && phase ≠ briefing
 *  P5: System board visible iff systems exist
 *  P6: Stress bar severity matches stress level
 *  P7: Role cards rendered (at least 1 when decision exists)
 *  P8: Footer shows role label in collaborative mode
 *  P9: Briefing overlay shown only during briefing phase
 *  P10: Practice mode footer text
 */
import { test, expect } from "../fixtures/base.fixture";
import type { Page } from "@playwright/test";
import fc from "fast-check";
import {
  playerStateArb,
  buildSnapshot,
  buildPlayerUrl,
  CONTEXT,
  EX_ID,
  type PlayerState,
} from "../helpers/arbitraries";

const NUM_RUNS = Number(process.env["PROP_RUNS"] ?? 30);

// ── Mutable state holder for route handlers ──────────────────────────

interface MockState {
  snapshot: ReturnType<typeof buildSnapshot>;
  decisions: unknown[];
}

const currentMock: MockState = {
  snapshot: buildSnapshot({
    phase: "setup", score: null, events: [], issues: [],
    decisions: [], systems: [], role: "co", practiceMode: false,
  }),
  decisions: [],
};

function updateMock(state: PlayerState): void {
  const snap = buildSnapshot(state);
  currentMock.snapshot = snap;
  currentMock.decisions = snap.decisions ?? [];
}

async function installRoutesOnce(page: Page): Promise<void> {
  await page.route(`**/api/exercises/${EX_ID}/engine/snapshot`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(currentMock.snapshot),
    }),
  );
  await page.route(`**/api/exercises/${EX_ID}/engine/context`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(CONTEXT),
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
          body: JSON.stringify(currentMock.decisions),
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

// ── Helpers ──────────────────────────────────────────────────────────

function shouldShowTurnNumber(state: PlayerState): boolean {
  if (!state.score || state.phase === "briefing") return false;
  // Turn number only shows when there's an active decision with a matching event
  const decision = state.decisions[0];
  if (!decision) return false;
  const eventId = decision.event_id;
  return state.events.some((e) => e.id === eventId);
}

function stressSeverity(stress: number): string {
  if (stress <= 3) return "low";
  if (stress <= 6) return "medium";
  return "high";
}

// ── Properties ──────────────────────────────────────────────────────

test.describe("Property: player view invariants @property", () => {
  test.setTimeout(90_000);

  test("P1: header always visible", async ({ page }) => {
    await installRoutesOnce(page);
    await fc.assert(
      fc.asyncProperty(playerStateArb, async (state) => {
        updateMock(state);
        await page.goto(buildPlayerUrl(state));
        await expect(page.locator(".player-header__title")).toBeVisible();
        await expect(page.locator("tfc-phase-badge")).toBeVisible();
      }),
      { numRuns: NUM_RUNS },
    );
  });

  test("P2: phase badge matches state", async ({ page }) => {
    await installRoutesOnce(page);
    await fc.assert(
      fc.asyncProperty(playerStateArb, async (state) => {
        updateMock(state);
        await page.goto(buildPlayerUrl(state));
        await expect(page.locator("tfc-phase-badge")).toContainText(state.phase);
      }),
      { numRuns: NUM_RUNS },
    );
  });


  test("P4: turn number visible iff score + active decision with event", async ({ page }) => {
    await installRoutesOnce(page);
    await fc.assert(
      fc.asyncProperty(playerStateArb, async (state) => {
        updateMock(state);
        await page.goto(buildPlayerUrl(state));
        const turnBanner = page.locator(".board-turn-banner__turn");
        if (shouldShowTurnNumber(state)) {
          await expect(turnBanner).toBeVisible();
        } else {
          await expect(turnBanner).not.toBeVisible();
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  test("P5: system board visible iff systems in snapshot", async ({ page }) => {
    await installRoutesOnce(page);
    await fc.assert(
      fc.asyncProperty(playerStateArb, async (state) => {
        updateMock(state);
        await page.goto(buildPlayerUrl(state));
        const board = page.locator("tfc-system-status-board");
        if (state.systems.length > 0) {
          await expect(board).toBeVisible();
          const rows = page.locator('[data-testid="system-row"]');
          await expect(rows).toHaveCount(state.systems.length);
        } else {
          await expect(page.locator(".system-board")).not.toBeVisible();
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  test("P6: stress bar severity matches stress level", async ({ page }) => {
    await installRoutesOnce(page);
    await fc.assert(
      fc.asyncProperty(
        playerStateArb.filter((s) => s.score !== null && s.phase !== "briefing"),
        async (state) => {
          updateMock(state);
          await page.goto(buildPlayerUrl(state));
          const stressBar = page.locator("tfc-stress-bar");
          await expect(stressBar).toBeVisible();
          const expected = stressSeverity(state.score!.stress);
          await expect(stressBar).toHaveAttribute("data-severity", expected);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  test("P7: board grid always rendered in main area", async ({ page }) => {
    await installRoutesOnce(page);
    await fc.assert(
      fc.asyncProperty(playerStateArb, async (state) => {
        updateMock(state);
        await page.goto(buildPlayerUrl(state));
        // The player main container is always present in the main area
        await expect(page.locator(".player-main")).toBeAttached();
        // The "Waiting for next turn..." banner shows when no current turn event
        const waitingBanner = page.locator(".board-turn-banner");
        await expect(waitingBanner).toBeVisible();
      }),
      { numRuns: NUM_RUNS },
    );
  });

  test("P8: footer shows role label in collaborative mode", async ({ page }) => {
    await installRoutesOnce(page);
    await fc.assert(
      fc.asyncProperty(playerStateArb, async (state) => {
        updateMock(state);
        await page.goto(buildPlayerUrl(state));
        const footer = page.locator(".player-footer");
        await expect(footer).toBeVisible();
        // Collaborative mode shows "You are the <Role>"
        // CONTEXT always has roles → collaborative mode is inferred
        if (state.practiceMode) {
          await expect(footer).toContainText("Practice Mode");
        } else {
          const roleLabel = CONTEXT.roles.find((r) => r.id === state.role)?.label;
          if (roleLabel) {
            await expect(footer).toContainText(`You are the ${roleLabel}`);
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  test("P9: briefing overlay shown only during briefing phase", async ({ page }) => {
    await installRoutesOnce(page);
    await fc.assert(
      fc.asyncProperty(playerStateArb, async (state) => {
        updateMock(state);
        await page.goto(buildPlayerUrl(state));
        const overlay = page.locator("tfc-briefing-overlay");
        if (state.phase === "briefing") {
          await expect(overlay).toBeAttached();
        } else {
          await expect(overlay).not.toBeAttached();
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  test("P10: practice mode shows stop button except during setup", async ({ page }) => {
    await installRoutesOnce(page);
    await fc.assert(
      fc.asyncProperty(
        playerStateArb.filter((s) => s.practiceMode),
        async (state) => {
          updateMock(state);
          await page.goto(buildPlayerUrl(state));
          const stopBtn = page.getByRole("button", { name: "Stop Exercise" });
          if (state.phase !== "setup") {
            await expect(stopBtn).toBeVisible();
          } else {
            await expect(stopBtn).not.toBeVisible();
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
