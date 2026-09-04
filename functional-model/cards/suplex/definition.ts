import type { CardDefinition, Effect } from '../../card';

export const suplex: CardDefinition = {
  name: 'Suplex',
  manaCost: '{1}{R}',
  typeLine: 'Sorcery',

  // Real `A:SP$ Charm | Choices$ DBDealDamage,DBExile` — a real "choose
  // one —", same `modal` shape battle-menu uses. Neither `ValidTgts$`
  // carries a controller restriction, so no `owner` on either mode's
  // effect (same "checked against the real script, found genuinely
  // unrestricted" reasoning card.ts's own doc comment on `owner` names for
  // Coeurl/Dion).
  effects: [
    {
      kind: 'modal',
      modes: [
        {
          // `ReplaceDyingDefined$ Targeted` ("if that creature would die
          // this turn, exile it instead") is a real replacement effect —
          // no dying/death-replacement mechanism exists anywhere in this
          // engine (state.ts's own header: no state-based actions, nothing
          // "dies" here), so only the real, reachable half (3 damage) is
          // modeled.
          describe: 'Suplex deals 3 damage to target creature. If that creature would die this turn, exile it instead (the exile-instead-of-dying replacement is not modeled — no death/dying mechanism exists in this engine).',
          effects: [{ kind: 'dealDamageTarget', amount: 3 } satisfies Effect],
        },
        {
          describe: 'Exile target artifact.',
          effects: [{ kind: 'move', owner: 'each', from: 'Battlefield', to: 'Exile', qty: 1, validType: 'artifact', target: true } satisfies Effect],
        },
      ],
    } satisfies Effect,
  ],
};
