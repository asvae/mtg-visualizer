import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { ringOfTheLucii } from './definition';

export const scenarios: Scenario[] = [
  // `you: { artifactsCount: 1 }` puts a real OTHER artifact ahead of self in
  // the candidate pool (self is always appended to "you"'s battlefield
  // LAST for an ability scenario — see harness.ts's own `setupPlayer`/
  // `addCard` ordering) — without it, Ring of the Lucii would be the only
  // "you"-side candidate and `chooseTarget`'s deterministic first-pick
  // would land on ITSELF, which real `ValidTgts$ Permanent.nonLand` (no
  // controller/self exclusion) does legally permit, but isn't what this
  // scenario means to illustrate.
  { result: "you pay 1 life, then tap the target nonland permanent (your own artifact — deterministic first candidate, ahead of the opponent's)", ability: 'tapNonland', you: { artifactsCount: 1 }, opponents: [{ artifactsCount: 1 }] },
  ...keywordScenarios(ringOfTheLucii),
];
