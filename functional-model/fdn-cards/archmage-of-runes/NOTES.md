# Archmage of Runes — authoring notes

## Authoring background

Real Forge: `S:Mode$ ReduceCost | ValidCard$ Instant,Sorcery | ...` —
"Instant and sorcery spells you cast cost {1} less to cast." The
`SpellCostReductionGrant` interface only supports color-gated reductions
(e.g. "White spells you cast cost {1} less"), not card-type-gated ones.
No cost-reduction field can express this gap.

(Flagged during the 2026-09-18 comment-cleanup sweep: this gap is only
documented as prose, with no `missingSchemaFunctionality` entry declaring
it; worth a follow-up authoring pass, out of scope for a
comment-relocation-only sweep.)
