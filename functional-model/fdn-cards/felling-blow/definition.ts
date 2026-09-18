import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

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
