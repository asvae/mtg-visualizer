# Nuxt UI (`@nuxt/ui@^4.11.0`) quirks specific to this project

- `UButtonGroup` does NOT exist in this installed version (confirmed via
  `ls node_modules/@nuxt/ui/dist/runtime/components` — no `ButtonGroup.vue`).
  Vue silently renders it as an unresolved passthrough element (buttons
  still show/work, just with zero joined-corner styling, no console error
  visible unless watching for the resolve warning). The real replacement
  is `FieldGroup.vue` (global name `UFieldGroup`) — genuinely group-aware
  via a `fieldGroup` variant on `Button.vue`. Swap `UButtonGroup` ->
  `UFieldGroup` with no other prop changes if this is ever seen again.
- `UButton`'s `size` prop only accepts `xs`/`sm`/`md`/`lg`/`xl` — `"2xs"`
  is not valid (caught by `nuxi typecheck`, not by anything visual).
- `import.meta.dev` used directly inline in a template `v-if` expression
  breaks the Vue SFC compiler ("import.meta may appear only with
  sourceType: module"). Always assign it to a local `const isDev =
  import.meta.dev` in `<script setup>` first and reference that in the
  template.
- Lucide icon names actually shipped in `@iconify-json/lucide`'s
  `icons.json` (confirmed present): `circle-check`, `circle-x`,
  `triangle-alert`, `list-checks`. Names like `check-circle`/
  `check-circle-2`/`x-circle` do NOT exist under lucide's current naming —
  verify against the installed `icons.json` before using an icon name from
  memory/habit.
