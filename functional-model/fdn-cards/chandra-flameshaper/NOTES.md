# Chandra, Flameshaper — authoring notes

## Authoring background (updated 2026-09-18, coverage-justification pass)

The prior version of this file's own "FLAG: Planeswalker loyalty
mechanics" framing overstated the gap: `abilities[].cost` is real,
documentary free text (same pattern `ajani-caller-of-the-pride`/
`kaito-cunning-infiltrator` already use for `'Loyalty: +1'`-style costs)
— recognized-but-inert, same "Ward pattern" `keywordCosts`/`Ward` already
establishes, not itself a declared capacity gap. Loyalty COUNTER tracking
is the same recognized-but-inert story. Neither blocks real structure
from existing on this card.

What actually IS genuinely unbuilt, now formally declared via 3 real
`missingSchemaFunctionality` entries instead of silent absence:
1. `[+2]`'s own "Exile the top three cards of your library. Choose one.
   You may play that card this turn." — no impulse-draw primitive exists.
   The `[+2]`'s own "Add {R}{R}{R}" half IS real (`kind:'addMana'`).
2. `[+1]`'s own "Create a token that's a copy of target creature you
   control, except it has haste and ...sacrifice this token." — the same
   "copy a permanent, with overrides" gray-tier engine gap
   `abyssal-harvester` also needs; entirely unbuilt.
3. `[-4]`'s own "Chandra deals 8 damage divided as you choose among any
   number of target creatures and/or planeswalkers." — `dealDamageTarget`
   only ever hits a single creature, no planeswalker option, no
   player-chosen division across multiple targets.

No emblem/ultimate ability is actually printed on this card (that was a
generic loyalty-planeswalker caveat in the old note, not something this
specific card's own real text needs) — removed from this file since it
doesn't apply here.
