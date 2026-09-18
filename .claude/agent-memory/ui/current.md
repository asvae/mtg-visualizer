# ui agent memory index

Read this in full on every spawn; follow a link into `topics/` only for
what the current task actually needs. Session narration lives in
`log/`, grep-only, not read by default.

- [Graph simulation physics](topics/graph-simulation-physics.md) — never fully settles, soft-vs-hard render, click-vs-drag hit-area, zombie-watcher/onMounted-async pitfall, qty-sync gotcha.
- [Playwright verification conventions](topics/playwright-verification-conventions.md) — `#graph` selector, real clicks over synthetic/forced, waitFor over fixed timeouts, node-isolation-via-display:none, stale dev-server HMR.
- [Synergy edges model](topics/synergy-edges-model.md) — 3 independent mechanisms (synergy-edge toggle, keyword hubs, unshipped relation-hub prototype) + uniform 1/N edge weighting; don't resurrect the scrapped topological source/sink filter.
- [Scope/Deck union model](topics/scope-deck-union-model.md) — `store.graph` = Scope∪Deck, card cache scoping, deck-sink-supply rows, deck-qty stepper, ListView "no themes facet" note.
- [CardPeekPanel design](topics/card-peek-panel-design.md) — URL sync via replace, flex-sibling layout (not overlay), resize width, click-outside excludes `#graph`, route-aware default action.
- [SearchBox design](topics/search-box-design.md) — merged ranked row list, arm-then-confirm keyboard gesture, discover-fetch shape, open releasedAt sort gap.
- [Engine console conventions](topics/engine-console-conventions.md) — `/app/engine/*` shared composable/components, Predicates-vs-Sinks distinction, Nuxt naming/shallowRef/URL-slug gotchas.
- [Engine console Schema page](topics/engine-console-schema-page.md) — `/app/engine/schema` (overflow-only), extracts real `card.ts` type declarations via a brace/comment-aware text scanner, never a hand-copy.
- [Nuxt UI quirks](topics/nuxt-ui-quirks.md) — no `UButtonGroup` (use `UFieldGroup`), `UButton` size values, `import.meta.dev` in templates, real lucide icon names.
- [Scryfall data quirks](topics/scryfall-data-quirks.md) — split/adventure `mana_cost` concatenation, keywords-array-omits-grants, transform-DFC per-face keywords.
- [Keywords page design](topics/keywords-page-design.md) — sidebar+slug layout, `namedCardArt` bystander-art fix, `setsUsed` gating rules.
- [Docs page + markdown renderer](topics/docs-page-markdown.md) — hand-rolled `app/lib/markdown.ts` (no markdown dependency), dev-only gating, shared by the Features-tab excerpt renderer.
- [UI layout conventions](topics/ui-layout-conventions.md) — floating-overlay-corner placement, badge-vs-dot status display rule, `badgeColor.ts` reuse.
- [Open flags to other agents](topics/open-flags-to-other-agents.md) — CardDetailTabs confirm/reject gating (`card`), `released_at` not threaded through card-owned routes (`card`).
- [PlainOracleText chrome](topics/plain-oracle-text-chrome.md) — FDN card header/mana-icon rendering reused from FunctionalModelText.vue minus all Fact/annotation machinery; no live vanilla-creature card yet to verify empty-text path against.
- [Engine console resizable nav](topics/engine-console-resizable-nav.md) — `EngineConsoleShell.vue` drag-handle pane resize, mirrors `CardPeekPanel.vue`'s pattern, shared width/localStorage key across all six tabs.
- [Don't git stash on shared tree](topics/git-stash-concurrent-agents.md) — `git stash` grabs the whole tree, can silently carry a concurrent agent's uncommitted changes; use targeted `git diff`/`git show` instead.
