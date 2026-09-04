import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const dragoonsWyvern: CardDefinition = {
  name: "Dragoon's Wyvern",
  manaCost: '{2}{U}',
  typeLine: 'Creature — Drake',

  pt: [2, 1],
  keywords: ['Flying'],

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'createToken', token: TOKENS.c_1_1_hero, amount: 1 } satisfies Effect],
    },
  ],
};
