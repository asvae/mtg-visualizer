# Elenda, Saint of Dusk — authoring notes

## Authoring background

Real Forge (elenda_saint_of_dusk.txt): `K:Hexproof:Instant` — a
QUALIFIED hexproof (protection-style, only from instants), genuinely
narrower than this schema's plain `'Hexproof'` Keyword member (the
general, unqualified version) — declaring `keywords:['Hexproof']` would
overclaim (full hexproof, not just from instants), so it's left off
entirely and declared as its own gap instead. The two `CheckSVar$ X |
SVarCompare$ GTY/GEZ` static P/T+Menace layers are both gated on a LIVE
life-total comparison against this player's own starting life total — no
`BoardStateCondition` variant reads life totals at all (only
graveyard-count/attacked-this-turn/self-counter-count).
