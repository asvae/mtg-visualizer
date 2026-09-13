import type { Scenario } from '../../harness';

// One combined scenario, not a bare `trigger:'onLifeGained'` fire: a
// top-level `trigger` skips the cast->enters lifecycle entirely (selfZone
// starts on Battlefield — see harness.ts's own `runScenario`), which would
// leave synergy.json's real cast/entersBattlefield/lifegain(Lifelink)
// SOURCE facts with no trace evidence at all (confirmed the hard way via
// verify-synergy.mjs). Casting for real (no top-level `trigger`) plus
// `dealsCombatDamage` backs those for real (real Lifelink lifegain, CR
// 702.15e, same mechanism aerith-gainsborough's own engine-trace pilot
// demonstrates) while `sequence` fires the anthem trigger itself — still
// exactly one scenario, no separate keyword/legend-rule probes.
export const scenarios: Scenario[] = [
  {
    result: 'puts a +1/+1 counter on self and both other Clerics (3 total); also deals 3 combat damage, gaining that much life via Lifelink',
    you: { creaturesCount: 2, creatureSubtypes: ['Cleric'] },
    sequence: ['onLifeGained'],
    dealsCombatDamage: { amount: 3 },
  },
];
