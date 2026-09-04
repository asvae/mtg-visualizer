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

  triggers: [
    { name: 'chapterI', effects: [stampede()] },
    { name: 'chapterII', effects: [stampede()] },
    { name: 'chapterIII', effects: [stampede()] },
    { name: 'chapterIV', effects: [stampede()] },
  ],
};

function stampede(): Effect {
  return { kind: 'pumpAll', predicate: 'creatures-you-control', power: 1, toughness: 0, notSelf: true };
}
