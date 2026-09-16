import type { CardDefinition, Effect } from '../../card';

// Real script (crossroads_village.txt): "This land enters tapped" is the
// same real replacement effect every other Town in this batch has — modeled
// as an onEnter trigger tapping self (treno-dark-city's own precedent).
// "As it enters, choose a color" (K:ETBReplacement:Other:ChooseColor) is a
// SECOND real ETB event, but its only observable consequence is which color
// the later `{T}: Add one mana of the chosen color` ability produces.
//
// **Real, HARD-FLAGGED gap, deliberately NOT migrated to `manaAbilities`**
// (2026-09-14, ENGINE_GAPS.md gap #5's own "ETB choose-a-color, fixed
// forever after" entry): unlike every OTHER real mana ability in this
// pool, this one's real Forge shape (`Produced$ Chosen`, reading
// `Card.getChosenColors()`) is genuinely narrower than "any of 5, every
// activation" — real Forge locks the produced color PERMANENTLY at ETB,
// once, for this specific permanent's whole lifetime. Modeling it as an
// ordinary `manaAbilities: [{colors:['W','U','B','R','G']}]` entry (the
// same shape Blitzball's genuine "any one color, no restriction" ability
// correctly uses) would be WRONG, not just incomplete — it would let this
// land pay a DIFFERENT color on every later cast within the same game,
// which real Magic never allows once the ETB choice is made. Fixing this
// for real needs two new primitives that don't exist anywhere in this
// engine: a persisted per-permanent "chosen color" field on `RealCard`,
// and a genuine ETB-choice mechanism to set it (no player-decision engine
// exists at all, `priority.ts`'s own header). Both the choice and the mana
// ability stay `staticAbilities` text — checked, verified as the ONLY
// real card in this pool with this exact shape (`scripts/verify-synergy
// .mjs`'s own `staticManaColorsFor` still special-cases this ONE bespoke
// string as "known statically," unchanged by this pass).
export const crossroadsVillage: CardDefinition = {
  name: 'Crossroads Village',
  manaCost: '',
  typeLine: 'Land — Town',

  // recognizer-exception: entersBattlefield-self-trigger-structural — real
  // CR 614.12 "This land enters tapped" replacement effect, modeled as an
  // onEnter self-tap trigger (see treno-dark-city's own doc comment for the
  // full convention). No "When/Whenever <self> enters" clause exists in the
  // real printed text at all, so this recognizer correctly declines rather
  // than asserting a false sink fact.
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [{ kind: 'tapTarget', validType: 'land', owner: 'you' } satisfies Effect],
    },
  ],

  staticAbilities: ['As this land enters, choose a color.', '{T}: Add one mana of the chosen color.'],
};
