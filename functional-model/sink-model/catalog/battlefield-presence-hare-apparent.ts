// Sink catalog INSTANCE: Battlefield presence — Same-name copies (Hare
// Apparent, FDN #15) (2026-09-18, split out of `battlefield-presence.ts` so
// the reusable `BattlefieldPresenceSink` factory — `families/battlefield-
// presence.ts` — and this curated, specific configuration don't share a
// module; see that file's own header for the full family write-up). A
// real, bespoke, low-reuse configuration (per `entry.ts`'s own "a bespoke
// sink with only one real card wanting it is still just a catalog entry"
// doc comment): the PRODUCER query is a literal `name` constraint (there is
// no honest general "produces a copy of whichever card is asking" query a
// shared, curated `SinkQuery` can express — it deliberately carries no
// reference back to its own owning card), and the CONSUMER filter is
// `{sameNameAsSelf: true}` rather than a `subtype` — a genuinely different
// check (`matchesBattlefieldPresenceConsumer` walks `createToken.amount`'s
// own `ValueRef` shape for this filter, not `costReduction.perControlled`/
// `pumpAll`/`putCounterAll`). A hypothetical future card with the identical
// "counts its own other copies" idiom would need its own sibling
// configuration (a different slug, a different literal `name`), sharing
// this same factory and matcher.
import { BattlefieldPresenceSink } from './families/battlefield-presence';
import type { SinkInstance } from './entry';

export const battlefieldPresenceHareApparent: SinkInstance = BattlefieldPresenceSink({
  slug: 'battlefield-presence-hare-apparent',
  query: { to: 'Battlefield', controller: 'you', name: { eq: 'Hare Apparent' } },
  filter: { sameNameAsSelf: true },
});
