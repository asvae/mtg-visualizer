import type { CardDefinition } from '../../card';

export const gaelicat: CardDefinition = {
  name: 'Gaelicat',
  manaCost: '{2}{W}',
  typeLine: 'Creature — Cat',

  // Real printed base P/T (data/fin/fin_scryfall.json) — without this,
  // state.ts's own addCard silently defaults to a fake 1/1 (same real gap
  // adelbert-steiner's own `pt` field closes).
  pt: [1, 3],
  keywords: ['Flying', 'Vigilance'],
  // Real Forge `S:Mode$ Continuous | IsPresent$ Artifact.YouCtrl |
  // PresentCompare$ GE2 | Affected$ Card.Self | AddPower$ 2`
  // (`res/cardsfolder/g/gaelicat.txt`) — a fixed +2/+0 bonus, fully on or
  // fully off once you control 2+ real artifacts, closed 2026-09-15
  // (fin/16-25 pass) via `card.ts`'s new `ptFormula.kind:'thresholdBonus'`
  // (ENGINE_GAPS.md's own "Gaelicat's/Magitek Infantry's own threshold-CDA
  // gaps" note — now real, live-recalculated via `state.ts`'s
  // `effectivePT`, not text-only).
  ptFormula: { kind: 'thresholdBonus', power: 2, toughness: 0, condition: { type: 'Artifact', min: 2 } },
};
