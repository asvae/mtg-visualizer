# Inspiring Paladin — authoring notes

## Authoring background

First ability: "During your turn, this creature has first strike." —
modeled via `continuousKeywordGrants` on self. FULLY covered — removed
from `staticAbilities` outright (2026-09-18, FDN schema-tightness
redesign/migration pass), NOT migrated to `missingSchemaFunctionality`,
since it's not a real gap at all: keeping a covered clause declared as an
open "demand" would misrepresent it. See the sibling `justification.json`.

Second ability: "During your turn, creatures you control with +1/+1
counters on them have first strike." — CANNOT be expressed via current
`continuousKeywordGrants` vocabulary (which filters on subtype, self, or
Equipment attachment, not on counter state). Real, genuine gap — declared
via `missingSchemaFunctionality` (migrated out of `staticAbilities`).

Coverage-justification manifest moved out to the sibling, span-verified
`justification.json` (2026-09-18, the justification.json redesign — see
`.claude/contracts/card-schema.md`). This was the FIRST real, checked-in
card this whole redesign started from (the original silent-gap bug: this
card was `blue` with zero reasons despite a whole real ability left
completely unmodeled).
