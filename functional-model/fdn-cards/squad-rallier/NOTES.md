# Squad Rallier — authoring notes

## Authoring background

Activated ability: "{2}{W}: Look at the top four cards of your library.
You may reveal a creature card with power 2 or less from among them and
put it into your hand. Put the rest on the bottom of your library in a
random order."

This card's `definition.ts` is now `forge-json-compiler`-sourced
(2026-09-19, later still — the compiler's FDN 1-50 coverage push closed
its own real `AB$`/`Cost$` and `Dig` gaps). The power-based filter gap
this file used to document is CLOSED: `Effect.kind:'dig'` gained a real
`validType: 'creature'` option and a `powerLE` field (`card.ts`, real
Forge `ChangeValid$ Creature.powerLE2` / `CardProperty.java`'s own generic
`power<comparator><N>` shape) instead of the old `'creature-or-artifact'`
approximation this file used to flag as undeclared.

`powerLE` is declaratively real but NOT YET engine-enforced — see
`engine-support-registry.ts`'s own `dig-power-filter-not-enforced` entry
(this card is the one that seeded it; its `pipeline-status.json` carries
`engineSupport: 'off'` for exactly this reason).
