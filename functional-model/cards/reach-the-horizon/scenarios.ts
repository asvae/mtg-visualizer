import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result:
      'no land cards available in library to search for (this harness has no land-typed library filler — see definition.ts\'s own comment on this real, untestable gap), so nothing enters the battlefield',
    castFrom: 'hand',
    you: { libraryCount: 2 },
  },
];
