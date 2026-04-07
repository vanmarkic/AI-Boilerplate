import { test, expect } from '@playwright/test';

test.describe('Dialog', () => {
  test('focus moves into dialog on open', async ({ page }) => {
    await page.goto('/#dialog-basic');
    await page.click('[data-testid="trigger"]');
    // First input in dialog should receive focus
    await expect(page.locator('[data-testid="first-input"]')).toBeFocused();
  });

  test('Tab cycles within dialog content', async ({ page }) => {
    await page.goto('/#dialog-basic');
    await page.click('[data-testid="trigger"]');
    // Focus is on first-input; Tab should go to second-input
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="second-input"]')).toBeFocused();
    // Tab again should go to Close button
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="close-btn"]')).toBeFocused();
    // Tab again should wrap back to first-input (focus trap)
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="first-input"]')).toBeFocused();
  });

  test('Escape closes dialog', async ({ page }) => {
    await page.goto('/#dialog-basic');
    await page.click('[data-testid="trigger"]');
    await expect(page.locator('[data-testid="dialog-content"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="dialog-content"]')).not.toBeVisible();
  });

  test('Close button closes dialog', async ({ page }) => {
    await page.goto('/#dialog-basic');
    await page.click('[data-testid="trigger"]');
    await page.click('[data-testid="close-btn"]');
    await expect(page.locator('[data-testid="dialog-content"]')).not.toBeVisible();
  });

  test('focus returns to trigger after close', async ({ page }) => {
    await page.goto('/#dialog-basic');
    await page.click('[data-testid="trigger"]');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="trigger"]')).toBeFocused();
  });

  test('body scroll is locked while dialog is open', async ({ page }) => {
    await page.goto('/#dialog-basic');
    await page.click('[data-testid="trigger"]');
    const overflow = await page.evaluate(() => document.body.style.overflow);
    expect(overflow).toBe('hidden');
  });

  test('forceMount: content in DOM with data-state=closed when dialog is closed', async ({
    page,
  }) => {
    await page.goto('/#dialog-force-mount');
    const content = page.locator('[data-testid="dialog-content"]');
    await expect(content).toBeAttached(); // in DOM
    await expect(content).toHaveAttribute('data-state', 'closed');
  });

  test('aria-labelledby matches Dialog.Title id', async ({ page }) => {
    await page.goto('/#dialog-basic');
    await page.click('[data-testid="trigger"]');
    const dialogEl = page.locator('[role="dialog"]');
    const titleEl = page.locator('[role="dialog"] h2');
    const titleId = await titleEl.getAttribute('id');
    await expect(dialogEl).toHaveAttribute('aria-labelledby', titleId!);
  });
});
