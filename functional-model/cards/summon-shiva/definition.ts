import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const summonShiva: CardDefinition = {
  name: 'Summon: Shiva',
  manaCost: '{3}{U}{U}',
  typeLine: 'Enchantment Creature — Saga Elemental',

  pt: [4, 5],

  triggers: [
    {
      // Heavenly Strike — "target creature AN OPPONENT CONTROLS." Neither
      // `tapTarget` nor `putCounterTarget` has an owner-restriction option
      // (both pool across every player's battlefield) — `custom`, pooling
      // only `ctx.opponents`' creatures, then chaining the real
      // `tap`/`putCounter` actions against that one chosen target.
      name: 'chapterI',
      effects: [
        {
          kind: 'custom',
          describe: 'Heavenly Strike — tap target creature an opponent controls, then put a stun counter on it',
          run: (ctx: EffectContext, actions: Actions) => {
            const pool = ctx.opponents.flatMap((p) => p.getCreaturesInPlay());
            const target = actions.chooseTarget(pool);
            if (target) {
              actions.tap(target);
              actions.putCounter(target, 'stun', 1);
            }
          },
        } satisfies Effect,
      ],
    },
    {
      name: 'chapterII',
      effects: [
        {
          kind: 'custom',
          describe: 'Heavenly Strike — tap target creature an opponent controls, then put a stun counter on it',
          run: (ctx: EffectContext, actions: Actions) => {
            const pool = ctx.opponents.flatMap((p) => p.getCreaturesInPlay());
            const target = actions.chooseTarget(pool);
            if (target) {
              actions.tap(target);
              actions.putCounter(target, 'stun', 1);
            }
          },
        } satisfies Effect,
      ],
    },
    {
      // Diamond Dust — "draw a card for each tapped creature your
      // opponents control." No fitting Effect kind/field: `Card` (the
      // wrapped interface every `getCreaturesInPlay()` result is, see
      // interfaces.ts) has no `isTapped()` anywhere — the ONLY tapped-state
      // read in this whole model is `RealCard.tapped` inside state.ts
      // itself, never exposed through the `Card` interface `custom`'s own
      // `ctx.opponents` actually receives. Genuine gap (see this batch's
      // final report): `Card.isTapped()` would need to be added to
      // interfaces.ts (and wired in state.ts's `wrapCard`) before Diamond
      // Dust's real X-count is computable here. No-op `custom` in the
      // meantime, same treatment every other unmodelable count/condition
      // in this batch gets.
      name: 'chapterIII',
      effects: [
        {
          kind: 'custom',
          describe: "Diamond Dust — draw a card for each tapped creature your opponents control (needs Card.isTapped(), not exposed anywhere in this model)",
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
