// Sink catalog INSTANCE: Counters — `+1/+1` (2026-09-18, split out of
// `counters.ts` so the reusable `CountersSink` factory — `families/
// counters.ts` — and this curated, specific configuration don't share a
// module; see that file's own header for the full family write-up). The 1
// real, currently-existing configuration in the Counters family. A future
// `-1/-1`/loyalty sibling would be exactly one more sibling file here, one
// more `CountersSink(...)` call over that card's own real `CardDefinition`,
// one more import in `catalog/index.ts`.
//
// **2026-09-19** — `CountersSink` now takes the real driving `CardDefinition`
// directly (`families/counters.ts`'s own header for the full rewrite
// writeup) instead of a hand-authored `{slug, counterType,
// consumerTriggerNames}` config object. This file now imports the real
// Exemplar of Light definition (FDN #11, `../../fdn-cards/exemplar-of-light/
// definition.ts`) and hands it straight to the factory — `slug`/
// `counterType`/`consumerTriggerNames` are all derived FROM this real
// `CardDefinition`, not authored a second time here.
import { exemplarOfLight } from '../../fdn-cards/exemplar-of-light/definition';
import { CountersSink } from './families/counters';
import type { SinkInstance } from './entry';

export const countersPlus1Plus1: SinkInstance = CountersSink(exemplarOfLight);
