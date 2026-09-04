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
          // "Total mana value of OTHER permanents you control" — this
          // model has no mana-value field on RealCard at all (see
          // interfaces.ts's TokenInfo/state.ts's RealCard — neither tracks
          // it), so the real number can't be computed here. Same "trigger
          // fixes a value once, read back downstream" pattern Kain's own
          // custom effect uses: a scenario supplies the real total via
          // triggerInput, this just reads it back rather than guessing 0
          // or inventing a fake mana-value system for one card.
          amount: (ctx) => (ctx.triggerInput?.totalManaValue as number) ?? 0,
        } satisfies Effect,
      ],
    },
  ],
};
