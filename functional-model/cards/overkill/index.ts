import type { CardDefinition, Effect } from '../../card';

export const overkill: CardDefinition = {
  name: 'Overkill',
  manaCost: '{2}{B}',
  typeLine: 'Instant',

  effects: [{ kind: 'pumpTarget', power: 0, toughness: -9999 } satisfies Effect],
};
