import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { lunaticPandora } from './definition';

export const scenarios: Scenario[] = [
  { result: 'surveils 1', ability: 'surveil' },
  // `you: { artifactsCount: 1 }` puts a real OTHER artifact ahead of self in
  // the candidate pool — self is always appended to "you"'s battlefield
  // LAST for an ability scenario (see harness.ts's own `setupPlayer`/
  // `addCard` ordering), so without a filler, Lunatic Pandora would be the
  // only "you"-side candidate and `chooseTarget`'s deterministic first-pick
  // would land on ITSELF — not what this scenario means to illustrate, and
  // not what real timing would even allow (Lunatic Pandora is already
  // sacrificed, paying the ability's own cost, by the time this effect
  // resolves, so it could never actually still be a legal target of its
  // own destroy).
  { result: "destroys the target nonland permanent (your own artifact — deterministic first candidate, ahead of the opponent's)", ability: 'destroyNonland', you: { artifactsCount: 1 }, opponents: [{ artifactsCount: 1 }] },
  ...keywordScenarios(lunaticPandora),
];
