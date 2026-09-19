// Matcher catalog entry: Lifegain.
//
// A shared, reviewed, curated `MatcherQuery` — see `catalog/index.ts`'s own
// header for the full "catalog, not per-card" design rationale. `query`
// answers the PRODUCER-side question, "does a candidate card's own
// `CardDefinition` cause its controller to gain life?" — mirrors the
// identical real, already-shipped FIN sink this project's own
// `match-query.test.ts` (`sink D`) already verifies agrees with production
// (`Aerith Gainsborough`'s own real `{event:'lifegain', controller:'you'}`
// sink Fact, `cards/aerith-gainsborough/synergy.json`).
//
// `consumerTriggerNames` (2026-09-18, added after the earlier per-card
// `sinks.json` attachment concept was tried-then-reverted, see
// `pipeline-status.ts`'s own header note — this entry USED to point at a
// `functional-model/fdn-cards/ajani-s-pridemate/sinks.json` file that no
// longer exists) answers the CONSUMER-side question instead: does a
// candidate REACT to some other source of lifegain? Ajani's Pridemate's own
// `onLifeGained` trigger (`functional-model/fdn-cards/ajani-s-pridemate/
// definition.ts`) is the real, motivating case — it has no `gainLife`
// effect of its own (so `query` alone declines it), but its trigger's own
// `name` is a real, deliberately-authored structural handle for exactly
// this precondition (see `entry.ts`'s own doc comment on
// `consumerTriggerNames` for why this is a safe, lower-stakes use of
// `Trigger.name` — a pure field comparison, never oracle/printed text).
//
// **`'onLifeGain'` added (2026-09-18, later still)** — real gap found live
// verifying Exemplar of Light (FDN #11)'s own "Whenever you gain life, put a
// +1/+1 counter on this creature" trigger: it's named `'onLifeGain'` (NOT
// `'onLifeGained'` — a real, checked-in spelling variant of the same
// convention, not a typo this catalog gets to silently "fix" by picking one
// canonical spelling), so the pre-existing single-name list declined it
// (confirmed: Exemplar of Light self-showed NO "Lifegain" row before this
// fix, contrary to the initial assumption it already did). Grepped every
// real FDN `definition.ts` for both spellings — Ajani's Pridemate is the
// only real `'onLifeGained'` case, Exemplar of Light the only real
// `'onLifeGain'` case, zero collision between the two lists.
import type { MatcherQuery } from '../matcher-query';
import type { MatcherCatalogEntry } from './entry';

export const query: MatcherQuery = { category: 'Lifegain', event: 'lifegain', controller: 'you' };

export const entry: MatcherCatalogEntry = { slug: 'lifegain', query, consumerTriggerNames: ['onLifeGained', 'onLifeGain'] };
