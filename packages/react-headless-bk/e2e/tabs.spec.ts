import { test, expect } from '@playwright/test';

test.describe('Tabs', () => {
  test('clicking trigger changes active tab', async ({ page }) => {
    await page.goto('/#tabs-auto');
    await page.click('[data-testid="trigger-2"]');
    await expect(page.locator('[data-testid="panel-2"]')).toBeVisible();
    await expect(page.locator('[data-testid="panel-1"]')).not.toBeVisible();
  });

  test('ArrowRight moves focus to next trigger (horizontal)', async ({ page }) => {
    await page.goto('/#tabs-auto');
    await page.focus('[data-testid="trigger-1"]');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-testid="trigger-2"]')).toBeFocused();
  });

  test('ArrowRight in automatic mode activates tab', async ({ page }) => {
    await page.goto('/#tabs-auto');
    await page.focus('[data-testid="trigger-1"]');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-testid="panel-2"]')).toBeVisible();
  });

  test('Home key jumps to first trigger', async ({ page }) => {
    await page.goto('/#tabs-auto');
    await page.focus('[data-testid="trigger-3"]');
    await page.keyboard.press('Home');
    await expect(page.locator('[data-testid="trigger-1"]')).toBeFocused();
  });

  test('End key jumps to last trigger', async ({ page }) => {
    await page.goto('/#tabs-auto');
    await page.focus('[data-testid="trigger-1"]');
    await page.keyboard.press('End');
    await expect(page.locator('[data-testid="trigger-3"]')).toBeFocused();
  });

  test('manual mode: ArrowRight focuses without activating', async ({ page }) => {
    await page.goto('/#tabs-manual');
    await page.focus('[data-testid="trigger-1"]');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-testid="trigger-2"]')).toBeFocused();
    // Panel 1 should still be visible (not activated)
    await expect(page.locator('[data-testid="panel-1"]')).toBeVisible();
    await expect(page.locator('[data-testid="panel-2"]')).not.toBeVisible();
  });

  test('manual mode: Enter activates focused tab', async ({ page }) => {
    await page.goto('/#tabs-manual');
    await page.focus('[data-testid="trigger-1"]');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="panel-2"]')).toBeVisible();
  });

  test('disabled trigger is skipped during arrow navigation', async ({ page }) => {
    await page.goto('/#tabs-disabled');
    await page.focus('[data-testid="trigger-1"]');
    await page.keyboard.press('ArrowRight');
    // trigger-2 is disabled, should skip to trigger-3
    await expect(page.locator('[data-testid="trigger-3"]')).toBeFocused();
  });
});
