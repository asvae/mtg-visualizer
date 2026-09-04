import type { CardDefinition, Effect } from '../../card';

// Real script (qiqirn_merchant.txt): TWO independent, unrelated {T}
// abilities on one permanent — the exact real shape `CardDefinition.abilities`
// exists for (new today), as opposed to the common single-ability
// `activationCost`+`effects` case.
export const qiqirnMerchant: CardDefinition = {
  name: 'Qiqirn Merchant',
  manaCost: '{2}{U}',
  typeLine: 'Creature — Beast Citizen',

  pt: [1, 4],

  abilities: [
    {
      name: 'cantrip',
      cost: '{1}, {T}',
      effects: [{ kind: 'drawCard' } satisfies Effect, { kind: 'discard', owner: 'you', qty: 1 } satisfies Effect],
    },
    {
      // "This ability costs {1} less to activate for each Town you
      // control" — `SVar:X:Count$Valid Town.YouCtrl` is a dynamic cost
      // reduction; `cost` here is documentary text only (same convention
      // every other card's `activationCost` string already uses — no field
      // anywhere computes a real dynamic mana cost), not something this
      // model recalculates. Sacrificing itself is part of the COST (Forge's
      // own `Sac<1/CARDNAME>`), not an effect — same "cost, not effect"
      // convention phoenix-down's own tap/exile cost text uses.
      name: 'bigDraw',
      cost: '{7}, {T}, Sacrifice Qiqirn Merchant (costs {1} less for each Town you control)',
      effects: [{ kind: 'drawCard', amount: 3 } satisfies Effect],
    },
  ],
};
