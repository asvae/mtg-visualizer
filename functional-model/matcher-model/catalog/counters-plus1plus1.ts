// Matcher catalog INSTANCE: Counters — `+1/+1` (2026-09-18, split out of
// `counters.ts` so the reusable `CountersMatcher` factory — `families/
// counters.ts` — and this curated, specific configuration don't share a
// module; see that file's own header for the full family write-up). The 1
// real, currently-existing configuration in the Counters family. A future
// `-1/-1`/loyalty sibling would be exactly one more sibling file here, one
// more `CountersMatcher(...)` call over that card's own real `CardDefinition`,
// one more import in `catalog/index.ts`.
//
// **2026-09-19** — `CountersMatcher` now takes the real driving `CardDefinition`
// directly (`families/counters.ts`'s own header for the full rewrite
// writeup) instead of a hand-authored `{slug, counterType,
// consumerTriggerNames}` config object. This file now imports the real
// Exemplar of Light definition (FDN #11, `../../fdn-cards/exemplar-of-light/
// definition.ts`) and hands it straight to the factory — `slug`/
// `counterType`/`consumerTriggerNames` are all derived FROM this real
// `CardDefinition`, not authored a second time here.
// **2026-09-19, later still** — `CountersMatcher(definition)` now returns
// `Matcher[]` (one instance PER DISTINCT `counterType` found on
// `definition` — see `families/counters.ts`'s own `deriveCounterTypes` doc
// comment for the full array/dedup rewrite writeup; live user correction:
// "we need array handling here obviously"). Exemplar of Light itself only
// ever grants ONE distinct counter type (`'+1/+1'`), so this destructures
// the single real element straight out — a real, structurally-justified
// assertion (not a guess) that stays correct unless/until a second,
// differently-typed `putCounter`-family effect is ever added to Exemplar of
// Light's own definition, at which point this file would need its own
// second named export for the new sibling instance.
import { exemplarOfLight } from '../../fdn-cards/exemplar-of-light/definition';
import { CountersMatcher } from './families/counters';
import type { Matcher } from './entry';

export const countersPlus1Plus1: Matcher = CountersMatcher(exemplarOfLight)[0]!;
