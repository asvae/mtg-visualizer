import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { ultrosObnoxiousOctopus } from './definition';

export const scenarios: Scenario[] = [
  {
    result: 'taps the opponent creature and puts a stun counter on it',
    trigger: 'onNoncreatureSpellCastGE4Mana',
    opponents: [{ creaturesCount: 1 }],
  },
  {
    result: 'no opponent creature present, no legal target',
    trigger: 'onNoncreatureSpellCastGE4Mana',
    opponents: [{}],
  },
  { result: 'puts 8 +1/+1 counters on itself', trigger: 'onNoncreatureSpellCastGE8Mana' },
  ...keywordScenarios(ultrosObnoxiousOctopus),
];
