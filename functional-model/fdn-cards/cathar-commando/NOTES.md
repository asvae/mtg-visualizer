# Cathar Commando — authoring notes

## Authoring background

"Destroy target artifact or enchantment" — `destroy.validType` has no
artifact/enchantment option (only 'permanent'|'creature'|'land'), but
`combinator.ts`'s `FilterPredicate.cardType` DOES support an OR-matched
type set (`['artifact','enchantment']`) — expressed as a real `program`
(select one qualifying permanent, then destroy it), same DSL
`selectUpTo`/`applyToBound` machinery `felidar-savior` already uses.
