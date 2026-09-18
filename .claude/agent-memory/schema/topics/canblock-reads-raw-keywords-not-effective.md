# `engine.ts`'s `canBlock` reads raw `keywords`, not `effectiveKeywords` (found 2026-09-18, authoring cephalid-inkmage)

While authoring `cephalid-inkmage`'s Threshold-gated "can't be blocked" via a
self-only `continuousKeywordGrants:[{keywords:['Unblockable'], ...}]` entry
(the first real FDN use of a GRANTED, as opposed to printed, `'Unblockable'`),
found that `functional-model/engine.ts`'s `canBlock` (509.1 legality check)
reads `attacker.keywords.includes('Unblockable')` and
`blocker.keywords.includes('Flying'|'Reach')` directly off the RAW per-card
`keywords` array — never `effectiveKeywords(state, card)`, the real query-time
function that unions `continuousKeywordGrants` (confirmed: `state.ts`'s
`effectiveKeywords` exists and IS used elsewhere in `engine.ts`, e.g. Haste/
Defender/first-strike checks — `canBlock` specifically is the one chokepoint
that doesn't consult it for Unblockable/Flying/Reach).

**Consequence**: even an UNCONDITIONAL `continuousKeywordGrants`-granted
`'Unblockable'`/`'Flying'`/`'Reach'` would not affect blocking legality today
— this is independent of (and predates) the new `BoardStateCondition`
machinery this same pass added; cephalid-inkmage's own `condition` field not
being checked is a SEPARATE reason on top of this one.

**Not fixed** — `engine.ts` is `engine`-owned, out of this specialist's lane.
Flagged in `cephalid-inkmage/definition.ts`'s own comment and its
`justification.json` reasoning so it's visible to whoever authors that card's
`justification.json`/anyone auditing it, and here for `engine` to pick up if
useful — plausibly worth a small `ENGINE_GAPS.md` note or a `canBlock` fix
(swap the raw reads for `effectiveKeywords`/`effectiveTypes`-style calls) the
next time `engine` is in this file, but no FDN card's status depends on it
being fixed (recognized-but-inert either way, Ward pattern).
