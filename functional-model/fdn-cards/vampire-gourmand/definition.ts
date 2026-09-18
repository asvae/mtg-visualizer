import type { CardDefinition, Effect } from '../../card';

export const vampireGourmand: CardDefinition = {
  name: 'Vampire Gourmand',
  manaCost: '{1}{B}',
  typeLine: 'Creature — Vampire',
  pt: [2, 2],

  triggers: [
    {
      name: 'onAttack',
      on: 'attacks',
      effects: [
        { kind: 'sacrifice', owner: 'you', validType: 'creature', notSelf: true, optional: true } satisfies Effect,
        { kind: 'drawCard', amount: 1 } satisfies Effect,
        { kind: 'grantKeywordSelf', keyword: 'Unblockable', untilEndOfTurn: true } satisfies Effect,
      ],
    },
  ],
};
