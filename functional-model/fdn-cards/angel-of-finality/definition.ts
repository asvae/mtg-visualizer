import type { CardDefinition, Effect } from '../../card';

export const angelOfFinality: CardDefinition = {
  name: 'Angel of Finality',
  manaCost: '{3}{W}',
  typeLine: 'Creature — Angel',
  pt: [3, 4],
  keywords: ['Flying'],

  missingSchemaFunctionality: [
    {
      clause: "exile target player's graveyard",
      demand:
        'A batch-move/zone-clear construct that (a) targets a PLAYER (not a card) as the real chosen object, and (b) moves EVERY card currently in that target\'s graveyard to exile unconditionally — `move`\'s own `target`/`qty` fields express "choose N cards from a pool," never "choose a player, then move that player\'s entire zone regardless of count."',
    },
  ],

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
