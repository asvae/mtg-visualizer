import type { Scenario } from '../../harness';

// No effects/triggers to exercise (a pure static-ability creature, same
// shape as adelbert-steiner) — one scenario just confirms the cast/enters
// lifecycle itself still traces cleanly.
export const scenarios: Scenario[] = [
  { result: 'creature enters, no other effect (the +2/+0 threshold bonus is continuous, not a resolvable effect)', you: { artifactsCount: 2 } },
];
