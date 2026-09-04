import type { Scenario } from '../../harness';

// No resolvable effects/triggers (see definition.ts's own comments on the mana
// ability/crew cost being real, structured, but out-of-scope facts) and no
// Lifelink/CDA/Legendary supertype for keywordScenarios() to probe — just
// the real lifecycle (enters the battlefield as a noncreature artifact
// until crewed).
export const scenarios: Scenario[] = [{ result: 'enters the battlefield; Flying/Vigilance are real but not creature-relevant until crewed (crewing itself has no resolvable behavior in this model)' }];
