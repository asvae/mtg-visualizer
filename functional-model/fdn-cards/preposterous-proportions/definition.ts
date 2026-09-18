import type { CardDefinition, Effect } from '../../card';

export const preposterousProportions: CardDefinition = {
  name: 'Preposterous Proportions',
  manaCost: '{5}{G}{G}',
  typeLine: 'Sorcery',

  effects: [
    { kind: 'pumpAll', predicate: 'creatures-you-control', power: 10, toughness: 10, untilEndOfTurn: true } satisfies Effect,
    { kind: 'grantKeywordAll', predicate: 'creatures-you-control', keyword: 'Vigilance', untilEndOfTurn: true } satisfies Effect,
  ],
};
