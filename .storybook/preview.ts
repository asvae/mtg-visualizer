import type { Preview } from '@storybook/vue3-vite';
import '../app/assets/css/main.css';

// App is dark-only (no light/dark toggle), so the preview canvas just
// matches it directly instead of offering a theme switcher.
const preview: Preview = {
  parameters: {
    backgrounds: { disable: true },
    layout: 'fullscreen',
  },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div style="background: var(--color-bg); color: var(--color-text); min-height: 100vh; padding: 2rem;"><story /></div>',
    }),
  ],
};

export default preview;
