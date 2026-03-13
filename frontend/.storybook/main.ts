import { resolve, dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/angular';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const maplibreCss = readFileSync(
  resolve(rootDir, 'node_modules/maplibre-gl/dist/maplibre-gl.css'),
  'utf-8',
);

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/!(ui)/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../../packages/ui/src/**/*.mdx',
    '../../packages/ui/src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
  ],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs', '@storybook/addon-themes'],
  framework: '@storybook/angular',
  previewHead: (head) => `${head}\n<style>@layer vendor { ${maplibreCss} }</style>`,
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
