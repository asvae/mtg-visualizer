import type { CardDefinition } from '../../card';

export const adelbertSteiner: CardDefinition = {
  name: 'Adelbert Steiner',
  manaCost: '{1}{W}',
  typeLine: 'Legendary Creature — Human Knight',

  // Real printed base P/T (data/fin/fin_scryfall.json) — without this,
  // state.ts's own addCard silently defaults to a fake 1/1.
  pt: [2, 1],
  keywords: ['Lifelink'],
  // Real layer-7a CDA, live-recalculated from current board state — see
  // state.ts's own effectivePT (real Forge citation there too), not a
  // fixed/timestamped delta.
  ptFormula: {
    kind: 'addPerEquipmentControlled',
    power: 1,
    toughness: 1,
    // The CDA's own real printed line (data/fin/fin_scryfall.json), separate
    // from the "Lifelink" keyword line above (a plain keyword, correctly
    // gets no Fact/annotation of its own). Own annotation (as of the
    // PRD_AUTOMATED_AUTHORING.md "definition-level annotation" migration,
    // 2026-09-13): `definition-annotations.json`, keyed `"ptFormula"`.
  },
};
