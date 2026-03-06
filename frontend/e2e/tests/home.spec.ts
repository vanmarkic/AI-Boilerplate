import { expect, test } from '../fixtures/base.fixture';

test.describe('Home page', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Frontend/i);
  });

  test('should display landing content', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText('AI Boilerplate');
  });
});
