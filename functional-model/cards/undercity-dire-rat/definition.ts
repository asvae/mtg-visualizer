import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const undercityDireRat: CardDefinition = {
  name: 'Undercity Dire Rat',
  manaCost: '{1}{B}',
  typeLine: 'Creature — Rat',

  pt: [2, 2],

  triggers: [
    {
      name: 'onDies',
      effects: [{ kind: 'createToken', token: TOKENS.c_a_treasure_sac, amount: 1 } satisfies Effect],
    },
  ],
};
