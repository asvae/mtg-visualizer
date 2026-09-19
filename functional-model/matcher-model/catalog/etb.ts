// Matcher catalog entry: ETB ("blink/bounce value" — see below for what this
// category actually means, corrected 2026-09-18).
//
// **SUPERSEDED, 2026-09-18, later still — this entry's ORIGINAL design (no
// producer/consumer split — see this file's git history / `card-schema.md`'s
// own section 6 for the full original writeup) was real, correct reasoning
// for the QUESTION IT ANSWERED ("does `on:'enter'` ever fire for another
// permanent" — no, confirmed against `engine.ts`'s real trigger-firing call
// sites), but that turned out to be the wrong question for what this category
// is actually supposed to represent. Real bug found live by the user:
// `felidar-savior` (FDN #12) self-displayed "ETB: 20" on its OWN page under
// the old design, because "has a real `on:'enter'` trigger" alone matched
// nearly every ETB-effect creature in the pool — the user's own correction:
// "Here only effect like return to the hand, or bounce or something similar
// should get etb."**
//
// **The real, intended concept is the "blink/bounce value" archetype** — a
// genuine real-Magic synergy pairing cards that BOUNCE/RETURN a permanent to
// hand (or blink it — exile then return) with cards that have a valuable,
// repeatable ETB trigger worth re-triggering. This is a genuine TWO-ROLE
// relationship, the EXACT same shape as `lifegain.ts` (a producer `query` +
// a separate consumer signal), not a single self-referential fact:
//
// - **Producer** (this entry's own `query`, below): an effect that
//   structurally guarantees it returns a PERMANENT to hand — a real `move`
//   `Effect` whose own `from` includes `'Battlefield'` and whose own `to` is
//   `'Hand'` (a card is only ever a genuine permanent, CR 110.1, while it's
//   actually on the battlefield — so this shape can never be confused with a
//   graveyard-recursion effect like Vampire Soulcaller's/Inspiration from
//   Beyond's own real `from:'Graveyard', to:'Hand'` shape). Matched via a new
//   `event:'bounce'` occurrence in `match-query.ts`'s `walkEffects`'s own
//   `case 'move'` — the real, motivating FDN card is Bigfin Bouncer
//   (`from:'Battlefield', to:'Hand', validType:'creature'`).
// - **Consumer** (`consumerTriggerOn: ['enter']` below — the ONE real, honest
//   part of the original design, kept as-is): a card OWNS the "ETB" category
//   because it has a real `Trigger.on === 'enter'` ability (an ability worth
//   re-triggering), even though it doesn't itself produce the bounce/blink
//   effect that re-triggers it. Checked via `matchesConsumerTriggerOn`
//   (`match-query.ts`) — a sibling to `lifegain.ts`'s own `consumerTriggerNames`
//   mechanism, but keyed on the engine's own real CLOSED `Trigger.on` enum
//   instead of the free-text `Trigger.name` field — genuinely safer than
//   `consumerTriggerNames`, since there's zero name-collision risk: `on:
//   'enter'` means exactly one real, auto-fired thing, always.
//
// **Deliberately scoped to bounce-to-hand only, NOT blink (exile-then-
// return)** — checked directly, not assumed: no real card in this pool
// models "exile, then return to the battlefield" as a single structural
// shape at all (every real `to:'Exile'` move in this pool is a one-way
// removal effect, never paired with a same-effect return). A real, separate,
// documented future gap — widen `match-query.ts`'s own `case 'move'` the next
// time a real card needs it, never guessed at here.
//
// **Self-inclusion note, same rule `card-interactions.ts`'s own self-
// ownership gate (`.claude/contracts/card-schema.md` section 7) already
// established for `lifegain`/Ajani's Pridemate**: a card that owns "ETB"
// ONLY via `consumerTriggerOn` (a pure consumer, no bounce effect of its
// own — Felidar Savior/Helpful Hunter, e.g.) shows the category but is never
// counted among its own matches; only a real bounce/blink PRODUCER (Bigfin
// Bouncer) is a match. A card that's both (a creature with an ETB trigger
// that ALSO bounces something) would count as its own match via the
// producer path, same as any other category.
//
// **`consumerTriggerNames` widened (2026-09-18, later still)** — real gap
// found live: Dazzling Angel (FDN #9), "Whenever another creature you
// control enters, you gain 1 life," is modeled as a NAME-ONLY trigger
// (`name: 'onOtherCreatureEnter'`, no `on` value at all — CR 603.6b's
// "another permanent enters" shape genuinely has no `Trigger.on` member
// today, same documented engine gap `consumerTriggerOn` above can never
// close for this convention, since it firing on ANOTHER permanent, not
// itself, is exactly what `on:'enter'` can't express). `consumerTriggerOn`
// alone can never recognize this real ETB-reactive card (its own trigger's
// `on` is `undefined`, never `'enter'`) — added a sibling
// `consumerTriggerNames` list, same mechanism `lifegain.ts` already
// established, checking `Trigger.name` instead. `'onOtherCreatureEnter'` is
// the one real, checked-in convention name for this shape as of this
// writing (grepped every real FDN `definition.ts` — Dazzling Angel is the
// only card using it; Skyknight Squire's own "whenever another creature you
// control enters" is modeled differently, via `on:'enter'`/`name:'onEnter'`,
// a separate, already-`consumerTriggerOn`-covered case, even though that
// modeling choice is itself questionable per its own GAP comment). Either
// consumer signal is sufficient — a card can declare one, the other, or
// both.
import type { MatcherQuery } from '../matcher-query';
import type { MatcherCatalogEntry } from './entry';

export const query: MatcherQuery = { category: 'ETB', event: 'bounce', controller: 'you' };

export const entry: MatcherCatalogEntry = { slug: 'etb', query, consumerTriggerOn: ['enter'], consumerTriggerNames: ['onOtherCreatureEnter'] };
