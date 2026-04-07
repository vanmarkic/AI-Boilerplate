import { test, expect } from '@playwright/test';

test.describe('Accordion', () => {
  test('single mode: opening B closes A', async ({ page }) => {
    await page.goto('/#accordion-single');
    await page.click('[data-testid="trigger-a"]');
    await expect(page.locator('[data-testid="content-a"]')).toBeVisible();
    await page.click('[data-testid="trigger-b"]');
    await expect(page.locator('[data-testid="content-b"]')).toBeVisible();
    await expect(page.locator('[data-testid="content-a"]')).not.toBeVisible();
  });

  test('single collapsible: clicking open item closes it', async ({ page }) => {
    await page.goto('/#accordion-single');
    await page.click('[data-testid="trigger-a"]');
    await expect(page.locator('[data-testid="content-a"]')).toBeVisible();
    await page.click('[data-testid="trigger-a"]');
    await expect(page.locator('[data-testid="content-a"]')).not.toBeVisible();
  });

  test('multiple mode: A and B can both be open', async ({ page }) => {
    await page.goto('/#accordion-multiple');
    await page.click('[data-testid="trigger-a"]');
    await page.click('[data-testid="trigger-b"]');
    await expect(page.locator('[data-testid="content-a"]')).toBeVisible();
    await expect(page.locator('[data-testid="content-b"]')).toBeVisible();
  });

  test('disabled item cannot be opened', async ({ page }) => {
    await page.goto('/#accordion-disabled');
    // force: true because aria-disabled prevents normal click interaction
    await page.click('[data-testid="trigger-a"]', { force: true });
    await expect(page.locator('[data-testid="content-a"]')).not.toBeVisible();
  });

  test('ArrowDown moves focus between triggers', async ({ page }) => {
    await page.goto('/#accordion-single');
    await page.focus('[data-testid="trigger-a"]');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('[data-testid="trigger-b"]')).toBeFocused();
  });
});
