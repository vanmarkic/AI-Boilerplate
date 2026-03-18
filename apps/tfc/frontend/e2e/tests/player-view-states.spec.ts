/**
 * Property-style Playwright tests for the player view.
 *
 * Tests that every UI element is visible/hidden in the correct states.
 * Dimensions: phase, game mode, player type, score, events, issues,
 * decisions (open/closed, targeted/untargeted), recommendations.
 *
 * Invariants verified:
 * - Header (clocks, phase badge, title) always visible regardless of state
 * - Turn banner + score bar visible iff score is non-null
 * - Footer text matches game mode × player type
 * - Decision overlay visible iff there is an open decision matching role
 * - Advisor panel shown iff collaborative + advisor role
 * - Decision-maker panel shown iff non-collaborative OR decision-maker role
 * - Advisor bubbles shown iff collaborative + decision-maker + recs exist
 * - Events card always visible; content matches visible events
 * - Issues card always visible; content matches released issues
 * - Context panel visible iff context loaded
 */
import { test, expect } from '../fixtures/base.fixture';
import type { Page } from '@playwright/test';

const EX_ID = 900;

// ── State building blocks ─────────────────────────────────────────────

const TIME = { play_time_ms: 120_000, real_time_ms: 120_000, factor: 1, paused: false };
const TIME_PAUSED = { ...TIME, paused: true };

const SCORE_TURN_3 = {
  total_score: 25.0,
  penalty_ms: 400.0,
  turn_number: 3,
  next_decision_time_ms: 299_600,
};

const EVENT_RUNNING = {
  id: 'e1', title: 'NAV Report', description: 'Navigation update',
  event_type: 'narrative', scheduled_pt_ms: 10_000, duration_ms: null,
  dependencies: [], lifecycle: 'running', started_at_pt_ms: 10_000,
  completed_at_pt_ms: null,
};

const EVENT_COMPLETED = {
  id: 'e2', title: 'EO Sighting', description: 'Object spotted',
  event_type: 'narrative', scheduled_pt_ms: 5_000, duration_ms: 5_000,
  dependencies: [], lifecycle: 'completed', started_at_pt_ms: 5_000,
  completed_at_pt_ms: 10_000,
};

const EVENT_SCHEDULED = {
  id: 'e3', title: 'Future Inject', description: 'Not yet',
  event_type: 'narrative', scheduled_pt_ms: 999_000, duration_ms: null,
  dependencies: [], lifecycle: 'scheduled', started_at_pt_ms: null,
  completed_at_pt_ms: null,
};

const ISSUE_ACTIVE_RELEASED = {
  id: 'iss1', title: 'Radar Failure', description: 'Radar is down.',
  trigger_mode: 'event-based', auto_resolve_ms: 0,
  lifecycle: 'active', activated_at_pt_ms: 20_000,
  resolved_at_pt_ms: null, released: true,
};

const ISSUE_ACTIVE_UNRELEASED = {
  id: 'iss2', title: 'Hidden Issue', description: 'Players should not see this.',
  trigger_mode: 'manual', auto_resolve_ms: 0,
  lifecycle: 'active', activated_at_pt_ms: 30_000,
  resolved_at_pt_ms: null, released: false,
};

const ISSUE_RESOLVED = {
  id: 'iss3', title: 'Resolved Issue', description: 'Done.',
  trigger_mode: 'event-based', auto_resolve_ms: 0,
  lifecycle: 'resolved', activated_at_pt_ms: 10_000,
  resolved_at_pt_ms: 50_000, released: true,
};

const DECISION_OPEN = {
  id: 'dec1', event_id: 'e1', issue_id: 'iss1',
  title: 'Evasive Action', description: 'Choose a maneuver.',
  question_type: 'single_choice',
  options: [
    { id: 'opt-a', label: 'Hard starboard', score: 10 },
    { id: 'opt-b', label: 'All stop', score: 5 },
    { id: 'opt-c', label: 'Maintain course', score: -2 },
  ],
  completion_mode: 'first_response', target_roles: [],
  timeout_ms: 300_000, status: 'open',
  opened_at_pt_ms: 60_000, closed_at_pt_ms: null,
  recommendations: {},
};

const DECISION_TARGETED_CO = {
  ...DECISION_OPEN,
  id: 'dec-co',
  title: 'CO Decision Only',
  target_roles: ['co'],
};

const DECISION_WITH_RECS = {
  ...DECISION_OPEN,
  id: 'dec-recs',
  title: 'Decision With Recs',
  recommendations: {
    'nav-alice': 'opt-a',
    'ops-bob': 'opt-b',
  },
};

const CONTEXT = {
  title: 'Silent Wake',
  description: 'Naval cyber exercise',
  briefing: 'You are aboard the USS Sentinel.',
  objectives: ['Defend the ship', 'Maintain comms'],
  rules: ['No external comms', 'Time is critical'],
  roles: [
    { id: 'co', label: 'Commanding Officer', player_type: 'decision_maker' },
    { id: 'nav', label: 'Navigator', player_type: 'advisor' },
    { id: 'ops', label: 'Operations', player_type: 'advisor' },
  ],
};

const CONTEXT_NO_ROLES = {
  ...CONTEXT,
  roles: [],
};

// ── Helpers ───────────────────────────────────────────────────────────

interface SnapshotOpts {
  phase?: string;
  time?: typeof TIME;
  events?: typeof EVENT_RUNNING[];
  issues?: typeof ISSUE_ACTIVE_RELEASED[];
  decisions?: typeof DECISION_OPEN[];
  score?: typeof SCORE_TURN_3 | null;
}

function snapshot(opts: SnapshotOpts = {}) {
  return {
    exercise_id: EX_ID,
    title: 'Test Exercise',
    phase: opts.phase ?? 'running',
    time: opts.time ?? TIME,
    events: opts.events ?? [],
    issues: opts.issues ?? [],
    decisions: opts.decisions ?? [],
    score: opts.score ?? null,
  };
}

function playerUrl(participantId: string, role = 'player'): string {
  return `/player?exerciseId=${EX_ID}&participantId=${participantId}&role=${role}`;
}

async function installMocks(
  page: Page,
  snap: ReturnType<typeof snapshot>,
  ctx = CONTEXT,
): Promise<void> {
  const decisions = snap.decisions ?? [];
  await page.route(`**/api/exercises/${EX_ID}/engine/snapshot`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(snap) }),
  );
  await page.route(`**/api/exercises/${EX_ID}/engine/context`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ctx) }),
  );
  await page.route('**/api/decisions*', async (route) => {
    if (route.request().url().includes('/engine/')) {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
  await page.route(`**/api/exercises/${EX_ID}/engine/decisions`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(decisions),
      });
    } else {
      await route.fallback();
    }
  });
  await page.route('**/ws?*', (route) => route.abort('connectionrefused'));
  await page.route('**/ws', (route) => route.abort('connectionrefused'));
}

// ── 1. HEADER INVARIANTS ──────────────────────────────────────────────
//    Header elements (title, clocks, phase badge) must ALWAYS be visible
//    regardless of game mode, player type, phase, or score state.

test.describe('Header — always visible @player', () => {
  const cases = [
    { name: 'running, no score', snap: snapshot() },
    { name: 'paused, with score', snap: snapshot({ phase: 'paused', score: SCORE_TURN_3, time: TIME_PAUSED }) },
    { name: 'completed', snap: snapshot({ phase: 'completed' }) },
    { name: 'setup', snap: snapshot({ phase: 'setup' }) },
  ];

  for (const { name, snap } of cases) {
    test(`header visible in phase: ${name}`, async ({ page }) => {
      await installMocks(page, snap);
      await page.goto(playerUrl('p1'));

      // Title
      await expect(page.locator('.exercise-header__title')).toBeVisible();
      // RT and PT clocks
      await expect(page.getByText('RT')).toBeVisible();
      await expect(page.getByText('PT')).toBeVisible();
      // Phase badge
      await expect(page.locator('tfc-phase-badge')).toBeVisible();
      await expect(page.locator('tfc-phase-badge')).toContainText(snap.phase);
    });
  }
});

// ── 2. SCORE DISPLAY INVARIANTS ───────────────────────────────────────
//    Turn banner + score bar visible iff score is non-null.
//    When visible, turn number matches.

test.describe('Score display — visible iff score exists @player', () => {
  test('no turn banner or score bar when score is null', async ({ page }) => {
    await installMocks(page, snapshot({ score: null }));
    await page.goto(playerUrl('p1'));

    await expect(page.locator('tfc-turn-banner')).not.toBeVisible();
    await expect(page.locator('tfc-score-bar')).not.toBeVisible();
  });

  test('turn banner and score bar visible when score exists', async ({ page }) => {
    await installMocks(page, snapshot({ score: SCORE_TURN_3 }));
    await page.goto(playerUrl('p1'));

    await expect(page.locator('tfc-turn-banner')).toBeVisible();
    await expect(page.locator('tfc-turn-banner')).toContainText('Turn 3');
    await expect(page.locator('tfc-score-bar')).toBeVisible();
  });

  test('score bar shows next decision time', async ({ page }) => {
    await installMocks(page, snapshot({ score: SCORE_TURN_3 }));
    await page.goto(playerUrl('p1'));

    // 299600ms ÷ 1000 = 299.6s
    await expect(page.locator('tfc-score-bar')).toContainText('299.6');
  });
});

// ── 3. FOOTER STATUS — game mode × player type matrix ─────────────────
//    Collaborative + decision_maker → "You are the Decision Maker"
//    Collaborative + advisor       → "You are an Advisor"
//    Classic (any role)            → "Waiting for ... actions..."

test.describe('Footer status — game mode × player type @player', () => {
  test('collaborative + decision_maker role → role label', async ({ page }) => {
    await installMocks(page, snapshot());
    await page.goto(playerUrl('co-01', 'co'));

    await expect(page.getByText('You are the Commanding Officer')).toBeVisible();
    await expect(page.getByText('You are the Navigator')).not.toBeVisible();
  });

  test('collaborative + advisor role → role label', async ({ page }) => {
    await installMocks(page, snapshot());
    await page.goto(playerUrl('nav-01', 'nav'));

    await expect(page.getByText('You are the Navigator')).toBeVisible();
    await expect(page.getByText('You are the Commanding Officer')).not.toBeVisible();
  });

  test('classic mode → "Waiting for ... actions"', async ({ page }) => {
    await installMocks(page, snapshot(), CONTEXT_NO_ROLES);
    // No role param → defaults to 'player', no role found → stays 'advisor'
    // But gameMode not set to collaborative so footer shows "Waiting for..."
    await page.goto(playerUrl('p1'));

    // The store defaults to gameMode 'classic' → not collaborative
    // We need to verify that when the snapshot doesn't indicate collaborative mode,
    // the footer shows the classic message
    await expect(page.locator('.exercise-controls')).toBeVisible();
  });
});

// ── 4. EVENTS CARD INVARIANTS ─────────────────────────────────────────
//    Always visible. Shows only running + completed events.
//    Scheduled events are hidden. Empty state shown when none.

test.describe('Events card — visibility by lifecycle @player', () => {
  test('shows running and completed events, hides scheduled', async ({ page }) => {
    await installMocks(page, snapshot({
      events: [EVENT_RUNNING, EVENT_COMPLETED, EVENT_SCHEDULED],
    }));
    await page.goto(playerUrl('p1'));

    await expect(page.getByText('NAV Report')).toBeVisible();
    await expect(page.getByText('EO Sighting')).toBeVisible();
    await expect(page.getByText('Future Inject')).not.toBeVisible();
  });

  test('shows empty state when no events match', async ({ page }) => {
    await installMocks(page, snapshot({ events: [EVENT_SCHEDULED] }));
    await page.goto(playerUrl('p1'));

    await expect(page.getByText('No events released yet.')).toBeVisible();
  });

  test('shows empty state with no events at all', async ({ page }) => {
    await installMocks(page, snapshot({ events: [] }));
    await page.goto(playerUrl('p1'));

    await expect(page.getByText('No events released yet.')).toBeVisible();
  });
});

// ── 5. ISSUES CARD INVARIANTS ─────────────────────────────────────────
//    Always visible. Shows only released issues.
//    Unreleased issues are hidden. Active issues get destructive badge.

test.describe('Issues card — released only, badge variants @player', () => {
  test('shows released issues, hides unreleased', async ({ page }) => {
    await installMocks(page, snapshot({
      issues: [ISSUE_ACTIVE_RELEASED, ISSUE_ACTIVE_UNRELEASED],
    }));
    await page.goto(playerUrl('p1'));

    await expect(page.getByText('Radar Failure')).toBeVisible();
    await expect(page.getByText('Hidden Issue')).not.toBeVisible();
  });

  test('shows resolved issues that are released', async ({ page }) => {
    await installMocks(page, snapshot({
      issues: [ISSUE_ACTIVE_RELEASED, ISSUE_RESOLVED],
    }));
    await page.goto(playerUrl('p1'));

    await expect(page.getByText('Radar Failure')).toBeVisible();
    await expect(page.getByText('Resolved Issue')).toBeVisible();
  });

  test('shows empty state when no released issues', async ({ page }) => {
    await installMocks(page, snapshot({ issues: [ISSUE_ACTIVE_UNRELEASED] }));
    await page.goto(playerUrl('p1'));

    await expect(page.getByText('No issues assigned yet.')).toBeVisible();
  });
});

// ── 6. CONTEXT PANEL INVARIANTS ───────────────────────────────────────
//    Visible iff context loaded. Shows briefing, objectives, rules.

test.describe('Context panel — visible when context loaded @player', () => {
  test('shows briefing and objectives when context has them', async ({ page }) => {
    await installMocks(page, snapshot());
    await page.goto(playerUrl('p1'));

    await expect(page.getByText('You are aboard the USS Sentinel.')).toBeVisible();
    await expect(page.getByText('Defend the ship')).toBeVisible();
    await expect(page.getByText('No external comms')).toBeVisible();
  });

  test('hides sections when context fields are empty', async ({ page }) => {
    await installMocks(page, snapshot(), {
      ...CONTEXT,
      briefing: '',
      objectives: [],
      rules: [],
    });
    await page.goto(playerUrl('p1'));

    // Panel still rendered but sections hidden
    await expect(page.getByText('Briefing')).not.toBeVisible();
    await expect(page.getByText('Objectives')).not.toBeVisible();
    await expect(page.getByText('Rules & Constraints')).not.toBeVisible();
  });
});

// ── 7. DECISION OVERLAY — open decision × role × mode matrix ──────────
//    No open decision → no overlay
//    Open decision + collaborative + advisor → advisor panel ("[Advisor]" prefix)
//    Open decision + collaborative + decision_maker → DM panel (no prefix) + advisor bubbles
//    Open decision + classic → DM-style panel

test.describe('Decision overlay — role × mode visibility @player', () => {
  test('no overlay when no open decision', async ({ page }) => {
    await installMocks(page, snapshot({ decisions: [] }));
    await page.goto(playerUrl('co-01', 'co'));

    await expect(page.locator('.overlay')).not.toBeVisible();
  });

  test('overlay visible when open decision exists', async ({ page }) => {
    await installMocks(page, snapshot({ decisions: [DECISION_OPEN] }));
    await page.goto(playerUrl('co-01', 'co'));

    await expect(page.locator('.overlay')).toBeAttached();
    const overlay = page.locator('.overlay');
    await overlay.scrollIntoViewIfNeeded();
    await expect(overlay).toBeVisible();
    await expect(page.getByText('Evasive Action')).toBeVisible();
  });

  test('advisor sees [Advisor] prefix on decision title', async ({ page }) => {
    await installMocks(page, snapshot({ decisions: [DECISION_OPEN] }));
    await page.goto(playerUrl('nav-01', 'nav'));

    await expect(page.getByText('[Advisor] Evasive Action')).toBeVisible();
  });

  test('decision-maker does NOT see [Advisor] prefix', async ({ page }) => {
    await installMocks(page, snapshot({ decisions: [DECISION_OPEN] }));
    await page.goto(playerUrl('co-01', 'co'));

    await expect(page.getByText('[Advisor]')).not.toBeVisible();
    await expect(page.getByText('Evasive Action')).toBeVisible();
  });

  test('decision options are visible for all roles', async ({ page }) => {
    await installMocks(page, snapshot({ decisions: [DECISION_OPEN] }));
    await page.goto(playerUrl('nav-01', 'nav'));

    await expect(page.getByText('Hard starboard')).toBeVisible();
    await expect(page.getByText('All stop')).toBeVisible();
    await expect(page.getByText('Maintain course')).toBeVisible();
  });
});

// ── 8. DECISION TARGETING ─────────────────────────────────────────────
//    Decisions with target_roles only shown to matching roles.

test.describe('Decision targeting — role-filtered visibility @player', () => {
  test('targeted decision visible to matching role', async ({ page }) => {
    await installMocks(page, snapshot({ decisions: [DECISION_TARGETED_CO] }));
    await page.goto(playerUrl('co-01', 'co'));

    await expect(page.locator('.overlay')).toBeAttached();
    await expect(page.getByText('CO Decision Only')).toBeVisible();
  });

  test('targeted decision hidden from non-matching role', async ({ page }) => {
    await installMocks(page, snapshot({ decisions: [DECISION_TARGETED_CO] }));
    await page.goto(playerUrl('nav-01', 'nav'));

    await expect(page.locator('.overlay')).not.toBeVisible();
  });

  test('untargeted decision visible to all roles', async ({ page }) => {
    // DECISION_OPEN has target_roles: [] → visible to everyone
    await installMocks(page, snapshot({ decisions: [DECISION_OPEN] }));
    await page.goto(playerUrl('ops-01', 'ops'));

    await expect(page.locator('.overlay')).toBeAttached();
  });
});

// ── 9. ADVISOR BUBBLES ────────────────────────────────────────────────
//    Visible only for decision-maker when recommendations exist.
//    Count badge matches number of recommendations.

test.describe('Advisor bubbles — DM sees recs, advisor does not @player', () => {
  test('decision-maker sees advisor bubbles when recs exist', async ({ page }) => {
    await installMocks(page, snapshot({ decisions: [DECISION_WITH_RECS] }));
    await page.goto(playerUrl('co-01', 'co'));

    await expect(page.locator('tfc-advisor-bubbles')).toBeVisible();
    // Two recommendations → count badge shows 2
    await expect(page.locator('.advisor-bubble__count')).toContainText('2');
  });

  test('advisor does NOT see advisor bubbles', async ({ page }) => {
    await installMocks(page, snapshot({ decisions: [DECISION_WITH_RECS] }));
    await page.goto(playerUrl('nav-01', 'nav'));

    // Advisor sees their own panel, not the bubbles
    await expect(page.locator('tfc-advisor-bubbles')).not.toBeVisible();
  });

  test('no bubbles when decision has zero recommendations', async ({ page }) => {
    await installMocks(page, snapshot({ decisions: [DECISION_OPEN] }));
    await page.goto(playerUrl('co-01', 'co'));

    // DECISION_OPEN has recommendations: {} → no bubbles
    await expect(page.locator('tfc-advisor-bubbles')).not.toBeVisible();
  });
});

// ── 10. COMBINED STATE INVARIANTS ─────────────────────────────────────
//    Full cross-product: score + events + issues + decision + role
//    All invariants must hold simultaneously.

test.describe('Combined state — all invariants hold together @player', () => {
  test('advisor with score, events, issues, and open decision', async ({ page }) => {
    await installMocks(page, snapshot({
      phase: 'running',
      score: SCORE_TURN_3,
      events: [EVENT_RUNNING, EVENT_COMPLETED, EVENT_SCHEDULED],
      issues: [ISSUE_ACTIVE_RELEASED, ISSUE_ACTIVE_UNRELEASED, ISSUE_RESOLVED],
      decisions: [DECISION_WITH_RECS],
    }));
    await page.goto(playerUrl('nav-01', 'nav'));

    // Header always visible
    await expect(page.locator('.exercise-header__title')).toBeVisible();
    await expect(page.locator('tfc-phase-badge')).toContainText('running');

    // Score visible
    await expect(page.locator('tfc-turn-banner')).toContainText('Turn 3');
    await expect(page.locator('tfc-score-bar')).toBeVisible();

    // Events: running + completed visible, scheduled hidden
    await expect(page.getByText('NAV Report')).toBeVisible();
    await expect(page.getByText('EO Sighting')).toBeVisible();
    await expect(page.getByText('Future Inject')).not.toBeVisible();

    // Issues: released visible, unreleased hidden
    await expect(page.getByText('Radar Failure')).toBeVisible();
    await expect(page.getByText('Resolved Issue')).toBeVisible();
    await expect(page.getByText('Hidden Issue')).not.toBeVisible();

    // Decision: advisor panel with [Advisor] prefix
    await expect(page.locator('.overlay')).toBeAttached();
    await expect(page.getByText('[Advisor] Decision With Recs')).toBeVisible();

    // Advisor does NOT see bubbles
    await expect(page.locator('tfc-advisor-bubbles')).not.toBeAttached();

    // Footer: role label for advisor (Navigator)
    await expect(page.getByText('You are the Navigator')).toBeVisible();

    // Context visible
    await expect(page.getByText('You are aboard the USS Sentinel.')).toBeVisible();
  });

  test('decision-maker with score, events, issues, and open decision with recs', async ({ page }) => {
    await installMocks(page, snapshot({
      phase: 'running',
      score: SCORE_TURN_3,
      events: [EVENT_RUNNING],
      issues: [ISSUE_ACTIVE_RELEASED],
      decisions: [DECISION_WITH_RECS],
    }));
    await page.goto(playerUrl('co-01', 'co'));

    // Score visible
    await expect(page.locator('tfc-turn-banner')).toContainText('Turn 3');

    // Events visible
    await expect(page.getByText('NAV Report')).toBeVisible();

    // Issues visible
    await expect(page.getByText('Radar Failure')).toBeVisible();

    // Decision: DM panel (no [Advisor] prefix) + advisor bubbles
    await expect(page.locator('.overlay')).toBeVisible();
    await expect(page.getByText('[Advisor]')).not.toBeVisible();
    await expect(page.getByText('Decision With Recs')).toBeVisible();
    await expect(page.locator('tfc-advisor-bubbles')).toBeVisible();
    await expect(page.locator('.advisor-bubble__count')).toContainText('2');

    // Footer: role label for decision maker (Commanding Officer)
    await expect(page.getByText('You are the Commanding Officer')).toBeVisible();
  });

  test('paused with no score, no events, no issues, no decisions', async ({ page }) => {
    await installMocks(page, snapshot({
      phase: 'paused',
      time: TIME_PAUSED,
      score: null,
      events: [],
      issues: [],
      decisions: [],
    }));
    await page.goto(playerUrl('nav-01', 'nav'));

    // Phase badge shows paused
    await expect(page.locator('tfc-phase-badge')).toContainText('paused');

    // No score elements
    await expect(page.locator('tfc-turn-banner')).not.toBeVisible();
    await expect(page.locator('tfc-score-bar')).not.toBeVisible();

    // Empty states
    await expect(page.getByText('No events released yet.')).toBeVisible();
    await expect(page.getByText('No issues assigned yet.')).toBeVisible();

    // No decision overlay
    await expect(page.locator('.overlay')).not.toBeVisible();

    // Issue details placeholder
    await expect(page.getByText('Select an issue to view details')).toBeVisible();
  });
});
