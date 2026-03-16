import { AxeBuilder } from '@axe-core/playwright';
import { test as base } from '@playwright/test';

type Fixtures = {
  makeAxe: () => AxeBuilder;
};

export const test = base.extend<Fixtures>({
  makeAxe: async ({ page }, use) => {
    await use(() => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']));
  },
});

export { expect } from '@playwright/test';
