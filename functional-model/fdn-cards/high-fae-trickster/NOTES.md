# High Fae Trickster — authoring notes

## Authoring background

Real Forge: `S:Mode$ CastWithFlash | ValidCard$ Card | ValidSA$ Spell |
Caster$ You` — "You may cast spells as though they had flash." The
vocabulary has no way to express static abilities that affect casting
mechanics or broadcast keyword grants for casting timing.

(Was flagged during the 2026-09-18 comment-cleanup sweep — a real,
notable case: unlike most other flagged gaps in this pool, this ability
had NEITHER a `missingSchemaFunctionality` entry NOR any placeholder
`Effect` at all, completely absent from this `CardDefinition` — a real
silent drop, not just an inert placeholder. Resolved in the same-day
coverage-justification authoring pass: checked for an existing static/
continuous-grant shape that could express "cast spells as though they
had flash" first (none of `continuousKeywordGrants`/
`continuousPTGrants`/`continuousTypeGrants` fit — all three broadcast
onto PERMANENTS on the battlefield, never onto the controller's own
general casting permission over cards still in hand) — genuinely no fit,
so this is now a real, declared `missingSchemaFunctionality` entry
instead of a silent absence. This caps the card at `purple`, not `blue`
— a real, honest capacity gap, not a schema-completeness oversight to
close inline.)
