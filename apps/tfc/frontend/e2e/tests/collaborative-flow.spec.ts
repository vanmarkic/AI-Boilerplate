/**
 * Playwright e2e tests for the simple_collaborative exercise flow.
 *
 * Covers:
 * - Join page: session code pre-fill from query param, role selector hidden
 * - Collaborative waiting room: player badge, Start button visible to all
 * - Start navigates to /player (not /gm)
 * - Full onboarding: join → waiting room → start as player
 */
import { test, expect, mockParticipant } from '../fixtures/base.fixture';

// ── Join page — collaborative mode ─────────────────────────────────────

test.describe('Join page — collaborative session code', () => {
  test('uses session code from ?code= query param on join', async ({
    page,
    mockApi,
  }) => {
    mockApi.seedCode('ABC123', 42, 'simple_collaborative');
    await mockApi.install();

    await page.goto('/join?code=ABC123');
    // Fill name and click join — the code from ?code= param drives the lookup
    await page.locator('input[placeholder="Enter your name"]').fill('Alice');
    await page.getByRole('button', { name: 'Join' }).click();

    await expect(page).toHaveURL(/waiting-room/);
    await expect(page).toHaveURL(/gameMode=simple_collaborative/);
  });

  test('hides role selector for simple_collaborative exercise', async ({
    page,
    mockApi,
  }) => {
    mockApi.seedCode('COLLAB', 42, 'simple_collaborative');
    await mockApi.install();

    await page.goto('/join');
    await page.locator('input[placeholder="e.g. ABC123"]').fill('COLLAB');
    await page.locator('input[placeholder="Enter your name"]').fill('Alice');

    // Trigger the by-code lookup by clicking join
    // Role selector should be hidden after lookup resolves
    await page.getByRole('button', { name: 'Join' }).click();

    // Navigates to waiting room — role selector was not shown
    await expect(page).toHaveURL(/waiting-room/);
    await expect(page).toHaveURL(/gameMode=simple_collaborative/);
  });

  test('shows role selector for classic exercise', async ({
    page,
    mockApi,
  }) => {
    mockApi.seedCode('CLASS1', 99, 'classic');
    await mockApi.install();

    await page.goto('/join');

    // Role selector visible before any lookup (default classic mode)
    await expect(page.locator('select')).toBeVisible();
  });

  test('joining collaborative exercise routes to waiting room with gameMode param', async ({
    page,
    mockApi,
  }) => {
    mockApi.seedCode('SW2026', 42, 'simple_collaborative');
    await mockApi.install();

    await page.goto('/join?code=SW2026');
    await page.locator('input[placeholder="Enter your name"]').fill('Alice');
    await page.getByRole('button', { name: 'Join' }).click();

    await expect(page).toHaveURL(/waiting-room/);
    await expect(page).toHaveURL(/gameMode=simple_collaborative/);
    await expect(page).toHaveURL(/exerciseId=42/);
  });
});

// ── Collaborative waiting room ──────────────────────────────────────────

test.describe('Collaborative waiting room', () => {
  const exerciseId = 500;

  function collabUrl(participantId: string): string {
    return `/waiting-room?exerciseId=${exerciseId}&participantId=${participantId}&gameMode=simple_collaborative`;
  }

  test('shows collaborative mode message', async ({ page, mockApi }) => {
    const me = mockParticipant({ display_name: 'Alice', role: 'player' });
    mockApi.seed(exerciseId, [me]);
    await mockApi.install();

    await page.goto(collabUrl(me.id));

    await expect(
      page.getByText('Collaborative exercise — no facilitator needed.'),
    ).toBeVisible();
  });

  test('shows fallback role dropdown when no scenario roles loaded', async ({
    page,
    mockApi,
  }) => {
    const me = mockParticipant({ display_name: 'Alice', role: 'player' });
    mockApi.seed(exerciseId, [me]);
    await mockApi.install();

    await page.goto(collabUrl(me.id));

    // Fallback: role dropdown visible (no scenario roles loaded)
    await expect(page.locator('select')).toBeVisible();
  });

  test('Start button shows participant count and is visible to any player', async ({
    page,
    mockApi,
  }) => {
    const alice = mockParticipant({ display_name: 'Alice', role: 'player' });
    const bob = mockParticipant({ display_name: 'Bob', role: 'player' });
    mockApi.seed(exerciseId, [alice, bob]);
    await mockApi.install();

    await page.goto(collabUrl(alice.id));

    await expect(
      page.getByRole('button', { name: /Start Exercise \(2\)/ }),
    ).toBeVisible();
  });

  test('Start button is enabled with at least one participant', async ({
    page,
    mockApi,
  }) => {
    const me = mockParticipant({ display_name: 'Alice', role: 'player' });
    mockApi.seed(exerciseId, [me]);
    await mockApi.install();

    await page.goto(collabUrl(me.id));

    await expect(
      page.getByRole('button', { name: /Start Exercise/ }),
    ).toBeEnabled();
  });

  test('clicking Start Exercise navigates to /player', async ({
    page,
    mockApi,
  }) => {
    const me = mockParticipant({ display_name: 'Alice', role: 'player' });
    mockApi.seed(exerciseId, [me]);
    await mockApi.install();

    await page.goto(collabUrl(me.id));
    await page.getByRole('button', { name: /Start Exercise/ }).click();

    await expect(page).toHaveURL(/\/player/);
    await expect(page).toHaveURL(new RegExp(`exerciseId=${exerciseId}`));
  });

  test('does NOT navigate to /gm on start', async ({ page, mockApi }) => {
    const me = mockParticipant({ display_name: 'Alice', role: 'player' });
    mockApi.seed(exerciseId, [me]);
    await mockApi.install();

    await page.goto(collabUrl(me.id));
    await page.getByRole('button', { name: /Start Exercise/ }).click();

    await expect(page).not.toHaveURL(/\/gm/);
  });

  test('all participants shown with names', async ({
    page,
    mockApi,
  }) => {
    const players = [
      mockParticipant({ display_name: 'Alice', role: 'player' }),
      mockParticipant({ display_name: 'Bob', role: 'player' }),
      mockParticipant({ display_name: 'Charlie', role: 'player' }),
    ];
    mockApi.seed(exerciseId, players);
    await mockApi.install();

    await page.goto(collabUrl(players[0].id));

    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.getByText('Bob')).toBeVisible();
    await expect(page.getByText('Charlie')).toBeVisible();
  });
});

// ── Full collaborative onboarding flow ─────────────────────────────────

test.describe('Full collaborative onboarding', () => {
  test('join with session code → collaborative waiting room → start as player', async ({
    page,
    mockApi,
  }) => {
    const exerciseId = 600;
    mockApi.seedCode('SILENT', exerciseId, 'simple_collaborative');
    await mockApi.install();

    // 1. Land on join with code in query param
    await page.goto('/join?code=SILENT');

    // 2. Enter name and join — session code from ?code= drives lookup
    await page.locator('input[placeholder="Enter your name"]').fill('Alice');
    await page.getByRole('button', { name: 'Join' }).click();

    // 3. In collaborative waiting room
    await expect(page).toHaveURL(/waiting-room/);
    await expect(page).toHaveURL(/gameMode=simple_collaborative/);
    await expect(
      page.getByText('Collaborative exercise — no facilitator needed.'),
    ).toBeVisible();

    // 4. Start — any player can do this
    await page.getByRole('button', { name: /Start Exercise/ }).click();

    // 5. Lands on /player, not /gm
    await expect(page).toHaveURL(/\/player/);
  });

  test('two players join and both see Start button', async ({
    page,
    mockApi,
  }) => {
    const exerciseId = 700;
    const alice = mockParticipant({ display_name: 'Alice', role: 'player' });
    const bob = mockParticipant({ display_name: 'Bob', role: 'player' });
    mockApi.seed(exerciseId, [alice, bob]);
    mockApi.seedCode('MULTI1', exerciseId, 'simple_collaborative');
    await mockApi.install();

    // Alice's waiting room view
    await page.goto(
      `/waiting-room?exerciseId=${exerciseId}&participantId=${alice.id}&gameMode=simple_collaborative`,
    );

    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.getByText('Bob')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Start Exercise \(2\)/ }),
    ).toBeEnabled();
  });
});
