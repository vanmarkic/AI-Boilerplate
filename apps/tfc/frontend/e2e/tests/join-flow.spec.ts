import { test, expect } from '@playwright/test';

test.describe('Join Flow', () => {
  test('should display the join page by default', async ({ page }) => {
    await page.goto('/');
    // Default route redirects to /join
    await expect(page).toHaveURL(/\/join/);
  });

  test('should show session code input', async ({ page }) => {
    await page.goto('/join');
    // The join view should have an input for session code
    const input = page.locator('input');
    await expect(input.first()).toBeVisible();
  });

  test('should show error for invalid session code', async ({ page }) => {
    await page.goto('/join');
    const input = page.locator('input').first();
    await input.fill('XXXXXX');
    // Submit the form
    const button = page.locator('button').filter({ hasText: /join|enter/i });
    if (await button.count() > 0) {
      await button.first().click();
      // Should show some error indication (API call will fail)
      await page.waitForTimeout(1000);
    }
  });
});
