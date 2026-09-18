# FDN comment convention: definition.ts vs NOTES.md (2026-09-18)

New standing convention for `functional-model/fdn-cards/<slug>/`, applied
in a pool-wide sweep this same day: `definition.ts` keeps ONLY a short
real-card-text comment directly above a genuinely complex `Effect`
(program/combinator tree, `kind:'custom'` closure with REAL non-no-op
logic, `kind:'modal'` with multiple branches, or a continuous grant gated
by a `condition` field). Everything else — authoring rationale,
vocabulary-choice reasoning, gap-attribution/ENGINE_GAPS.md discussion,
"why this shape," dated session narration — moves to a new sibling
`NOTES.md` (plain prose, no fixed schema). A `describe` field on a
no-op `custom` placeholder is treated as already self-documenting —
its surrounding "why this is a gap" comment moves out too, doesn't stay.
Self-evident field-shape comments (`keywords`, `keywordCosts`,
`activationCost`, `alternateCosts`, a `missingSchemaFunctionality`
entry's own `clause`/`demand`) get deleted outright, not kept anywhere,
when they add no reasoning beyond restating the field.

All 150 cards now have a `NOTES.md` (even the ~36 that had zero comments
to relocate — brief placeholder text). Verified as a pure no-op: full
`--all` re-gate showed every card's `pipeline-status.json` content
byte-identical (only `computedAt` differed, reverted rather than
committed) and `npx vitest run functional-model` unchanged (1314 passed).
`npm run typecheck` still exactly the known 7-diagnostic baseline (none
under `fdn-cards/`). Commit: `c0b7e4d`.

**Real, unresolved things this sweep surfaced (not fixed, flagged in each
card's own NOTES.md, worth `engine`/follow-up-authoring attention)**:
- Several gaps documented ONLY as prose/`describe` text with NO
  `missingSchemaFunctionality` entry declaring them (policy says every
  genuine gap needs one): `valkyrie-s-call`, `curator-of-destinies`
  (can't-be-countered half), `make-your-move`, `squad-rallier`,
  `abyssal-harvester`, `courageous-goblin`, `uncharted-voyage`,
  `joust-through`, `archmage-of-runes`, `fleeting-flight`.
- `high-fae-trickster` is the most notable: its "cast spells as though
  they had flash" ability has NEITHER a `missingSchemaFunctionality`
  entry NOR any placeholder `Effect` — completely absent from the
  `CardDefinition`, not even inert-documented.
- `skyship-buccaneer`/`sphinx-of-forgotten-lore` both use a
  `condition: string` + `description` trigger shape that doesn't match
  the `Trigger.on`/`name` shape every other card in the pool uses — a
  real schema-consistency question, not touched (logic, not comments).
- `dazzling-angel`'s own gap comment predates the
  `otherPermanentEnters`/`otherPermanentEntersMatch` vocabulary this same
  day's earlier schema-completeness pass added elsewhere (arahbo/
  skyknight-squire) — never migrated to it, worth checking.

None of the above were touched (comment-relocation-only scope) — each is
recorded in that card's own `NOTES.md` with an explicit "flagged during
the 2026-09-18 comment-cleanup sweep" note for whoever picks it up next.
