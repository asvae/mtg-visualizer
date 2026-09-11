import type { Scenario } from '../../harness';

// A real branching modal ability — two genuinely mutually-exclusive modes
// that can't both be shown in one continuous story, so exactly one scenario
// per real mode (2026-09-12, per the standing "more than 1 scenario only for
// a very significant reason" rule) rather than either an artificial
// single-scenario consolidation or the extra no-op variants this file used
// to carry (dropped: they never called moveTo/tap at all with an empty
// pool, so they added zero real trace evidence beyond what these two
// already provide).
export const scenarios: Scenario[] = [
  { result: 'returns a creature card from graveyard to the battlefield tapped', mode: 0, you: { graveyardCreatureCount: 2 } },
  { result: 'exiles the Zombie', mode: 1, opponents: [{ creaturesCount: 1, creatureSubtypes: ['Zombie'] }] },
];
