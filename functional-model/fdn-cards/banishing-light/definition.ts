import type { CardDefinition, Effect } from '../../card';

export const banishingLight: CardDefinition = {
  name: 'Banishing Light',
  manaCost: '{2}{W}',
  typeLine: 'Enchantment',

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'move',
          owner: 'opponents',
          from: 'Battlefield',
          to: 'Exile',
          validType: 'any',
          nonLand: true,
          qty: 1,
          target: true,
        } satisfies Effect,
      ],
    },
  ],

  missingSchemaFunctionality: [
    {
      clause: 'until Banishing Light leaves the battlefield',
      demand:
        'No primitive ties a zone change\'s own duration to a SEPARATE permanent\'s own future departure from the battlefield (CR 603.6e linked ability) — only a flat `untilEndOfTurn` (514.2 Cleanup) duration exists.',
    },
  ],
};
