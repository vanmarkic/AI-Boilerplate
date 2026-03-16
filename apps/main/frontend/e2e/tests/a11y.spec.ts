import { AxeResults } from 'axe-core';
import { expect, test } from '../fixtures/base.fixture';

function getCriticalViolations(results: AxeResults) {
  return results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious',
  );
}

test.describe('Accessibility', () => {
  test('home page should have no critical a11y violations', async ({ page, makeAxe }) => {
    await page.goto('/');
    await page.locator('h1').waitFor();
    const violations = getCriticalViolations(await makeAxe().analyze());
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  test('register page should have no critical a11y violations', async ({ page, makeAxe }) => {
    await page.goto('/register');
    await page.locator('form').waitFor();
    const violations = getCriticalViolations(await makeAxe().analyze());
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });
});
