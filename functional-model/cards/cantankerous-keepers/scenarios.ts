import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'enters the battlefield (its own ETB trigger fires separately below)' },
  {
    result: 'mills four cards, then puts all Elf cards from among them into hand',
    trigger: 'onEnter',
    you: { libraryCount: 4, librarySubtypeCount: 2, librarySubtype: 'Elf' },
  },
  {
    result: 'no Elf cards among the four milled cards — puts nothing into hand',
    trigger: 'onEnter',
    you: { libraryCount: 4 },
  },
];
