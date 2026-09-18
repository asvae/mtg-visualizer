# Authority of the Consuls — authoring notes

## Authoring background

Real Forge (authority_of_the_consuls.txt): `R:Event$ Moved | ValidCard$
Creature.OppCtrl | Destination$ Battlefield | ReplaceWith$ ETBTapped` —
a real CR 614 replacement on OTHER players' own creatures entering
tapped. No such cross-controller ETB-tapped replacement grant exists
anywhere in this schema (`millModifierGrants`/`spellCostReductionGrants`
are the closest analogous "broadcast a replacement onto opponents' own
events" shapes, neither covers entering-tapped). The lifegain trigger's
own `ValidCard$ Creature.OppCtrl` filter also has no matching vocabulary:
`otherPermanentEntersMatch.sameController` is only documented for "same
controller as the granting permanent" (the you-case), never an
opponent-only filter.
