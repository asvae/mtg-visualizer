import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'destroys the target artifact', you: { artifactsCount: 1 } },
  { result: 'destroys the target enchantment', you: { enchantmentsCount: 1 } },
  // No `PlayerState` field seeds a keyword (Flying included) onto a
  // generated filler creature (`setupPlayer`'s battlefield-creature loops
  // never pass `keywords` to `state.addCard`) — same "real code,
  // untestable" situation summon-titan's own comment already documents for
  // a different field gap. The "or creature with flying" branch of the
  // real target predicate is exercised by the code path above (all three
  // conditions are the SAME `||` chain, see definition.ts), just not
  // independently provable through a scenario.
  { result: 'no legal target, nothing destroyed', you: {}, opponents: [{}] },
];
