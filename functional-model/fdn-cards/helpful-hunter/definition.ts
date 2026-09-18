import type { CardDefinition, Effect } from '../../card';

export const helpfulHunter: CardDefinition = {
  name: 'Helpful Hunter',
  manaCost: '{1}{W}',
  typeLine: 'Creature — Cat',
  pt: [1, 1],

  triggers: [{ name: 'onEnter', on: 'enter', effects: [{ kind: 'drawCard' } satisfies Effect] }],
};
