import type { Preview } from '@storybook/angular';
import 'maplibre-gl/dist/maplibre-gl.css';

const preview: Preview = {
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
