import type { Preview } from '@storybook/angular';

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Color theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: 'tfc-hoi', title: 'HOI4' },
          { value: '', title: 'Default' },
          { value: 'ocean', title: 'Ocean' },
          { value: 'tfc-cyber', title: 'Cyber' },
          { value: 'tfc-health', title: 'Health' },
          { value: 'tfc-military', title: 'Military' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'tfc-hoi',
  },
  decorators: [
    (story, context) => {
      const theme = context.globals['theme'] ?? 'tfc-hoi';
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.setAttribute('data-effects', 'glow-glass');
      return story();
    },
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
