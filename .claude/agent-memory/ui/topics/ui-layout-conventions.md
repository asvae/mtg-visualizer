# Small established UI conventions worth matching, not re-deriving

- **Floating overlay controls**: bottom-right corner
  (`layouts/graph.vue`, `absolute right-3 bottom-3 z-10`) is used for
  gravity-mode-select + PhysicsControls. Bottom-center
  (`absolute bottom-3 left-1/2 -translate-x-1/2 z-10`, inside `app/pages/
  app/index.vue`) is used for the Graph/List toggle — placed there
  specifically to avoid colliding with the bottom-right pair. If a third
  floating control is ever added, this is the established `bottom-3`/
  `z-10` offset pattern to match, and it should NOT collide with either
  existing corner.
- **Badges vs. dots for status display**: compact list rows (sidebar rows,
  filter chips) use a plain small colored dot, status name in a hover
  `title` only — kept intentionally minimal, not upgraded to full badges,
  because per-row space is genuinely tight. A single "prominent" status
  display (e.g. a detail-pane header) uses a real `UBadge` with the label
  always visible next to the entry name. Don't blanket-convert one style
  to the other without checking which context a given instance is in.
- **`app/lib/badgeColor.ts`** (`statusBadgeStyle`/`readableTextColor`) is
  the one legibility helper for coloring a `UBadge` against an arbitrary
  hex — reuse it for any new badge rather than hand-picking per-color text
  contrast.
