import type { Scenario } from '../../harness';

// No resolvable effect exists (the mana ability is text-only — see
// definition.ts's own comment) and no keyword/ptFormula/Legendary to probe —
// same shape adelbert-steiner's own baseline entry uses for a static-only
// permanent.
export const scenarios: Scenario[] = [
  { result: 'enters the battlefield; the mana ability is a continuous static effect, not a resolvable action in this model' },
];
