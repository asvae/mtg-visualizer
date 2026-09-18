# Chandra, Flameshaper — authoring notes

## Authoring background

FLAG: Planeswalker loyalty mechanics (capacity gap)
Loyalty abilities require infrastructure not yet implemented:
(1) Loyalty cost syntax (e.g., "+2", "-4") — `abilities[].cost` only supports mana costs
(2) Loyalty counter tracking on the planeswalker
(3) Ultimate ability support and emblem mechanics

Real card abilities from Scryfall/Forge:
[+2] Add {R}{R}{R}. Exile the top three cards of your library. Choose one. You may play that card this turn.
[+1] Create a token that's a copy of target creature you control, except it has haste and "At the beginning of the end step, sacrifice this token."
[-4] Chandra deals 8 damage divided as you choose among any number of target creatures and/or planeswalkers.
