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
      on: 'enter',
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
            if (libraryLands.length > 0) {
              const found = actions.chooseTarget(libraryLands);
              actions.moveTo(found, 'Battlefield');
              actions.tap(found);
            }
            // Real "...then shuffle" (601.2/701.19) — genuine bug fix
            // (2026-09-16, escalation triage): this closure searched the
            // controller's library but never actually called
            // `actions.shuffleLibrary`, even though the describe string
            // above already claimed it did and `Actions.shuffleLibrary` is
            // a real, already-wired primitive (see `move`'s own
            // `shuffleAfter` field, card.ts, for the same real primitive
            // used declaratively elsewhere). Runs even when no basic land
            // was actually found — 701.19's own "then shuffle" fires off
            // the SEARCH itself, not off a successful find (same
            // unconditional-per-search pattern `move`'s own `shuffleAfter`
            // uses regardless of `moved.length`).
            actions.shuffleLibrary(controller);
          },
        } satisfies Effect,
      ],
    },
  ],
};
