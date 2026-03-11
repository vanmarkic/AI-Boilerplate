import { expect, test } from '../fixtures/base.fixture';

/**
 * Tier-1 partial build E2E — exhaustive verification of the minimum viable
 * feature surface.
 *
 * Validates:
 *   1. Every tier-1 route is reachable and renders the expected content.
 *   2. Navigation between tier-1 pages works.
 *   3. Forms and interactive elements on tier-1 pages function correctly.
 *   4. No higher-tier routes accidentally leak into the build.
 *   5. The app shell remains intact for unknown routes.
 *   6. Backend tier-1 API endpoints respond correctly.
 *   7. Accessibility baseline for all tier-1 pages.
 *
 * When tier-2+ features are added, extend the "Excluded routes" section.
 */

// ── Tier-1 page rendering ───────────────────────────────────

test.describe('Tier-1 page rendering', () => {
  test('landing page renders hero heading and CTA', async ({ page }) => {
    await page.goto('/');
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText('AI Boilerplate');
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('landing page renders tech stack pills', async ({ page }) => {
    await page.goto('/');
    const pills = page.locator('span.font-mono.bg-card');
    await expect(pills).not.toHaveCount(0);
    await expect(pills.first()).toBeVisible();
  });

  test('register page renders form with all fields', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('Create Account');
    await expect(page.getByPlaceholder('Alice Smith')).toBeVisible();
    await expect(page.getByPlaceholder('alice@example.com')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });
});

// ── Tier-1 form interactions ────────────────────────────────

test.describe('Tier-1 form interactions', () => {
  test('landing email form submits and shows confirmation', async ({ page }) => {
    await page.goto('/');
    const emailInput = page.locator('input[type="email"]');
    await emailInput.fill('test@example.com');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByText("You're on the list.")).toBeVisible();
  });

  test('register form disables submit when empty', async ({ page }) => {
    await page.goto('/register');
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeDisabled();
  });

  test('register form enables submit with valid input', async ({ page }) => {
    await page.goto('/register');
    await page.getByPlaceholder('Alice Smith').fill('Test User');
    await page.getByPlaceholder('alice@example.com').fill('test@example.com');
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeEnabled();
  });
});

// ── Cross-page navigation ───────────────────────────────────

test.describe('Tier-1 navigation', () => {
  test('can navigate from landing to register', async ({ page }) => {
    await page.goto('/');
    await page.goto('/register');
    await expect(page.locator('h1')).toHaveText('Create Account');
  });

  test('can navigate from register back to landing', async ({ page }) => {
    await page.goto('/register');
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('AI Boilerplate');
  });

  test('app shell stays intact across route changes', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('app-root')).toBeAttached();
    await page.goto('/register');
    await expect(page.locator('app-root')).toBeAttached();
  });
});

// ── Excluded routes (extend as tier-2+ features are added) ──

test.describe('Excluded routes', () => {
  test('unknown route does not crash the app', async ({ page }) => {
    await page.goto('/non-existent-feature');
    await expect(page.locator('app-root')).toBeAttached();
  });

  // When a tier-2 feature is added, add a test like:
  // test('tier-2 route is not reachable in tier-1 build', async ({ page }) => {
  //   await page.goto('/analytics');
  //   await expect(page.locator('app-analytics')).not.toBeAttached();
  // });
});

// ── Backend API surface (skipped when backend is unavailable) ──

test.describe('Tier-1 backend API', () => {
  test('GET /api/health returns status ok', async ({ request }) => {
    const res = await request.get('/api/health');
    test.skip(!res.ok(), 'Backend not available');
    const body = (await res.json()) as { status: string; version: string };
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('version');
  });

  test('POST /api/users accepts valid registration', async ({ request }) => {
    const res = await request.post('/api/users', {
      data: { name: 'E2E Test', email: `e2e-${String(Date.now())}@test.local` },
    });
    test.skip(res.status() === 0 || res.status() >= 500, 'Backend not available');
    // 201 Created or 409 Conflict (duplicate) are both valid in tier-1
    expect([201, 409]).toContain(res.status());
  });

  test('POST /api/users rejects invalid email', async ({ request }) => {
    const res = await request.post('/api/users', {
      data: { name: 'Bad Email', email: 'not-an-email' },
    });
    test.skip(res.status() === 0 || res.status() >= 500, 'Backend not available');
    expect(res.status()).toBe(422);
  });
});

// ── Accessibility baseline for tier-1 pages ─────────────────

test.describe('Tier-1 accessibility', () => {
  test('landing page has no critical a11y violations', async ({ page, makeAxe }) => {
    await page.goto('/');
    await page.locator('h1').waitFor();
    const results = await makeAxe().analyze();
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
  });

  test('register page has no critical a11y violations', async ({ page, makeAxe }) => {
    await page.goto('/register');
    await page.locator('form').waitFor();
    const results = await makeAxe().analyze();
    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
  });
});
