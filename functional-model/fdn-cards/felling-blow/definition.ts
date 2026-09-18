import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// "Put a +1/+1 counter on target creature you control. Then that creature
// deals damage equal to its power to target creature an opponent
// controls." — the damage amount depends on the FIRST target's own live
// power AFTER the counter is applied, a cross-effect reference no plain
// declarative `Effect` field can express (no `Computed` has access to a
// prior effect's own chosen target). Real, narrowly-scoped `custom`
// closure instead — genuinely functional, not a placeholder (mirrors
// `celestial-armor`'s own real Equip-attach closure).
export const fellingBlow: CardDefinition = {
  name: 'Felling Blow',
  manaCost: '{2}{G}',
  typeLine: 'Sorcery',

  effects: [
    {
      kind: 'custom',
      describe: "put a +1/+1 counter on target creature you control; that creature deals damage equal to its power to target creature an opponent controls",
      run: (ctx: EffectContext, actions: Actions) => {
        const boosted = actions.chooseTarget(ctx.you.getCreaturesInPlay());
        if (!boosted) return;
        actions.putCounter(boosted, '+1/+1', 1);
        const opponentCreatures = ctx.opponents.flatMap((p) => p.getCreaturesInPlay());
        const victim = actions.chooseTarget(opponentCreatures);
        if (!victim) return;
        actions.dealDamage(boosted, victim, boosted.getNetPower());
      },
    } satisfies Effect,
  ],
};
