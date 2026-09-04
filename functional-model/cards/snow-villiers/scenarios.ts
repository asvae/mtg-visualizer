import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { snowVilliers } from './definition';

// No effects/triggers to exercise beyond the real lifecycle + the shared
// keyword/CDA/legend-rule probes (Vigilance is recognized-but-inert — see
// card.ts's own doc comment; the power-CDA is real and live, see this
// card's own `ptFormula`) — same shape adelbert-steiner/gaelicat's own
// scenarios use for a mostly-static creature.
export const scenarios: Scenario[] = [{ result: 'enters the battlefield; power CDA sets it to 3 (2 other creatures + self), toughness fixed at 3', you: { creaturesCount: 2 } }, ...keywordScenarios(snowVilliers)];
