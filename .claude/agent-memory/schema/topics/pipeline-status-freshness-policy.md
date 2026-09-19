# Standing policy: pipeline-status.json freshness (2026-09-19)

Triggered by a real bug: the 23-card forge-json-compiler file-replacement
(see `forge-json-compiler-fdn-1-50-file-replacement-2026-09-19.md`) left
those 23 cards' `pipeline-status.json` unregated for a while — silently
showing yesterday's `computedAt` after their `definition.ts` content had
already changed. It wasn't caught until the user noticed "no changes in
UI." That same-day follow-up regated those 23; this entry generalizes the
lesson pool-wide, going forward.

**Standing rule**: before reporting any FDN card/batch as ready for
review or complete, always verify `pipeline-status.json`'s `computedAt`
is fresh relative to `definition.ts`'s actual current content — re-run
`npx vite-node functional-model/scripts/gate-and-write-status.mjs --all`
(or targeted slugs) if in doubt. Never assume a prior status snapshot is
still accurate. "New schema takes priority": whenever the gate/schema
logic itself changes (new `Effect`/`Trigger` vocabulary, `ENGINE_GAPS.md`
edits that feed `engineGapsContext`, coverage-justification rule changes,
etc.) OR a card's own `definition.ts`/`justification.json` changes,
status must be recomputed for real — a stale `computedAt` must never sit
around undetected.

**Confirmed via a full-corpus regate run (2026-09-19, all 150 real FDN
cards, `--all` flag)**:
- Result: 82 blue / 19 purple / 49 gray / 0 other / 0 missing-file.
- 135/150 cards changed ONLY `computedAt` (pure freshness refresh, no
  substantive change) — most of the corpus, as expected.
- 15/150 cards (all already `purple`, `status` unchanged) had a
  substantively STALE `engineGapsContext` snapshot: `gray` gap list was
  frozen at 3 entries, `purple` at 15, while the live `ENGINE_GAPS.md`
  now backs 21/16 respectively. This is the concrete "gate/schema itself
  drifted since last computed" case the policy above exists for — not a
  card-content change, a context-source change. Slugs: abyssal-harvester,
  aetherize, angel-of-finality, chandra-flameshaper,
  curator-of-destinies, divine-resilience, drake-hatcher,
  fiery-annihilation, high-fae-trickster, incinerating-blast,
  inspiring-paladin, joust-through, kellan-planar-trailblazer,
  make-your-move, zul-ashur-lich-lord. (4 other purple cards —
  homunculus-horde, kaito-cunning-infiltrator, kykar-zephyr-awakener,
  nine-lives-familiar — already had the fresh 21/16 context, presumably
  regated more recently.)
- No `status` (blue/purple/gray) value itself flipped for any card in
  this run — the corpus's real gate outcomes were already accurate, only
  timestamps/context were stale.
- Zero `yellow`/`green` review verdicts exist anywhere in the FDN pool
  right now (confirmed by grep before AND after this run) — so this run
  never exercised the gate script's own fingerprint-based review-reset
  logic; nothing to accidentally discard. That logic itself was not
  touched/bypassed.

**Practical implication**: `engineGapsContext` is a live, derived
snapshot of `ENGINE_GAPS.md` baked into each `purple`/`blue` card's
`pipeline-status.json` at gate time — it goes stale exactly like
`computedAt` does whenever `ENGINE_GAPS.md` gains/loses entries, even
with zero change to the card's own files. Any session doing an
`ENGINE_GAPS.md` edit (own or via the `engine` agent) that could feed
`engineGapsContext` should consider a full `--all` regate afterward, not
just a regate of the cards it touched directly.
