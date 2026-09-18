import type { CardDefinition, Effect } from '../../card';

export const fleetingDistraction: CardDefinition = {
  name: 'Fleeting Distraction',
  manaCost: '{U}',
  typeLine: 'Instant',

  effects: [
    { kind: 'pumpTarget', power: -1, toughness: 0, untilEndOfTurn: true } satisfies Effect,
    { kind: 'drawCard' } satisfies Effect,
  ],
};
