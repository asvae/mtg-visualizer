import type { CardDefinition, Effect } from '../../card';

export const aetherize: CardDefinition = {
  name: 'Aetherize',
  manaCost: '{3}{U}',
  typeLine: 'Instant',

  effects: [
    {
      kind: 'custom',
      describe: 'Return all attacking creatures to their owner\'s hand (move effect does not support attacking-creatures predicate)',
      run: () => {},
    } satisfies Effect,
  ],
};
