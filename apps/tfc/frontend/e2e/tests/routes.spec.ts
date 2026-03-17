import { test, expect } from '@playwright/test';

test.describe('TFC Routes', () => {
  test('join route loads', async ({ page }) => {
    await page.goto('/join');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('builder route loads', async ({ page }) => {
    await page.goto('/builder');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('gm route loads', async ({ page }) => {
    await page.goto('/gm');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('player route loads', async ({ page }) => {
    await page.goto('/player');
    await expect(page.locator('body')).not.toBeEmpty();
  });

  test('review route loads', async ({ page }) => {
    await page.goto('/review');
    await expect(page.locator('body')).not.toBeEmpty();
  });
});
