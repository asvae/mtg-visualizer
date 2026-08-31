import type { StorybookConfig } from '@storybook/vue3-vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

// Plain Vue+Vite framework, not Nuxt — there's no published Nuxt framework
// preset, and the components worth story-ing (presentational ones like
// CardMediaRelations.vue) don't touch Nuxt-specific APIs anyway, just plain
// props/emits + Tailwind classes. @storybook/vue3-vite only wires the story
// decorator/template compilation, NOT actual .vue SFC compilation — without
// @vitejs/plugin-vue added by hand here, .vue files 404/fail to transform
// entirely. Same reason the Tailwind Vite plugin is added by hand below:
// this build doesn't go through Nuxt's own Vite config.
const config: StorybookConfig = {
  stories: ['../app/**/*.stories.@(js|ts)'],
  framework: {
    name: '@storybook/vue3-vite',
    options: {},
  },
  async viteFinal(viteConfig) {
    viteConfig.plugins ??= [];
    viteConfig.plugins.push(vue(), tailwindcss());
    return viteConfig;
  },
};

export default config;
