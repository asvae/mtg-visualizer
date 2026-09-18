# Curator of Destinies — authoring notes

## Authoring background

Real Forge: `R:Event$ Counter | ValidCard$ Card.Self | ValidSA$ Spell |
Layer$ CantHappen` — "This spell can't be countered." The vocabulary has
no way to express replacement effects or uncounterable mechanics.

(Flagged during the 2026-09-18 comment-cleanup sweep: this "can't be
countered" gap is currently only documented as prose, with no
`missingSchemaFunctionality` entry declaring it the way the rest of this
pool does — worth a follow-up authoring pass to migrate it, out of scope
for a comment-relocation-only sweep.)

Real Forge: `DB$ PeekAndReveal | Defined$ You | PeekAmount$ 5 | ... |
TwoPiles | ...` — "look at the top five cards of your library and
separate them into a face-down pile and a face-up pile. An opponent
chooses one of those piles. Put that pile into your hand and the other
into your graveyard." The vocabulary has no way to express: looking at
library cards, separating into piles, or letting an opponent choose
between piles. No move effect can handle conditional pile selection by
opponent.
