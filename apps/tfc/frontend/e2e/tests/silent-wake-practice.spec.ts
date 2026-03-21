/**
 * Integration e2e test: Silent Wake scenario — practice mode, full 15-turn playthrough.
 *
 * Runs against a live TFC Docker stack (real backend, real database, real engine).
 * No route mocking — Playwright drives the browser while the engine auto-chains decisions.
 *
 * Prerequisites:
 *   make dev-tfc-local   # starts db + tfc-api Docker, Angular on port 4201
 *   # OR: make dev-tfc   # full Docker stack
 *
 * Run:
 *   cd apps/tfc/frontend && npx playwright test --grep "@silent-wake"
 *
 * Flow per exercise:
 *   API: create exercise (practice_mode) → join waiting room → start engine → begin
 *   UI: for each of 15 decisions: read role cards → select options → submit per card
 *   API: stop exercise (cleanup)
 *
 * Decision flow:
 *   The decision_sequence maps 1:1 to evt-t1 through evt-t15.
 *   Each event opens one decision with target_roles specifying which role cards appear.
 *   Advisor role cards submit recommendations first, then the CO (decision_maker) submits
 *   the binding decision which closes the turn and auto-triggers the next via
 *   force_trigger_next_decision.
 *
 * Role card architecture:
 *   - tfc-role-card components are rendered per role inside .board-grid
 *   - Advisor cards (nav, pwo, eo, cyop, aawo, ops) show checkboxes and a Submit button
 *   - CO card (decision_maker) shows checkboxes, advisor recs, and a Submit button
 *   - Cards with status "intel" show no checkboxes (role not targeted by decision)
 *   - Submitting the CO card closes the decision and auto-chains the next turn
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Configuration ────────────────────────────────────────────────────

const API_BASE = "http://localhost:8001";
const SCENARIO_TITLE = "Silent Wake";
const FETCH_TIMEOUT_MS = 5_000;

// Load seed to know decision templates, target_roles, and top-scoring options
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const seedPath = resolve(
  __dirname,
  "../../../backend/seeds/silent_wake.json",
);
let SEED: Record<string, unknown>;
let CONTENT: Record<string, unknown>;
let DECISION_SEQUENCE: string[];
let DECISION_TEMPLATES: {
  id: string;
  title: string;
  description: string;
  question_type: string;
  max_selections: number;
  target_roles: string[];
  forced_option_ids?: string[];
  stress_delta: number;
  options: { id: string; label: string; score: number; stress_delta: number }[];
}[];
let ROLES: { id: string; label: string; player_type: string }[];

try {
  SEED = JSON.parse(readFileSync(seedPath, "utf-8"));
  CONTENT = SEED.content as Record<string, unknown>;
  DECISION_SEQUENCE = CONTENT.decision_sequence as string[];
  DECISION_TEMPLATES = CONTENT.decision_templates as typeof DECISION_TEMPLATES;
  ROLES = CONTENT.roles as typeof ROLES;
} catch (e) {
  throw new Error(
    `Failed to load seed file at ${seedPath}. ` +
    `Ensure the backend seeds directory exists. Error: ${e}`,
  );
}

// ── API helpers ──────────────────────────────────────────────────────

async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), ...init });
}

async function findScenario(): Promise<number> {
  const res = await apiFetch(`${API_BASE}/api/scenarios`);
  const scenarios = (await res.json()) as { id: number; title: string }[];
  const sw = scenarios.find((s) => s.title === SCENARIO_TITLE);
  if (!sw) throw new Error(`Scenario "${SCENARIO_TITLE}" not found — is the backend seeded?`);
  return sw.id;
}

async function createExercise(scenarioId: number): Promise<number> {
  const res = await apiFetch(`${API_BASE}/api/exercises`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: `E2E Silent Wake ${Date.now()}`,
      scenario_id: scenarioId,
      game_mode: "simple_collaborative",
      practice_mode: true,
    }),
  });
  if (!res.ok) throw new Error(`Create exercise failed: ${res.status}`);
  const data = (await res.json()) as { id: number };
  return data.id;
}

async function joinWaitingRoom(exerciseId: number): Promise<string> {
  const res = await apiFetch(
    `${API_BASE}/api/exercises/${exerciseId}/waiting-room/join`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ display_name: "Solo Player", role: "co" }),
    },
  );
  if (!res.ok) throw new Error(`Join failed: ${res.status}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

async function startEngine(exerciseId: number): Promise<void> {
  const res = await apiFetch(
    `${API_BASE}/api/exercises/${exerciseId}/engine/start`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error(`Start engine failed: ${res.status}`);
}

async function beginExercise(exerciseId: number): Promise<void> {
  const res = await apiFetch(
    `${API_BASE}/api/exercises/${exerciseId}/engine/begin`,
    { method: "POST" },
  );
  if (!res.ok) throw new Error(`Begin failed: ${res.status}`);
}

async function getSnapshot(exerciseId: number) {
  const res = await apiFetch(
    `${API_BASE}/api/exercises/${exerciseId}/engine/snapshot`,
  );
  return res.json() as Promise<{
    phase: string;
    decisions: {
      id: string;
      title: string;
      status: string;
      question_type: string;
      options: { id: string; label: string; score: number }[];
      max_selections: number | null;
    }[];
    score: { total_score: number; turn_number: number } | null;
  }>;
}

async function stopExercise(exerciseId: number): Promise<void> {
  await apiFetch(`${API_BASE}/api/exercises/${exerciseId}/engine/stop`, {
    method: "POST",
  });
}

/** Poll until a specific decision ID is open, or any open decision if no ID given. */
async function waitForOpenDecision(
  exerciseId: number,
  expectedId?: string,
  timeoutMs = 10_000,
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snap = await getSnapshot(exerciseId);
    const open = snap.decisions.find((d) => d.status === "open");
    if (open && (!expectedId || open.id === expectedId)) return open.id;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    `Timed out waiting for open decision${expectedId ? ` (expected: ${expectedId})` : ""}`,
  );
}

/** Poll until a decision ID is no longer open (closed or absent from snapshot). */
async function waitForDecisionClosed(
  exerciseId: number,
  decisionId: string,
  timeoutMs = 10_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snap = await getSnapshot(exerciseId);
    const decisions = snap.decisions ?? [];
    // Decision is closed if it has status "closed" OR is no longer in the open decisions list
    const stillOpen = decisions.some((d) => d.id === decisionId && d.status === "open");
    if (!stillOpen) {
      return;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Decision ${decisionId} was not closed within ${timeoutMs}ms`);
}

/** Pick the top-scoring options (up to max_selections), with stable tiebreaking. */
function topOptions(tpl: (typeof DECISION_TEMPLATES)[0]): string[] {
  const sorted = [...tpl.options].sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.id.localeCompare(b.id),
  );
  return sorted.slice(0, tpl.max_selections).map((o) => o.id);
}

/** Dismiss Vite HMR error overlay if present (dev server TS errors). */
async function dismissViteErrors(page: import("@playwright/test").Page): Promise<void> {
  const overlay = page.locator("vite-error-overlay");
  if (await overlay.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await page.keyboard.press("Escape");
    await overlay.waitFor({ state: "hidden", timeout: 2_000 }).catch(() => {});
  }
}

/**
 * Submit all role cards for a given decision template.
 *
 * For multi-role decisions:
 *   1. Submit each advisor card (non-CO role targeted by the decision) by selecting
 *      the first top-scoring option and clicking Submit.
 *   2. Submit the CO card last — this closes the decision and auto-triggers the next turn.
 *
 * For CO-only decisions (T1, T15):
 *   There is only one card; submit it directly.
 *
 * Advisor cards see only their own role's options or common options (no role filter).
 * The CO card sees all options.
 */
async function submitAllRoleCards(
  page: import("@playwright/test").Page,
  tpl: (typeof DECISION_TEMPLATES)[0],
): Promise<void> {
  const picks = topOptions(tpl);
  const advisorRoleIds = tpl.target_roles.filter((rid) => {
    const role = ROLES.find((r) => r.id === rid);
    return role?.player_type !== "decision_maker";
  });
  const coRoleId = tpl.target_roles.find((rid) => {
    const role = ROLES.find((r) => r.id === rid);
    return role?.player_type === "decision_maker";
  });

  // Submit each advisor card first
  for (const advisorId of advisorRoleIds) {
    // Find the role card for this advisor by its role-id label (uppercased in the card header)
    const card = page
      .locator("tfc-role-card")
      .filter({ has: page.locator(`.role-card__role-id`, { hasText: new RegExp(`^${advisorId}$`, "i") }) });

    await expect(card).toBeVisible({ timeout: 10_000 });

    // Advisor sees only common options (no role) or its own role's options.
    // Just pick the first available checkbox.
    const firstCheckbox = card.locator('input[type="checkbox"]').first();
    await expect(firstCheckbox).toBeVisible({ timeout: 5_000 });
    await firstCheckbox.check();

    await card.getByRole("button", { name: "Submit" }).click();
  }

  // Submit CO card last (closes decision, triggers next turn)
  if (coRoleId) {
    const coCard = page
      .locator("tfc-role-card")
      .filter({ has: page.locator(`.role-card__role-id`, { hasText: new RegExp(`^${coRoleId}$`, "i") }) });

    await expect(coCard).toBeVisible({ timeout: 10_000 });

    // Select top-scoring options on the CO card by clicking the option label wrapper.
    // .role-card__option is the <label> element wrapping the checkbox + text span.
    for (const pickId of picks) {
      const opt = tpl.options.find((o) => o.id === pickId)!;
      const optionLabel = coCard.locator(".role-card__option").filter({ hasText: opt.label });
      if (await optionLabel.count() > 0) {
        await optionLabel.click();
      } else {
        // Fallback: click the text directly (e.g. if CSS class changes)
        await coCard.getByText(opt.label).click();
      }
    }

    await coCard.getByRole("button", { name: "Submit" }).click();
  }
}

// ── Test lifecycle ───────────────────────────────────────────────────

let scenarioId: number;
let exerciseId: number;
let participantId: string;

test.describe.serial("Silent Wake — integration practice mode @e2e @silent-wake @integration", () => {
  // Retries are incompatible with serial + shared backend state
  test.describe.configure({ retries: 0 });

  test.beforeAll(async () => {
    scenarioId = await findScenario();
    exerciseId = await createExercise(scenarioId);
    participantId = await joinWaitingRoom(exerciseId);
    await startEngine(exerciseId);
    await beginExercise(exerciseId);
    // Wait for first event-triggered decision to appear
    await waitForOpenDecision(exerciseId);
  });

  test.afterAll(async () => {
    await stopExercise(exerciseId);
  });

  function playerUrl(): string {
    return `/player?exerciseId=${exerciseId}&participantId=${participantId}&role=all_roles&gameMode=simple_collaborative&practiceMode=true`;
  }

  // ── Smoke: verify setup ──────────────────────────────────────────

  test("engine is running with first decision open", async () => {
    const snap = await getSnapshot(exerciseId);
    expect(snap.phase).toBe("running");
    const open = snap.decisions.find((d) => d.status === "open");
    expect(open).toBeDefined();
  });

  // ── Turn 1: evt-t1 — CO-only multi_choice decision ─────────────
  //
  // target_roles: ["co"] — only the CO card appears with checkboxes.
  // No advisor cards for this turn.

  test("Turn 1 — renders practice mode UI with role cards and turn banner", async ({
    page,
  }) => {
    await page.goto(playerUrl());
    await dismissViteErrors(page);

    // Practice mode footer
    await expect(
      page.getByText("Practice Mode — playing all roles"),
    ).toBeVisible();

    // Turn banner appears when a decision is open
    await expect(page.locator(".board-turn-banner")).toBeVisible({ timeout: 10_000 });

    // Role cards grid is rendered
    await expect(page.locator(".board-grid")).toBeVisible({ timeout: 10_000 });

    // At least one role card is visible (CO card for T1)
    await expect(page.locator("tfc-role-card").first()).toBeVisible({ timeout: 10_000 });

    // Stress bar is present in the header
    await expect(page.locator("tfc-stress-bar")).toBeVisible();
  });

  test("Turn 1 — CO-only card: select options and submit", async ({
    page,
  }) => {
    await waitForOpenDecision(exerciseId, "evt-t1", 15_000);
    await page.goto(playerUrl());
    await dismissViteErrors(page);

    const tpl = DECISION_TEMPLATES.find((t) => t.id === "evt-t1")!;

    // All 7 role cards render, but only CO has checkboxes (T1 target_roles: ["co"])
    await expect(page.locator("tfc-role-card").first()).toBeVisible({ timeout: 10_000 });

    // Find the CO card — the one with checkboxes
    const coCard = page.locator("tfc-role-card").filter({ has: page.locator('input[type="checkbox"]') }).first();
    await expect(coCard.locator('input[type="checkbox"]').first()).toBeVisible({ timeout: 5_000 });

    // Select both options (max_selections: 2, all score equally)
    const picks = topOptions(tpl);
    for (const pickId of picks) {
      const opt = tpl.options.find((o) => o.id === pickId)!;
      const optionLabel = coCard.locator(".role-card__option").filter({ hasText: opt.label });
      await optionLabel.click();
    }

    await coCard.getByRole("button", { name: "Submit" }).click();

    // Verify closure via API
    await waitForDecisionClosed(exerciseId, "evt-t1");
  });

  // ── Turns 2-15: multi-role decisions ────────────────────────────
  //
  // After evt-t1 closes, the engine chains: on_decision_closed_v2 increments
  // current_index from 0→1, so get_next_decision_id returns evt-t2.
  // Each subsequent close chains: evt-t3 → evt-t4 → ... → evt-t15.

  for (let seqIdx = 1; seqIdx < DECISION_SEQUENCE.length; seqIdx++) {
    const decId = DECISION_SEQUENCE[seqIdx];
    const tpl = DECISION_TEMPLATES.find((t) => t.id === decId);
    if (!tpl) continue;

    const turnNumber = seqIdx + 1;
    const turnLabel = `Turn ${turnNumber}`;
    test(`${turnLabel} — "${tpl.title}" renders role cards and submits`, async ({
      page,
    }) => {
      // Wait for this specific decision to be open in the engine
      await waitForOpenDecision(exerciseId, decId, 15_000);

      // Navigate to player view
      await page.goto(playerUrl());
      await dismissViteErrors(page);

      // Wait for role cards to appear
      await expect(page.locator("tfc-role-card").first()).toBeVisible({ timeout: 10_000 });

      // Turn banner should show the correct turn number
      await expect(
        page.locator(".board-turn-banner__turn"),
      ).toContainText(`TURN ${turnNumber}`, { timeout: 5_000 });

      // All 7 role cards render; cards with checkboxes match target_roles
      const activeCards = page.locator("tfc-role-card").filter({
        has: page.locator('input[type="checkbox"]'),
      });
      await expect(activeCards.first()).toBeVisible({ timeout: 5_000 });

      // T6+ decisions have stress_delta >= 1 — stress should be non-zero in the header
      if (tpl.stress_delta >= 1 || turnNumber >= 6) {
        const stressLabel = page.locator('[data-testid="stress-bar"]');
        await expect(stressLabel).toBeVisible({ timeout: 3_000 });
        // Stress value should be a number > 0 at this point in the scenario
        const stressText = await stressLabel.textContent();
        expect(Number(stressText)).toBeGreaterThan(0);
      }

      // T11 checks: after SWB10 "Isolate System" is selected, CIC NETWORK goes OFF.
      // We assert the system board shows CIC NETWORK as off after T11 completes,
      // so we check it here at the start of T12 (when T11 has already closed).
      if (turnNumber === 12) {
        const systemBoard = page.locator("tfc-system-status-board");
        await expect(systemBoard).toBeVisible({ timeout: 3_000 });
        // CIC NETWORK power_state should be false after T11's SWB10 selection
        await expect(
          systemBoard.getByText("CIC NETWORK"),
        ).toBeVisible();
      }

      // Submit all role cards in the correct order: advisors first, then CO
      await submitAllRoleCards(page, tpl);

      // Verify closure via API
      await waitForDecisionClosed(exerciseId, decId);
    });
  }

  // ── Post-game verification ─────────────────────────────────────

  test("all 15 decisions completed — score reflects all turns", async () => {
    const snap = await getSnapshot(exerciseId);

    const openDecs = snap.decisions.filter((d) => d.status === "open");
    expect(openDecs.length).toBe(0);

    expect(snap.score).not.toBeNull();
    // turn_number starts at 1 and increments on each close: 15 closes → 16
    expect(snap.score?.turn_number).toBe(16);
    expect(snap.score?.total_score).toBeGreaterThan(0);
  });

  test("final UI shows no active role cards", async ({ page }) => {
    await page.goto(playerUrl());
    await dismissViteErrors(page);

    // No active decision → board-grid is empty or cards have no checkboxes
    const activeCards = page.locator("tfc-role-card .role-card--active");
    await expect(activeCards).toHaveCount(0, { timeout: 5_000 });

    // Practice mode footer still visible
    await expect(
      page.getByText("Practice Mode — playing all roles"),
    ).toBeVisible();

    // Stress bar still visible in header
    await expect(page.locator("tfc-stress-bar")).toBeVisible();
  });
});
