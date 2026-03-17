import { test, expect } from '@playwright/test';

test.describe('Join Flow', () => {
  test('should display the home page by default', async ({ page }) => {
    await page.goto('/');
    // Default route redirects to /home
    await expect(page).toHaveURL(/\/home/);
  });

  test('should show session code input', async ({ page }) => {
    await page.goto('/join');
    // The join view should have an input for session code
    const input = page.locator('input');
    await expect(input.first()).toBeVisible();
  });

  test('should show error for invalid session code', async ({ page }) => {
    await page.goto('/join');
    await page.locator('input').first().fill('XXXXXX');
    await page.locator('input').nth(1).fill('Alice');
    await page.getByRole('button', { name: 'Join' }).click();

    // API call fails — error message shown
    await expect(page.getByText('Session code not found')).toBeVisible();
  });
});
