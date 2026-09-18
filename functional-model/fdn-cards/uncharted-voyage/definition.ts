import type { CardDefinition } from '../../card';

export const unchartedVoyage: CardDefinition = {
  name: 'Uncharted Voyage',
  manaCost: '{3}{U}',
  typeLine: 'Instant',
  effects: [
    {
      kind: 'custom',
      describe: 'Target creature\'s owner puts it on the top or bottom of their library',
      run: () => {},
    },
    {
      kind: 'surveil',
      qty: 1,
    },
  ],
};
