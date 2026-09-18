import type { CardDefinition, Effect } from '../../card';

export const angelOfFinality: CardDefinition = {
  name: 'Angel of Finality',
  manaCost: '{3}{W}',
  typeLine: 'Creature — Angel',
  pt: [3, 4],
  keywords: ['flying'],
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'custom',
          describe: 'exile target player\'s graveyard (no Effect kind exists for exiling an entire zone as one effect based on a target player selection)',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
