import type { CardDefinition, Effect } from '../../card';

export const arahboTheFirstFang: CardDefinition = {
  name: 'Arahbo, the First Fang',
  manaCost: '{2}{W}',
  typeLine: 'Legendary Creature — Cat Avatar',
  pt: [2, 2],

  continuousPTGrants: [{ power: 1, toughness: 1, includeSelf: false, subtype: 'Cat' }],

  // "Whenever Arahbo or another nontoken Cat you control enters, create a
  // 1/1 white Cat creature token."
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
    {
      name: 'onOtherCatEnters',
      on: 'otherPermanentEnters',
      otherPermanentEntersMatch: { subtype: 'Cat', nonToken: true, sameController: true },
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
