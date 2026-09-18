// Sink catalog INSTANCE: Counters — `+1/+1` (2026-09-18, split out of
// `counters.ts` so the reusable `CountersSink` factory — `families/
// counters.ts` — and this curated, specific configuration don't share a
// module; see that file's own header for the full family write-up). The 1
// real, currently-existing configuration in the Counters family. A future
// `-1/-1`/loyalty sibling would be exactly one more sibling file here, one
// more `CountersSink({...})` call, one more import in `catalog/index.ts`.
import { CountersSink } from './families/counters';
import type { SinkInstance } from './entry';

export const countersPlus1Plus1: SinkInstance = CountersSink({
  slug: 'counters-plus1plus1',
  counterType: '+1/+1',
  consumerTriggerNames: ['onCounterAdded'],
});
