# Keywords page (`/app/keywords/[[slug]].vue` and its `/app/engine/keywords`
mirror) — decisions worth preserving

- Sidebar-nav + single-selected-content layout (not stacked collapsible
  cards) is this app's established list+detail pattern — Predicates/
  Features/Sets/Sinks under `/app/engine/*` all deliberately mirror this
  page's shape (see `engine-console-conventions.md`).
- `[[slug]].vue` optional-catch-all serves both the bare route (defaults
  to the first visible entry) and `/app/keywords/<slug>` — one file, no
  duplicated fetch/sidebar/search logic. `selectedEntry` is a `computed`
  off `(data, route.params.slug)`, not a ref synced via watch.
- `KeywordEntryCard.vue`'s own card-art thumbnail gallery was intentionally
  removed on this page (not just made text-only) — real card art comes
  back via `ScenarioReplay`/`ScenarioReplayTrace`'s normal `namedCardArt`
  path instead. A `forceTextOnly` prop exists on `ScenarioReplay.vue` for
  text-only rendering but was explicitly REVERTED on this page later (real
  art restored) — don't re-add it here without confirming that reversal
  is still wanted.
- `namedCardArt` (`ScenarioReplay.vue` -> `ScenarioReplayTrace.vue`, keyed
  by card name) is the general fix for scenario bystander cards that never
  get an `instanceId` (so the old `isSelf`-keyed single-card-art path never
  applied to them) — populated from `entry.cards` (every name in a
  bundle's own `cardNames`). A card with no real identity at all (a
  synthetic demo-only card) still correctly falls through to the
  placeholder-chip text abbreviation.
- `setsUsed` chip list is gated purely on field presence (`entry.
  setsUsed` existing), not on review status — a `not_implemented` gap
  entry with real historical set data (e.g. Abandon) still shows the
  header even with no gap note. Capped display at 16 with a "+N more"
  toggle; no set-code-to-full-name tooltip (no cheap client-side mapping
  available).
- Search matches `entry.title` only, applied independently inside each of
  the two grouping computeds (evergreen / set-specific) so a zero-match
  group's heading disappears rather than showing empty.
