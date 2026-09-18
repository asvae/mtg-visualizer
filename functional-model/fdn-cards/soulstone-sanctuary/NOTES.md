# Soulstone Sanctuary — authoring notes

## Authoring background

Real Forge (soulstone_sanctuary.txt): the animate ability sets a fixed
3/3 P/T and grants "all creature types" — `animate(target, types)` only
ever ADDS a literal, authored type-string array (interfaces.ts), it has
no P/T-setting parameter and no "every creature type" wildcard (hard-
coding all ~250 real creature types would misrepresent this as a fixed
authored list rather than the real dynamic "all" the card prints).
