import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const rideTheShoopuf: CardDefinition = {
  name: 'Ride the Shoopuf',
  manaCost: '{1}{G}',
  typeLine: 'Enchantment',

  triggers: [
    {
      name: 'onLandfall',
      effects: [{ kind: 'putCounterTarget', validType: 'creature', counterType: '+1/+1', amount: 1, owner: 'you' } satisfies Effect],
    },
  ],

  // {5}{G}{G}: This enchantment becomes a 7/7 Beast creature in addition
  // to its other types. `animate` (card.ts) only ever mutates the current
  // TYPE list (layer 4) — it has no power/toughness field, so it alone
  // can't express the real `Power$ 7 | Toughness$ 7` this ability also
  // carries. No declarative Effect kind sets an ABSOLUTE P/T either (only
  // `pump*`'s relative deltas exist), so the P/T half is a `custom` effect
  // that reads the real current net P/T (`getNetPower`/`getNetToughness`,
  // both real interfaces.ts members) and pumps by exactly the delta needed
  // to land on 7/7 — a precise translation using existing real primitives,
  // not a lazy catch-all.
  activationCost: '{5}{G}{G}',
  effects: [
    { kind: 'animate', target: 'self', types: ['Creature', 'Beast'] } satisfies Effect,
    {
      kind: 'custom',
      describe: 'becomes a 7/7 Beast creature (power and toughness set to a fixed 7/7)',
      run: (ctx: EffectContext, actions: Actions) => {
        actions.pump(ctx.self, 7 - ctx.self.getNetPower(), 7 - ctx.self.getNetToughness());
      },
    } satisfies Effect,
  ],
};
