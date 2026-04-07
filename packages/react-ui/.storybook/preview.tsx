import type { Preview } from 'storybook';
import '@aspect/design-system';

const preview: Preview = {
  initialGlobals: {
    theme: '',
    effects: 'glow-glass',
  },
  globalTypes: {
    theme: {
      description: 'Design system theme',
      toolbar: {
        title: 'Theme',
        icon: 'paintbrush',
        items: [
          { value: '', title: 'Naval Group Corporate' },
          { value: 'steel-blue', title: 'Steel Blue' },
          { value: 'ocean', title: 'Ocean' },
        ],
        dynamicTitle: true,
      },
    },
    effects: {
      description: 'Visual effects',
      toolbar: {
        title: 'Effects',
        icon: 'star',
        items: [
          { value: 'glow-glass', title: 'Glow & Glass' },
          { value: '', title: 'None' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme || '';
      const effects = context.globals.effects || '';
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.setAttribute('data-effects', effects);
      return <Story />;
    },
  ],
};

export default preview;
