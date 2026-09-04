import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const auronSInspiration: CardDefinition = {
  name: "Auron's Inspiration",
  manaCost: '{2}{W}',
  typeLine: 'Instant',

  alternateCosts: [{ name: 'Flashback', cost: '{2}{W}{W}', from: 'graveyard', thenExile: true }],

  effects: [
    {
      // "Attacking creatures get +2/+0" is symmetric (ANY player's
      // attacking creatures, no +YouCtrl qualifier) AND depends on combat
      // state (who's attacking) that this model doesn't track at all (no
      // attack-declaration step exists — see turn.ts's own header: combat
      // steps are reachable in sequence but no attacker/blocker state is
      // assigned). `pumpAll`'s own predicate union only covers
      // 'creatures-you-control'; a real "attacking" filter would need
      // fabricated combat state, so this stays an honest custom instead.
      kind: 'custom',
      describe: 'attacking creatures get +2/+0 until end of turn (no combat/attacking state tracked in this model)',
      run: (_ctx: EffectContext, _actions: Actions) => {
        // Intentionally a no-op — see describe above.
      },
    } satisfies Effect,
  ],
};
