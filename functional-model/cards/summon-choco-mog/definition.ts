import type { CardDefinition, Effect } from '../../card';

// Real 714.3a/b Saga chapters modeled as named `triggers`, same
// simplification jecht-reluctant-guardian-braska-s-final-aeon/summon-bahamut
// already document (turn-based-action precision traded for reusing the
// existing multi-trigger mechanism). Chapters I-IV all point at the SAME
// real Forge SVar (K:Chapter:4:DBStampede,DBStampede,DBStampede,DBStampede)
// — the ability repeats every chapter, not a typo, same shape summon-
// bahamut's own chapters I/II already establish for a repeated SVar.
export const summonChocoMog: CardDefinition = {
  name: 'Summon: Choco/Mog',
  manaCost: '{2}{W}',
  typeLine: 'Enchantment Creature — Saga Bird Moogle',
  // Real printed 3/3 (Scryfall power/toughness, fin/35) — was missing
  // entirely before this migration, which would have silently defaulted
  // this creature face to a fake 1/1 via state.ts's own addCard (see
  // card.ts's own `pt` doc comment for that exact documented gap; same
  // real bug crystal-fragments-summon-alexander's own backFace had before
  // its migration).
  pt: [3, 3],

  triggers: [
    { name: 'chapterI', effects: [stampede()] },
    { name: 'chapterII', effects: [stampede()] },
    { name: 'chapterIII', effects: [stampede()] },
    { name: 'chapterIV', effects: [stampede()] },
  ],
};

function stampede(): Effect {
  // Real "Other creatures you control get +1/+0" — `notSelf: true` is the
  // real Forge `Creature.YouCtrl+Other` exclusion (same `pumpAll` field
  // Summon: Knights of Round/Esper Origins // Summon: Esper Maduin already
  // use for their own "Other creatures..." chapters). NOT surfaced as a
  // separate matcher-level constraint on this card's own `synergy.json`
  // pump fact — checked real precedent first (Ambrosia Whiteheart's own
  // "return ANOTHER permanent you control" bounce fact, `move`'s own
  // `notSelf: true`, carries no self-exclusion marker on its Fact either):
  // this model's `Constraints` vocabulary has no "excluding self" concept
  // at all, and a broadcast-pump SINK only cares about the real category
  // (creatures you control get pumped), not whether literally every one or
  // all-but-one member of that bucket receives it — `notSelf` is real,
  // engine-execution-level detail (card.ts's own `Effect`), not synergy-
  // matching-relevant data.
  return { kind: 'pumpAll', predicate: 'creatures-you-control', power: 1, toughness: 0, notSelf: true };
}
