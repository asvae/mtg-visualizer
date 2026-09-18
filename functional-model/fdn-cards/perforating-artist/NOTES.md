# Perforating Artist — authoring notes

## Authoring background

Real Forge (perforating_artist.txt): Raid firing shape is real/modelable
(`on:'endStep'` + `condition:{kind:'attackedThisTurn'}`), but the actual
effect — "each opponent loses 3 life UNLESS that player sacrifices a
nonland permanent of their choice or discards a card" — is a real
pay-or-suffer CHOICE the AFFECTED player makes. No player-decision engine
exists anywhere in this codebase (`chooseTarget` always deterministically
takes the first pool candidate; `optional`/`declineOptional`-style flags
are documentary only) — there's no mechanism for an opponent to choose
between an unless-cost and a consequence at all.
