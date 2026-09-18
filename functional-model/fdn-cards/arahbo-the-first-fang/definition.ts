import type { CardDefinition, Effect } from '../../card';

export const arahboTheFirstFang: CardDefinition = {
  name: 'Arahbo, the First Fang',
  manaCost: '{2}{W}',
  typeLine: 'Legendary Creature — Cat Avatar',
  pt: [2, 2],

  // Other Cats you control get +1/+1
  continuousPTGrants: [{ power: 1, toughness: 1, includeSelf: false, subtype: 'Cat' }],

  // Whenever Arahbo or another nontoken Cat you control enters, create a 1/1 white Cat creature token.
  // Note: Current engine only models ETB triggers on self; firing when OTHER nontoken Cats enter
  // requires a gap closure (ENGINE_GAPS.md) — no ValidCard$ filter/condition on this trigger yet.
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'createToken',
          token: {
            name: 'Cat',
            manaCost: '0',
            types: ['Creature', 'Cat'],
            basePower: 1,
            baseToughness: 1,
          },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
