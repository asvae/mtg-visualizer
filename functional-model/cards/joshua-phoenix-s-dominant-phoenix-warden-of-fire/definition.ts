import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// A transforming DFC Legendary Creature // Saga — same shape as dion-
// bahamut-s-dominant-bahamut-warden-of-light / jill-shiva-s-dominant-
// shiva-warden-of-ice (front-face activated exile-then-return, back-face
// Saga chapters modeled as named triggers — the same 714.3a/b turn-based-
// action-vs-triggered-ability simplification documented on jecht-
// reluctant-guardian-braska-s-final-aeon's own file).
export const joshuaPhoenixsDominant: CardDefinition = {
  name: "Joshua, Phoenix's Dominant",
  manaCost: '{1}{R}{W}',
  typeLine: 'Legendary Creature — Human Noble Wizard',

  pt: [3, 4],

  triggers: [
    {
      // "Discard up to two cards, then draw that many cards" — `discard`
      // already discards only up to `qty` when the hand has fewer (see
      // state.ts's own `GameState.discard`), so a fixed `qty: 2`
      // legitimately covers the "up to" half; matching the actual
      // discarded count for `drawCard` would need the real number fed
      // back, which no Effect chaining supports (same class of loss Locke
      // Cole/Rook Turret's own fixed-count discard-then-draw pairs already
      // accept) — fixed `2` on both sides is the honest approximation.
      name: 'onEnter',
      effects: [{ kind: 'discard', owner: 'you', qty: 2 } satisfies Effect, { kind: 'drawCard', amount: 2 } satisfies Effect],
    },
  ],

  activationCost: '{3}{R}{W}, {T} (activate only as a sorcery)',
  effects: [
    {
      kind: 'custom',
      describe: "exile Joshua, then return it to the battlefield transformed under its owner's control",
      run: (ctx: EffectContext, actions: Actions) => {
        actions.moveTo(ctx.self, 'Exile');
        actions.moveTo(ctx.self, 'Battlefield');
      },
    } satisfies Effect,
  ],

  backFace: {
    name: 'Phoenix, Warden of Fire',
    manaCost: '',
    typeLine: 'Legendary Enchantment Creature — Saga Phoenix',

    pt: [4, 4],
    keywords: ['Flying', 'Lifelink'],

    triggers: [
      {
        name: 'chapterI',
        effects: [{ kind: 'dealDamage', target: 'opponents', amount: 2 } satisfies Effect],
      },
      {
        name: 'chapterII',
        effects: [{ kind: 'dealDamage', target: 'opponents', amount: 2 } satisfies Effect],
      },
      {
        name: 'chapterIII',
        effects: [
          // "Return any number of target creature cards with total mana
          // value 6 or less from your graveyard to the battlefield" — no
          // budget/total-CMC-cap mechanism exists on `move`'s targeted
          // branch (it only ever counts CARDS, not a running mana-value
          // sum), so the real "any number... total MV 6 or less" is
          // approximated as a fixed `qty: 2` (a representative "usually
          // fits under 6" case), same declared-approximation class
          // vincent-valentine-galian-beast's own P/T-scaled counters use.
          { kind: 'move', owner: 'you', from: 'Graveyard', to: 'Battlefield', qty: 2, validType: 'creature', target: true } satisfies Effect,
          {
            kind: 'custom',
            describe: 'exile Phoenix, then return it to the battlefield (front face up)',
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
