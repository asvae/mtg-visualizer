import type { CardDefinition } from '../../card';

export const unchartedVoyage: CardDefinition = {
  name: 'Uncharted Voyage',
  manaCost: '{3}{U}',
  typeLine: 'Instant',
  effects: [
    {
      kind: 'custom',
      describe: 'Target creature\'s owner puts it on the top or bottom of their library',
      run: () => {
        // NOTE: Choosing whether to put target on top or bottom of library is a player choice
        // that requires target handling not yet fully modeled for library placement.
      },
    },
    {
      kind: 'surveil',
      qty: 1,
    },
  ],
};
