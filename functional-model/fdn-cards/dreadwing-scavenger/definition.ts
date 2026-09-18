import type { CardDefinition, Effect } from '../../card';

export const dreadwingScavenger: CardDefinition = {
  name: 'Dreadwing Scavenger',
  manaCost: '{1}{U}{B}',
  typeLine: 'Creature — Nightmare Bird',
  pt: [2, 2],
  keywords: ['Flying'],

  continuousPTGrants: [{ power: 1, toughness: 1, includeSelf: true, condition: { kind: 'graveyardCountAtLeast', min: 7 } }],
  continuousKeywordGrants: [{ keywords: ['Deathtouch'], includeSelf: true, condition: { kind: 'graveyardCountAtLeast', min: 7 } }],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [{ kind: 'drawCard', amount: 1 } satisfies Effect, { kind: 'discard', owner: 'you', qty: 1 } satisfies Effect],
    },
    {
      name: 'onAttacks',
      on: 'attacks',
      effects: [{ kind: 'drawCard', amount: 1 } satisfies Effect, { kind: 'discard', owner: 'you', qty: 1 } satisfies Effect],
    },
  ],
};
