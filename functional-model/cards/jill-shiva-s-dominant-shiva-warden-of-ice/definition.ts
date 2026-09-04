import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// A transforming DFC Legendary Creature // Saga — same shape as
// dion-bahamut-s-dominant-bahamut-warden-of-light / jecht-reluctant-
// guardian-braska-s-final-aeon (front-face activated exile-then-return,
// back-face Saga chapters modeled as named triggers — the same 714.3a/b
// turn-based-action-vs-triggered-ability simplification documented on
// jecht's own file).
export const jillShivasDominant: CardDefinition = {
  name: "Jill, Shiva's Dominant",
  manaCost: '{2}{U}',
  typeLine: 'Legendary Creature — Human Noble Warrior',
  pt: [2, 2],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        // Real ValidTgts$ Permanent.nonLand+Other, TargetMax$1 — up to one
        // OTHER nonland permanent, any player's. Same cross-player-pool
        // gap Eject's own `move` effect hits (see that card's comment):
        // `owner: 'opponents'` stands in for the representative case.
        { kind: 'move', owner: 'opponents', from: 'Battlefield', to: 'Hand', qty: 1, validType: 'any', target: true, optional: true } satisfies Effect,
      ],
    },
  ],

  activationCost: '{3}{U}{U}, {T} (activate only as a sorcery)',
  effects: [
    {
      kind: 'custom',
      describe: "exile Jill, then return it to the battlefield transformed under its owner's control",
      run: (ctx: EffectContext, actions: Actions) => {
        actions.moveTo(ctx.self, 'Exile');
        actions.moveTo(ctx.self, 'Battlefield');
      },
    } satisfies Effect,
  ],

  backFace: {
    name: 'Shiva, Warden of Ice',
    manaCost: '',
    typeLine: 'Legendary Enchantment Creature — Saga Elemental',
    pt: [4, 5],
    triggers: [
      {
        name: 'chapterI',
        effects: [
          {
            // "Target creature can't be blocked this turn" — a temporary
            // evasion GRANT to a target has no fitting Effect kind, and no
            // Actions primitive anywhere in this model tracks "can't be
            // blocked" state at all (unlike a P/T delta, counter, or tap,
            // there's simply nothing to mutate). The true escape hatch per
            // card.ts's own header, with no mutation to pair it with —
            // nothing beyond the trigger firing itself is observable in
            // the trace. Flagged as a gap in the batch report.
            kind: 'custom',
            describe: "Mesmerize — target creature can't be blocked this turn",
            run: () => {},
          } satisfies Effect,
        ],
      },
      {
        name: 'chapterII',
        effects: [
          {
            kind: 'custom',
            describe: "Mesmerize — target creature can't be blocked this turn",
            run: () => {},
          } satisfies Effect,
        ],
      },
      {
        name: 'chapterIII',
        effects: [
          {
            // Real "Tap all lands your opponents control" — a
            // predicate-based board-wide action, the same declarative
            // shape as `pumpAll`/`putCounterAll` but for `tap`; no such
            // `tapAll` Effect kind exists yet (card.ts's own `tapTarget`
            // doc comment explicitly anticipates this: "a board-wide
            // tap-all this batch doesn't need yet"). Not modeled here —
            // flagged as a gap rather than hacked via `custom` looping
            // `actions.tap()` (a real Effect kind should model a
            // predicate-based board-wide action, same reasoning
            // `pumpAll`/`putCounterAll` already established as first-class
            // kinds instead of ad hoc loops).
            kind: 'custom',
            describe: 'Cold Snap — exile Shiva, then return it to the battlefield (front face up)',
            run: (ctx: EffectContext, actions: Actions) => {
              actions.moveTo(ctx.self, 'Exile');
              actions.moveTo(ctx.self, 'Battlefield');
            },
          } satisfies Effect,
        ],
      },
    ],
  },
};
