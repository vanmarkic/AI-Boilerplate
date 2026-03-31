import { test, expect } from '@playwright/test';

test.describe('Collapsible', () => {
  test('click trigger toggles content', async ({ page }) => {
    await page.goto('/#collapsible-basic');
    await expect(page.locator('[data-testid="content"]')).not.toBeVisible();
    await page.click('[data-testid="trigger"]');
    await expect(page.locator('[data-testid="content"]')).toBeVisible();
    await page.click('[data-testid="trigger"]');
    await expect(page.locator('[data-testid="content"]')).not.toBeVisible();
  });

  test('data-state updates on toggle', async ({ page }) => {
    await page.goto('/#collapsible-basic');
    const trigger = page.locator('[data-testid="trigger"]');
    await expect(trigger).toHaveAttribute('data-state', 'closed');
    await page.click('[data-testid="trigger"]');
    await expect(trigger).toHaveAttribute('data-state', 'open');
  });

  test('Enter/Space on trigger toggles', async ({ page }) => {
    await page.goto('/#collapsible-basic');
    await page.focus('[data-testid="trigger"]');
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="content"]')).toBeVisible();
  });

  test('disabled collapsible does not toggle', async ({ page }) => {
    await page.goto('/#collapsible-disabled');
    // force: true because the button is HTML-disabled and Playwright won't click disabled elements
    await page.click('[data-testid="trigger"]', { force: true });
    await expect(page.locator('[data-testid="content"]')).not.toBeVisible();
  });

  test('forceMount: content stays in DOM, data-state changes', async ({ page }) => {
    await page.goto('/#collapsible-force-mount');
    const content = page.locator('[data-testid="content"]');
    await expect(content).toBeAttached();
    await expect(content).toHaveAttribute('data-state', 'closed');
    await page.click('[data-testid="trigger"]');
    await expect(content).toHaveAttribute('data-state', 'open');
  });
});
