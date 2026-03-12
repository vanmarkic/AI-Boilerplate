import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/angular';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../../packages/ui/src/**/*.mdx',
    '../../packages/ui/src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: '@storybook/angular',
  webpackFinal: async (config) => {
    if (config.resolve) {
      config.resolve.symlinks = false;
    }
    // Font packages are hoisted to the workspace root node_modules.
    // Storybook webpack resolves style paths relative to frontend/,
    // so we alias them to the root where they actually live.
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias as Record<string, string>),
      'node_modules/@fontsource-variable': resolve(rootDir, 'node_modules/@fontsource-variable'),
    };
    return config;
  },
};
export default config;
