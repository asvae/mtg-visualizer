# PlainOracleText.vue collapse/expand toggle (2026-09-18)

FDN's `PlainOracleText.vue` root is now a single wrapped `<div class="group
relative max-w-2xl pr-8">` (was a Vue multi-root template before) so the
component can own its own hover/position context without CardDetailTabs.vue
needing a wrapper change. A ghost `UButton` (`variant="ghost"`, `size="xs"`,
chevron icon) sits `absolute top-0 right-0`, hidden via `opacity-0
group-hover:opacity-100 transition-opacity` — only visible while hovering
the card-text container, matching the "reveal on container hover" pattern
(no prior exact convention existed elsewhere in the app for this; nearest
precedent was `app/pages/index.vue`'s unrelated `group`/`group-hover` archetype
tiles).

State: local `ref<boolean>` named `short`, not persisted (no localStorage) —
resets to long on remount, per explicit task guidance to default simple.
Button label is the OPPOSITE of current state ("Shorter" while long,
"Longer" while short) — shows what clicking will DO.

Short state renders ONLY the oracle-text `<p>` (with `parseManaSegments`/
`ManaSymbol` icons intact) — name, mana-cost pips, type line, and P/T are
all `v-if`-gated out, not just visually hidden.

Scope is deliberately FDN-only — `FunctionalModelText.vue` (FIN's
annotated counterpart) was NOT touched; its header row is load-bearing for
self-fact annotation anchoring (`selfFacts`/`headerHighlightIndex`), a
different situation.

Verified live via a throwaway Playwright script (not checked in — used
`.scratch/` as scratch space per this project's Playwright-script
convention, then deleted after) on two real FDN cards: Archmage of Runes
(`fdn/30`, creature w/ P/T) and Arcane Epiphany (`fdn/29`, instant, no
P/T) — hover reveal, label toggle, and mana-icon count before/after
(3 cost pips + 1 in-text pip long -> just the 1 in-text pip short) all
confirmed correct on both.

Gotcha hit while testing: reusing one Playwright `page` across sequential
`page.goto()` calls to two different `:number`s under the same `:set` can
read stale DOM content if you query too eagerly after navigation — this
route only fully remounts on `:set` change (see `card-page-route-
architecture.md`), navigation timing needs a beat. Use a fresh `page` per
card (or wait for the name text itself before asserting) rather than
reusing one page across number changes in a script.
