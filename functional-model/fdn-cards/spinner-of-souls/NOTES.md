# Spinner of Souls — authoring notes

## Authoring background

Real Forge (spinner_of_souls.txt): `SVar:TrigDigUntil:DB$ DigUntil |
Valid$ Creature | FoundDestination$ Hand | RevealedDestination$ Library |
RevealedLibraryPosition$ -1 | RevealRandomOrder$ True` — a real "reveal
cards from the top of your library UNTIL you reveal one matching a
condition" mechanic, genuinely distinct from `kind:'dig'` (which only
ever looks at a FIXED number of cards, never an open-ended search until a
match). No such "look-until" primitive exists anywhere in this schema.
