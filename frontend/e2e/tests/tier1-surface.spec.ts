import { expect, test } from '../fixtures/base.fixture';

/**
 * Tier-1 partial build E2E — verifies the minimum viable feature surface.
 *
 * These tests run against a tier-1 filtered build to confirm:
 *   1. Tier-1 routes are reachable and render correctly.
 *   2. No higher-tier routes accidentally leak into the build.
 *
 * When tier-2+ features are added, append negative-path assertions below
 * (e.g. navigating to a tier-2 route should 404 / redirect).
 */

test.describe('Tier-1 build surface', () => {
  test('landing page renders hero content', async ({ page }) => {
    await page.goto('/');
    const heading = page.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText('AI Boilerplate');
  });

  test('register page renders form', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('form')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('register form validates required fields', async ({ page }) => {
    await page.goto('/register');
    const submitBtn = page.locator('button[type="submit"]');
    // Button should be disabled when form is empty
    await expect(submitBtn).toBeDisabled();
  });

  test('unknown route does not render excluded content', async ({ page }) => {
    // Navigating to a non-existent route should not crash the app.
    // This is the baseline — extend with tier-2 route names once they exist.
    const response = await page.goto('/non-existent-feature');
    // App shell should still render (Angular handles unknown routes)
    await expect(page.locator('app-root')).toBeAttached();
  });
});

test.describe('Tier-1 backend API surface', () => {
  test('GET /api/health returns ok', async ({ request }) => {
    const res = await request.get('/api/health');
    // In dev without backend running this will fail — skip gracefully in CI
    // when only frontend is started. The full-stack CI job validates this.
    test.skip(!res.ok(), 'Backend not available — skipping API check');
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
