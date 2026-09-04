import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens';

export const namazuTrader: CardDefinition = {
  name: 'Namazu Trader',
  manaCost: '{3}{B}',
  typeLine: 'Creature — Fish Citizen',

  triggers: [
    {
      name: 'onEnter',
      effects: [
        { kind: 'loseLife', owner: 'you', amount: 1 } satisfies Effect,
        { kind: 'createToken', token: TOKENS.c_a_treasure_sac, amount: 1 } satisfies Effect,
      ],
    },
    {
      name: 'onAttack',
      effects: [
        { kind: 'sacrifice', owner: 'you', validType: 'creature-or-artifact', notSelf: true, optional: true } satisfies Effect,
        // "If you do, surveil 2" — real Forge gates this on the sacrifice
        // actually happening; this prototype's mock always "succeeds" a
        // sacrifice call (it doesn't model "no valid target" failure), so
        // this always runs once the sacrifice step is reached. Flagged as
        // a known simplification, not silently assumed correct.
        { kind: 'surveil', qty: 2 } satisfies Effect,
      ],
    },
  ],
};
