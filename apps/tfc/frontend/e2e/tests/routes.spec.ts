import { test, expect } from '@playwright/test';

test.describe('TFC Routes @smoke @routes', () => {
  test('builder route loads', async ({ page }) => {
    await page.goto('/builder');
    await expect(page.locator('body')).not.toBeEmpty();
    await page.screenshot({ path: 'screenshots/builder.png', fullPage: true });
  });

  test('gm route loads', async ({ page }) => {
    await page.goto('/gm');
    await expect(page.locator('body')).not.toBeEmpty();
    await page.screenshot({ path: 'screenshots/gm.png', fullPage: true });
  });

  test('player route loads', async ({ page }) => {
    await page.goto('/player');
    await expect(page.locator('body')).not.toBeEmpty();
    await page.screenshot({ path: 'screenshots/player.png', fullPage: true });
  });

  test('review route loads', async ({ page }) => {
    await page.goto('/review');
    await expect(page.locator('body')).not.toBeEmpty();
    await page.screenshot({ path: 'screenshots/review.png', fullPage: true });
  });
});
