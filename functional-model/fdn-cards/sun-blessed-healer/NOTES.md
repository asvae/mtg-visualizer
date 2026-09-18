# Sun-Blessed Healer — authoring notes

## Authoring background

Real Kicker {1}{W}. `'Kicker'` is now a real `Keyword` union member
(2026-09-18, schema-completeness pass) — the base "this spell has Kicker"
fact is tracked via `keywords`, and the specific non-default cost payload
("{1}{W}") is recorded via the sibling `keywordCosts` field (same split
Ward already uses — see sire-of-seven-deaths/zul-ashur-lich-lord). Still
recognized-but-inert: no payment-tracking or modal-gating-on-payment
mechanism exists anywhere in this engine (Ward pattern — see
`engine-support-registry.ts`'s own `kicker-not-enforced` entry) — the
card's own kicked/not-kicked BRANCH is still modeled via the pre-existing
`modal`/`ctx.mode` mechanism, same as before this field existed.

No field conditions a trigger's firing on whether an alternate/additional
cost was paid — modeled via the same `modal`/`ctx.mode` convention
chocobo-kick/vayne-s-treachery/divine-resilience already use for Kicker
(mode 0 = not kicked, nothing happens; mode 1 = kicked, do the real
return).
