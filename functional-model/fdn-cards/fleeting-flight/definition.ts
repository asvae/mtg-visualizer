import type { CardDefinition, Effect } from '../../card';

export const fleetingFlight: CardDefinition = {
  name: 'Fleeting Flight',
  manaCost: '{W}',
  typeLine: 'Instant',

  effects: [
    {
      kind: 'putCounterTarget',
      validType: 'creature',
      counterType: '+1/+1',
      amount: 1,
    } satisfies Effect,
    {
      kind: 'grantKeywordTarget',
      keyword: 'Flying',
      validType: 'creature',
      untilEndOfTurn: true,
    } satisfies Effect,
    {
      kind: 'grantKeywordTarget',
      keyword: 'CombatDamagePrevention',
      validType: 'creature',
      untilEndOfTurn: true,
    } satisfies Effect,
  ],
};
