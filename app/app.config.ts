export default defineAppConfig({
  ui: {
    // @nuxt/ui's own default primary is plain Tailwind `green` — reads as
    // neon/toxic against this app's dark theme, and clashes semantically
    // with `--color-produce` (main.css), which is already "green" for a
    // different reason (theme relations). `teal` reads calmer at the same
    // saturation and doesn't compete with that existing meaning.
    colors: {
      primary: 'teal',
    },
  },
});
