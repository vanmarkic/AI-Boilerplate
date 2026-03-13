import type { Preview } from '@storybook/angular';
import { withThemeByDataAttribute } from '@storybook/addon-themes';

const preview: Preview = {
  decorators: [
    withThemeByDataAttribute({
      themes: {
        Default: '',
        Ocean: 'ocean',
      },
      defaultTheme: 'Default',
      attributeName: 'data-theme',
      parentSelector: 'html',
    }),
  ],
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },
  },
};

export default preview;
