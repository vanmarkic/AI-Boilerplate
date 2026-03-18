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
  type MockParticipant,
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
    await expect(page.getByText("2 roles")).toBeVisible();
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

    await expect(page.getByText("Hospital MCI")).toBeVisible();
    await expect(page.getByText("0 / 2 players")).toBeVisible();
    await expect(page.getByText("Commanding Officer (CO)")).toBeVisible();
    await expect(page.getByText("Navigator (NAV)")).toBeVisible();
  });

  test("shows name input and join button when not joined", async ({
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

    await expect(page.locator("input#lobby-name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Join" })).toBeVisible();
  });

  test("shows existing participants in lobby", async ({ page, mockApi }) => {
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

    await expect(page.getByText("Alice")).toBeVisible();
    await expect(page.getByText("1 / 2 players")).toBeVisible();
  });
});

// ── Scenario → Waiting Room Navigation ──────────────────────────────

test.describe(
  "Scenario to waiting room @home @waiting-room @scenario-picker",
  () => {
    test("clicking a scenario creates exercise and shows lobby (waiting room)", async ({
      page,
      mockApi,
    }) => {
      mockApi.seedScenario(MOCK_SCENARIO);

      // After exercise creation, the joinable endpoint must return the new exercise.
      // Track whether POST /exercises has been called so we can switch the response.
      let exerciseCreated = false;

      await mockApi.install();

      // Override the joinable route to return the lobby after creation
      await page.route("**/api/exercises/joinable", async (route) => {
        if (route.request().method() !== "GET") {
          await route.fallback();
          return;
        }
        if (!exerciseCreated) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([]),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([
              {
                exercise: {
                  id: 99,
                  title: "Hospital MCI",
                  game_mode: "simple_collaborative",
                  scenario_id: 1,
                },
                participants: [],
                roles: MOCK_ROLES,
                max_players: 2,
                requires_gm: false,
              },
            ]),
          });
        }
      });

      // Override POST /exercises to flip the flag
      await page.route("**/api/exercises", async (route) => {
        if (route.request().method() !== "POST") {
          await route.fallback();
          return;
        }
        exerciseCreated = true;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: 99,
            title: "Hospital MCI",
            description: "",
            phase: "setup",
            scenario_id: 1,
            domain_id: null,
            time_factor: 1.0,
            game_mode: "simple_collaborative",
            session_code: "ABCDEF",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        });
      });

      await page.goto("/home");

      // Step 1: Click "Run Exercise" to open the scenario picker
      await page.getByText("Run Exercise").click();
      await expect(page.getByText("Hospital MCI")).toBeVisible();

      // Step 2: Click the scenario card
      await page.getByText("Hospital MCI").click();

      // Step 3: Lobby / waiting room should appear with role slots
      await expect(page.getByText("0 / 2 players")).toBeVisible();
      await expect(page.getByText("Commanding Officer (CO)")).toBeVisible();
      await expect(page.getByText("Navigator (NAV)")).toBeVisible();
    });
  },
);

// ── Role Slot Display ─────────────────────────────────────────────────

test.describe("Role slots @home @waiting-room", () => {
  test('shows open slots as "Open"', async ({ page, mockApi }) => {
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

    const openSlots = page.getByText("Open");
    await expect(openSlots.first()).toBeVisible();
  });

  test("shows GM slot when requires_gm is true", async ({ page, mockApi }) => {
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

    await expect(page.getByText("Game Master (Trainer)")).toBeVisible();
  });
});
