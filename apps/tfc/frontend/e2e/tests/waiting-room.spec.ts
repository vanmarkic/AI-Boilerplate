/**
 * Playwright e2e tests for the waiting room flow.
 *
 * Tests the join page, waiting room view, game master controls,
 * role changes, and leave behaviour using mocked API routes.
 */
import {
  test,
  expect,
  mockParticipant,
  type MockParticipant,
} from "../fixtures/base.fixture";

// ── Waiting Room View ──────────────────────────────────────────────────

test.describe("Waiting room view @waiting-room", () => {
  const exerciseId = 100;

  function waitingRoomUrl(participantId: string): string {
    return `/waiting-room?exerciseId=${exerciseId}&participantId=${participantId}`;
  }

  test("displays participants list", async ({ page, mockApi }) => {
    const me = mockParticipant({
      display_name: "Alice",
      role: "player",
    });
    const other = mockParticipant({
      display_name: "Bob",
      role: "observer",
    });
    mockApi.seed(exerciseId, [me, other]);
    await mockApi.install();

    await page.goto(waitingRoomUrl(me.id));

    await expect(page.getByText("Alice")).toBeVisible();
    await expect(page.getByText("Bob")).toBeVisible();
  });

  test('shows "You" badge next to own name', async ({ page, mockApi }) => {
    const me = mockParticipant({
      display_name: "Alice",
      role: "player",
    });
    mockApi.seed(exerciseId, [me]);
    await mockApi.install();

    await page.goto(waitingRoomUrl(me.id));

    await expect(page.getByText("You")).toBeVisible();
  });

  test("shows role slots when no participants have claimed", async ({
    page,
    mockApi,
  }) => {
    // Seed exercise + scenario with roles but no participants in the room
    mockApi.seedExercise(exerciseId, "classic", exerciseId);
    mockApi.seedScenario({
      id: exerciseId,
      title: "Test Scenario",
      description: "",
      domain_id: null,
      content: {
        roles: [
          { id: "player", label: "Player", player_type: "advisor" },
          { id: "observer", label: "Observer", player_type: "advisor" },
        ],
        game_mode: "classic",
      },
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    await mockApi.install();
    await page.goto(waitingRoomUrl("nobody"));

    // Role slots visible with Claim buttons
    await expect(page.getByText("Player")).toBeVisible();
    await expect(page.getByText("Observer")).toBeVisible();
  });

  test("shows Waiting Room title", async ({ page, mockApi }) => {
    const me = mockParticipant({ display_name: "Alice", role: "player" });
    mockApi.seed(exerciseId, [me]);
    await mockApi.install();

    await page.goto(waitingRoomUrl(me.id));

    await expect(page.getByText("Waiting Room")).toBeVisible();
  });

  test("leave button is always visible", async ({ page, mockApi }) => {
    const me = mockParticipant({ display_name: "Alice", role: "player" });
    mockApi.seed(exerciseId, [me]);
    await mockApi.install();

    await page.goto(waitingRoomUrl(me.id));

    await expect(page.getByRole("button", { name: "Leave" })).toBeVisible();
  });
});

// ── Game Master Controls ───────────────────────────────────────────────

test.describe("Game master controls @waiting-room @game-master", () => {
  const exerciseId = 200;

  function waitingRoomUrl(participantId: string): string {
    return `/waiting-room?exerciseId=${exerciseId}&participantId=${participantId}`;
  }

  test('GM sees "Start Exercise" button', async ({ page, mockApi }) => {
    const gm = mockParticipant({
      display_name: "Commander",
      role: "game-master",
    });
    const player = mockParticipant({
      display_name: "Alice",
      role: "player",
    });
    mockApi.seed(exerciseId, [gm, player]);
    await mockApi.install();

    await page.goto(waitingRoomUrl(gm.id));

    await expect(
      page.getByRole("button", { name: /Start Exercise/ }),
    ).toBeVisible();
  });

  test("Start Exercise button is disabled when not enough participants", async ({
    page,
    mockApi,
  }) => {
    const player = mockParticipant({
      display_name: "Alice",
      role: "player",
    });
    // Only 1 participant but exercise requires player + GM roles
    mockApi.seed(exerciseId, [player]);
    await mockApi.install();

    await page.goto(waitingRoomUrl(player.id));

    await expect(
      page.getByRole("button", { name: /Start Exercise/ }),
    ).toBeDisabled();
  });

  test('clicking "Start Exercise" navigates to GM view', async ({
    page,
    mockApi,
  }) => {
    const gm = mockParticipant({
      display_name: "Commander",
      role: "game-master",
    });
    const player = mockParticipant({
      display_name: "Alice",
      role: "player",
    });
    // Need enough participants: 1 scenario role (player) + GM = 2 needed
    mockApi.seed(exerciseId, [gm, player]);
    await mockApi.install();

    await page.goto(waitingRoomUrl(gm.id));

    await page.getByRole("button", { name: /Start Exercise/ }).click();

    await expect(page).toHaveURL(/\/gm/);
    await expect(page).toHaveURL(/exerciseId=200/);
  });

  test("GM sees all role slots with participant names", async ({
    page,
    mockApi,
  }) => {
    const gm = mockParticipant({
      display_name: "Commander",
      role: "game-master",
    });
    const p1 = mockParticipant({
      display_name: "Alice",
      role: "player",
    });
    const p2 = mockParticipant({
      display_name: "Bob",
      role: "observer",
    });
    mockApi.seed(exerciseId, [gm, p1, p2]);
    await mockApi.install();

    await page.goto(waitingRoomUrl(gm.id));

    await expect(page.getByText("Commander")).toBeVisible();
    await expect(page.getByText("Alice")).toBeVisible();
    await expect(page.getByText("Bob")).toBeVisible();
  });
});

// ── Role Change ────────────────────────────────────────────────────────

test.describe("Role change @waiting-room", () => {
  const exerciseId = 300;

  function waitingRoomUrl(participantId: string): string {
    return `/waiting-room?exerciseId=${exerciseId}&participantId=${participantId}`;
  }

  test("claiming a role sends PUT request", async ({ page, mockApi }) => {
    const me = mockParticipant({
      display_name: "Alice",
      role: "player",
    });
    // Seed exercise with 2 roles so there's an unclaimed slot
    mockApi.seedExercise(exerciseId, "simple_collaborative", exerciseId);
    mockApi.seedScenario({
      id: exerciseId,
      title: "Test",
      description: "",
      domain_id: null,
      content: {
        roles: [
          { id: "player", label: "Player", player_type: "advisor" },
          { id: "observer", label: "Observer", player_type: "advisor" },
        ],
        game_mode: "simple_collaborative",
      },
      version: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    mockApi.seed(exerciseId, [me]);
    await mockApi.install();

    let putCalled = false;
    await page.route("**/participants/*/role", async (route) => {
      if (route.request().method() === "PUT") {
        putCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ...me, role: "observer" }),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto(
      `/waiting-room?exerciseId=${exerciseId}&participantId=${me.id}`,
    );

    // Click the Claim button for the unclaimed 'Observer' role slot
    const claimButtons = page.getByRole("button", { name: "Claim" });
    await claimButtons.first().click();

    // Wait for the API call
    await page.waitForTimeout(500);
    expect(putCalled).toBe(true);
  });
});

// ── Leave Flow ─────────────────────────────────────────────────────────

test.describe("Leave flow @waiting-room", () => {
  const exerciseId = 400;

  function waitingRoomUrl(participantId: string): string {
    return `/waiting-room?exerciseId=${exerciseId}&participantId=${participantId}`;
  }

  test("clicking Leave navigates to /home", async ({ page, mockApi }) => {
    const me = mockParticipant({
      display_name: "Alice",
      role: "player",
    });
    mockApi.seed(exerciseId, [me]);
    await mockApi.install();

    await page.goto(waitingRoomUrl(me.id));

    await page.getByRole("button", { name: "Leave" }).click();

    await expect(page).toHaveURL(/\/home/);
  });

  test("leave sends DELETE request with correct participant ID", async ({
    page,
    mockApi,
  }) => {
    const me = mockParticipant({
      display_name: "Alice",
      role: "player",
    });
    mockApi.seed(exerciseId, [me]);
    await mockApi.install();

    let deletedId = "";
    await page.route("**/waiting-room/participants/*", async (route) => {
      if (route.request().method() === "DELETE") {
        const url = route.request().url();
        const m = url.match(/participants\/([^/]+)/);
        deletedId = m ? m[1] : "";
        await route.fulfill({ status: 204 });
      } else {
        await route.fallback();
      }
    });

    await page.goto(waitingRoomUrl(me.id));
    await page.getByRole("button", { name: "Leave" }).click();

    await page.waitForURL(/\/home/);
    expect(deletedId).toBe(me.id);
  });
});
