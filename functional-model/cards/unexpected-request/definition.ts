import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const unexpectedRequest: CardDefinition = {
  name: 'Unexpected Request',
  manaCost: '{2}{R}',
  typeLine: 'Sorcery',

  // No declarative `gainControl` Effect kind exists (only `Actions.gainControl`,
  // same "custom calling a real action with no dedicated kind" shape
  // `equip` already needs) — `custom`, chaining the real `gainControl` +
  // `untap` + `grantKeyword` + optional `equip` actions, same combined-
  // actions shape stolen-uniform's own gainControl+equip custom uses. The
  // real `ValidTgts$ Creature` carries no controller restriction, so the
  // pool spans both sides. The delayed "unattach at the beginning of the
  // next end step" and "control reverts at end of turn" triggers have no
  // unattach/control-revert action anywhere in this engine — left
  // unmodeled beyond this comment, same "genuinely out of scope"
  // treatment stolen-uniform's own end-of-turn unattach gets.
  effects: [
    {
      kind: 'custom',
      describe:
        'gain control of target creature until end of turn; untap it and it gains haste until end of turn; you may attach an Equipment you control to it (the end-of-turn control-revert and unattach delayed triggers are not modeled — no such actions exist in this engine)',
      run: (ctx: EffectContext, actions: Actions) => {
        const pool = [...ctx.you.getCreaturesInPlay(), ...ctx.opponents.flatMap((p) => p.getCreaturesInPlay())];
        const target = actions.chooseTarget(pool);
        if (!target) return;
        actions.gainControl(ctx.you, target);
        actions.untap(target);
        actions.grantKeyword(target, 'Haste');
        const equipment = ctx.you.getCardsIn('Battlefield').find((c) => c.hasSubtype('Equipment'));
        if (equipment) actions.equip(equipment, target);
      },
    } satisfies Effect,
  ],
};
