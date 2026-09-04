import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens.ts';

// Real script (magic_pot.txt): a real death trigger (ChangesZone,
// Battlefield -> Graveyard, ValidCard$ Card.Self — same `onDies` naming
// convention every other death-trigger card in this repo uses) plus one
// independent activated ability targeting "target card in a graveyard" —
// ANY player's, no owner restriction printed (`ValidTgts$ Card`, no
// zone-controller clause). `move`'s targeted branch has no combined
// cross-player pool (it loops `playersFor(owner, ctx)` and picks up to
// `qty` from EACH player it iterates — `owner: 'each'` here would wrongly
// exile up to one card from BOTH graveyards instead of one total), same
// real gap eject's own comment documents. `owner: 'you'` stands in for the
// representative/common case (your own graveyard), same approximation
// eject makes with `'opponents'`.
export const magicPot: CardDefinition = {
  name: 'Magic Pot',
  manaCost: '{3}',
  typeLine: 'Artifact Creature — Goblin Construct',

  pt: [1, 4],

  triggers: [
    {
      name: 'onDies',
      effects: [{ kind: 'createToken', token: TOKENS.c_a_treasure_sac, amount: 1 } satisfies Effect],
    },
  ],

  activationCost: '{2}, {T}',
  effects: [{ kind: 'move', owner: 'you', from: 'Graveyard', to: 'Exile', qty: 1, validType: 'any', target: true } satisfies Effect],
};
