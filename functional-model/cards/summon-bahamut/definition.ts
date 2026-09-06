import type { CardDefinition, Effect } from '../../card';

export const summonBahamut: CardDefinition = {
  name: 'Summon: Bahamut',
  manaCost: '{9}',
  // Real Scryfall type_line has no "Legendary" supertype (data/fin/fin_scryfall.json) —
  // a genuine Saga permanent, but not a legendary one.
  typeLine: 'Enchantment Creature — Saga Dragon',

  keywords: ['Flying'],

  // Real 714.3a/b Saga chapters, same "named triggers" simplification the
  // rest of this batch uses for Sagas (see jecht-reluctant-guardian-braska-s-final-aeon's
  // own comment on why: turn-based-action precision traded for reusing the
  // existing multi-trigger mechanism). Chapters I and II both point at the
  // SAME real Forge SVar (K:Chapter:4:DBDestroy,DBDestroy,DBDraw,DBDamage) —
  // the ability repeats, not a typo.
  triggers: [
    {
      name: 'chapterI',
      effects: [{ kind: 'destroy', validType: 'permanent', nonLand: true, qty: 1, optional: true } satisfies Effect],
    },
    {
      name: 'chapterII',
      effects: [{ kind: 'destroy', validType: 'permanent', nonLand: true, qty: 1, optional: true } satisfies Effect],
    },
    {
      name: 'chapterIII',
      effects: [{ kind: 'drawCard', amount: 2 } satisfies Effect],
    },
    {
      name: 'chapterIV',
      effects: [
        {
          kind: 'dealDamage',
          target: 'opponents',
          // "Total mana value of OTHER permanents you control" — computed
          // live off each real permanent's own `Card.getCMC()` (state.ts's
          // `RealCard.cmc`, the same real field Dark Confidant's own
          // upkeep life-loss reads), not a scenario-supplied stand-in —
          // `wrapCard` mints a fresh object per call (state.ts), so `self`
          // is excluded by id, not by reference equality.
          amount: (ctx) => ctx.you.getCardsIn('Battlefield').reduce((sum, c) => (c.getId() === ctx.self.getId() ? sum : sum + c.getCMC()), 0),
        } satisfies Effect,
      ],
    },
  ],
};
