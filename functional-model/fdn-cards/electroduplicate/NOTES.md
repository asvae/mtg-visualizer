# Electroduplicate — authoring notes

## Authoring background

Real Forge (electroduplicate.txt): `SP$ CopyPermanent | ValidTgts$
Creature.YouCtrl | AddKeywords$ Haste | AtEOTTrig$ Sacrifice` — "Create a
token that's a copy of target creature you control, except it has haste
and 'At the beginning of the end step, sacrifice this token.'"
`copyPermanent` (interfaces.ts) IS wired into `Actions` (card.ts's own
`Actions.copyPermanent`) and returns the real new token `Card` — that
exact object reference is what makes the delayed self-sacrifice precise
(closing over `copy` directly, `actions.moveTo(copy, 'Graveyard')`,
rather than an ambiguous "sacrifice by criteria" call that could grab a
different creature/token off the board — same real `delayUntil`
primitive elrond-moon-reader's own "return at the beginning of the next
end step" custom effect already uses).
