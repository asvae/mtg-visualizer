# Make Your Move — authoring notes

## Authoring background

"Destroy target artifact, enchantment, or creature with power 4 or
greater." — the target restriction is a three-way disjunction: (artifact)
OR (enchantment) OR (creature AND power >= 4). The current `destroy`
Effect schema can express only:
- validType:'creature' + minPower:4 -> creatures with power >= 4 only
- validType:'permanent' + nonLand:true -> all non-land permanents (too
  broad, would also destroy creatures with power < 4)

There is no field or combination of fields to express the full
disjunctive target restriction faithfully. No-op custom purely so
`synergyTags()` still records the real text.

(Flagged during the 2026-09-18 comment-cleanup sweep: same as
curator-of-destinies — this gap is only documented as prose/`describe`
text, with no `missingSchemaFunctionality` entry declaring it; worth a
follow-up authoring pass, out of scope for a comment-relocation-only
sweep.)
