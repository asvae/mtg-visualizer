import type { CardDefinition } from '../../card';

export const warrenElder: CardDefinition = {
  name: 'Warren Elder',
  manaCost: '{1}{W}',
  typeLine: 'Creature — Rabbit Cleric',
  activationCost: '{3}{W}',

  effects: [{ kind: 'pumpAll', predicate: 'creatures-you-control', power: 1, toughness: 1 }],
};
