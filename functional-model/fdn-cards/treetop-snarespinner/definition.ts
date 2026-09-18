import type { CardDefinition, Effect } from '../../card';

// "Activate only as a sorcery" is documentary only — no priority/timing
// speed restriction is enforced anywhere for a plain (non-mana) activated
// ability in this engine (same "not every free-text constraint is
// mechanically enforced" convention `kaito-cunning-infiltrator`'s own
// loyalty-ability costs already accept).
export const treetopSnarespinner: CardDefinition = {
  name: 'Treetop Snarespinner',
  manaCost: '{3}{G}',
  typeLine: 'Creature — Spider',
  pt: [1, 4],
  keywords: ['Reach', 'Deathtouch'],

  activationCost: '{2}{G}',
  effects: [{ kind: 'putCounterTarget', validType: 'creature', counterType: '+1/+1', amount: 1, owner: 'you', qty: 1 } satisfies Effect],
};
