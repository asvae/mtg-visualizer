import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result:
      'no land card available in library to search for (this harness has no land-typed library filler — see definition.ts\'s own comment on this real, untestable gap); the +1/+1 counter is still placed on the target creature you control',
    castFrom: 'hand',
    you: { libraryCount: 1, creaturesCount: 1 },
  },
  { result: 'no legal creature target you control, no counter placed', castFrom: 'hand', you: { libraryCount: 1, creaturesCount: 0 } },
];
