/**
 * Playwright e2e tests for the refined landing page flow.
 *
 * Tests the scenario picker, lobby preview, role assignment,
 * and joinable exercise detection.
 */
import {
  test,
  expect,
  mockParticipant,
} from "../fixtures/base.fixture";

const MOCK_ROLES = [
  { id: "co", label: "Commanding Officer (CO)", player_type: "decision_maker" },
  { id: "nav", label: "Navigator (NAV)", player_type: "advisor" },
];

const MOCK_SCENARIO = {
  id: 1,
  title: "Hospital MCI",
  description: "Mass casualty incident scenario",
  domain_id: null,
  content: {
    roles: MOCK_ROLES,
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

// ── Landing Page Default State ────────────────────────────────────────

test.describe("Landing page — no active exercise @home @landing", () => {
  test("shows main menu when no joinable exercise", async ({
    page,
    mockApi,
  }) => {
    await mockApi.install();
    await page.goto("/home");

    await expect(page.getByText("Training Flow Control")).toBeVisible();
    await expect(page.getByText("Run Exercise")).toBeVisible();
    await expect(page.getByText("Build Scenario")).toBeVisible();
    await expect(page.getByText("Review Results")).toBeVisible();
  });
});

// ── Scenario Picker ───────────────────────────────────────────────────

test.describe("Scenario picker @home @scenario-builder", () => {
  test('"Run Exercise" opens scenario picker', async ({ page, mockApi }) => {
    mockApi.seedScenario(MOCK_SCENARIO);
    await mockApi.install();
    await page.goto("/home");

    await page.getByText("Run Exercise").click();

    await expect(page.getByText("Hospital MCI")).toBeVisible();
    await expect(page.getByText("2 stations")).toBeVisible();
    await expect(
      page.getByText("Collaborative", { exact: true }),
    ).toBeVisible();
  });

  test("back button returns to main menu", async ({ page, mockApi }) => {
    mockApi.seedScenario(MOCK_SCENARIO);
    await mockApi.install();
    await page.goto("/home");

    await page.getByText("Run Exercise").click();
    await expect(page.getByText("Hospital MCI")).toBeVisible();

    await page.getByText("Back").click();
    await expect(page.getByText("Run Exercise")).toBeVisible();
  });
});

// ── Lobby Preview ─────────────────────────────────────────────────────

test.describe("Landing page — active lobby @home @landing", () => {
  test("shows lobby when joinable exercise exists", async ({
    page,
    mockApi,
  }) => {
    mockApi.seedJoinable({
      exercise: {
        id: 42,
        title: "Hospital MCI",
        game_mode: "simple_collaborative",
        scenario_id: 1,
      },
      participants: [],
      roles: MOCK_ROLES,
      max_players: 2,
      requires_gm: false,
    });
    await mockApi.install();
    await page.goto("/home");

    await expect(page.getByText("Join Exercise")).toBeVisible();
    await expect(
      page.getByText(/1 active operations? awaiting crew/),
    ).toBeVisible();
  });

  test("shows Join Exercise link in lobby preview", async ({
    page,
    mockApi,
  }) => {
    mockApi.seedJoinable({
      exercise: {
        id: 42,
        title: "Hospital MCI",
        game_mode: "simple_collaborative",
        scenario_id: 1,
      },
      participants: [],
      roles: MOCK_ROLES,
      max_players: 2,
      requires_gm: false,
    });
    await mockApi.install();
    await page.goto("/home");

    await expect(page.getByText("Join Exercise")).toBeVisible();
  });

  test("shows active operation count with participants", async ({
    page,
    mockApi,
  }) => {
    const alice = mockParticipant({
      display_name: "Alice",
      role: "co",
    });
    mockApi.seedJoinable({
      exercise: {
        id: 42,
        title: "Hospital MCI",
        game_mode: "simple_collaborative",
        scenario_id: 1,
      },
      participants: [alice],
      roles: MOCK_ROLES,
      max_players: 2,
      requires_gm: false,
    });
    await mockApi.install();
    await page.goto("/home");

    await expect(page.getByText("Join Exercise")).toBeVisible();
    await expect(
      page.getByText(/1 active operations? awaiting crew/),
    ).toBeVisible();
  });
});

// ── Scenario → Waiting Room Navigation ──────────────────────────────

test.describe(
  "Scenario to waiting room @home @waiting-room @scenario-picker",
  () => {
    test("clicking a collaborative scenario shows mode picker", async ({
      page,
      mockApi,
    }) => {
      mockApi.seedScenario(MOCK_SCENARIO);
      await mockApi.install();
      await page.goto("/home");

      // Step 1: Click "Run Exercise" to open the scenario picker
      await page.getByText("Run Exercise").click();
      await expect(page.getByText("Hospital MCI")).toBeVisible();

      // Step 2: Click the scenario card → mode picker appears
      await page.getByText("Hospital MCI").click();

      // Step 3: Mode picker should show play-mode options
      await expect(page.getByText("Select Operation Type")).toBeVisible();
      await expect(page.getByText("Full Team")).toBeVisible();
      await expect(page.getByText("2 Players")).toBeVisible();
      await expect(page.getByText("Practice (Solo)")).toBeVisible();
    });
  },
);

// ── Join Exercise Card Display ────────────────────────────────────────

test.describe("Join Exercise card @home @landing", () => {
  test("shows Join Exercise card with Live badge", async ({
    page,
    mockApi,
  }) => {
    mockApi.seedJoinable({
      exercise: {
        id: 42,
        title: "Test Exercise",
        game_mode: "simple_collaborative",
        scenario_id: 1,
      },
      participants: [],
      roles: MOCK_ROLES,
      max_players: 2,
      requires_gm: false,
    });
    await mockApi.install();
    await page.goto("/home");

    await expect(page.getByText("Join Exercise")).toBeVisible();
    await expect(page.getByText("Live")).toBeVisible();
  });

  test("shows Join Exercise card for classic mode", async ({
    page,
    mockApi,
  }) => {
    mockApi.seedJoinable({
      exercise: {
        id: 42,
        title: "Classic Exercise",
        game_mode: "classic",
        scenario_id: 1,
      },
      participants: [],
      roles: MOCK_ROLES,
      max_players: 3,
      requires_gm: true,
    });
    await mockApi.install();
    await page.goto("/home");

    await expect(page.getByText("Join Exercise")).toBeVisible();
    await expect(page.getByText("Live")).toBeVisible();
  });
});
