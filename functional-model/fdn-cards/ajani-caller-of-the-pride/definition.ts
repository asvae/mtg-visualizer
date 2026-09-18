import type { CardDefinition, Effect } from '../../card';

// Real Forge (ajani_caller_of_the_pride.txt) — real loyalty abilities.
// `abilities[].cost` is plain, unparsed descriptive text (same "no loyalty-
// ability cost/activation vocabulary" convention `kaito-cunning-
// infiltrator`'s own +1/-2/-9 abilities already establish) — everything
// else below is real, executable vocabulary.
export const ajaniCallerOfThePride: CardDefinition = {
  name: 'Ajani, Caller of the Pride',
  manaCost: '{1}{W}{W}',
  typeLine: 'Legendary Planeswalker — Ajani',

  abilities: [
    {
      name: '+1',
      cost: 'Loyalty: +1',
      effects: [{ kind: 'putCounterTarget', validType: 'creature', counterType: '+1/+1', amount: 1, qty: 1 } satisfies Effect],
    },
    {
      name: '-3',
      cost: 'Loyalty: -3',
      effects: [
        { kind: 'grantKeywordTarget', keyword: 'Flying', validType: 'creature', untilEndOfTurn: true } satisfies Effect,
        { kind: 'grantKeywordTarget', keyword: 'DoubleStrike', validType: 'creature', untilEndOfTurn: true } satisfies Effect,
      ],
    },
    {
      name: '-8',
      cost: 'Loyalty: -8',
      effects: [
        {
          kind: 'createToken',
          token: { name: 'Cat', manaCost: '0', types: ['Creature', 'Cat'], basePower: 2, baseToughness: 2 },
          amount: (ctx) => ctx.you.getLife(),
        } satisfies Effect,
      ],
    },
  ],
};
