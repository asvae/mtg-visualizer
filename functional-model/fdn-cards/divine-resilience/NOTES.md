# Divine Resilience — authoring notes

## Authoring background

Kicker {2}{W} — modeled using `modal` mechanism (mode 0 = not kicked,
mode 1 = kicked), same convention chocobo-kick/vayne-s-treachery use.
Mode 0 targets one creature, mode 1 targets any number.

Mode 1's own effect (`kind: 'custom'`, no-op): this effect would be
triggered only if the spell was kicked. In practice, the scenario would
select this mode (mode 1) to indicate kicker was paid and would select
the targets. The grantKeyword effect would then apply to all chosen
targets. For now, this is modeled as a placeholder since
`grantKeywordTarget` doesn't support "any number" of targets yet —
declared as a real `missingSchemaFunctionality` entry (2026-09-18,
coverage-justification authoring pass), not a silent no-op: no "choose
any number of targets" primitive exists anywhere in this schema, genuine
capacity gap, caps this card at `purple`.

The specific printed Kicker cost, `{2}{W}`, is now also structurally
recorded via `keywordCosts` (same split Ward's own non-default cost
already established) — this card is in fact `card.ts`'s own cited
motivating example for that field's existence.
