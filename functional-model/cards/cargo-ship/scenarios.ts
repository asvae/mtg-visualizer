import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { cargoShip } from './definition';

// No Lifelink/CDA/Legendary supertype for keywordScenarios() to probe
// (Flying/Vigilance are both bare, no-fact keywords per definition.ts's own
// comment) — spread in anyway for pool-wide consistency (same convention
// the-lunar-whale/the-prima-vista already follow), it's just a no-op here.
export const scenarios: Scenario[] = [
  {
    result: 'taps for {C} (a restricted mana ability — this engine tracks no mana pool, so the "spend only on artifact spells/abilities" restriction itself is unenforced, see definition.ts) and, separately, is crewed (Crew 1) to become an artifact creature until end of turn',
    ability: 'mana',
    you: { creaturesCount: 1 },
    sequence: [{ activate: true }],
  },
  ...keywordScenarios(cargoShip),
];
