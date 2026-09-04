import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const sandworm: CardDefinition = {
  name: 'Sandworm',
  manaCost: '{4}{R}',
  typeLine: 'Creature — Worm',

  pt: [5, 4],
  keywords: ['Haste'],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        {
          // "Destroy target land" — `destroy`'s own declarative `validType`
          // is only 'permanent'|'creature', no 'land' option, so this can't
          // be expressed declaratively. "Its controller may search their
          // library for a basic land card, put it onto the battlefield
          // tapped, then shuffle" likewise needs a land-typed search with no
          // declarative `move`/`dig` validType for it either ('creature'|
          // 'artifact'|'any' only) — `custom`, filtering the real
          // `isLand()` getter already exposed on every wrapped Card, is the
          // honest shape for both halves. "Basic" isn't a tracked supertype
          // anywhere in this model (state.ts's RealCard has no supertype
          // field at all), so "a basic land card" is narrowed to "a land
          // card" — same kind of narrowing from-father-to-son's own
          // Vehicle-&#8834;-Artifact approximation already documents.
          kind: 'custom',
          describe: "destroy target land; its controller may search their library for a basic land card, put it onto the battlefield tapped, then shuffle",
          run: (ctx: EffectContext, actions: Actions) => {
            const pool = [...ctx.you.getCardsIn('Battlefield'), ...ctx.opponents.flatMap((p) => p.getCardsIn('Battlefield'))].filter((c) => c.isLand());
            if (pool.length === 0) return;
            const target = actions.chooseTarget(pool);
            const controller = target.getController();
            actions.destroy(target);
            const libraryLands = controller.getCardsIn('Library').filter((c) => c.isLand());
            if (libraryLands.length === 0) return;
            const found = actions.chooseTarget(libraryLands);
            actions.moveTo(found, 'Battlefield');
            actions.tap(found);
          },
        } satisfies Effect,
      ],
    },
  ],
};
