import type { Scenario } from '../../harness';
import { vaanStreetThief } from './definition';

export const scenarios: Scenario[] = [
  {
    result: "exiles the top card of the opponent's library and creates a Treasure token (casting the discovered card is not modeled)",
    trigger: 'onScoutsDealCombatDamage',
    opponents: [{ libraryCount: 1 }],
  },
  {
    result: 'puts a +1/+1 counter on Vaan and both other Scouts you control',
    trigger: 'onCastSpellYouDontOwn',
    you: { creaturesCount: 2, creatureSubtypes: ['Scout'] },
  },
  {
    result: 'puts a +1/+1 counter on Vaan only — the other 2 creatures are not Scouts, Pirates, or Rogues',
    trigger: 'onCastSpellYouDontOwn',
    you: { creaturesCount: 2 },
  },
];
