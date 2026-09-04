import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { squallSeedMercenary } from './definition';

export const scenarios: Scenario[] = [
  { result: 'grants double strike until end of turn to a creature you control', trigger: 'onAttacksAlone', you: { creaturesCount: 1 } },
  { result: 'returns a mana-value-3-or-less permanent card from the graveyard to the battlefield', trigger: 'onDealsCombatDamageToPlayer', you: { graveyardCreatureCount: 2 } },
  { result: 'empty graveyard, no legal target, nothing returned', trigger: 'onDealsCombatDamageToPlayer', you: { graveyardCreatureCount: 0 } },
  ...keywordScenarios(squallSeedMercenary),
];
