# Squad Rallier — authoring notes

## Authoring background

Activated ability: "{2}{W}: Look at the top four cards of your library.
You may reveal a creature card with power 2 or less from among them and
put it into your hand. Put the rest on the bottom of your library in a
random order."

GAP: The `dig` effect does not support power-based filtering (power <=
2). Current vocabulary: `validType` can be
'artifact'/'any'/'creature-or-artifact' but no numeric power constraint.

(Flagged during the 2026-09-18 comment-cleanup sweep: this power-filter
gap is only documented as prose, with no `missingSchemaFunctionality`
entry declaring it; worth a follow-up authoring pass, out of scope for a
comment-relocation-only sweep.)
