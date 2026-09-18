import type { CardDefinition, Effect } from '../../card';

export const arbiterOfWoe: CardDefinition = {
  name: 'Arbiter of Woe',
  manaCost: '{4}{B}{B}',
  typeLine: 'Creature — Demon',
  pt: [5, 4],

  keywords: ['Flying'],

  // Migrated from `staticAbilities` to `missingSchemaFunctionality`
  // (2026-09-18, FDN schema-tightness redesign).
  missingSchemaFunctionality: [
    {
      clause: 'As an additional cost to cast this spell, sacrifice a creature.',
      demand: 'An additional-cost vocabulary for a SPELL\'s own normal cast cost — nothing on `CardDefinition` lets a spell require sacrificing a permanent (or any other non-mana/non-alternate cost component) as part of casting it; `activationCost` covers only an ACTIVATED ability\'s cost, and `AlternateCost` is a REPLACEMENT cost, not an ADDITIONAL one paid alongside the normal mana cost.',
    },
  ],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'discard',
          owner: 'opponents',
          qty: 1,
        } satisfies Effect,
        {
          kind: 'loseLife',
          owner: 'opponents',
          amount: 2,
        } satisfies Effect,
        {
          kind: 'drawCard',
          amount: 1,
        } satisfies Effect,
        {
          kind: 'gainLife',
          amount: 2,
        } satisfies Effect,
      ],
    },
  ],
};
