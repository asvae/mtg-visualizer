import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { balambGardenSeedAcademyBalambGardenAirborne } from './definition';

export const scenarios: Scenario[] = [
  { result: 'enters tapped', trigger: 'onEnter' },
  { result: 'transforms into Balamb Garden, Airborne (approximated as exile then return to the battlefield — see definition.ts)' },
  { result: 'attacks and draws a card', face: 'back', trigger: 'onAttacks' },
  // `keywordScenarios` only reads the FRONT face's own `typeLine` (a
  // "Land — Town" front, not Legendary) — the back face, Balamb Garden,
  // Airborne, IS "Legendary Artifact — Vehicle", so its own 704.5j legend-
  // rule check is exercised manually here instead of via the shared probe.
  { result: 'legend rule: a second copy of Balamb Garden, Airborne enters and is put into the graveyard', face: 'back', duplicateLegendaryEnters: true },
  ...keywordScenarios(balambGardenSeedAcademyBalambGardenAirborne),
];
