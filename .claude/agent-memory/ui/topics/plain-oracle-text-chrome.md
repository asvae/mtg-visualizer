# PlainOracleText.vue — FDN's non-annotated card-text chrome

- `PlainOracleText.vue` (used for `fdn` cards, which have no
  `synergy.json`/`Fact.annotations` at all) intentionally stays free of
  `FunctionalModelText.vue`'s Fact/annotation/highlight machinery, but it
  DOES reuse that component's plain visual chrome: name heading, mana cost
  as real `<ManaSymbol>` icons (`parseManaSegments`), type line, oracle-text
  body with inline mana icons too, power/toughness line. Stripping
  annotations must never mean stripping mana-icon rendering — a prior pass
  over-stripped down to a bare `<p>{{ oracleText }}</p>`, which regressed
  `{3}{W}`-style inline costs (e.g. Celestial Armor's "Equip {3}{W}") back
  to literal curly-brace text. Fixed 2026-09-18.
- Props widened from a single `oracleText: string` to also take
  `name`/`manaCost`/`typeLine`/`power?`/`toughness?` — the plain (non-
  annotated) `CardData` fields `CardDetailTabs.vue` already has as
  `data.card`, NOT `AnnotatedCard`/`AnnotatedFace` (that's `fin`-only).
  `CardData` has no `colorIndicator` field at all (that's an
  `AnnotatedFace`-only field) — the color-indicator swatch row
  `FunctionalModelText.vue` renders is genuinely omitted here, not faked.
- The header (name/mana-cost/type-line/P-T) renders unconditionally now —
  `CardDetailTabs.vue`'s call-site condition changed from
  `isFdn && data.functionalModel.oracleText` to plain `isFdn`, since a
  vanilla FDN creature (no rules text) still needs its header shown; only
  the oracle-text `<p>` itself is gated on `oracleText` being truthy inside
  `PlainOracleText.vue`.
- FDN's pool is confirmed single-faced only (`layout: 'normal'`, no
  DFC/split/adventure) — this component deliberately never loops over more
  than one face, unlike `FunctionalModelText.vue`.
- Verification gotcha: as of 2026-09-18 there is NO real FDN card in the
  live transcribed pool with `functionalModel` populated AND `oracleText`
  genuinely `''` (every "Not started" pipeline card has `functionalModel:
  null` entirely, not an empty `oracleText` string) — a real vanilla
  creature (e.g. Savannah Lions) just hasn't been transcribed yet. To
  verify the empty-oracle-text/vanilla-creature render path, used
  Playwright `page.route()` to intercept `/api/card/fdn/5` and force
  `oracleText: ''` in the response — confirmed the header still renders,
  no stray `<p>`/gap left. Revisit this once a real vanilla creature is
  transcribed, to confirm against real data too.
