import type { Scenario } from '../../harness';
import { keywordScenarios } from '../../keyword-scenarios';
import { sazhKatzroy } from './definition';

export const scenarios: Scenario[] = [
  { result: 'searches the library and puts a card into hand (approximated — no Bird/basic-land subtype filter available, see definition.ts)', trigger: 'onEnter', you: { libraryCount: 1 } },
  { result: 'empty library, nothing found', trigger: 'onEnter', you: { libraryCount: 0 } },
  {
    result: 'puts a +1/+1 counter on the target creature (0 -> 1), then doubles it to 2',
    trigger: 'onAttack',
    you: { creaturesCount: 1 },
  },
  {
    result: 'no other creature present — Sazh Katzroy itself is the only legal target, so it targets and doubles its own counters',
    trigger: 'onAttack',
  },
  ...keywordScenarios(sazhKatzroy),
];
