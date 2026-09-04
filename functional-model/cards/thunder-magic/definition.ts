import type { CardDefinition, Effect } from '../../card';

export const thunderMagic: CardDefinition = {
  name: 'Thunder Magic',
  manaCost: '{R}',
  typeLine: 'Instant',

  // Real `K:Tiered` + `A:SP$ Charm | Choices$ DBThunder,DBThundara,DBThundaga`
  // — mechanically "choose one additional cost, which fixes the damage
  // amount," which resolves to exactly one of three fixed damage effects
  // running, the same shape `modal` already covers (battle-menu/suplex) —
  // the "additional cost per mode" nuance is documentary text only (`cost`
  // strings on `activationCost`/`abilities` elsewhere carry the same kind
  // of non-recalculated cost text). 'Tiered'/'Thunder'/'Thundara'/
  // 'Thundaga' are flavor keyword names on this printing, not entries in
  // card.ts's own controlled `Keyword` vocabulary, so they aren't listed
  // under `keywords`.
  effects: [
    {
      kind: 'modal',
      modes: [
        { describe: 'Thunder — {0} — Thunder Magic deals 2 damage to target creature.', effects: [{ kind: 'dealDamageTarget', amount: 2 } satisfies Effect] },
        { describe: 'Thundara — {3} — Thunder Magic deals 4 damage to target creature.', effects: [{ kind: 'dealDamageTarget', amount: 4 } satisfies Effect] },
        { describe: 'Thundaga — {5}{R} — Thunder Magic deals 8 damage to target creature.', effects: [{ kind: 'dealDamageTarget', amount: 8 } satisfies Effect] },
      ],
    } satisfies Effect,
  ],
};
