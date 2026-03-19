/**
 * Playwright e2e tests for the simple_collaborative exercise flow.
 *
 * Covers:
 * - Collaborative waiting room: player badge, Start button visible to all
 * - Start navigates to /player (not /gm)
 * - Full onboarding: join → waiting room → start as player
 */
import { test, expect, mockParticipant } from "../fixtures/base.fixture";

// ── Collaborative waiting room ──────────────────────────────────────────

test.describe("Collaborative waiting room @waiting-room @collaborative", () => {
  const exerciseId = 500;

  function collabUrl(participantId: string): string {
    return `/waiting-room?exerciseId=${exerciseId}&participantId=${participantId}`;
  }

  test("shows collaborative mode message", async ({ page, mockApi }) => {
    const me = mockParticipant({ display_name: "Alice", role: "player" });
    mockApi.seed(exerciseId, [me], "simple_collaborative");
    await mockApi.install();

    await page.goto(collabUrl(me.id));

    await expect(
      page.getByText("Collaborative exercise — no facilitator needed."),
    ).toBeVisible();
  });

  test("shows error when no scenario roles loaded", async ({
    page,
    mockApi,
  }) => {
    const me = mockParticipant({ display_name: "Alice", role: "player" });
    // Only seed participants, explicitly set exercise with no scenario
    mockApi.rooms.set(exerciseId, [me]);
    mockApi.seedExercise(exerciseId, "simple_collaborative", null);
    await mockApi.install();

    await page.goto(collabUrl(me.id));

    // No roles → error message shown
    await expect(page.getByText("Scenario has no roles defined")).toBeVisible();
  });

  test("Start button shows participant count and is visible to any player", async ({
    page,
    mockApi,
  }) => {
    const alice = mockParticipant({ display_name: "Alice", role: "player" });
    const bob = mockParticipant({ display_name: "Bob", role: "player" });
    mockApi.seed(exerciseId, [alice, bob], "simple_collaborative");
    await mockApi.install();

    await page.goto(collabUrl(alice.id));

    await expect(
      page.getByRole("button", { name: /Start Exercise \(2\)/ }),
    ).toBeVisible();
  });

  test("Start button is enabled when all role slots are filled", async ({
    page,
    mockApi,
  }) => {
    const me = mockParticipant({ display_name: "Alice", role: "player" });
    // 1 participant, 1 derived role (player) → all slots filled
    mockApi.seed(exerciseId, [me], "simple_collaborative");
    await mockApi.install();

    await page.goto(collabUrl(me.id));

    await expect(
      page.getByRole("button", { name: /Start Exercise/ }),
    ).toBeEnabled();
  });

  test("clicking Start Exercise navigates to /player", async ({
    page,
    mockApi,
  }) => {
    const me = mockParticipant({ display_name: "Alice", role: "player" });
    mockApi.seed(exerciseId, [me], "simple_collaborative");
    await mockApi.install();

    await page.goto(collabUrl(me.id));
    await page.getByRole("button", { name: /Start Exercise/ }).click();

    await expect(page).toHaveURL(/\/player/);
    await expect(page).toHaveURL(new RegExp(`exerciseId=${exerciseId}`));
  });

  test("does NOT navigate to /gm on start", async ({ page, mockApi }) => {
    const me = mockParticipant({ display_name: "Alice", role: "player" });
    mockApi.seed(exerciseId, [me], "simple_collaborative");
    await mockApi.install();

    await page.goto(collabUrl(me.id));
    await page.getByRole("button", { name: /Start Exercise/ }).click();

    await expect(page).not.toHaveURL(/\/gm/);
  });

  test("all participants shown with names", async ({ page, mockApi }) => {
    const players = [
      mockParticipant({ display_name: "Alice", role: "co" }),
      mockParticipant({ display_name: "Bob", role: "nav" }),
      mockParticipant({ display_name: "Charlie", role: "ops" }),
    ];
    mockApi.seed(exerciseId, players, "simple_collaborative");
    await mockApi.install();

    await page.goto(collabUrl(players[0].id));

    await expect(page.getByText("Alice")).toBeVisible();
    await expect(page.getByText("Bob")).toBeVisible();
    await expect(page.getByText("Charlie")).toBeVisible();
  });
});
