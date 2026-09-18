import type { CardDefinition, Effect } from '../../card';

// "return target permanent card from your graveyard to your hand" —
// `move.validType` has no dedicated "permanent" option (only
// 'creature'|'artifact'|'land'|'any'); `validType:'any'` is the same
// established approximation `sun-blessed-healer`'s own real "nonland
// permanent card" clause already uses (a card, not a specific-type
// permanent, restriction — accepted pool-wide imprecision, not a novel
// gap).
export const elvishRegrower: CardDefinition = {
  name: 'Elvish Regrower',
  manaCost: '{2}{G}{G}',
  typeLine: 'Creature — Elf Druid',
  pt: [4, 3],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'move',
          owner: 'you',
          from: 'Graveyard',
          to: 'Hand',
          validType: 'any',
          qty: 1,
          target: true,
        } satisfies Effect,
      ],
    },
  ],
};
