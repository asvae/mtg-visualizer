import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  {
    result: 'loses 1 life, sacrifices itself, then searches library for a basic land and puts it onto the battlefield tapped',
    you: { libraryCount: 2, libraryLandCount: 1 },
  },
  { result: 'no land in library — loses 1 life and sacrifices itself, finds nothing', you: { libraryCount: 2 } },
];
