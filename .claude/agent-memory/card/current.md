# card agent — memory index

- [Dev-environment gotchas](topics/dev-environment-gotchas.md) — vue-tsc no-op, single dev-server lock, stale HMR, Playwright scratch-script placement.
- [Nitro `.mjs` import gotcha](topics/nitro-mjs-import-gotcha.md) — a dynamically-imported `.mjs` sibling breaks Nitro's dev bundler at runtime even though `tsc` passes; spawn via vite-node instead.
- [Prod functional-model bundle](topics/prod-functional-model-bundle.md) — Netlify Functions can't touch raw `functional-model/`; prod reads a committed `fm-bundle.json` with a manual regen+commit cadence.
- [Card page route architecture](topics/card-page-route-architecture.md) — `CardDetailTabs.vue` is the shared content hub across 3 page hosts; standalone `/app/card` and `/app/engine/cards` are deliberately separate routes (a merge was tried and reverted).
- [FDN vs FIN card model](topics/fdn-vs-fin-card-model.md) — FDN cards have no Facts/synergy data; separate pipeline-status + plain-oracle-text treatment (no sink-attachment tab anymore — reverted).
- [FDN Interactions wiring](topics/fdn-interactions-wiring.md) — `computeCardInteractions` served/rendered live; FDN pool loader must spawn vite-node, not plain `import()`, or program-effect cards silently drop out.
- [Card-status bucket system](topics/card-status-bucket-system.md) — FIN fact-authoring dashboard buckets, duplicated-by-convention union across 3 files, computed live per-request.
- [`cardResponse.ts` hand-mirror gotcha](topics/cardresponse-hand-mirror-gotcha.md) — client `CardResponse` type is a hand-kept duplicate of the server route's type, not imported; new server fields get missed here.
- [DFC / multi-face gotchas](topics/dfc-and-multiface-gotchas.md) — Scryfall never serves per-face keywords; DFC `PoolCard.name` is front-face-only; FIN's bonus/variant collector numbers.
- [Fact-provenance icon history](topics/fact-provenance-icon-history.md) — meaning has flipped repeatedly; verify current template before assuming which icon means what.
- [`factConditions.ts` design principle](topics/fact-conditions-design-principle.md) — exclusion-list not allow-list; over-showing is the safe direction to be wrong.
- [Card-lookup duplication precedent](topics/card-lookup-duplication-precedent.md) — several routes deliberately hand-roll their own card lookup; revisit only at a 4th consumer.
- [Forge-model deletion](topics/forge-model-deletion.md) — `forge-model/`/`ForgeCardScript.vue` deleted 2026-09-11 for GPL-3.0 exposure; why it's gone from this agent's domain list; see forge-script-dev-tab.md for the 2026-09-19 confirmed revival.
- [Forge Script dev tab](topics/forge-script-dev-tab.md) — 2026-09-19 revival, dev-only live-read from gitignored `tmp/mtg-forge/`, never committed/bundled; slug algorithm + pieces + a dev-server-restart gotcha hit while verifying.
- [Facts-tab display ordering invariants](topics/facts-display-ordering-invariants.md) — toggles must filter, never re-sort; multi-fact-per-segment hover must highlight all of them.
- [Flex-col text-overflow gotcha](topics/flex-col-text-overflow-gotcha.md) — a `shrink-0`/unbounded flex sibling holding long freeform text can collapse `CardMedia` to 0×0 via a flexbox circular-sizing quirk; needs explicit `max-w-*`+`min-w-0`, not just `break-words` — the specific box this fixed is since removed (see fdn-vs-fin-card-model.md), lesson generalizes.
- [EngineConsoleShell `header-extra` slot](topics/engine-console-shell-header-extra-slot.md) — generic optional slot next to "N of N"; today's only consumer is the Cards tab's FDN pipeline-status badge.
- [PlainOracleText collapse toggle](topics/plain-oracle-text-collapse-toggle.md) — FDN-only hover-reveal Shorter/Longer button; short state = oracle text only, mana icons intact.
- [Shared card-meta resolver](topics/shared-card-meta-resolver.md) — `server/utils/cardMeta.ts`/`scryfallFetch.ts` + `CardMatchGallery.vue`; the one correct way to render a card-name match list with real thumbnails, never a live per-card client fetch.

## Known open item (not yet fixed, flagged to orchestrator each time)

- `.claude/contracts/state-event-format.md`'s `TraceResult.scenario` shape
  omits the real, already-shipped `scenario.raw` field (documented in
  `harness.ts`'s own `TraceResult` interface comment, just never copied
  into the contract's abbreviated version). Harmless (additive field,
  "render generically off `fn`" already covers `log`), just a doc gap.
