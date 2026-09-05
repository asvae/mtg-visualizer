import type { Preview } from '@storybook/vue3-vite';
import { themes } from 'storybook/theming';
import '../app/assets/css/main.css';

// App is dark-only (no light/dark toggle), so the preview canvas just
// matches it directly instead of offering a theme switcher.
const preview: Preview = {
  // Global "autodocs" tag — gives every component a "Docs" entry that lists
  // all of its own stories on one page (props table + each story rendered
  // inline), without needing tags: ['autodocs'] repeated in every
  // *.stories.ts file. `docs.autodocs` in main.ts alone doesn't do this in
  // this Storybook version — the tag has to come from here.
  tags: ['autodocs'],
  parameters: {
    backgrounds: { disable: true },
    layout: 'fullscreen',
    // manager.ts's themes.dark only styles the sidebar/toolbar chrome —
    // the addon-docs page itself (headings, description, ArgsTable) is a
    // separate rendering context with its own default (light) theme unless
    // told otherwise here.
    docs: { theme: themes.dark },
  },
  decorators: [
    (story) => ({
      components: { story },
      template: '<div style="background: var(--color-bg); color: var(--color-text); min-height: 100vh; padding: 2rem;"><story /></div>',
    }),
  ],
};

export default preview;
