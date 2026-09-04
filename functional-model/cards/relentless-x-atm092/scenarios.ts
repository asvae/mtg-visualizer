import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result:
      'returns to the battlefield tapped with a finality counter on it (this scenario\'s own setup already starts self on the battlefield — see definition.ts\'s own comment on the real "activated from the graveyard" gap — only the resulting tapped+countered state is modeled)',
    ability: 'returnFromGraveyard',
  },
];
