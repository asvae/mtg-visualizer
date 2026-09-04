import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const cactuar: CardDefinition = {
  name: 'Cactuar',
  manaCost: '{G}',
  typeLine: 'Creature — Plant',

  pt: [3, 3],
  keywords: ['Trample'],

  triggers: [
    {
      name: 'onEndStep',
      effects: [
        {
          // "if this creature didn't enter the battlefield this turn,
          // return it to its owner's hand" — the condition ("didn't enter
          // this turn") has no tracked state anywhere in this model (no
          // turn-entry timestamp on RealCard, state.ts's own header rules
          // out turn-structure bookkeeping beyond what turn.ts separately
          // builds) — same "described but not gated" treatment other
          // untracked conditions get elsewhere; this trigger always
          // returns itself when fired. Always SELF specifically (not a
          // chosen target), so `move`'s own declarative shape (which picks
          // from a pool, not a fixed card) doesn't fit — `custom` moving
          // `ctx.self` directly is the honest shape, same as y-shtola-
          // rhul's own self-only exile-return.
          kind: 'custom',
          describe: "if this creature didn't enter the battlefield this turn (condition not tracked), return it to its owner's hand",
          run: (ctx: EffectContext, actions: Actions) => {
            actions.moveTo(ctx.self, 'Hand');
          },
        } satisfies Effect,
      ],
    },
  ],
};
