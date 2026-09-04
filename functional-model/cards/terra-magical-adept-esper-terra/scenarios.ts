import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { terraMagicalAdept } from './definition';

export const scenarios: Scenario[] = [
  {
    result: 'mills 5 cards; none of them are enchantments (this model has no way to seed a typed library card), nothing put into hand',
    trigger: 'onEnter',
    you: { libraryCount: 5 },
  },
  { result: 'exiles Terra, then returns it to the battlefield transformed into Esper Terra' },
  { result: 'back face: Flying only, no resolvable chapters (see definition.ts for the real gap — copyPermanent not wired, mana production out of scope)', face: 'back' },
  ...keywordScenarios(terraMagicalAdept),
];
