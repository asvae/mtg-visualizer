# High Fae Trickster — authoring notes

## Authoring background

Real Forge: `S:Mode$ CastWithFlash | ValidCard$ Card | ValidSA$ Spell |
Caster$ You` — "You may cast spells as though they had flash." The
vocabulary has no way to express static abilities that affect casting
mechanics or broadcast keyword grants for casting timing.

(Flagged during the 2026-09-18 comment-cleanup sweep — this is a real,
notable case: unlike most other flagged gaps in this pool, this ability
has NEITHER a `missingSchemaFunctionality` entry NOR any placeholder
`Effect` at all — it is completely absent from this `CardDefinition`,
which otherwise only declares `keywords`. Worth a follow-up authoring
pass to declare this gap properly; out of scope for a
comment-relocation-only sweep.)
