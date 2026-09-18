import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const fieryAnnihilation: CardDefinition = {
  name: 'Fiery Annihilation',
  manaCost: '{2}{R}',
  typeLine: 'Instant',

  missingSchemaFunctionality: [
    {
      clause: 'If that creature would die this turn, exile it instead.',
      demand:
        'No CR 614.2 "replace this creature\'s death with exile, for the rest of this turn" mechanism exists — `state.ts` has narrow, per-keyword damage/lifegain/untap replacement hooks (`DamagePrevention`/`CombatDamagePrevention`/`LifegainDouble`/`CantUntap`) but none intercepts the graveyard-bound zone change itself and redirects it to Exile.',
    },
  ],

  effects: [
    {
      kind: 'custom',
      describe:
        'Fiery Annihilation deals 5 damage to target creature; exile up to one target Equipment attached to that creature (see missingSchemaFunctionality[0] for the "if that creature would die this turn, exile it instead" half)',
      run: (ctx: EffectContext, actions: Actions) => {
        const pool = [ctx.you, ...ctx.opponents].flatMap((p) => p.getCreaturesInPlay());
        const target = actions.chooseTarget(pool, ctx.preferTarget);
        if (!target) return;
        actions.dealDamage(ctx.self, target, 5);
        const equipment = target.getEquippedBy();
        if (equipment.length > 0 && !ctx.declineOptional) {
          const eq = actions.chooseTarget(equipment);
          if (eq) actions.moveTo(eq, 'Exile');
        }
      },
    } satisfies Effect,
  ],
};
