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
} from '../fixtures/base.fixture';

const MOCK_ROLES = [
  { id: 'co', label: 'Commanding Officer (CO)', player_type: 'decision_maker' },
  { id: 'nav', label: 'Navigator (NAV)', player_type: 'advisor' },
];

const MOCK_SCENARIO = {
  id: 1,
  title: 'Hospital MCI',
  description: 'Mass casualty incident scenario',
  domain_id: null,
  content: {
    roles: MOCK_ROLES,
    game_mode: 'simple_collaborative',
    phases: [],
    events: [],
    issues: [],
    decision_templates: [],
    default_time_factor: 1.0,
    briefing: 'Test',
    objectives: [],
    rules: [],
    decision_sequence: [],
  },
  version: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// ── Landing Page Default State ────────────────────────────────────────

test.describe('Landing page — no active exercise', () => {
  test('shows main menu when no joinable exercise', async ({
    page,
    mockApi,
  }) => {
    await mockApi.install();
    await page.goto('/home');

    await expect(page.getByText('Training Flow Control')).toBeVisible();
    await expect(page.getByText('Run Exercise')).toBeVisible();
    await expect(page.getByText('Build Scenario')).toBeVisible();
    await expect(page.getByText('Review Results')).toBeVisible();
  });
});

// ── Scenario Picker ───────────────────────────────────────────────────

test.describe('Scenario picker', () => {
  test('"Run Exercise" opens scenario picker', async ({
    page,
    mockApi,
  }) => {
    mockApi.seedScenario(MOCK_SCENARIO);
    await mockApi.install();
    await page.goto('/home');

    await page.getByText('Run Exercise').click();

    await expect(page.getByText('Hospital MCI')).toBeVisible();
    await expect(page.getByText('2 roles')).toBeVisible();
    await expect(page.getByText('Collaborative')).toBeVisible();
  });

  test('back button returns to main menu', async ({ page, mockApi }) => {
    mockApi.seedScenario(MOCK_SCENARIO);
    await mockApi.install();
    await page.goto('/home');

    await page.getByText('Run Exercise').click();
    await expect(page.getByText('Hospital MCI')).toBeVisible();

    await page.getByText('Back').click();
    await expect(page.getByText('Run Exercise')).toBeVisible();
  });
});

// ── Lobby Preview ─────────────────────────────────────────────────────

test.describe('Landing page — active lobby', () => {
  test('shows lobby when joinable exercise exists', async ({
    page,
    mockApi,
  }) => {
    mockApi.seedJoinable({
      exercise: {
        id: 42,
        title: 'Hospital MCI',
        game_mode: 'simple_collaborative',
        scenario_id: 1,
      },
      participants: [],
      roles: MOCK_ROLES,
      max_players: 2,
      requires_gm: false,
    });
    await mockApi.install();
    await page.goto('/home');

    await expect(page.getByText('Hospital MCI')).toBeVisible();
    await expect(page.getByText('0 / 2 players')).toBeVisible();
    await expect(page.getByText('Commanding Officer (CO)')).toBeVisible();
    await expect(page.getByText('Navigator (NAV)')).toBeVisible();
  });

  test('shows name input and join button when not joined', async ({
    page,
    mockApi,
  }) => {
    mockApi.seedJoinable({
      exercise: {
        id: 42,
        title: 'Hospital MCI',
        game_mode: 'simple_collaborative',
        scenario_id: 1,
      },
      participants: [],
      roles: MOCK_ROLES,
      max_players: 2,
      requires_gm: false,
    });
    await mockApi.install();
    await page.goto('/home');

    await expect(page.locator('input#lobby-name')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Join' }),
    ).toBeVisible();
  });

  test('shows existing participants in lobby', async ({
    page,
    mockApi,
  }) => {
    const alice = mockParticipant({
      display_name: 'Alice',
      role: 'co',
    });
    mockApi.seedJoinable({
      exercise: {
        id: 42,
        title: 'Hospital MCI',
        game_mode: 'simple_collaborative',
        scenario_id: 1,
      },
      participants: [alice],
      roles: MOCK_ROLES,
      max_players: 2,
      requires_gm: false,
    });
    await mockApi.install();
    await page.goto('/home');

    await expect(page.getByText('Alice')).toBeVisible();
    await expect(page.getByText('1 / 2 players')).toBeVisible();
  });
});

// ── Role Slot Display ─────────────────────────────────────────────────

test.describe('Role slots', () => {
  test('shows open slots as "Open"', async ({ page, mockApi }) => {
    mockApi.seedJoinable({
      exercise: {
        id: 42,
        title: 'Test Exercise',
        game_mode: 'simple_collaborative',
        scenario_id: 1,
      },
      participants: [],
      roles: MOCK_ROLES,
      max_players: 2,
      requires_gm: false,
    });
    await mockApi.install();
    await page.goto('/home');

    const openSlots = page.getByText('Open');
    await expect(openSlots.first()).toBeVisible();
  });

  test('shows GM slot when requires_gm is true', async ({
    page,
    mockApi,
  }) => {
    mockApi.seedJoinable({
      exercise: {
        id: 42,
        title: 'Classic Exercise',
        game_mode: 'classic',
        scenario_id: 1,
      },
      participants: [],
      roles: MOCK_ROLES,
      max_players: 3,
      requires_gm: true,
    });
    await mockApi.install();
    await page.goto('/home');

    await expect(
      page.getByText('Game Master (Trainer)'),
    ).toBeVisible();
  });
});
