import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const battleMenu: CardDefinition = {
  name: 'Battle Menu',
  manaCost: '{1}{W}',
  typeLine: 'Instant',

  effects: [
    {
      kind: 'modal',
      modes: [
        { describe: 'Attack — create a 2/2 white Knight creature token', effects: [{ kind: 'createToken', token: TOKENS.w_2_2_knight, amount: 1 } satisfies Effect] },
        { describe: 'Ability — target creature gets +0/+4 until end of turn', effects: [{ kind: 'pumpTarget', power: 0, toughness: 4 } satisfies Effect] },
        { describe: 'Magic — destroy target creature with power 4 or greater', effects: [{ kind: 'destroy', validType: 'creature', qty: 1, minPower: 4 } satisfies Effect] },
        { describe: 'Item — you gain 4 life', effects: [{ kind: 'gainLife', amount: 4 } satisfies Effect] },
      ],
    } satisfies Effect,
  ],
};
