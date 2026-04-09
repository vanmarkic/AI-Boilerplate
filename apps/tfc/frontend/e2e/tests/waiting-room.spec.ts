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
} from '../fixtures/base.fixture';

// ── Join Page ──────────────────────────────────────────────────────────

test.describe('Join page', () => {
  test('renders join form with all fields', async ({ page, mockApi }) => {
    await mockApi.install();
    await page.goto('/join');

    await expect(page.getByText('Join Exercise')).toBeVisible();
    await expect(page.locator('#session-code')).toBeVisible();
    await expect(page.locator('#display-name')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join' })).toBeVisible();
  });

  test('join button is disabled when fields are empty', async ({
    page,
    mockApi,
  }) => {
    await mockApi.install();
    await page.goto('/join');

    await expect(
      page.getByRole('button', { name: 'Join' }),
    ).toBeDisabled();
  });

  test('join as player navigates to waiting room', async ({
    page,
    mockApi,
  }) => {
    await mockApi.install();
    await page.goto('/join');

    await page.locator('#session-code').fill('42');
    await page.locator('#display-name').fill('Alice');
    await page.getByRole('button', { name: 'Join' }).click();

    await expect(page).toHaveURL(/waiting-room/);
    await expect(page).toHaveURL(/exerciseId=42/);
    await expect(page).toHaveURL(/participantId=/);
  });

  test('join as game-master navigates to waiting room', async ({
    page,
    mockApi,
  }) => {
    await mockApi.install();
    await page.goto('/join');

    await page.locator('#session-code').fill('42');
    await page.locator('#display-name').fill('Commander');
    await page.locator('select').selectOption('game-master');
    await page.getByRole('button', { name: 'Join' }).click();

    await expect(page).toHaveURL(/waiting-room/);
  });

  test('join as observer navigates to waiting room', async ({
    page,
    mockApi,
  }) => {
    await mockApi.install();
    await page.goto('/join');

    await page.locator('#session-code').fill('42');
    await page.locator('#display-name').fill('Watcher');
    await page.locator('select').selectOption('observer');
    await page.getByRole('button', { name: 'Join' }).click();

    await expect(page).toHaveURL(/waiting-room/);
  });

  test('role dropdown has all three options', async ({ page, mockApi }) => {
    await mockApi.install();
    await page.goto('/join');

    const options = page.locator('select option');
    await expect(options).toHaveCount(3);
    await expect(options.nth(0)).toHaveText('Player');
    await expect(options.nth(1)).toHaveText('Observer');
    await expect(options.nth(2)).toHaveText('Game Master');
  });

  test('shows error for invalid session code', async ({
    page,
    mockApi,
  }) => {
    await mockApi.install();
    await page.goto('/join');

    await page.locator('#session-code').fill('abc');
    await page.locator('#display-name').fill('Alice');
    await page.getByRole('button', { name: 'Join' }).click();

    await expect(
      page.getByText('Session code must be a valid exercise ID'),
    ).toBeVisible();
  });
});

// ── Waiting Room View ──────────────────────────────────────────────────

test.describe('Waiting room view', () => {
  const exerciseId = 100;

  function waitingRoomUrl(participantId: string): string {
    return `/waiting-room?exerciseId=${exerciseId}&participantId=${participantId}`;
  }

  test('displays participants list', async ({ page, mockApi }) => {
    const me = mockParticipant({
      display_name: 'Alice',
      role: 'player',
    });
    const other = mockParticipant({
      display_name: 'Bob',
      role: 'observer',
    });
    mockApi.seed(exerciseId, [me, other]);
    await mockApi.install();

    await page.goto(waitingRoomUrl(me.id));

    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.getByText('Bob')).toBeVisible();
  });

  test('shows "You" badge next to own name', async ({ page, mockApi }) => {
    const me = mockParticipant({
      display_name: 'Alice',
      role: 'player',
    });
    mockApi.seed(exerciseId, [me]);
    await mockApi.install();

    await page.goto(waitingRoomUrl(me.id));

    await expect(page.getByText('You')).toBeVisible();
  });

  test('shows empty state when no participants', async ({
    page,
    mockApi,
  }) => {
    await mockApi.install();
    await page.goto(waitingRoomUrl('nobody'));

    await expect(page.getByText('No participants yet')).toBeVisible();
  });

  test('displays exercise ID', async ({ page, mockApi }) => {
    const me = mockParticipant({ display_name: 'Alice', role: 'player' });
    mockApi.seed(exerciseId, [me]);
    await mockApi.install();

    await page.goto(waitingRoomUrl(me.id));

    await expect(
      page.getByText(`exercise #${exerciseId}`),
    ).toBeVisible();
  });

  test('leave button is always visible', async ({ page, mockApi }) => {
    const me = mockParticipant({ display_name: 'Alice', role: 'player' });
    mockApi.seed(exerciseId, [me]);
    await mockApi.install();

    await page.goto(waitingRoomUrl(me.id));

    await expect(
      page.getByRole('button', { name: 'Leave' }),
    ).toBeVisible();
  });
});

// ── Game Master Controls ───────────────────────────────────────────────

test.describe('Game master controls', () => {
  const exerciseId = 200;

  function waitingRoomUrl(participantId: string): string {
    return `/waiting-room?exerciseId=${exerciseId}&participantId=${participantId}`;
  }

  test('GM sees "Start Exercise" button', async ({ page, mockApi }) => {
    const gm = mockParticipant({
      display_name: 'Commander',
      role: 'game-master',
    });
    mockApi.seed(exerciseId, [gm]);
    await mockApi.install();

    await page.goto(waitingRoomUrl(gm.id));

    await expect(
      page.getByRole('button', { name: 'Start Exercise' }),
    ).toBeVisible();
  });

  test('player does NOT see "Start Exercise" button', async ({
    page,
    mockApi,
  }) => {
    const player = mockParticipant({
      display_name: 'Alice',
      role: 'player',
    });
    mockApi.seed(exerciseId, [player]);
    await mockApi.install();

    await page.goto(waitingRoomUrl(player.id));

    await expect(
      page.getByRole('button', { name: 'Start Exercise' }),
    ).not.toBeVisible();
  });

  test('observer does NOT see "Start Exercise" button', async ({
    page,
    mockApi,
  }) => {
    const obs = mockParticipant({
      display_name: 'Watcher',
      role: 'observer',
    });
    mockApi.seed(exerciseId, [obs]);
    await mockApi.install();

    await page.goto(waitingRoomUrl(obs.id));

    await expect(
      page.getByRole('button', { name: 'Start Exercise' }),
    ).not.toBeVisible();
  });

  test('clicking "Start Exercise" navigates to GM view', async ({
    page,
    mockApi,
  }) => {
    const gm = mockParticipant({
      display_name: 'Commander',
      role: 'game-master',
    });
    mockApi.seed(exerciseId, [gm]);
    await mockApi.install();

    await page.goto(waitingRoomUrl(gm.id));

    await page.getByRole('button', { name: 'Start Exercise' }).click();

    await expect(page).toHaveURL(/\/gm/);
    await expect(page).toHaveURL(/exerciseId=200/);
  });

  test('GM sees all participants with role dropdowns', async ({
    page,
    mockApi,
  }) => {
    const gm = mockParticipant({
      display_name: 'Commander',
      role: 'game-master',
    });
    const p1 = mockParticipant({
      display_name: 'Alice',
      role: 'player',
    });
    const p2 = mockParticipant({
      display_name: 'Bob',
      role: 'observer',
    });
    mockApi.seed(exerciseId, [gm, p1, p2]);
    await mockApi.install();

    await page.goto(waitingRoomUrl(gm.id));

    await expect(page.getByText('Commander')).toBeVisible();
    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.getByText('Bob')).toBeVisible();

    // One dropdown per participant
    const selects = page.locator('select');
    await expect(selects).toHaveCount(3);
  });
});

// ── Role Change ────────────────────────────────────────────────────────

test.describe('Role change', () => {
  const exerciseId = 300;

  function waitingRoomUrl(participantId: string): string {
    return `/waiting-room?exerciseId=${exerciseId}&participantId=${participantId}`;
  }

  test('changing role sends PUT request', async ({ page, mockApi }) => {
    const me = mockParticipant({
      display_name: 'Alice',
      role: 'player',
    });
    const other = mockParticipant({
      display_name: 'Bob',
      role: 'player',
    });
    mockApi.seed(exerciseId, [me, other]);
    await mockApi.install();

    let putCalled = false;
    await page.route('**/participants/*/role', async (route) => {
      if (route.request().method() === 'PUT') {
        putCalled = true;
        const body = route.request().postDataJSON();
        const p = { ...other, role: body.role };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(p),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto(waitingRoomUrl(me.id));

    // Change Bob's role via the second dropdown
    const selects = page.locator('select');
    await selects.nth(1).selectOption('game-master');

    // Wait for the API call
    await page.waitForTimeout(500);
    expect(putCalled).toBe(true);
  });
});

// ── Leave Flow ─────────────────────────────────────────────────────────

test.describe('Leave flow', () => {
  const exerciseId = 400;

  function waitingRoomUrl(participantId: string): string {
    return `/waiting-room?exerciseId=${exerciseId}&participantId=${participantId}`;
  }

  test('clicking Leave navigates to /join', async ({ page, mockApi }) => {
    const me = mockParticipant({
      display_name: 'Alice',
      role: 'player',
    });
    mockApi.seed(exerciseId, [me]);
    await mockApi.install();

    await page.goto(waitingRoomUrl(me.id));

    await page.getByRole('button', { name: 'Leave' }).click();

    await expect(page).toHaveURL(/\/join/);
  });

  test('leave sends DELETE request with correct participant ID', async ({
    page,
    mockApi,
  }) => {
    const me = mockParticipant({
      display_name: 'Alice',
      role: 'player',
    });
    mockApi.seed(exerciseId, [me]);
    await mockApi.install();

    let deletedId = '';
    await page.route('**/waiting-room/participants/*', async (route) => {
      if (route.request().method() === 'DELETE') {
        const url = route.request().url();
        const m = url.match(/participants\/([^/]+)/);
        deletedId = m ? m[1] : '';
        await route.fulfill({ status: 204 });
      } else {
        await route.fallback();
      }
    });

    await page.goto(waitingRoomUrl(me.id));
    await page.getByRole('button', { name: 'Leave' }).click();

    await page.waitForURL(/\/join/);
    expect(deletedId).toBe(me.id);
  });
});

// ── Full Join-to-Leave Flow ────────────────────────────────────────────

test.describe('Full join-to-leave integration', () => {
  test('join as player → see waiting room → leave', async ({
    page,
    mockApi,
  }) => {
    await mockApi.install();
    await page.goto('/join');

    // Fill join form
    await page.locator('#session-code').fill('42');
    await page.locator('#display-name').fill('Alice');
    await page.getByRole('button', { name: 'Join' }).click();

    // Now in waiting room
    await expect(page).toHaveURL(/waiting-room/);
    await expect(page.getByText('Alice')).toBeVisible();

    // Leave
    await page.getByRole('button', { name: 'Leave' }).click();
    await expect(page).toHaveURL(/\/join/);
  });

  test('join as game-master → see start button → start exercise', async ({
    page,
    mockApi,
  }) => {
    await mockApi.install();
    await page.goto('/join');

    await page.locator('#session-code').fill('42');
    await page.locator('#display-name').fill('Commander');
    await page.locator('select').selectOption('game-master');
    await page.getByRole('button', { name: 'Join' }).click();

    await expect(page).toHaveURL(/waiting-room/);
    await expect(
      page.getByRole('button', { name: 'Start Exercise' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Start Exercise' }).click();
    await expect(page).toHaveURL(/\/gm/);
  });
});
