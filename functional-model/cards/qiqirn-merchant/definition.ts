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
      // control" — CLOSED (2026-09-12, ENGINE_GAPS.md gap #7's third
      // example): a real, board-state-COUNTED discount on THIS ability's
      // own cost, `card.ts`'s new `ActivationCostReduction` (real Forge
      // citation, `res/cardsfolder/q/qiqirn_merchant.txt`: `A:AB$ Draw |
      // Cost$ 7 T Sac<1/CARDNAME> | ... | ReduceCost$ X | ...` +
      // `SVar:X:Count$Valid Town.YouCtrl`) — `engine.ts`'s
      // `effectiveActivationCost` genuinely counts real Town-subtype
      // permanents the activator controls and discounts the {7} generic
      // portion accordingly, replacing the old documentary-only
      // parenthetical, same "structured field replaces free text once real"
      // convention `continuousKeywordGrants`'s own cards already established.
      // `cost` itself stays real printed text (no field anywhere renders a
      // dynamic mana cost back into a string for display — `activationCostFor`/
      // `effectiveActivationCost` compute the real number separately).
      // Sacrificing itself is part of the COST (Forge's own
      // `Sac<1/CARDNAME>`), not an effect — same "cost, not effect"
      // convention phoenix-down's own tap/exile cost text uses; still not
      // itself payable through `canActivateAbility` (self-sacrifice is a
      // real, separate, unbuilt engine gap — see this card's own
      // `scenarios.ts` header), unrelated to and unaffected by this discount.
      name: 'bigDraw',
      cost: '{7}, {T}, Sacrifice Qiqirn Merchant (costs {1} less for each Town you control)',
      costReduction: { amountPerMatch: 1, subtype: 'Town' },
      effects: [{ kind: 'drawCard', amount: 3 } satisfies Effect],
    },
  ],
};
