# FDN batch C: justification.json for 28 cards (orchestrator-dispatched, parallel batch)

Third of three parallel, disjoint 28-slug batches (A/B/C) authoring real,
span-verified `functional-model/fdn-cards/<slug>/justification.json`
against `data/fdn/fdn_scryfall.json`. This batch's 28 slugs:
homunculus-horde, hungry-ghoul, icewind-elemental, incinerating-blast,
infernal-vessel, infestation-sage, inspiration-from-beyond, joust-through,
kaito-cunning-infiltrator, kellan-planar-trailblazer, kiora-the-rising-tide,
luminous-rebuke, lunar-insight, make-your-move, mischievous-mystic,
mischievous-pup, mossborn-hydra, nine-lives-familiar,
preposterous-proportions, prideful-parent, quakestrider-ceratops,
quick-draw-katana, raise-the-past, ravenous-amulet, refute,
resolute-reinforcements, revenge-of-the-rats, rune-sealed-wall.

**Outcome: 16 blue / 12 purple / 0 gray.** Every card individually verified
via `verify-coverage-justification-cli.mjs` as authored (not batched at the
end), then gated via `gate-and-write-status.mjs <28 explicit slugs>` (never
`--all` — two sibling batches were editing other slugs in the same tree
concurrently).

## Resolved the 2 task-flagged undeclared gaps
- `joust-through`: "target attacking or blocking creature" — genuine gap
  (no targeted Effect has a combat-role filter); added
  `missingSchemaFunctionality`, referenced via a `rules`-type span. The
  card's own `dealDamageTarget`/`gainLife` effects stay real/unchanged —
  the restriction itself was simply never representable, not a bug in the
  existing effects.
- `make-your-move`: "target artifact, enchantment, or creature with power 4
  or greater" — genuine gap (`destroy`'s `validType` is a single
  closed-enum pick, and `minPower` applies pool-wide once set, so it can't
  gate power only on the creature branch of a 3-way type disjunction);
  added `missingSchemaFunctionality`, kept the pre-existing no-op `custom`
  placeholder as-is.

## Found + declared 6 MORE undeclared gaps the same way (not task-named, found while tiling)
- `homunculus-horde`: "create a token that's a copy of this creature" — no
  copy-a-permanent mechanic (CR 707) exists anywhere; pre-existing no-op
  `custom` placeholder, now backed by a real gap entry.
- `kaito-cunning-infiltrator`: the -9 emblem ability — no emblem mechanic
  (CR 701.42) exists anywhere; pre-existing no-op `custom` placeholder, now
  backed. Everything else on this card (native trigger, +1/-2 abilities)
  was ALREADY real/executable and needed no change.
- `incinerating-blast`: "You may discard a card. If you do, draw a card."
  — was COMPLETELY ABSENT from `effects` (not even a no-op placeholder);
  added a real gap entry (optional-choice-gated conditional effect, no
  player-decision engine exists anywhere in this model).
- `infernal-vessel`: "if it wasn't a Demon" — the self-type-absence gate on
  an otherwise-real, executable `onDeath` custom effect; no
  `BoardStateCondition` variant checks a permanent's own type membership.
- `nine-lives-familiar`: "if you cast it" — same class of gap, gates an
  otherwise-real `onEnter` counter-placement effect; no field tracks
  cast-vs-other-arrival history.
- `kellan-planar-trailblazer`: found with a COMPLETELY EMPTY
  `CardDefinition` (bare name/manaCost/typeLine/pt, both real activated
  abilities — a subtype-conditional type-change with dynamic trigger
  installation, twice — entirely unrepresented, not even inert-documented).
  Added 2 `missingSchemaFunctionality` entries (one per ability).
- `ravenous-amulet`: "Activate only as a sorcery." on a plain (non-mana)
  named ability — no timing/speed-restriction field exists on
  `abilities[]` (only `ManaAbility` has an analogous
  `restriction`/`activationCondition` pair). Distinguished from the
  existing pool-wide "Equip only as a sorcery" reminder-text convention
  (`quick-draw-katana`'s own Equip ability): that text is STANDARD Equip
  keyword reminder text (CR 702.6, `lore`-typed, no gap needed), whereas
  this is a genuinely separate printed sentence on a bespoke ability with
  nothing anywhere to point at.

## One real, narrow FIX using pre-existing vocabulary (not a gap)
- `kiora-the-rising-tide`: its own `onAttack` trigger's Threshold gate
  ("if there are seven or more cards in your graveyard") had NO
  `condition` field at all — its own NOTES.md claimed this was "the same
  accepted simplification `crypt-feaster` already uses," but that's now
  STALE: `crypt-feaster` already HAS `condition: {kind:
  'graveyardCountAtLeast', min:7}` (2026-09-18 schema-completeness pass).
  Added the identical field to kiora — a real, narrow, existing-vocabulary
  fix, not a rewrite. Worth a pool-wide sweep for other stale
  "no condition field exists" NOTES.md claims predating that pass (only
  checked this card's own oracle text pattern here, not the whole batch).

## Off-convention Trigger shapes: none found in this batch
Checked every trigger in all 28 cards — no `condition: string` +
`description` shape (the `skyship-buccaneer`/`sphinx-of-forgotten-lore`
pattern flagged as a heads-up, not in this batch either) turned up.

## Colored-token color loss: confirmed pool-wide convention, not a gap
`TokenInfo` has no `colors` field anywhere in this schema (confirmed via
`interfaces.ts`). Every "1/1 white/black/blue Cat/Soldier/Rat/..." token
clause in this batch (infestation-sage, mischievous-mystic,
prideful-parent, resolute-reinforcements, revenge-of-the-rats,
kaito-cunning-infiltrator's -2, kiora's Scion of the Deep) covers the WHOLE
clause including the color word via the producing trigger/effect
reference, honestly noting in `reasoning` that color is real-but-
unrepresentable — matches `arahbo-the-first-fang`'s own established
precedent, not treated as its own gap (would be pure noise duplicated
across ~7 cards).

## Blank-oracle-text vanilla creature: new precedent
`quakestrider-ceratops` (12/8 vanilla Dinosaur, real Scryfall `oracle_text:
""`) had no prior pool precedent for this shape. Confirmed
`validateCoverageJustification`'s full-coverage tiling trivially passes
with ZERO `oracle_text` entries when the real text is empty (empty-string
loop never finds an uncovered char) — but the manifest's own top-level
"entries must be non-empty" check still requires SOMETHING. Used a single
`type_line`-targeted entry (`{kind:'field', field:'typeLine'}` +
`{kind:'field', field:'pt'}`) to satisfy that, with `reasoning` explaining
there's no real oracle text to cover at all. Worth checking if any other
FDN vanilla creature (blank Oracle: line in Forge) needs the same
treatment later.

## Verification
Every card individually verified via `verify-coverage-justification-cli.mjs`
as authored. Gated via `gate-and-write-status.mjs` scoped to exactly these
28 slugs (never `--all`): **16 blue / 12 purple / 0 gray / 0 other / 0
missing-file**. `npx vitest run functional-model`: 122 files, 1314 passed /
5 skipped — byte-identical to the pre-existing baseline (unaffected).
`npm run typecheck`: same known 7 diagnostics (3
`CardDetailTabs.vue`/`card-status.ts` + `card.ts` `endTurn` + `mana.ts:275`
+ `server/api/tokens/by-key.ts:32`), 0 new — none under `fdn-cards/`.

Pool-wide totals STALE until sibling batches A/B are also accounted for
together (each batch's own topic file records its own count only).
