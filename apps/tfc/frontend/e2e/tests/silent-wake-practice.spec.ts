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
 *   UI: for each of 15 decisions: read → select options → submit
 *   API: stop exercise (cleanup)
 *
 * Decision flow:
 *   Event evt-t1 fires at t=0 → opens a free_text decision (no matching template).
 *   Closing evt-t1 triggers decision chaining: on_decision_closed_v2 increments
 *   current_index to 1, so get_next_decision_id returns decision_sequence[1] = dec-t2.
 *   dec-t1 is never instantiated — evt-t1 IS the Turn 1 decision.
 *   Subsequent closures chain dec-t3 → dec-t4 → ... → dec-t15.
 */
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ── Configuration ────────────────────────────────────────────────────

const API_BASE = "http://localhost:8001";
const SCENARIO_TITLE = "Silent Wake";
const FETCH_TIMEOUT_MS = 5_000;

// Load seed to know decision templates & top-scoring options
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
  forced_option_ids?: string[];
  options: { id: string; label: string; score: number }[];
}[];

try {
  SEED = JSON.parse(readFileSync(seedPath, "utf-8"));
  CONTENT = SEED.content as Record<string, unknown>;
  DECISION_SEQUENCE = CONTENT.decision_sequence as string[];
  DECISION_TEMPLATES = CONTENT.decision_templates as typeof DECISION_TEMPLATES;
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

/** Poll until a decision ID is confirmed closed. Returns true or throws on timeout. */
async function waitForDecisionClosed(
  exerciseId: number,
  decisionId: string,
  timeoutMs = 10_000,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const snap = await getSnapshot(exerciseId);
    if (snap.decisions.some((d) => d.id === decisionId && d.status === "closed")) {
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
    return `/player?exerciseId=${exerciseId}&participantId=${participantId}&role=solo_player&gameMode=simple_collaborative&practiceMode=true`;
  }

  // ── Smoke: verify setup ──────────────────────────────────────────

  test("engine is running with first decision open", async () => {
    const snap = await getSnapshot(exerciseId);
    expect(snap.phase).toBe("running");
    const open = snap.decisions.find((d) => d.status === "open");
    expect(open).toBeDefined();
  });

  // ── Turn 1: event-triggered free-text decision (evt-t1) ────────

  test("Turn 1 — renders event narrative and practice mode UI", async ({
    page,
  }) => {
    await page.goto(playerUrl());
    await dismissViteErrors(page);

    // Practice mode footer
    await expect(
      page.getByText("Practice Mode — playing all roles"),
    ).toBeVisible();

    // Context panel shows the briefing
    await expect(
      page.getByText(CONTENT.briefing as string, { exact: false }),
    ).toBeVisible();

    // The first decision is evt-t1 (event-based, free_text — no template match)
    // In practice mode it shows the all-advisors panel first
    await expect(page.locator("tfc-all-advisors-panel")).toBeVisible({ timeout: 10_000 });
  });

  test("Turn 1 — close event decision via advisor submit → Proceed → Submit", async ({
    page,
  }) => {
    await page.goto(playerUrl());
    await dismissViteErrors(page);
    await expect(page.locator("tfc-all-advisors-panel")).toBeVisible({ timeout: 10_000 });

    // Practice mode Phase 1: all-advisors panel with Operations Officer tab
    // The advisor dialog is open with a free_text textarea — submit it first
    const textarea = page.locator("tfc-all-advisors-panel textarea");
    await expect(textarea).toBeVisible({ timeout: 5_000 });
    await textarea.fill("Acknowledged. Continue transit.");
    await page.locator("tfc-all-advisors-panel").getByRole("button", { name: "Submit" }).first().click();

    // After advisor submission, "Proceed to Decision" should be clickable
    const proceedBtn = page.getByRole("button", { name: "Proceed to Decision" });
    await expect(proceedBtn).toBeVisible({ timeout: 5_000 });
    await proceedBtn.click();

    // Phase 2: decision panel for the decision-maker — another free_text
    const phase2Textarea = page.locator("tfc-decision-panel textarea");
    await expect(phase2Textarea).toBeVisible({ timeout: 5_000 });
    await phase2Textarea.fill("Continue transit. All stations nominal.");

    // Submit the decision
    await page.locator("tfc-decision-panel").getByRole("button", { name: "Submit" }).click();

    // Verify closure via API (decision panel stays because next decision chains instantly)
    await waitForDecisionClosed(exerciseId, "evt-t1");
  });

  // ── Turns 2-15: multi-choice decision templates ────────────────

  // After evt-t1 closes, the engine chains: on_decision_closed_v2 increments
  // current_index from 0→1, so get_next_decision_id returns decision_sequence[1] = dec-t2.
  // Each subsequent close chains to the next in sequence: dec-t3, dec-t4, ..., dec-t15.

  for (let seqIdx = 1; seqIdx < DECISION_SEQUENCE.length; seqIdx++) {
    const decId = DECISION_SEQUENCE[seqIdx];
    const tpl = DECISION_TEMPLATES.find((t) => t.id === decId);
    if (!tpl) continue;

    const turnLabel = `Turn ${seqIdx + 1}`;

    test(`${turnLabel} — "${tpl.title}" renders and submits`, async ({
      page,
    }) => {
      // Wait for this specific decision to be open in the engine
      await waitForOpenDecision(exerciseId, decId, 15_000);

      // Navigate to player view
      await page.goto(playerUrl());
      await dismissViteErrors(page);

      // Wait for all-advisors panel with decision
      const advisorPanel = page.locator("tfc-all-advisors-panel");
      await expect(advisorPanel).toBeVisible({ timeout: 10_000 });

      // Practice mode Phase 1: advisor dialog is open
      // Submit a recommendation using the top-scoring option
      const advisorCheckbox = advisorPanel.locator('input[type="checkbox"]').first();
      await expect(advisorCheckbox).toBeVisible({ timeout: 5_000 });
      const advisorPicks = topOptions(tpl);
      for (const pickId of advisorPicks.slice(0, 1)) {
        const opt = tpl.options.find((o) => o.id === pickId)!;
        await advisorPanel.getByText(opt.label).first().click();
      }
      await advisorPanel.getByRole("button", { name: "Submit" }).first().click();

      // Click "Proceed to Decision" to move to Phase 2
      const proceedBtn = page.getByRole("button", {
        name: "Proceed to Decision",
      });
      await expect(proceedBtn).toBeVisible({ timeout: 5_000 });
      await proceedBtn.click();

      // Phase 2: decision panel for the decision-maker
      const decisionPanel = page.locator("tfc-decision-panel");
      await expect(page.getByText(tpl.title)).toBeVisible({ timeout: 5_000 });

      // Verify all options are rendered
      for (const opt of tpl.options) {
        await expect(page.getByText(opt.label)).toBeVisible();
      }

      // Select top-scoring options (checkboxes)
      const picks = topOptions(tpl);
      for (const pickId of picks) {
        const opt = tpl.options.find((o) => o.id === pickId)!;
        await decisionPanel.getByText(opt.label).click();
      }

      // Submit
      const submitBtn = decisionPanel.getByRole("button", { name: "Submit" });
      await expect(submitBtn).toBeEnabled();
      await submitBtn.click();

      // Verify closure via API (decision panel stays because next decision chains instantly)
      await waitForDecisionClosed(exerciseId, decId);
    });
  }

  // ── Post-game verification ─────────────────────────────────────

  test("all 15 decisions completed — score reflects all turns", async () => {
    const snap = await getSnapshot(exerciseId);

    const openDecs = snap.decisions.filter((d) => d.status === "open");
    expect(openDecs.length).toBe(0);

    expect(snap.score).not.toBeNull();
    expect(snap.score?.turn_number).toBe(15);
    expect(snap.score?.total_score).toBeGreaterThan(0);
  });

  test("final UI shows no decision overlay", async ({ page }) => {
    await page.goto(playerUrl());
    await dismissViteErrors(page);

    // No active decision → no decision panel
    await expect(page.locator("tfc-decision-panel")).not.toBeVisible({ timeout: 5_000 });
    await expect(page.locator("tfc-all-advisors-panel")).not.toBeVisible({ timeout: 5_000 });

    // Practice mode footer still visible
    await expect(
      page.getByText("Practice Mode — playing all roles"),
    ).toBeVisible();

    // Score bar should show final turn
    await expect(page.locator("tfc-score-bar")).toBeVisible();
  });
});
