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
      // Real 603.6b "enters the battlefield" trigger — auto-fired by
      // `engine.ts`'s own `resolveTop` the moment Jill resolves onto the
      // battlefield, no scenario/player naming it explicitly.
      on: 'enter',
      effects: [
        // Real ValidTgts$ Permanent.nonLand+Other, TargetMax$1 — up to one
        // OTHER nonland permanent, any player's. Same cross-player-pool
        // gap Eject's own `move` effect hits (see that card's comment):
        // `owner: 'opponents'` stands in for the representative case.
        // `nonLand: true` — real printed text excludes lands (found while
        // rebuilding this card's scenarios: the old `validType: 'any'`
        // alone let a land through, which the real card never allows).
        { kind: 'move', owner: 'opponents', from: 'Battlefield', to: 'Hand', qty: 1, validType: 'any', nonLand: true, target: true, optional: true } satisfies Effect,
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
          // "Target creature can't be blocked this turn" — real Forge
          // shape is a temporary static-ability grant (Mode$ CantBlockBy,
          // see vampire_gourmand.txt's own DBUnblockable/Unblockable SVar
          // pair in the real ../mtg-forge checkout), approximated here via
          // the SAME `grantKeywordTarget`/`hasKeyword` machinery a real
          // keyword grant uses (card.ts's own `Keyword` doc comment on
          // 'Unblockable' explains why) — a genuinely trackable mutation
          // now, not a no-op `custom` escape hatch.
          { kind: 'grantKeywordTarget', keyword: 'Unblockable', validType: 'creature' } satisfies Effect,
        ],
      },
      {
        name: 'chapterII',
        effects: [{ kind: 'grantKeywordTarget', keyword: 'Unblockable', validType: 'creature' } satisfies Effect],
      },
      {
        name: 'chapterIII',
        effects: [
          // Real "Tap all lands your opponents control" — a
          // predicate-based board-wide action, the same declarative shape
          // as `pumpAll`/`putCounterAll` but for `tap` (card.ts's own new
          // `tapAll` Effect kind).
          { kind: 'tapAll', predicate: 'lands', owner: 'opponents' } satisfies Effect,
          {
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
