# Courageous Goblin — authoring notes

## Authoring background

"Whenever this creature attacks while you control a creature with power
4 or greater, this creature gets +1/+0 and gains menace until end of
turn." The conditional gate (power >= 4 control check) is a Forge-side
condition not yet modeled in `CardDefinition`. The effects themselves are
clean.

(Flagged during the 2026-09-18 comment-cleanup sweep: this gate is only
documented as prose, with no `missingSchemaFunctionality` entry declaring
it; worth a follow-up authoring pass, out of scope for a
comment-relocation-only sweep.)
