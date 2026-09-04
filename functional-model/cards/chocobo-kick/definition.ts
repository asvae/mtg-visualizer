import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real Kicker (an additional optional cost, `K:Kicker:Return<1/Land>`)
// branches the resolved effect exactly like a real "choose one —" would —
// no Kicker-specific field exists anywhere in EffectContext/CardDefinition,
// so this repurposes the existing `modal`/`ctx.mode` mechanism (mode 0 =
// not kicked, mode 1 = kicked) the same way vayne-s-treachery's own Kicker
// already does (mode 0/1 = not-kicked/kicked), including modeling the
// kicker's own additional cost (returning a land) as part of the kicked
// branch's own effects, same precedent.
function dealPowerDamage(multiplier: 1 | 2): Effect {
  return {
    // "Target creature you control deals damage equal to its power to
    // target creature an opponent controls" — needs a chosen source
    // creature's own LIVE power read at resolution and applied to a
    // SEPARATE chosen target; no declarative Effect kind covers "damage
    // sourced from one chosen target's own stat, dealt to a second chosen
    // target" (`dealDamageTarget`'s `amount` can only be a fixed/computed
    // number, not another target's own read) — `custom`, choosing both
    // targets then reading the source's real `getNetPower()`, is the
    // honest shape, same "read a chosen target's own live stat" pattern
    // self-destruct/nibelheim-aflame already use.
    kind: 'custom',
    describe: `target creature you control deals damage equal to${multiplier === 2 ? ' twice' : ''} its power to target creature an opponent controls`,
    run: (ctx: EffectContext, actions: Actions) => {
      const sourcePool = ctx.you.getCreaturesInPlay();
      if (sourcePool.length === 0) return;
      const source = actions.chooseTarget(sourcePool);
      const targetPool = ctx.opponents.flatMap((p) => p.getCreaturesInPlay());
      if (targetPool.length === 0) return;
      const target = actions.chooseTarget(targetPool);
      actions.dealDamage(source, target, source.getNetPower() * multiplier);
    },
  } satisfies Effect;
}

export const chocoboKick: CardDefinition = {
  name: 'Chocobo Kick',
  manaCost: '{1}{G}',
  typeLine: 'Sorcery',

  effects: [
    {
      kind: 'modal',
      modes: [
        { describe: 'Not kicked — target creature you control deals damage equal to its power to target creature an opponent controls', effects: [dealPowerDamage(1)] },
        {
          describe: "Kicked (return a land you control to its owner's hand) — that creature deals twice that much damage instead",
          effects: [{ kind: 'move', owner: 'you', from: 'Battlefield', to: 'Hand', qty: 1, validType: 'land', target: true } satisfies Effect, dealPowerDamage(2)],
        },
      ],
    } satisfies Effect,
  ],
};
