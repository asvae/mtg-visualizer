// Real, execution-VERIFIED synergy matching — v2. Supersedes the string-key
// `factsFor`/`staticFactsFor` model this file used to export (see
// SYNERGY_DESIGN.md, "design v2", for the full reasoning this rewrite is
// based on). Facts are no longer flat colon-strings joined by equality; they
// are attribute bags (see `Fact` below) AUTHORED BY AN AI reading a card's
// own `definition.ts` (cards/<slug>/synergy.json), not derived by script from a
// trace — a script can observe THAT a lambda reads `hasSubtype('Legendary')`
// but not WHY (pump vs. destroy have identical reads, opposite intent).
// scripts/verify-synergy.mjs reconciles the AI's facts against an
// instrumented trace.json in both directions; this module never runs a
// scenario itself.
//
// Type-only import of CardDefinition/Effect — this file still has zero
// RUNTIME dependency on card.ts (confirmed before adding the v1 version of
// this file, still true here), so it stays a one-way edge, no cycle, and
// stays cheap enough to import from a live server route without pulling in
// harness.ts/state.ts/layers.ts.
import type { CardDefinition } from './card';

// ---------------------------------------------------------------------------
// The fact model (SYNERGY_DESIGN.md "The fact model")

export type Side = 'you' | 'opp';

/** `has` = all of; `hasAny` = any of; `not` = none of. Grow only when a real card forces it. */
export interface TypeConstraint {
  has?: string[];
  hasAny?: string[];
  not?: string[];
}

export interface NumConstraint {
  min?: number;
  max?: number;
  eq?: number;
}

export interface NameConstraint {
  eq: string;
}

/** The fixed, small constraint vocabulary — appears on a sink fact, and on a source fact only where the effect itself is filtered (what it targets). */
export interface Constraints {
  types?: TypeConstraint;
  cmc?: NumConstraint;
  power?: NumConstraint;
  toughness?: NumConstraint;
  amount?: NumConstraint;
  name?: NameConstraint;
  /**
   * True only for a candidate that is CURRENTLY ATTACKING (508.1) at the
   * moment the fact's own effect applies — Auron's Inspiration's own real
   * "Attacking creatures get +2/+0 until end of turn" is the card that
   * forced this (2026-09-11, same "grow only when a real card forces it"
   * discipline every other field here already follows). Real, per-instance
   * COMBAT state, not a printed/static card property the way `types`/
   * `power`/`toughness`/`cmc` are — deliberately NOT added to `StaticAttrs`
   * (this file's own header: "Static card properties ... are NOT stored in
   * facts," and `StaticAttrs`/`resolveSubject`/`staticAttrsFor` resolve
   * purely off a `CardDefinition`/`TokenLike`, which has no notion of "is
   * this instance attacking right now" at all — that's `engine.ts`'s own
   * `GameEngine.attackers`, never reachable from here).
   *
   * `attacking` here IS orthogonal to WHO controls the creature — Auron's
   * own real text has no controller restriction at all (either player's
   * attacking creatures), so `controller`/`recipient` stay unset on that
   * fact, same as any other genuinely unrestricted-side fact in the pool;
   * don't invent a controller restriction the printed text doesn't have
   * just because this field exists.
   *
   * **Known, deliberate limitation, same class as `Fact.event` staying
   * inert on an already-zone-shaped fact**: `satisfiesConstraints` does
   * NOT check this field — there is no live-combat-state pipeline reaching
   * it (only `StaticAttrs`), so a `target: {attacking: true}` constraint is
   * currently real, honest, self-documenting DATA, not yet a real matching
   * filter. A future card wanting this to actually gate a match (a sink
   * with `target: {attacking: true}`, say) would need genuine engine-state
   * wiring first — filed under the same "future full matcher unification"
   * bucket the `Fact` merge's own caveat already opened, not faked here.
   */
  attacking?: boolean;
  /**
   * True only for a candidate that is CURRENTLY ATTACHED to the fact's own
   * card (301.5c) — Cloud, Midgar Mercenary's own real "...or an Equipment
   * attached to it" is the card that forced this (2026-09-11, same
   * "grow only when a real card forces it" discipline as `attacking`
   * right above, added the same day for the same reason). Real, per-
   * instance ATTACHMENT state (`state.ts`'s own `RealCard.attachedToId`/
   * `getAttachedTo`/`getEquippedBy` — real, live, checked before adding
   * this field rather than assumed), not a printed/static card property —
   * WHICH Equipment (if any) is attached to a given permanent varies by
   * game, so `types:{has:['Equipment']}` alone would mean "any Equipment
   * card anywhere," not "the one actually attached here"; this field is
   * what narrows it to the latter, real, intended meaning.
   *
   * **Same known, deliberate limitation as `attacking`**: NOT consulted by
   * `satisfiesConstraints` — `StaticAttrs`/`resolveSubject` resolve purely
   * off a `CardDefinition`/`TokenLike`, never live board-state, so there is
   * no pipeline that could check this today. Real, honest, self-documenting
   * DATA on the fact; a future matcher extension wanting this to actually
   * gate a match needs genuine engine-state wiring first — same "future
   * full matcher unification" bucket as `attacking`.
   */
  attachedToSelf?: boolean;
  /**
   * The exact REVERSE relation of `attachedToSelf` right above — true only
   * for the candidate that the fact's own card (`self`) is CURRENTLY
   * ATTACHED TO (301.5c), i.e. `self.attachedToId === candidate.id` rather
   * than `candidate.attachedToId === self.id`. Crystal Fragments' own real
   * "Equipped creature gets +1/+1" is the card that forced this
   * (2026-09-11, same "grow only when a real card forces it" discipline as
   * `attachedToSelf`/`attacking` above) — the pump target here is the
   * creature THIS Equipment is attached to, not (as `attachedToSelf` would
   * mean) some other card attached to this one. `state.ts`'s own real
   * `equip()`/`attachedToId` model (checked before adding this field, same
   * as `attachedToSelf` was) only ever sets `attachedToId` on the
   * EQUIPMENT side pointing at the creature, so this direction genuinely
   * needed its own field rather than a boolean flip of the existing one —
   * `attachedToSelf` and this field describe two different real permanents
   * relative to `self` and are never interchangeable.
   *
   * **Same known, deliberate limitation as `attachedToSelf`/`attacking`**:
   * NOT consulted by `satisfiesConstraints` — no pipeline resolves live
   * board-state attachment for a produce's own filter today. Real, honest,
   * self-documenting DATA; a future matcher extension wanting this to
   * actually gate a match needs genuine engine-state wiring first, same
   * "future full matcher unification" bucket as the other two.
   */
  equippedBySelf?: boolean;
  /**
   * True only for a candidate that is CURRENTLY TAPPED (302.6/deals-with-
   * tapped-permanents rules generally) — Fate of the Sun-Cryst's own real
   * "This spell costs {2} less to cast if it targets a tapped creature" is
   * the card that forced this (2026-09-12, same "grow only when a real
   * card forces it" discipline as `attacking`/`attachedToSelf`/
   * `equippedBySelf` above). Real, per-instance state (`RealCard.tapped`),
   * not a printed/static card property — deliberately a NEW field here
   * rather than reusing the existing top-level `Fact.tapped` (that one
   * describes the fact's own SUBJECT entering/being tapped as part of the
   * occurrence itself, e.g. Vector, Imperial Capital's "enters tapped" —
   * a different, unrelated meaning from "is the CANDIDATE this constraint
   * filters currently tapped," which is what a presence-SINK filtering for
   * "a tapped creature on the battlefield" needs).
   *
   * **Same known, deliberate limitation as `attacking`/`attachedToSelf`/
   * `equippedBySelf`**: NOT consulted by `satisfiesConstraints` —
   * `StaticAttrs`/`resolveSubject` resolve purely off a `CardDefinition`/
   * `TokenLike`, never live board-state, so there is no pipeline that
   * could check this today (checked `state.ts`: `RealCard.tapped` is real,
   * live, per-instance state, but nothing routes it into the constraint
   * matcher). Real, honest, self-documenting DATA representing the real
   * condition this card's cost reduction depends on — NOT a claim that the
   * reduction itself is executable (ENGINE_GAPS.md gap #7's own cost-
   * reduction sub-gap stays open, unrelated to and unresolved by this
   * field); a future matcher extension wanting this to actually gate a
   * match needs genuine engine-state wiring first, same "future full
   * matcher unification" bucket as the other three.
   */
  tapped?: boolean;
  /**
   * True only when the candidate must be a DIFFERENT real permanent/card
   * than the fact's own owner — CR 109.5 ("another" means "other than this
   * object"). G'raha Tia's own real "Whenever another creature or artifact
   * you control dies" (`onOtherPermanentsDie`, `definition.ts`) is the card
   * that forced this (2026-09-12, same "grow only when a real card forces
   * it" discipline as `attacking`/`attachedToSelf`/`equippedBySelf`/
   * `tapped` above) — without it, the "another" qualifier that's a real,
   * important part of the printed text was invisible: the fact looked
   * identical to a plain, unrestricted "a creature or artifact you control
   * dies," which is a different, broader real trigger condition.
   *
   * **Same known, deliberate limitation as `attacking`/`attachedToSelf`/
   * `equippedBySelf`/`tapped`**: NOT consulted by `satisfiesConstraints`,
   * `constraintsOf`, or `hasAnyConstraint` — unlike those, this ISN'T
   * blocked on missing live board-state (this file's own `factsInteract`
   * already resolves both sides' real card identity via `pCard.name`/
   * `wCard.name`, see its `same-instance` self-check), so a future matcher
   * pass genuinely COULD wire this in without new engine plumbing — but
   * that's a real, separate MATCHING-semantics change (would need its own
   * pool-wide before/after diff per SYNERGY_DESIGN.md's own discipline,
   * same as the `Fact` merge's own `find-synergies.mjs` diffs), not done
   * here on purpose: this field is scoped to fixing a real, honest DATA/
   * display gap (the Facts tab silently dropping the "another" qualifier),
   * not a request to change which cards interact. Real, honest,
   * self-documenting DATA today; a future matcher extension wanting this to
   * actually gate a match can do so directly off `pCard`/`wCard` identity,
   * filed under the same "future full matcher unification" bucket as the
   * other four.
   */
  excludeSelf?: boolean;
}

/** `Weight`/`Fact.value` (a 1-5 mechanically-computed magnitude, formerly
 * written by `compute-weights.mjs`) was removed from the schema entirely,
 * pool-wide, 2026-09-14 — an explicit user instruction ("let's remove value
 * from everything ... No -1, no nothing. wipe it out of the project"), not
 * a deprecation. It was never consulted by `factsInteract`/anything that
 * actually matches or interacts facts (see `.claude/contracts/card-schema.md`)
 * — a rough per-fact "how strong is this" dial that stopped being trusted as
 * a real differentiator well before this removal. `compute-weights.mjs`
 * (whose entire job was computing/writing this field) is deleted outright,
 * not gutted-and-kept. See git history for the full historical design (the
 * bucketing scheme, the `-1` "pending computation" sentinel, the earlier
 * `ease`/`strength`/`power` naming attempts) if ever relevant again. */

/** `'self'` = the card this synergy.json belongs to; `{token}` = a token, resolved from token-cards/<slug>/definition.ts's own definition the same way. */
export type Subject = 'self' | { token: string };

/**
 * One fact — a persistent state, an occurrence, or (very commonly, for a
 * real zone movement) both at once.
 *
 * **Unified 2026-09-11, superseding the earlier `ZoneFact`/`EventFact`
 * split** (see SYNERGY_DESIGN.md's "The fact model" for the full
 * before/after reasoning trail — the old two-interface design's own doc
 * comments, preserved there as dated/superseded history via git blame,
 * explain why it existed in the first place; not repeated in full here).
 * The old design used a real TypeScript union (`Fact = ZoneFact |
 * EventFact`) with a structural discriminator (`isZoneFact`/`isEventFact`)
 * — a fact was either a persistent-object movement (`zone`/`to`/`from`) or
 * a named occurrence (`event`), never both, by construction. That split
 * forced an awkward workaround the moment a single real fact legitimately
 * needed BOTH an `event` name AND real zone data at once — CR 700.4's
 * "dying IS moving from the battlefield to a graveyard" is exactly ONE
 * real occurrence, not two — `EventFact` had to invent differently-named
 * `zoneFrom`/`zoneTo` fields (purely descriptive, never matched)
 * specifically so they wouldn't trip `isZoneFact`'s structural check and
 * misclassify the fact as the other shape.
 *
 * Now there is exactly one `Fact` interface. `event`/`to`/`from` (and
 * every other field below) are independent optional fields that can
 * freely co-occur on the same object:
 * - A pure location/presence fact: `{ to: 'Graveyard', ... }` — no
 *   `event`, no `from`.
 * - A pure named-action fact with no fixed zone consequence worth
 *   asserting inline (see the ACT-vs-CONSEQUENCE standing rule below):
 *   `{ event: 'destroy', ... }` — no `to`/`from`.
 * - Both at once, now ONE object instead of two: `{ event: 'dies', from:
 *   'Battlefield', to: 'Graveyard', ... }`.
 *
 * `to`/`from`/`zone` — which zone(s) a real movement or presence check is
 * INTO/OUT OF:
 * - `to` — the destination, or (with no `event`/`from`) a SINK's plain,
 *   timeless presence check: "the consumer wants something present in
 *   this zone right now," no movement implied. **Supersedes the legacy
 *   `zone` field below** (2026-09-11, same day as this merge) — `zone`
 *   was always conceptually "a `to` with no `from`, no `event`," so
 *   keeping both spellings was two names for one idea. Every NEW fact
 *   (source AND sink alike) should use `to`, not `zone` —
 *   `effectiveZone` below still resolves `zone ?? to` for the rest of the
 *   pool, which hasn't been migrated off the legacy field (a full
 *   pool-wide migration is a separate, larger sweep, out of scope for
 *   this pass; only this card's own data was migrated — see
 *   SYNERGY_DESIGN.md).
 * - `from` — optional, the origin of a real movement. Omit when
 *   unknown/unspecified/could-be-anywhere (e.g. a generic ETB: cast from
 *   hand, fetched from a library, blinked back from exile — CR doesn't
 *   care); set it when the movement has one well-defined origin (e.g.
 *   `'Battlefield'` for something that dies/is sacrificed/destroyed — CR
 *   700.4). `from`/`to` are the AUTHORITATIVE data — a friendly movement
 *   name ("dies", "enters the battlefield") is a DERIVED display label on
 *   top (`describeFact`, via `ZONE_MOVEMENT_NAMES`/`zoneMovementName`
 *   below), never the reverse: a consumer that only cares about the `to`
 *   side (e.g. "this card cares about things being put into a graveyard,
 *   regardless of where they came from") matches on `to` alone, ignoring
 *   `from` entirely — exactly what `factsInteract` itself does below.
 *   Real, valid fact shape this merge introduces that never existed
 *   before: `from` with NO `to` at all (`self-cast`'s own `from:'Hand'` —
 *   the real destination is the Stack, which this model deliberately
 *   never assigns as a value on either side, see `ZONE_MOVEMENT_NAMES`'s
 *   own doc comment) — `effectiveZone`/`describeFact` both handle this
 *   without crashing, see their own doc comments.
 *
 * `event` — a named CR-recognizable occurrence (`'dies'`, `'destroy'`,
 * `'cast'`, `'entersBattlefield'`, `'damage'`, `'drawCard'`,
 * `'putCounter'`, `'sacrifice'`, ...), independent of whether `to`/`from`
 * are also present.
 *
 * **When does an ACT-type fact (`cast`/`destroy`/`sacrifice` — something a
 * player/effect DOES) get `to`/`from` inline on itself, vs. stay a bare
 * `event` tag deferring to a separate consequence fact?** Standing rule
 * (see SYNERGY_DESIGN.md's own named section for the full worked-examples
 * table): inline only when the movement is a guaranteed, DEFINING part of
 * the act (`cast` — CR 601.2a, no "cast but the card didn't move" case);
 * bare otherwise, when the movement is conditional/preventable (`destroy`
 * — indestructible/regeneration) or the consequence is already
 * independently matched by a separate fact (`sacrifice` used to defer to
 * a dedicated `self-graveyard` ZoneFact, now itself folded into the
 * merged `dies` fact by this same pass — see this card's own
 * `synergy.json`). A CONSEQUENCE-type fact (`dies`, `entersBattlefield` —
 * something that has ALREADY happened by the time it fires) always gets
 * the treatment for whichever end is actually fixed, since the movement
 * is no longer conditional on anything by that point.
 *
 * `playLand` vs. `entersBattlefield` — DELIBERATELY two separate events,
 * not one derived from the other. CR 305's land-drop special action
 * ("play a land" — hand to battlefield, no stack, no mana cost, once per
 * turn) is genuinely NOT the same fact as "a permanent entered the
 * battlefield" — the latter fires no matter HOW a permanent got there
 * (cast, a land drop, or an effect that puts it there directly, e.g.
 * Elven Passage's own library-search-to-battlefield). A land found by
 * Elven Passage's own effect really does trigger `entersBattlefield` (its
 * own landfall/ETB triggers see it) but was never PLAYED — no `playLand`
 * fact for it. Conversely a land played normally always gets BOTH: a
 * `playLand` fact for the special action itself, and an `entersBattlefield`
 * fact once it actually resolves onto the battlefield. Never assume one
 * implies the other when authoring a card's own facts. Structural
 * grounding: `harness.ts`'s own `lifecycleBefore` emits a real, distinct
 * `fn: 'playLand'` trace line only for a Land typeLine going through the
 * ordinary (non-trigger/non-ability/non-activation) scenario path — an
 * effect that moves a land onto the battlefield some other way (a
 * `moveTo`/`custom` effect, e.g.) never emits it, so `scripts/
 * verify-synergy.mjs` can actually tell the two apart instead of trusting
 * an author's label.
 *
 * **Matching is UNCHANGED by this merge — deliberately deferred, not
 * redesigned here.** `factsInteract` still hard-partitions on
 * `isZoneFact(fact)` (now a plain structural classifier over this ONE
 * `Fact` type, not a type-narrowing union guard) before attempting a
 * match — a fact with any of `to`/`from`/`zone` present is still treated
 * as "zone-shaped," an `event`-only fact as "event-shaped," and the two
 * families still never match each other. A merged fact that now carries
 * BOTH `event` and `to`/`from` is classified into the zone-shaped family
 * ONLY — it no longer also satisfies an `event`-shaped want for the same
 * real-world concept the way its old separate EventFact half used to.
 * This is a real, accepted, DOCUMENTED regression for the specific facts
 * it hits (see this merge's own dated entry in SYNERGY_DESIGN.md and this
 * session's real pool-wide interactions diff) — not fixed here on
 * purpose; a real matcher redesign letting one fact satisfy both
 * shape-families' wants at once is tracked there as open future work.
 */
export interface Fact extends Constraints {
  role: 'source' | 'sink';
  /**
   * A named CR-recognizable occurrence — see this interface's own doc
   * comment. Independent of `to`/`from`; the two can freely co-occur.
   *
   * **Can be fully inert for matching/rendering on a fact that's ALSO
   * zone-shaped, and that's fine, not a bug** (2026-09-11, confirmed by
   * tracing every real consumer, not assumed): once `isZoneFact(fact)` is
   * `true` (any of `zone`/`to`/`from` present), `factsInteract`'s
   * shape-partition gate (`isZoneFact(p) !== isZoneFact(w)`) means the
   * `event` string is never even reached for comparison against an
   * event-shaped want, and `describeFact`'s own zone branch
   * (`zoneMovementName(from, to)`, a lookup by the `(from,to)` PAIR) never
   * reaches its own `event`-keyed label dispatch either — `self-enters`
   * (`{event:'entersBattlefield', to:'Battlefield', ...}`) is the real
   * example: its label "enters the battlefield" comes entirely from the
   * `(from,to)` lookup, not from this field, and its `event` string
   * currently produces zero real matches (confirmed: the 2 real
   * `event:'entersBattlefield'` sinks it used to match, Loporrit Scout and
   * Woodland Weavemaster, are lost via the shape-partition gate above,
   * before `event` string equality is ever checked — see
   * SYNERGY_DESIGN.md's "Fact unification" section).
   *
   * Kept anyway, deliberately, not dead weight to clean up: it's real,
   * accurate documentation of what the movement fundamentally IS (a CR-
   * recognizable named occurrence, not just an anonymous zone arrival),
   * and it's the exact field a future matcher-unification pass (tracked
   * as open work in SYNERGY_DESIGN.md) would read to recover those 2 lost
   * matches — removing it now would mean re-deriving "this is an
   * entersBattlefield occurrence" from scratch later, for zero savings
   * today.
   */
  event?: string;
  /** Legacy spelling of `to` (see this interface's own doc comment) — a SINK's plain state-presence check, or a pre-merge SOURCE fact's own destination. New facts should use `to` instead; `effectiveZone` still resolves either. */
  zone?: string;
  /** The zone a real movement or presence-check is INTO — see this interface's own doc comment. */
  to?: string;
  /** The zone a real movement is OUT OF, optional — see this interface's own doc comment (including the real `from`-with-no-`to` case). */
  from?: string;
  /**
   * On (almost) every event, the DOER — whoever's controller performs/causes
   * the event ("your damage" = damage YOU deal, "your sacrifice" = a
   * permanent YOU sacrifice). `lifeloss` is a real, documented EXCEPTION,
   * not covered by `recipient` below: it predates `recipient` (added
   * 2026-09-05 for kain-traitorous-dragoon/namazu-trader's own life
   * payments) and already uses `controller` to name who LOSES the life —
   * "each opponent loses life" is `lifeloss` + `controller:'opp'`, "you lose
   * 2 life" is `lifeloss` + `controller:'you'` — because a life payment has
   * no separate "doer" worth naming (the loser IS the one paying). Left
   * as-is deliberately (real cards — summon-primal-odin's own two facts —
   * already rely on this reading; migrating it to `recipient` is a real
   * re-authoring pass across the whole pool's existing `lifeloss` facts, out
   * of scope for the fix `recipient` itself was added for). Do not assume
   * this convention generalizes to any OTHER event without checking first.
   */
  controller?: Side;
  /** "The thing appearing in the `to` zone is THIS" — a legacy pairing with `zone`/`to` predating `target` below, but NOT superseded by it the way `zone` is superseded by `to`: `subject` is still the ONLY field `factsInteract`'s zone-matching branch (`resolveSubject(p.subject, ...)`) ever reads to resolve a producer's real static attributes for a type-constrained zone-shaped want — `target` is never consulted there. A merged fact that's genuinely self-referencing (see this card's own merged `dies` fact — folded from a `subject:'self'`-only ZoneFact half and a `target:'self'`-only EventFact half) needs BOTH, not either/or: `subject:'self'` so a real TYPE-CONSTRAINED zone-shaped want (e.g. "creature in graveyard") still resolves this card's own real types the way the old standalone ZoneFact did, and `target:'self'` for the EventFact-side self-reference `effectiveController`/an event-shaped consumer would otherwise read. Dropping `subject` on a fact merged from a `subject`-carrying half is a real, measurable regression (confirmed via this merge's own real `find-synergies.mjs` diff — see SYNERGY_DESIGN.md — 17 real type-constrained zone-shaped matches silently lost the first time this was tried without `subject`), not a harmless simplification; fixed by keeping both. A `sink` fact instead uses the `Constraints` fields above directly to describe what it's looking for. */
  subject?: Subject;
  /** `'self'` = this same object; a bare `Constraints` = "whatever this effect's own filter is" (a produce) or "whatever the consumer itself must satisfy" (a want, always paired with `target: 'self'` — see matcher). */
  target?: 'self' | Constraints;
  /**
   * Who RECEIVES this event, independent of `controller` (the dealer/doer)
   * — added because `event: 'damage'` had exactly one side named
   * (`controller`, always `'you'` across every real fact in the pool: "your
   * damage") with no way to say WHO that damage actually goes to. Bahamut's
   * own Mega Flare ("deals damage ... to each opponent") is the case that
   * surfaced this: before `recipient` existed the fact read as bare "your
   * damage," dropping the "to each opponent" half of the ability entirely.
   * Distinct from `target` on purpose — `target` is a `Constraints`-shaped
   * TYPE/CMC/etc. filter over PERMANENTS (`dies`/`putCounter`'s own use), not
   * a plain `Side` naming a PLAYER; damage-to-a-player has no type/cmc to
   * filter on, just a side. Optional — omitting it keeps the original
   * dealer-only reading ("your damage", direction unstated) for every
   * existing fact that predates this field; only newly-authored facts
   * (Bahamut's own, so far — this is fin/1-only, not a pool-wide migration)
   * set it. NOT the same convention as `lifeloss`'s own `controller`-as-
   * recipient special case above — keep the two separate, don't conflate
   * them into one "sometimes controller means recipient" rule.
   */
  recipient?: Side;
  /**
   * Purely descriptive (2026-09-11) — real CR 601.2c "target" language
   * (including "up to one target...", where real targeting rules like
   * hexproof/protection/shroud can matter and 0-or-1 is a real legal
   * outcome) vs. an unconditional broadcast to everyone/everything a
   * `target`/`recipient` bucket names, with no choice involved at all.
   * Motivating contrast, both real fin/1 (Summon: Bahamut) facts:
   * - `destroy-act`/`destroy-nonland` — oracle text: "Destroy up to one
   *   target nonland permanent." A real choice among legal candidates;
   *   `targeted: true`.
   * - `chapter-iv-damage` — oracle text: "...deals damage... to each
   *   opponent." No choice — it unconditionally hits every member of the
   *   `recipient: 'opp'` bucket; `targeted: false`.
   *
   * **Convention: only ever written when the axis is actually meaningful
   * for the fact — i.e. when `target`/`recipient` names a real bucket of
   * potential candidates (other permanents via a `Constraints` filter, or
   * a `Side` that can plurally include more than one player/permanent).**
   * `true` or explicit `false` both mean "this was reviewed against the
   * real oracle text." Omitted (not `false`) for a fact whose `target` is
   * simply `'self'`/whose only real "recipient" is the singular `you` —
   * `self-cast`, `self-enters`, `self-dies`, `self-sacrifice`,
   * `self-counters`, `chapter-iii-draw` — there is no bucket of candidates
   * to have chosen among OR broadcast to in the first place (the event
   * only ever happens to/for exactly one fixed thing), so "targeted" isn't
   * a real question for them, not an unreviewed one. Don't default this
   * to `false` for every fact that isn't `true` — that would misrepresent
   * "not applicable" as "reviewed and confirmed broadcast."
   *
   * **Purely informational — NOT consulted by `factsInteract`.** No sink
   * in the pool wants "only a targeted producer" or "only a broadcast
   * producer" today, so this adds self-explaining data to the JSON, not a
   * new matching dimension. If a real future card needs "must be a
   * targeted removal effect" as an actual want, that's a reason to wire
   * this into `factsInteract` deliberately then, not a reason to pretend
   * it's already load-bearing.
   */
  targeted?: boolean;
  /** Free-form event-specific fields a real card's own effect carries (Aerith's own `counterType: '+1/+1'`, e.g.) — not part of the fixed constraint vocabulary, matched by plain equality when both sides declare it. */
  counterType?: string;
  /**
   * `event: 'grantType'`'s own free-form detail — the type name being
   * granted (Dragoon's Lance's own "is a Knight in addition to its other
   * types" → `type: 'Knight'`; Magitek Armor's own Crew-triggered "becomes
   * an artifact creature" → `type: 'Creature'`, the ARTIFACT half omitted
   * since the Vehicle already is one — granting it again would be a
   * presence restatement, not a real new type). Matched by plain equality
   * (same treatment as `counterType`) — 2026-09-12, `scripts/verify-
   * synergy.mjs`'s own forward-evidence check for `grantType` now compares
   * this against the real `types` array a logged `fn:'animate'` trace line
   * carries, once a self-targeted `animate` effect backs the fact for
   * real (see that script's own `producedEvents`'s `case 'animate'`) —
   * Dragoon's Lance's own `grantType` facts predate this and stay
   * genuinely inert regardless (no execution path exists for a type grant
   * to ANOTHER permanent, only to `self`), still exempted by name in that
   * script.
   */
  type?: string;
  /**
   * `event: 'grantKeyword'`'s own free-form detail — the keyword name being
   * granted (Moogles' Valor's own "target creature gains indestructible" →
   * `keyword: 'Indestructible'`). Matched by plain equality (same treatment
   * as `counterType`/`type` above) — written pool-wide already (e.g.
   * `moogles-valor/synergy.json`) but previously only reachable via the
   * generic untyped-field fallback (`app/lib/factConditions.ts`'s own
   * `formatUnknown`), not a declared field on this interface; added
   * 2026-09-12 to close that typing gap, purely additive, no matching
   * behavior change (plain-equality fallback already worked the same way).
   */
  keyword?: string;
  /** `event: 'addMana'`'s own free-form detail — the color produced (card.ts's `Effect` `kind: 'addMana'`'s own `color` field, or a single-element `card.ts`'s `CardDefinition.manaAbilities`/`ManaAbility.colors` entry, formerly derived off a plain `"{T}: Add {X}."` static-ability string via a since-deleted `mana.ts` regex — see that field's own doc comment). Superseded by `colors` below for anything NEW (a plain string can't express a real choice-of-color ability as one matchable fact, only as display-equality) — kept only because 11 real single-color cards (Druid of the Cowl, Goobbue Gardener, Llanowar Elves, Midgar, Ishgard, Jidoor, Lindblum, Zanarkand, White Auracite, Willowrush Verge, Elvish Archdruid) already declare this field and migrating them is out of scope for the pass that added `colors` (2026-09-09) — still matched (by plain equality, same as `counterType`) for backward compatibility, and `factsInteract` also treats it as an implicit single-element `colors` set so it stays comparable against a `colors`-shaped want on the other side. */
  color?: string;
  /** `event: 'addMana'`'s own color-SET detail, added 2026-09-09 alongside `playLand` — reuses `TypeConstraint`'s exact `has`/`hasAny`/`not` vocabulary/matching (`satisfiesType`) rather than inventing a fourth constraint pattern, since "does the producer's color set satisfy the consumer's color need" is structurally the identical question `Constraints.types` already answers for card types. On a PRODUCE fact: which color(s) this ability can actually make — `hasAny` for a genuine choice-of-color ability (Vector, Imperial Capital's own "{T}: Add {B} or {R}." → `{hasAny:['B','R']}`, ONE fact instead of two `color:'B'`/`color:'R'` facts — it makes one of these per activation, never both at once, so `has` would misstate it as "makes both simultaneously"; a fixed single-color ability would use `{has:['G']}` if migrated). On a WANT fact: what color(s) the consumer needs — `has:['R']` for "needs R specifically," `hasAny:['W','U']` for "needs any of W or U," `not:['B']` for "needs any non-black source" — matched against the producer's own declared set (see `factsInteract`'s `colorSetOf`/`satisfiesType` reuse below), no separate matching code written for color. Coexists with `color` above (a legacy single-color fact) via the same `colorSetOf` helper, so a `colors`-shaped want still matches a `color`-shaped produce and vice versa. */
  colors?: TypeConstraint;
  /** `event: 'entersBattlefield'`'s own free-form detail — a real "enters the battlefield tapped" replacement (e.g. Vector, Imperial Capital's own "Vector, Imperial Capital enters tapped."). Same "documented free-form field, matched by plain equality when both sides declare it" treatment as `counterType`/`color` — no want declares one yet, so this is purely descriptive today. */
  tapped?: boolean;
  /**
   * Documentary only (2026-09-12, `the-wind-crystal`/fin-43's migration) —
   * this fact's own real effect is a temporary CR 611/702 duration
   * ("...until end of turn"), not a permanent/static one. Motivating gap:
   * a card like Craterhoof Behemoth's own "gain trample ... until end of
   * turn" and a permanent, always-on grant (Ardyn's own
   * `continuousKeywordGrants`-backed "Demons you control have menace") were
   * previously indistinguishable in the `Fact` data itself — both render as
   * a bare `grantKeyword` with no duration signal at all. Checked the whole
   * pool before adding this: several existing `grantKeyword`/`pump` facts
   * ARE genuinely until-end-of-turn on their own real oracle text (Craterhoof
   * Behemoth, Coral Sword, Restoration Magic's own three modes, Summon
   * Titan, Blitzball Shot, Squall/Seifer's own combat-trick modes, Moogles'
   * Valor, Circle of Power's own Wizard pump) but NONE of them set this
   * field yet — adding it there too is a real pool-wide authoring sweep,
   * out of scope for this task (scoped to fin/43 only); don't read their
   * omission as "these are permanent," just "not yet authored."
   *
   * **2026-09-12 follow-up sweep** (Moogles' Valor/fin-27 task): applied
   * retroactively to every other-that-day-migrated fin/1-50 card whose real
   * grant/pump/animate fact is genuinely until-end-of-turn — moogles-valor
   * (grantKeyword Indestructible), restoration-magic (all 4 grantKeyword
   * Hexproof/Indestructible facts across its Cure/Cura/Curaga tiers),
   * summon-choco-mog (pump), summon-knights-of-round (pump; its own
   * "put an indestructible counter" fact stays unset — that grant IS
   * permanent, counters don't wear off), summon-primal-garuda (pump +
   * grantKeyword Flying), magitek-armor (Crew's own grantType Creature
   * fact — the animate itself is temporary even though layers.ts's own
   * animate/LayerSet still tracks no duration, a separate pre-existing
   * engine gap, see magitek-armor/progress.json). Craterhoof Behemoth,
   * Coral Sword, Summon Titan, Blitzball Shot, Squall/Seifer, and Circle of
   * Power remain un-swept (outside fin/1-50 or not migrated that day) —
   * still "not yet authored," not "confirmed permanent."
   *
   * **Only ever written `true`, never `false`.** Same convention as
   * `targeted`'s own "only set when the axis is actually meaningful"
   * rule — a permanent/always-on grant doesn't get `untilEndOfTurn: false`
   * (that would misrepresent "not applicable" as "reviewed and confirmed
   * permanent"); it's simply omitted.
   *
   * **Purely informational — NOT consulted by `factsInteract`, and NOT
   * added to `themeOf`** (same treatment `targeted`/`zoneFrom`/`zoneTo`
   * already get). No sink in the pool wants "only a permanent grant" or
   * "only a temporary one" today; wire this into the matcher deliberately
   * if a real future card needs that as an actual want.
   */
  untilEndOfTurn?: boolean;
  /**
   * Documentary only (2026-09-12, Qiqirn Merchant/fin-65) — a real
   * board-state-COUNTED cost-reduction on THIS fact's own cost-payment act
   * (CR 601.2f/602.1, Forge's own `SVar:X:Count$Valid Town.YouCtrl` —
   * "This ability costs {1} less to activate for each Town you control").
   * `card.ts`'s `ActivationCostReduction` is the real engine-side mechanism
   * (`engine.ts`'s `effectiveActivationCost`, ENGINE_GAPS.md gap #7's third
   * example) — this field is purely self-explaining DATA on the fact, same
   * "documented gap, not silently assumed away" treatment `Constraints.tapped`
   * already establishes for Fate of the Sun-Cryst's own target-conditional
   * discount (a genuinely different real mechanism: keyed on a chosen
   * TARGET, not a board-state COUNT).
   *
   * **Purely informational — NOT consulted by `factsInteract`, and NOT
   * added to `themeOf`** (same treatment `targeted`/`untilEndOfTurn` already
   * get) — no sink in the pool wants "a cheaper activation" as a theme
   * today.
   */
  costReductionPerControlled?: { amountPerMatch: number; subtype: string };
  /** Documentary only — this event's own trigger/activation is capped to once per turn on the real card (e.g. Elrond's draw-per-activation), but nothing in state.ts/turn.ts enforces that cap yet (see progress.json's knownGaps). Not matched against anything.
   *
   * **Only ever set on the TRIGGER/condition side (a card's own real "this
   * ability triggers only once each turn" clause), never on the produced
   * EFFECT fact it fires** (2026-09-12, G'raha Tia/Venat correction —
   * both cards' own trigger AND their resulting `drawCard` produce fact
   * had this set, which double-counts the same real cap and implies the
   * trigger and its effect are linked data, which they explicitly aren't
   * yet — see `Fact`'s own doc comment on keeping trigger/effect facts
   * independent for now, no shared-cap linking mechanism exists). If this
   * ever needs cross-fact linking (a real payoff caring specifically
   * about a once-per-turn-capped trigger, not just its effect), that's a
   * deliberate future schema addition, not an accidental byproduct of
   * setting this field twice.
   *
   * **`triggeredBy` below (2026-09-16) is exactly that deliberate future
   * addition** — but it's still purely a NAMING link (which trigger),
   * not a cap-sharing mechanism; `oncePerTurn` itself stays independently
   * set per-fact as this paragraph already established, unchanged. */
  oncePerTurn?: boolean;
  /**
   * The name of the `Trigger` (`Trigger.name`, e.g. `'onEnter'`) whose own
   * CONDITION causes this fact's own effect — real motivating case:
   * Ultima, Origin of Oblivion's own "Whenever Ultima attacks..." trigger
   * causing its own `putCounter` produce fact (2026-09-16, causal-links
   * plumbing, coordinator-approved "do now" scope off that design
   * assessment). Normally set on the resulting EFFECT-side fact, naming
   * the trigger that fires it — setting it on the trigger-CONDITION fact
   * itself is mostly a tautology (that fact IS the named trigger already,
   * by construction), but not forbidden: `entersBattlefield-self-trigger-
   * structural.ts` sets it on its own condition-side sink fact too, purely
   * as a harmless grouping tag (so a future consumer can filter "every
   * fact belonging to this card's own trigger X" on the same key
   * regardless of which side of the relationship a given fact is on).
   *
   * **Purely informational — NOT consulted by `factsInteract`, and NOT
   * added to `themeOf`** (same treatment `targeted`/`untilEndOfTurn`/
   * `costReductionPerControlled`/`oncePerTurn` above already get). No sink
   * in the pool wants "only a trigger-caused fact" as a theme today; this
   * exists so a future consumer (a UI grouping a card's own facts by which
   * printed ability produced them, or a future matcher wanting to chain
   * "X satisfies this card's own trigger-condition sink, which fires THIS
   * card's own linked source too") has a real, structural link to read
   * instead of re-deriving it from prose.
   *
   * **Deliberately narrower than the full "effect enables effect" causal
   * graph the same design assessment also considered** (a `Fact.id` +
   * `causedBy: string[]` scheme linking arbitrary facts, including two
   * SIBLING effects within the same trigger where one gates the other) —
   * that fuller graph is explicitly NOT built here (deferred until the
   * combinator program-AST-walker matures — see `recognizers/program-ast-
   * walker.ts` — a much cheaper place to derive intra-program parent/child
   * links than retrofitting arbitrary `custom`-closure control flow,
   * which this model has no static way to read at all). `triggeredBy`
   * only ever names a TRIGGER (always has a stable `Trigger.name` to
   * reference), never another arbitrary fact.
   *
   * Populated by the 4 real trigger-condition recognizers that read
   * `RecognizerInput.triggers` directly (`dies-trigger-structural.ts`,
   * `lifegain-trigger-structural.ts`, `attacks-trigger-structural.ts`,
   * `entersBattlefield-self-trigger-structural.ts` — NOT this field itself;
   * see each one's own doc comment) is a SEPARATE, deferred step: this
   * field/the `EffectSource` plumbing (`recognizers/structural-effects.ts`)
   * exists now, but actually SETTING `triggeredBy` on the ~40 effect-side
   * recognizers' own emitted facts requires a real per-recognizer judgment
   * call (does this effect's own trigger genuinely match the SAME English
   * clause a sibling trigger-condition recognizer already fact-ified?) —
   * flagged as recognizer-lane follow-up work, not attempted pool-wide in
   * this same pass.
   */
  triggeredBy?: string;
  /**
   * See `AnnotationRef` — a real pointer into this fact's own owning face's
   * real printed text (oracle text body or type line). Computed ONCE,
   * offline, by `scripts/compute-annotations.mjs` from that card's own
   * `annotations-authoring.json` (NOT stored on the fact itself — see that
   * file's own header and `FactAnnotationAuthoring`'s doc comment below for
   * why: 2026-09-11, same day this field became required — once
   * `annotations` exists, the literal `sourceText`/`highlight` strings used
   * to compute it are pure duplication on the SERVED object, since the real
   * text is always re-derivable by slicing `oracleText`/`typeLine` at
   * `annotations[].line`/`.start`/`.end`; the authored strings still need
   * to live SOMEWHERE for regen/review, just not on this served shape).
   * Baked into the checked-in `synergy.json`; never hand-authored on this
   * object, never recomputed live server-side.
   *
   * **Required, minimum one entry** (hard invariant, not just true by
   * convention: every fact must carry at least one real annotation, i.e.
   * genuinely point at something the card's own owner actually prints,
   * whether that's the oracle text or the type line). A fact with literally
   * nothing real to anchor to (pure inferred game-rules knowledge with zero
   * card-specific textual basis, not even the type line) doesn't belong in
   * this model as a `Fact` at all — fold its signal into a fact that DOES
   * have real backing, or drop it, rather than inventing a synthetic/
   * decorative annotation just to satisfy this field's shape. Enforced for
   * real by `scripts/annotation-coverage.mjs` (`ANNOTATED_CARD_SLUGS` —
   * scoped to cards that have actually opted into the annotations model;
   * the rest of the pool hasn't been migrated yet and isn't held to this by
   * the runtime check, only by this type's own aspirational shape for any
   * NEW fact authored anywhere).
   */
  annotations: [AnnotationRef, ...AnnotationRef[]];
  /**
   * Which face of a multi-face card (transform/Adventure/etc.) this fact's
   * own ability actually lives on — `'front'` = the card's main
   * `CardDefinition` (the object this same file's `resolveSubject`/
   * `staticAttrsFor` already treat as `'self'`), `'back'` =
   * `CardDefinition.backFace` (see card.ts; also reused as the structural
   * vehicle for Adventure/Room/other two-named-half layouts, not just real
   * transforms — see e.g. ishgard-the-holy-see-faith-grief's own
   * definition.ts comment). Reuses the exact `'front'|'back'` vocabulary
   * `Scenario.face`/`SequenceStep.face` (harness.ts) already established,
   * rather than a numeric faces-array index, so a single `face` idea reads
   * the same way whether it's naming which face a SCENARIO exercises or
   * which face a FACT belongs to. AUTHOR-SET, like `annotations-authoring
   * .json`'s own `anchor` — deliberately NOT inferred from whether the
   * authored text happens to appear in one face's oracle text or the
   * other: that inference is exactly what broke for
   * `sidequest-catch-a-fish-cooking-campsite`'s own front-face upkeep-
   * trigger sink fact (2026-09-09) — its authored `sourceText` had a
   * trailing "..." never in the real oracle text, so it silently matched
   * NEITHER face. Omit only for a genuinely single-faced card — every fact
   * on a card whose `CardDefinition` declares a `backFace` should set this
   * explicitly (`'front'` included, not just `'back'`) so a consumer never
   * has to fall back to inference at all. Not matched against anything by
   * `factsInteract` — purely a rendering/grouping hint for a consumer
   * presenting a multi-face card's own facts split by face (see
   * `.claude/contracts/card-schema.md`).
   */
  face?: 'front' | 'back';
  /**
   * Which finite catalog entry produced this fact — omitted entirely for
   * every hand-authored fact in the pool today (an implicit, unmarked
   * "agent" default; nothing on disk has ever tagged agent-authored facts,
   * so there's no explicit `origin: 'agent'` case to represent), present
   * only on a fact a recognizer (`functional-model/recognizers/`,
   * `PRD_AUTOMATED_AUTHORING.md`) mechanically derived from the card's own
   * printed text. Same treatment as `AnnotationRef`/`Fact.annotations` —
   * a real, structured side-channel that rides ALONGSIDE a fact's actual
   * matching vocabulary (`event`/`to`/`from`/`target`/etc.) without forking
   * it: `factsInteract` never reads this field, two facts that are
   * otherwise identical still match/interact identically regardless of who
   * or what produced them, and `themeOf` (this file, above) does not add
   * it either — same "purely informational" bucket as `targeted`/
   * `untilEndOfTurn`/`costReductionPerControlled`/`oncePerTurn` already
   * establish.
   *
   * Unlike `Fact.annotations` (which needs a real derivation step —
   * `annotations-authoring.json` + `compute-annotations.mjs` — because a
   * human's authored intent has to be matched against real text after the
   * fact), a recognizer already knows its own verdict and its own matched
   * span at the moment it runs, so there is no separate
   * "provenance-authoring.json" file for this: `scripts/
   * apply-recognizers.mjs` builds this object directly from a recognizer's
   * own `RecognizedFact.provenance` (`functional-model/recognizers/
   * types.ts`) and bakes it straight into the fact object it appends to
   * `cards/<slug>/synergy.json`, same "computed once, checked in" treatment
   * `annotations` itself gets, just with one fewer intermediate file.
   *
   * `rule` is a plain `string`, not `recognizers/types.ts`'s own narrower
   * `RecognizerId` union — this file (the actual Fact vocabulary the engine
   * simulates against) deliberately does not import from `recognizers/`,
   * the same direction every other dependency between the two already
   * runs (recognizers import `Fact`/`AnnotationRef`/`toLineOffset` FROM
   * here, never the reverse) — widening the exhaustive catalog of real
   * recognizer names lives in `recognizers/types.ts`'s own `RecognizerId`,
   * which is still assignable into this field (a string-literal union is a
   * subtype of `string`).
   */
  provenance?: FactProvenance;
}

/**
 * See `Fact.provenance`'s own doc comment — `origin: 'parser'` is the only
 * real value today (nothing on disk marks agent-authored facts explicitly),
 * kept as a literal union of one rather than a bare `string` so a future
 * second non-agent origin (if one is ever needed) is a real, deliberate
 * type change here, not a silent typo risk.
 */
export interface FactProvenance {
  origin: 'parser';
  rule: string;
}

/**
 * Deprecated back-compat ALIASES for the pre-merge `ZoneFact`/`EventFact`
 * interfaces (removed 2026-09-11, folded into the one `Fact` interface
 * above) — kept as plain type synonyms, NOT separate shapes, purely so
 * other files that still import/annotate with these two names
 * (`app/lib/factConditions.ts` — card-owned, flagged rather than edited
 * here per this task's own "pool-wide-safe plumbing, don't need to touch
 * other files" scoping) keep compiling unchanged. Both are now literally
 * `Fact` — there is no narrower shape left to alias. New code should just
 * write `Fact`; these two names exist only to avoid an unrelated-file
 * edit sweep this specific task didn't need to make. A future
 * terminology-cleanup pass can retire them once every remaining
 * `ZoneFact`/`EventFact` reference elsewhere in the repo is updated to
 * `Fact` directly.
 */
export type ZoneFact = Fact;
export type EventFact = Fact;

/**
 * A pointer into a card's own real printed text, precise enough for a
 * renderer to slice the exact highlighted phrase without re-doing any
 * string search at render time (2026-09-11 — replaces the old
 * `annotateOracleText` design, which rebuilt a whole segment tree on
 * every server request; see SYNERGY_DESIGN.md's fact-model section and
 * `.claude/contracts/card-schema.md` for the full rationale — that
 * function and its `AnnotatedSegment`/`AnnotatedFactRef` shape have since
 * been deleted from this file, migration complete on both sides).
 *
 * Two variants, discriminated by `target` — a real, non-speculative second
 * kind added 2026-09-11 alongside `annotations` becoming required (see
 * `Fact.annotations`'s own doc comment): some facts genuinely have nothing
 * in the oracle text body to point at at all (a baseline "this creature was
 * cast"/"this permanent enters" claim licensed by the card's own printed
 * TYPE, not its ability text) — forcing those through the oracle-only
 * shape would mean either a fabricated oracle-text match or leaving
 * `annotations` empty, both of which the required-annotations invariant
 * now forbids. `target: 'name'` or other speculative targets are still NOT
 * added — `'typeLine'` is the one real case the pool has needed so far.
 *
 * - `{ target: 'oracle', line, start, end }` — `line` is 0-INDEXED within
 *   the OWNING FACE's own real `oracleText` string, split on `\n`
 *   (Scryfall's own paragraph breaks — one entry per printed line/ability).
 *   Which face is "owning" is `Fact.face` (`'front'`/`'back'`/omitted = the
 *   only face on a single-faced card). `start`/`end` are character offsets
 *   WITHIN THAT LINE ONLY (not the whole oracle text), half-open (`end`
 *   exclusive) — a consumer gets the exact phrase via
 *   `oracleText.split('\n')[line]!.slice(start, end)`. Chosen over
 *   whole-text offsets specifically so a consumer never has to also carry
 *   the line-splitting logic just to use these numbers.
 * - `{ target: 'typeLine', start, end }` — character offsets into the
 *   OWNING FACE's own real, single-line `typeLine` string (`CardDefinition
 *   .typeLine`/`.backFace.typeLine`, card.ts) directly — no `line` field at
 *   all, since a type line has no paragraph structure to index into (unlike
 *   `'oracle'`, there is exactly one "line," so naming it would be dead
 *   weight on every entry of this kind). A consumer slices via
 *   `typeLine.slice(start, end)`.
 *
 * An array, not a single ref, because one fact can legitimately annotate
 * more than one span (the same phrase appearing more than once in the
 * text, or several spans tied to different keywords in one ability) —
 * though the current computation (`computeFactAnnotations` below) only
 * ever produces zero or one, since it's derived from a single `highlight`
 * string against a single chosen target text. `annotations` itself is
 * REQUIRED with a minimum of one entry (`Fact.annotations`) — a fact whose
 * `sourceText`/`highlight` doesn't verifiably match its own real text (per
 * `anchor`) is now a hard authoring failure, not a silently-tolerated gap;
 * see `scripts/annotation-coverage.mjs`.
 */
export type AnnotationRef = { target: 'oracle'; line: number; start: number; end: number } | { target: 'typeLine'; start: number; end: number };

/**
 * Structural classifier — checks for the exact key names `zone`/`to`/`from`
 * presence, nothing more. Pre-merge (2026-09-11) this was a real
 * type-narrowing guard (`fact is ZoneFact`) over a `Fact = ZoneFact |
 * EventFact` union where the two shapes were mutually exclusive by
 * construction; now that `ZoneFact`/`EventFact` are both just aliases for
 * `Fact` itself (see `Fact`'s own doc comment), this is a plain boolean
 * classifier `factsInteract` uses to decide which matching family a fact
 * belongs to — a fact CAN satisfy both `isZoneFact` and `isEventFact` at
 * once now (e.g. a merged `dies` fact with real `to`/`from` AND an
 * `event` key), which was structurally impossible before the merge.
 * Plain `boolean` return (not a type predicate) since there's no longer a
 * narrower type to narrow TO — every caller already has `fact: Fact`,
 * which already has every field this checks.
 */
export function isZoneFact(fact: Fact): boolean {
  return 'zone' in fact || 'to' in fact || 'from' in fact;
}

/** The zone a fact is actually "about," regardless of which field name authored it — a sink's (or a legacy source's) `zone`, or a rework-shaped source's own `to`. `factsInteract`/`describeFact`/`themeOf` all resolve through this single choke point rather than each re-deriving the `zone ?? to` fallback separately. Can be `undefined` for a real, valid fact now (2026-09-11 merge) — a `from`-only fact (e.g. `self-cast`'s own `from:'Hand'`, no `to` since the real destination is the deliberately-invisible Stack — see `Fact`'s own doc comment) is genuinely zone-shaped (has `from`) but has no actual "current zone" to name; every caller below already guards for this rather than assuming a non-`undefined` result. */
function effectiveZone(fact: Fact): string | undefined {
  return fact.zone ?? fact.to;
}

/** See `isZoneFact`'s own doc comment — same "no longer a narrowing guard, plain boolean, kept for other files' back-compat naming" treatment, now over the same one `Fact` type. */
export function isEventFact(fact: Fact): boolean {
  return 'event' in fact;
}

/** On-disk shape of cards/<slug>/synergy.json — role is implied by which array a fact sits in, so it's omitted from the stored data and reattached on load (see `loadCardFacts` in scripts/find-synergies.mjs and scripts/verify-synergy.mjs). AI-authored, tracked in git, never derived by script — see this file's own header. */
export interface SynergyFile {
  source: Omit<Fact, 'role'>[];
  sink: Omit<Fact, 'role'>[];
}

/**
 * One fact's worth of human/AI-authored intent for `scripts/
 * compute-annotations.mjs` to turn into a real `Fact.annotations` entry —
 * `sourceText`/`highlight`/`anchor` used to live directly on the `Fact`
 * object itself; moved out here 2026-09-11 alongside `annotations` becoming
 * required, per explicit user ask: once a fact has a real baked
 * `annotations` pointer, the literal text is fully re-derivable by slicing
 * `oracleText`/`typeLine` at that pointer, so storing the string TOO on the
 * served object is pure duplication (this session's running "facts should
 * be as short as possible" theme). This shape is the input to that
 * derivation, not itself served anywhere.
 *
 * - `sourceText` — a short verbatim (or near-verbatim) snippet of the
 *   card's own real text (which text depends on `anchor`) this fact was
 *   derived from. Must be a genuinely verbatim substring of that real text
 *   — `computeFactAnnotations` verifies this and, since `Fact.annotations`
 *   is required, a `sourceText`/`highlight` pair that doesn't verifiably
 *   match is a HARD FAILURE for an opted-in card (see
 *   `scripts/annotation-coverage.mjs`), not silently tolerated.
 * - `highlight` — the exact substring of `sourceText` that names THIS fact
 *   specifically (AI-authored per fact, NOT derived by a generic
 *   per-event-kind regex — see the pre-2026-09-11 `Fact.highlight` doc
 *   comment in git history for the full "why not a regex" rationale, still
 *   accurate here, just relocated).
 * - `anchor` — which of the card's own real printed text fields to match
 *   against: `'oracle'` (default, omit for this case) = this face's own
 *   oracle text body; `'typeLine'` = the face's own printed type line
 *   (e.g. `"Enchantment Creature — Saga Dragon"`) — for a fact whose real
 *   textual basis genuinely isn't in the ability text at all (Summon:
 *   Bahamut's own `self-cast`/`self-enters` are the cards that forced
 *   this: a baseline "this creature was cast as a creature spell"/"this
 *   permanent enters the battlefield" claim is true because of what's
 *   PRINTED ON THE TYPE LINE, not the oracle-text body).
 * - `line` — (2026-09-13, closes a real, previously-admitted gap — see the
 *   git history of this doc comment / `rawHighlightRange`'s pre-fix version
 *   for the original "not resolved" wording) an optional 0-indexed line
 *   number (`oracleText.split('\n')[line]`, same convention `AnnotationRef
 *   .line` already uses) that, when present, scopes `rawHighlightRange`'s
 *   own `sourceText`/`highlight` search to ONLY that one physical line of
 *   the anchored text, rather than the whole multi-line blob. Plain
 *   substring search (`indexOf`) has no way to tell apart two genuinely
 *   different real occurrences of the same (or a same-prefixed) phrase on
 *   DIFFERENT lines of the same card — `line` eliminates that class of
 *   ambiguity outright rather than relying on every phrase happening to be
 *   unique pool-wide. Omit for the old, still-supported whole-text search
 *   (every `annotations-authoring.json` authored before this field existed
 *   keeps working unchanged — `compute-annotations.mjs` doesn't require
 *   `line` on anything).
 *
 * Failure modes, and which stay silent vs become loud (2026-09-14, closes a
 * real silent-authoring-bug gap — see `rawHighlightRange`'s own doc
 * comment): no `highlight` at all, a `line` index that doesn't exist in the
 * text, or a `sourceText` not found anywhere it's searched (whole-text, or
 * scoped to the named `line`) are all legitimate "this anchor doesn't
 * resolve" cases and stay silent (`undefined`) — a stale/renumbered
 * `line`, a `sourceText` that no longer appears verbatim after an errata,
 * or simply no authoring entry yet. But once the anchor DOES resolve (a
 * valid `line`, and — when given — a `sourceText` genuinely found within
 * it) and `highlight` STILL isn't found as a substring of that
 * already-resolved text, that's not "nothing to anchor to" — the author
 * pointed at real, existing text and then typo'd/staled the one substring
 * meant to name the fact within it. `rawHighlightRange` throws a real
 * `Error` for exactly this case instead of returning `undefined` — see
 * that function's own doc comment for why this can't share the same
 * silent-return contract as the other failure modes above.
 */
export interface FactAnnotationAuthoring {
  anchor?: 'oracle' | 'typeLine';
  /**
   * Required when `line` is omitted (the original whole-text-search mode,
   * where this is the only thing narrowing the match before `highlight` is
   * found within it). Optional when `line` is set — `line` already narrows
   * the search to one physical line, so a separate `sourceText` is only
   * useful there as EXTRA within-line narrowing (e.g. the same `highlight`
   * substring appearing twice on that one line), not required for
   * disambiguation the way it was before.
   */
  sourceText?: string;
  highlight: string;
  line?: number;
}

/**
 * On-disk shape of `cards/<slug>/annotations-authoring.json` — checked in
 * (so the authored intent survives, reviewable in git history, re-runnable
 * if oracle text or `compute-annotations.mjs`'s own matching logic ever
 * changes) but never read by `loadCardSynergy`/served in the API response,
 * and never read by `find-synergies.mjs`/`verify-synergy.mjs`'s own
 * matching/reconciliation logic — its ONLY reader is `scripts/
 * compute-annotations.mjs`. POSITIONALLY aligned with that same card's
 * `synergy.json` `source`/`sink` arrays (index i here authors index i
 * there) — index-based, not a stable id-keyed map, because facts no longer
 * carry a stable `id` to key off (removed 2026-09-11, same day) — reordering
 * facts in `synergy.json` without also reordering this file will silently
 * misalign the two, so keep them in lockstep when editing either. `null` at
 * a given index = "no sourceText/highlight authored for this fact" (the
 * same tolerance the old inline optional fields had — not every fact needs
 * one, though every OPTED-IN card's fact does still need a resulting
 * `annotations` entry one way or another, per that field's own required-
 * ness — see `Fact.annotations`'s doc comment for the "fold it or drop it"
 * alternative when a fact truly has nothing to anchor to).
 */
export interface AnnotationAuthoringFile {
  source: (FactAnnotationAuthoring | null)[];
  sink: (FactAnnotationAuthoring | null)[];
}

// ---------------------------------------------------------------------------
// Static attribute resolution — a produce's `subject` (or a want's own
// implicit subject, the card itself) resolves to real CardDefinition/token
// attributes at MATCH time, never stored redundantly on the fact itself
// (SYNERGY_DESIGN.md: "Static card properties ... are NOT stored in facts").

export interface StaticAttrs {
  name: string;
  types: string[];
  cmc?: number;
  power?: number;
  toughness?: number;
}

/** The minimal shape a token definition needs for attribute resolution — `token-cards/<slug>/definition.ts` exports something at least this wide (see SYNERGY_DESIGN.md's "Tokens" section); not the full `TokenDefinition` shape (which also carries triggers/activated/keywords) since the matcher only ever reads static attributes off it. */
export interface TokenLike {
  name: string;
  typeLine: string;
  pt?: [power: number, toughness: number];
  cmc?: number;
}

/**
 * Real type line shape: "Supertype(s) Type(s) — Subtype(s)" (205.3a-c) —
 * everything after the em-dash is the real subtype list, space-separated;
 * "Legendary" is folded in as a plain type WORD the same pragmatic way
 * harness.ts's own `typesFromTypeLine`/`subtypesFromTypeLine` already do
 * (hasSubtype('Legendary') throughout this corpus, no real supertype field
 * anywhere in this model) — kept as a small local duplicate here rather than
 * imported from harness.ts, so this file stays free of harness.ts/state.ts's
 * runtime weight (see this file's own header).
 */
function typeWordsFromTypeLine(typeLine: string): string[] {
  const words: string[] = [];
  if (/\bCreature\b/.test(typeLine)) words.push('Creature');
  if (/\bArtifact\b/.test(typeLine)) words.push('Artifact');
  if (/\bEnchantment\b/.test(typeLine)) words.push('Enchantment');
  if (/\bLand\b/.test(typeLine)) words.push('Land');
  if (/\bPlaneswalker\b/.test(typeLine)) words.push('Planeswalker');
  if (/\bInstant\b/.test(typeLine)) words.push('Instant');
  if (/\bSorcery\b/.test(typeLine)) words.push('Sorcery');
  const subtypes = typeLine.split('—')[1]?.trim().split(/\s+/).filter(Boolean) ?? [];
  words.push(...subtypes);
  if (/\bLegendary\b/.test(typeLine)) words.push('Legendary');
  return words;
}

export function staticAttrsFor(card: CardDefinition | TokenLike): StaticAttrs {
  return {
    name: card.name,
    types: typeWordsFromTypeLine(card.typeLine),
    cmc: card.cmc,
    power: card.pt?.[0],
    toughness: card.pt?.[1],
  };
}

/**
 * Resolves a `Subject` against the card the fact belongs to, or a token
 * registry for `{token}`. An OMITTED `subject` is deliberately NOT the same
 * as `'self'` — Gaius van Baelsar's own "each player sacrifices a
 * creature" produces `{zone:'Graveyard', controller:'you'}` with no
 * `subject` at all, because what lands in the graveyard is whichever
 * creature got sacrificed, not Gaius himself; resolving that to Gaius's own
 * attrs would wrongly let a type-constrained want (Fight On!'s own "wants
 * Graveyard CREATURES") match him even when the actual sacrificed object's
 * type is unknown. Returns undefined for both "no subject declared" and "a
 * {token} subject this registry doesn't (yet) know about" (before
 * token-cards/<slug>/ has been authored — see SYNERGY_DESIGN.md's "Tokens"
 * section: "the token-cards/ folder grows on demand") — either way, a caller
 * asking "what are its static attrs" gets "unknown," which the matcher
 * already treats as "matches only an unconstrained want" (see
 * `factsInteract`'s own `hasAnyConstraint` check).
 */
export function resolveSubject(subject: Subject | undefined, ownCard: CardDefinition, tokens: Record<string, TokenLike>): StaticAttrs | undefined {
  if (subject === 'self') return staticAttrsFor(ownCard);
  if (subject === undefined) return undefined;
  const token = tokens[subject.token];
  return token ? staticAttrsFor(token) : undefined;
}

// ---------------------------------------------------------------------------
// Constraint evaluation

/** The real, enumerable set of colors an `addMana` fact's own PRODUCE side carries — flattens `colors` (both `has` and `hasAny`, since either just enumerates what the ability can make) and falls back to the legacy singular `color` as a one-element set, so a `colors`-shaped want still matches a `color`-shaped produce (and vice versa — see `factsInteract`). `undefined` only when neither field is declared at all (an addMana fact authored before either existed). */
function colorSetOf(fact: EventFact): string[] | undefined {
  if (fact.colors) return [...(fact.colors.has ?? []), ...(fact.colors.hasAny ?? [])];
  if (fact.color) return [fact.color];
  return undefined;
}

function satisfiesType(types: string[], c: TypeConstraint | undefined): boolean {
  if (!c) return true;
  if (c.has && !c.has.every((t) => types.includes(t))) return false;
  if (c.hasAny && !c.hasAny.some((t) => types.includes(t))) return false;
  if (c.not && c.not.some((t) => types.includes(t))) return false;
  return true;
}
function satisfiesNum(value: number | undefined, c: NumConstraint | undefined): boolean {
  if (!c) return true;
  if (value === undefined) return false;
  if (c.min !== undefined && value < c.min) return false;
  if (c.max !== undefined && value > c.max) return false;
  if (c.eq !== undefined && value !== c.eq) return false;
  return true;
}
function satisfiesName(value: string | undefined, c: NameConstraint | undefined): boolean {
  if (!c) return true;
  return value === c.eq;
}

/** Every constraint field on `c` must hold against `attrs` — an absent field on `c` is vacuously satisfied (SYNERGY_DESIGN.md's "grow only when a real card forces it" — an unconstrained fact matches anything). */
export function satisfiesConstraints(attrs: StaticAttrs, c: Constraints): boolean {
  return satisfiesType(attrs.types, c.types) && satisfiesNum(attrs.cmc, c.cmc) && satisfiesNum(attrs.power, c.power) && satisfiesNum(attrs.toughness, c.toughness) && satisfiesName(attrs.name, c.name);
}

function sidesCompatible(a: Side | undefined, b: Side | undefined): boolean {
  return !a || !b || a === b;
}

/**
 * A fact that references `'self'` (a produce's `subject`, or an event's own
 * `target: 'self'`) is implicitly about the CASTER's own side even when
 * `controller` itself is omitted (SYNERGY_DESIGN.md's own Aerith facts #4/
 * #5/#7/#8 all omit `controller` — "puts counters on ITSELF" has no other
 * sensible side). Without this, a fully-omitted-controller fact would fall
 * back to `sidesCompatible`'s wildcard and wrongly match an OPPONENT-side
 * effect (Braska's Final Aeon's own chapter III forces an opponent's
 * creature to die — that must never satisfy another card's own "I want to
 * die" want just because both facts happen to omit `controller`). A fact
 * that references nothing self-shaped (Overkill's own unconstrained
 * `{event:'dies'}`, e.g.) keeps the true wildcard.
 */
function effectiveController(fact: Fact): Side | undefined {
  if (fact.controller) return fact.controller;
  // Checks BOTH `subject`/`target` unconditionally (2026-09-11, once
  // ZoneFact/EventFact merged into one `Fact`) — these two fields used to
  // be mutually exclusive by construction (a ZoneFact only ever declared
  // `subject`, an EventFact only ever `target`), so branching on
  // `isZoneFact` picked the right one for free. Now that a merged fact can
  // carry either, or only one for its own reasons (e.g. `self-cast` has
  // `target:'self'` but no `subject` at all, despite ALSO being classified
  // zone-shaped by `isZoneFact` once it carries a real `from`), gating on
  // `isZoneFact` would silently stop recognizing a real self-reference —
  // checking both unconditionally is the correct fix for that, not a
  // `factsInteract` matching-semantics redesign (this helper only ever
  // decided "is this fact implicitly about the caster's own side," never
  // which zone/event branch to run).
  return fact.subject === 'self' || fact.target === 'self' ? 'you' : undefined;
}

function constraintsOf(fact: Constraints): Constraints {
  const { types, cmc, power, toughness, name } = fact;
  return { types, cmc, power, toughness, name };
}
function hasAnyConstraint(c: Constraints): boolean {
  return !!(c.types || c.cmc || c.power || c.toughness || c.name);
}

// ---------------------------------------------------------------------------
// The matcher (SYNERGY_DESIGN.md "Step 6 — matcher")

export interface PoolCard {
  name: string;
  card: CardDefinition;
  source: Fact[];
  sink: Fact[];
}

export type SelfInteractionKind = 'same-instance' | 'second-copy' | 'second-copy-legendary';

export interface InteractionMatch {
  card: string;
  /** Present only when `card` names THIS SAME card — the pair (A, A), computed and kept like any other match, never dropped (SYNERGY_DESIGN.md "Self-interactions"). */
  selfInteraction?: SelfInteractionKind;
  /** Identifies exactly which fact on `card` this match satisfied, distinct from `mine`'s own fact on `InteractionGroup`. Used by `server/api/graph-links.ts` to group every match pointing at the SAME sink fact (possibly from many different producer cards) for its own supply-side normalization. Computed via `factIdentity` (below) — there is no longer a per-fact `id` field (removed 2026-09-11, facts are short enough now that stable identity across regen/diffing isn't needed; see `SYNERGY_DESIGN.md`), so this is always derivable and never `undefined` in practice, but stays optional in the type since nothing requires it. */
  theirFactId?: string;
}

export interface InteractionGroup {
  /** Which side of this fact `cardName` is on — `'source'` means this card provides the thing, `'sink'` means it benefits from it. */
  direction: 'source' | 'sink';
  fact: Fact;
  /** The set of attributes this fact actually constrains (SYNERGY_DESIGN.md: "Derivable from the fact; no labels in the data layer") — `['zone','controller','types']` for a type-gated zone want, `['event']` for a bare "lifegain" hook, etc. */
  theme: string[];
  description: string;
  matches: InteractionMatch[];
}

/** The ONLY fact-identity convention now that `Fact.id` is gone (removed
 * 2026-09-11 — see `ZoneFact`/`EventFact`'s own former doc comments in git
 * history and `SYNERGY_DESIGN.md`'s fact-model section): `role` + this
 * fact's own rendered `describeFact` label + its first real `annotations`
 * entry (stringified) — NOT `sourceText` (also removed from the served
 * `Fact` shape the same day, once `annotations` itself became the required,
 * real anchor — see `Fact.annotations`'s own doc comment). `annotations[0]`
 * is a strictly BETTER disambiguator than `sourceText` ever was: it's
 * guaranteed present (the field is required, minimum one entry) and
 * exact-position-precise, where `sourceText` was only ever a same-string
 * coincidence check. Two facts sharing `role`+label+the exact same
 * annotation position would also look identical to a human reading the
 * Facts table anyway, so nothing is lost by treating them as the same
 * identity. Mirrors the card page's own `factKey`
 * (`app/pages/app/card/[set]/[number].vue`) — keep the two in sync if
 * either changes. */
function factIdentity(fact: Fact): string {
  // `annotations` is required by the TYPE, but only summon-bahamut's
  // on-disk synergy.json actually carries it so far (pool-wide migration
  // is separate, later work) — every other card's real JSON simply lacks
  // the field despite what the type promises, so this must tolerate
  // `undefined` at runtime or every cross-card interaction lookup
  // 500s (confirmed live, 2026-09-11).
  return `${fact.role}::${describeFact(fact)}::${JSON.stringify(fact.annotations?.[0])}`;
}

function factKind(fact: Fact): string {
  return isZoneFact(fact) ? `zone:${effectiveZone(fact)}` : `event:${fact.event}`;
}

/** Theme = the set of attributes a want (or a produce's own filter) actually constrains — no separate label vocabulary, just which fields are present. */
export function themeOf(fact: Fact): string[] {
  const theme = [factKind(fact).split(':')[0]!];
  if (fact.controller) theme.push('controller');
  if (fact.types) theme.push('types');
  if (fact.cmc) theme.push('cmc');
  if (fact.power) theme.push('power');
  if (fact.toughness) theme.push('toughness');
  if (fact.name) theme.push('name');
  if (isEventFact(fact) && fact.counterType) theme.push('counterType');
  if (isEventFact(fact) && (fact.color || fact.colors)) theme.push('color');
  if (isEventFact(fact) && fact.tapped) theme.push('tapped');
  return theme;
}

/** Override for the bare "<zone> presence" phrase on a zone fact — Exile's own default reads as "exile presence" otherwise, which says nothing about where the thing came from; in this pool an Exile fact is always something leaving the battlefield, so name that instead. Applies regardless of `controller` or a `types`/`cmc` qualifier — see `describeFact`'s own doc comment. */
const ZONE_PRESENCE_PHRASE: Record<string, string> = {
  Exile: 'exile from battlefield',
};

/**
 * The friendly, human-readable name for a SOURCE `ZoneFact`'s own real
 * `(from, to)` movement — a pure DISPLAY/derivation layer on top of the
 * authoritative `from`/`to` data (`ZoneFact`'s own doc comment, 2026-09-11
 * rework), never the reverse: nothing here is read by `factsInteract` or
 * any other matching code, only by `describeFact` (and, per this rework's
 * own task brief, directly consumable by the `card` agent's Facts-tab
 * rendering too, without needing to re-derive it independently — exported
 * as plain data rather than folded silently into `describeFact`'s own
 * control flow).
 *
 * Deliberately narrow — grow only when a real card's own fact needs a
 * movement this table doesn't already name, same "grow only when a real
 * card forces it" discipline `TypeConstraint`/the constraint vocabulary
 * above already follows. The two entries here are exactly what Summon:
 * Bahamut's own facts need:
 *  - `from: undefined, to: 'Battlefield'` → "enters the battlefield" — any
 *    origin (cast from hand, fetched, blinked back — CR doesn't
 *    distinguish for this purpose).
 *  - `from: 'Battlefield', to: 'Graveyard'` → "dies" — CR 700.4: an object
 *    that's put into a graveyard from the battlefield is CONSIDERED to
 *    have died, regardless of what caused it (destruction, sacrifice, -X/-X,
 *    state-based action, ...) — since a `ZoneFact` always describes a
 *    persistent OBJECT (never a player), anything real moving
 *    battlefield → graveyard already satisfies "permanent," so no separate
 *    type/target constraint is needed to disambiguate this one from, say,
 *    a nonpermanent card merely being put into a graveyard some other way
 *    (that would never have `from: 'Battlefield'` in the first place).
 *
 * Any `(from, to)` pair not listed here NEVER falls back to bare "<to>
 * presence" phrasing either (real bug, fixed 2026-09-11: `describeFact`
 * used to let an unnamed movement fall through to the generic sink-style
 * presence phrase even when the fact had a real `from` — caught live on
 * Ambrosia Whiteheart's own `{to:'Hand', from:'Battlefield'}` bounce fact
 * rendering as "Hand presence"). The user's own standing rule: "there
 * should be no presence in sources (only in sinks), sources — only zone
 * movements." `describeFact` itself now enforces this structurally for
 * any SOURCE fact with a real `to` — an unnamed pair gets a generic-but-
 * honest "moves to X (from Y)" phrase instead, never presence wording.
 * This table's own job stays exactly what its doc comment already says:
 * grow it with a real, specific, friendlier name as real cards need one —
 * `bounce` (Ambrosia Whiteheart's Battlefield→Hand) and `tutor` (Cloud,
 * Midgar Mercenary's real full-library search AND Ashe, Princess of
 * Dalmasca's real look-top-5-take-1 dig — genuinely different mechanisms,
 * see each card's own real oracle text, but this table only keys on
 * `(from, to)`, not the effect kind, so one honest shared word that
 * doesn't overclaim "searched the whole library" for Ashe's own
 * top-5-only dig is the correct shared choice here (user's own naming
 * call, 2026-09-11 — renamed from an earlier "found," same reasoning,
 * different word), not a missed distinction) are exactly this: real names
 * added because real cards needed them, not a speculative full mapping of
 * every possible zone pair.
 *
 * `regrowth` (Graveyard→Hand) added 2026-09-11, later still, for Delivery
 * Moogle's own real "search your library and/or graveyard for an artifact
 * card ... put it into your hand" — a genuine "and/or" choice between TWO
 * distinct origins, modeled as two separate source facts (`Library→Hand`,
 * already named `tutor`, and this new `Graveyard→Hand` pair), not one fact
 * with an ambiguous/omitted `from`, since the real oracle text names both
 * zones explicitly rather than leaving the origin unspecified. Named after
 * the classic reprinted sorcery Regrowth ("Return target card from your
 * graveyard to your hand") — same "borrow the short, common MTG term for
 * the effect archetype" convention `tutor` (Demonic Tutor) already
 * established, not an invented word; this project's own `card.ts` already
 * uses the broader neighboring term `graveyard-recursion` for a DIFFERENT
 * concept (casting FROM the graveyard via an alternate cost, not returning
 * a card TO hand), so `regrowth` — the narrower, standard term for
 * specifically a graveyard-to-hand return — was picked instead of
 * reusing/overloading that existing, differently-scoped term.
 *
 * `reanimate` (Graveyard→Battlefield) added 2026-09-12 for Phoenix Down's
 * own real "Return target creature card ... from your graveyard to the
 * battlefield tapped" — the first pool card to put a card FROM the
 * graveyard directly onto the battlefield (checked: zero prior `(from:
 * 'Graveyard', to: 'Battlefield')` facts anywhere in the pool before this
 * one). Named after the classic MTG effect archetype (Reanimate, Animate
 * Dead, etc.), same "borrow the short, common term" convention `tutor`/
 * `regrowth` already established, not an invented word.
 */
export const ZONE_MOVEMENT_NAMES: ReadonlyArray<{ from?: string; to: string; name: string }> = [
  { to: 'Battlefield', name: 'enters the battlefield' },
  { from: 'Battlefield', to: 'Graveyard', name: 'dies' },
  { from: 'Battlefield', to: 'Hand', name: 'bounce' },
  { from: 'Library', to: 'Hand', name: 'tutor' },
  { from: 'Graveyard', to: 'Hand', name: 'regrowth' },
  { from: 'Graveyard', to: 'Battlefield', name: 'reanimate' },
  // The Water Crystal/fin-85 (2026-09-12) — its own real "{4}{U}{U}, {T}:
  // Each opponent mills..." activated ability is the first real card in
  // the pool with a Library->Graveyard fact (checked: zero prior facts
  // with this exact `(from, to)` pair before this one) — named after the
  // real MTG term ("mill" is itself Comprehensive Rules glossary
  // vocabulary, not a colloquialism — same "real, not invented" bar
  // `dies`/`tutor`/`reanimate` above already meet), not an invented word.
  { from: 'Library', to: 'Graveyard', name: 'mill' },
];

/** Looks up `ZONE_MOVEMENT_NAMES` for a specific `(from, to)` pair — `from: undefined` in a table entry means "matches any origin, including a real declared one" only when the fact ITSELF also omits `from` (an entry that only cares about `to` would be a different, broader kind of rule this table doesn't need yet — see its own doc comment's "grow only when forced" discipline). Returns `undefined` (not a fallback string) when nothing matches, so callers can tell "no friendly name yet" apart from "the name is itself falsy." */
export function zoneMovementName(from: string | undefined, to: string): string | undefined {
  return ZONE_MOVEMENT_NAMES.find((m) => m.to === to && m.from === from)?.name;
}

/**
 * Human-readable text for a fact — the Interactions panel's own `description`
 * field, parsed straight off the same structured fields the matcher itself
 * reads (no separate hand-written label table to keep in sync).
 *
 * Deliberately BARE, single-dimensional: a label is just the fixed category
 * noun/phrase for the fact's own zone/event kind — "battlefield presence",
 * "dying", "damage", "graveyard presence" — and nothing else. Neither WHO
 * (`controller`/`recipient` — you/an opponent/either player) NOR WHAT KIND
 * (a `types`/`cmc` constraint on the fact's own fields, or on an event
 * fact's own `target` filter — e.g. a `dies` fact with
 * `target:{types:{not:['Land']}}}`) is rendered into this string, even
 * though both stay real, intact, readable data ON the fact object. A
 * consumer wanting that detail (the card page's own conditions/notes
 * column, `app/lib/factConditions.ts`) reads `controller`/`recipient`/
 * `target` directly instead of parsing this label. (2026-09-10: reverts an
 * earlier same-day pass that briefly baked "your"/"opponent's"/"either
 * player's" prefixes and type-derived nouns like "nonland permanent" into
 * these same labels — see git history for that intermediate shape; user
 * decision was that ALL such detail belongs in the notes column, not the
 * label, full stop.)
 *
 * Formerly-deliberate exception, now closed (2026-09-10, same pass as the
 * rest of this file's bare conversion): a QUALIFIED zone fact (a `types`/
 * `cmc` constraint on the fact's own top-level fields, as opposed to an
 * EVENT fact's separate `target` filter) used to render its type and
 * control the way real oracle text does ("creature cards in your
 * graveyard", "creature permanents you control on the battlefield"). That
 * was flagged as inconsistent with every other branch's bare treatment and
 * is now collapsed the same way: a qualified zone fact renders the exact
 * same bare "<zone> presence" as an unqualified one. `constraintBits`/
 * `ZONE_NOUN` (the helpers this used) are dead now that no branch consumes
 * them — left removed rather than kept around unused. The `types`/`cmc`
 * constraint stays real, intact data on the fact; `app/lib/factConditions.ts`
 * (card-owned) already renders it generically via its own
 * `constraintPhrases`, independent of which `describeFact` branch produced
 * the label.
 *
 * **2026-09-11 exception, deliberately real (not a wording nicety):** a
 * SOURCE zone-change fact (`ZoneFact.to`/`from` — see its own doc comment)
 * DOES get a distinct, named label ("dies", "enters the battlefield")
 * instead of the generic bare "<zone> presence" every other zone fact
 * still gets — this isn't the same kind of qualifier this function
 * otherwise refuses to fold in (WHO/WHAT-KIND), it's naming WHICH EVENT
 * the fact IS, which the bare zone/event vocabulary genuinely has no other
 * way to say (a zone fact has no `event` field to speak through). See
 * `zoneMovementName`/`ZONE_MOVEMENT_NAMES` immediately above.
 *
 * **Real bug fixed 2026-09-11, same day:** this SOURCE branch used to fall
 * all the way through to the generic "<zone> presence" phrasing below
 * whenever `zoneMovementName` didn't recognize the `(from, to)` pair yet —
 * even when the fact had a real `from` populated, i.e. was structurally a
 * genuine movement, not presence (caught live on Ambrosia Whiteheart's own
 * `{to:'Hand', from:'Battlefield'}` bounce fact rendering as "Hand
 * presence"). Per the user's own standing rule ("sources are only zone
 * movements, never presence — that's a sink-only concept"), a SOURCE fact
 * with a real `to` now NEVER reaches the presence line below, structurally,
 * not just for the pairs `ZONE_MOVEMENT_NAMES` happens to name today — an
 * unnamed real movement gets a generic-but-honest "moves to X (from Y)"
 * (or bare "moves to X" with no known origin) instead, so this holds for
 * any FUTURE unnamed pair too, not just the ones patched case-by-case here.
 */
export function describeFact(fact: Fact): string {
  if (isZoneFact(fact)) {
    // A SOURCE fact with a real (from,to) movement (2026-09-11 rework —
    // see `Fact`'s own doc comment) is ALWAYS a movement, never presence
    // (this branch's own doc comment above) — name it via `zoneMovementName`
    // when a friendly name exists ("dies", "enters the battlefield",
    // "bounce", "tutor"), else fall back to a generic-but-still-honest
    // movement phrase, NEVER the bare "<zone> presence" phrasing below
    // (that stays reserved for a pre-rework source fact authored with a
    // bare `zone` and no `to`/`from` at all, and for every real SINK fact —
    // see this function's own doc comment). Same `fact.to !== undefined ||
    // fact.from !== undefined` gate as before the bugfix — a legacy
    // bare-`zone`-only source fact still deliberately skips this branch
    // entirely (unchanged presence phrasing below), only a genuinely
    // rework-shaped fact (real `to` and/or `from`) is in scope here.
    if (fact.role === 'source' && (fact.to !== undefined || fact.from !== undefined)) {
      const to = fact.to ?? fact.zone;
      if (to !== undefined) {
        const name = zoneMovementName(fact.from, to);
        if (name) return name;
        return fact.from !== undefined ? `moves to ${to.toLowerCase()} (from ${fact.from.toLowerCase()})` : `moves to ${to.toLowerCase()}`;
      }
      // `to === undefined` — a `from`-only fact (self-cast's own real
      // destination is the deliberately-invisible Stack) — falls through to
      // the shared logic below exactly as before (still real, readable data
      // via the `event`-named branches, not a zone-presence phrase either).
    }
    const zone = effectiveZone(fact);
    // A `from`-only fact with no real `to`/`zone` at all (2026-09-11, a new
    // real case once ZoneFact/EventFact merged into one `Fact` — e.g.
    // `self-cast`'s own `from:'Hand'`, no `to` since its real destination
    // is the deliberately-invisible Stack, see `Fact`'s own doc comment)
    // has no "current zone" to render as a presence phrase — rather than
    // crash on an undefined zone string, fall through to the `event`-named
    // branches below (still real, readable data for a fact like this,
    // which typically does carry one) instead of returning from this
    // branch at all.
    if (zone !== undefined) return ZONE_PRESENCE_PHRASE[zone] ?? `${zone.toLowerCase()} presence`;
  }
  const event = fact.event;
  // Bare "life gain" always (2026-09-10) — `controller` (whose life total
  // goes up) stays real, intact data, surfaced in the notes/conditions
  // column instead of a "your"/"opponent's" prefix.
  if (event === 'lifegain') return 'life gain';
  // Bare "dying" always (2026-09-10) — regardless of `target: 'self'` vs. a
  // real `Constraints` object, regardless of what that constraint says
  // (Summon: Bahamut's own `target:{types:{not:['Land']}}}`, e.g., destroys
  // any NONLAND permanent, not specifically a creature — an earlier same-day
  // version of this branch derived a "nonland permanent"-style noun from
  // that constraint via `constraintBits`, then a WHO prefix on top of it;
  // both are real, intact `target`/`controller` data, surfaced in the
  // notes/conditions column instead — this label stays single-dimensional).
  if (event === 'dies') return 'dying';
  // Bare "counters" always (2026-09-10) — `counterType` (e.g. "+1/+1",
  // "LORE", "stun") was rendered into this label until later the same day;
  // overridden to match every other qualifier on this fact (`controller`,
  // `target === 'self'`) per the single-dimensional label design applied
  // pool-wide this session: WHICH counter type, like WHO controls the
  // recipient permanent, is real, intact data surfaced in the notes/
  // conditions column instead, not the label itself.
  if (event === 'putCounter') return 'counters';
  // Bare "damage" always (2026-09-10) — `controller` (the dealer) and
  // `recipient` (added alongside Bahamut's own Mega Flare fact, same day —
  // who the damage goes to, independent of `controller`) are both real,
  // intact data on the fact; neither renders into this label anymore. See
  // `EventFact.recipient`'s own doc comment for the field itself.
  if (event === 'damage') return 'damage';
  if (event === 'drawCard' || event === 'drawCards') return 'card draw';
  // Deliberately generic regardless of `fact.tapped` — same convention as
  // `addMana` below: `tapped` is already one of CONDITION_KEYS, rendered in
  // the card page's own details/JSON column, so the label doesn't repeat it.
  if (event === 'entersBattlefield') return 'enters the battlefield';
  if (event === 'playLand') return 'play a land';
  if (event === 'activateAbility') return 'activate ability';
  // A generic "a spell was cast" event (2026-09-10) — deliberately flat, no
  // creature/noncreature/legendary wording variation ever: type-specificity
  // for a want (e.g. "wants specifically a creature spell cast") lives in
  // the fact's own `Constraints.types`/`target` data for MATCHING purposes
  // only, never in a separate `cast`-shaped event string or separate label
  // text — same reason `addMana` above stays color-generic even though the
  // fact itself carries real color data. A source fact for "this card
  // itself was cast" uses `target: 'self'` (`dies`'s own self/general split
  // above is the existing mechanism this reuses, not a new one); this
  // pre-existing `castCreatureSpell`/`castNoncreatureSpell`-shaped camelCase
  // event strings elsewhere in the pool are UNRELATED and untouched by this
  // — `cast` is a new, separate, plain vocabulary entry for future/`fin/1`
  // (Summon: Bahamut) use, not a rename or migration of those.
  if (event === 'cast') return 'cast a spell';
  // Real, pre-existing camelCase event strings (champions-of-the-perfect/
  // fang-fearless-l-cie's own "cast a creature spell" wants, predating the
  // `cast` vocabulary entry above) — explicit bare labels, same real-bug
  // fix `preventDamage` gets right below (2026-09-12, user: "PreventDamage
  // - is camel case"). Without this, the generic fallback below returns
  // the raw `event` string verbatim, which the card page's own
  // `first-letter:uppercase` CSS only capitalizes the FIRST letter of —
  // "castCreatureSpell" rendered literally as "CastCreatureSpell", no
  // spaces, same bug class. `castNoncreatureSpell` has no real pool
  // instance yet (checked) — not added preemptively.
  if (event === 'castCreatureSpell') return 'cast a creature spell';
  // Summon: Alexander's own real chapter I/II "Prevent all damage that
  // would be dealt to creatures you control this turn" (2026-09-12,
  // user's own live catch) — a deliberately generic catch-all category,
  // same spirit as `pump`'s own promotion (no amount/duration/scope
  // vocabulary beyond the bare label): "unlikely to be synergistic, but
  // good to highlight this effect regardless."
  if (event === 'preventDamage') return 'prevent damage';
  // Same real camelCase-display bug class as `preventDamage`/
  // `castCreatureSpell` above, caught 2026-09-12 while adding Dragoon's
  // Lance's own new `grantType` vocabulary — `grantKeyword` itself was
  // ALREADY real, live pool vocabulary (Dion/Ardyn/Dragoon's Lance/
  // haste-magic/circle-of-power) but had never hit an explicit branch,
  // so it was ALSO rendering raw ("GrantKeyword") this whole time; fixed
  // alongside its new sibling rather than left for a future report.
  // `grantType` — Dragoon's Lance's own "is a Knight in addition to its
  // other types" — genuinely new vocabulary (see that card's own
  // `definition.ts` comment for why it stays honest-but-structurally-
  // inert, no execution behind it yet).
  if (event === 'grantKeyword') return 'grant keyword';
  if (event === 'grantType') return 'grant type';
  // Same real camelCase-display bug class as `preventDamage`/
  // `castCreatureSpell`/`grantKeyword` above (2026-09-15, Cloud, Midgar
  // Mercenary/fin-10's own Facts tab: this event's label was rendering as
  // the raw literal "TriggeredAbility" — the card page's own
  // `first-letter:uppercase` CSS only capitalizes the FIRST letter of
  // whatever this function returns, so an un-branched camelCase `event`
  // string reaches the page with its OWN internal capital letters intact).
  // `triggerDoubling-selfAndAttachedEquipment-structural`'s own real
  // `{event:'triggeredAbility'}` facts (self-half + Equipment-attached-half)
  // are the only real pool producer of this event today — checked directly,
  // no other recognizer or hand-authored fact uses it. Bare "triggered
  // ability" (2026-09-15), same single-dimensional label convention every
  // other branch here follows — WHICH ability (self vs. an attached
  // Equipment's own) stays real, intact `target`/`subject` data, surfaced
  // in the notes/conditions column, never folded into the label itself.
  if (event === 'triggeredAbility') return 'triggered ability';
  // Deliberately generic — no color breakdown in this label (`colors`/
  // `color` either way, whichever the fact carries) — that's the card
  // page's own "details"/JSON column's job (see `CONDITION_KEYS` in
  // app/pages/app/card/[set]/[number].vue), same short-generic-label
  // convention every other fact row already follows. Was briefly
  // color-specific ("(B/R)") right after `colors` (added 2026-09-09)
  // superseded the legacy singular `color` — reverted per explicit
  // instruction, not a further engine-side vocabulary change.
  // Bare "mana production" always (2026-09-10) — `controller` (whose mana
  // pool this fills) stays real, intact data, surfaced in the notes/
  // conditions column instead of a "your"/"opponent's" prefix, same
  // treatment as every other branch this pass touched.
  if (event === 'addMana') return 'mana production';
  // The Gold Saucer's own real "Flip a coin" activated ability (2026-09-09)
  // — deliberately about the FLIP itself, not its win/lose outcome (no
  // coin-flip/random-outcome mechanism exists anywhere in this model, and
  // that outcome genuinely stays unmodeled — see this card's own
  // definition.ts comment); the flip happening at all is guaranteed by the
  // ability's own printed text the same way `playLand`/`entersBattlefield`
  // above are guaranteed by construction, so this is a real, ordinary
  // event fact, not a probabilistic one.
  if (event === 'coinFlip') return 'flip a coin';
  // Edgar, King of Figaro's own real "Two-Headed Coin — The first time you
  // flip one or more coins each turn, those coins come up heads and you win
  // those flips" (ENGINE_GAPS.md gap #15, closed 2026-09-12) — a genuine
  // CR-614-style REPLACEMENT on a flip's OUTCOME, distinct from `coinFlip`
  // above (which is only ever about the flip itself happening, never who
  // wins it).
  if (event === 'winCoinFlip') return 'win coin flips';
  // The Wind Crystal's own real "If you would gain life, you gain twice
  // that much life instead" (ENGINE_GAPS.md gap #8b, closed 2026-09-12) — a
  // genuine CR 614.2 self-replacement on the LIFEGAIN event's own amount,
  // distinct from `lifegain` above (which is about SOMETHING gaining life
  // at all, not a multiplier on however much).
  if (event === 'lifegainDouble') return 'double lifegain';
  // Same real camelCase-display bug class as `triggeredAbility` right above
  // (2026-09-15 quick pool-wide check, Message F's own "check whether any
  // OTHER shipped event name has this same gap") — none of these three had
  // ANY explicit branch before this pass (they fell all the way through to
  // the generic fallback below, rendering their own raw camelCase strings
  // verbatim): `the-water-crystal`'s own real "Blue spells you cast cost
  // {1} less" (`costReduction`) and "Whenever an opponent draws a card
  // except the first one they draw in each of their draw steps, they mill
  // a card" (`millIncrease` — real name for "an extra, forced mill" event,
  // not a generic `mill` fact, since it's conditional on an EXTRA draw, not
  // a plain mill effect); `stiltzkin-moogle-merchant`/`stolen-uniform`'s own
  // real "gain control of target ..." (`gainControl`).
  if (event === 'costReduction') return 'cost reduction';
  if (event === 'gainControl') return 'gain control';
  if (event === 'millIncrease') return 'increased mill';
  // The Gold Saucer's own real "Sacrifice two artifacts" COST, modeled as
  // a real `{event:'sacrifice'}` produce fact (2026-09-09) — the ACT of
  // sacrificing (a real, deterministic event a sacrifice-themed payoff
  // elsewhere in the pool could care about — Aristocrats-style), distinct
  // from the existing `Battlefield`/`types:{has:['Artifact']}` sink fact
  // above (which only says this card WANTS artifacts, not that it
  // performs a sacrifice). Bare "sacrifice" always (2026-09-10) — neither
  // the `types`/`cmc` qualifier (Gold Saucer's own `types:{has:['Artifact']}`
  // used to render "artifact sacrifice") nor `controller` (used to render
  // "your"/"opponent's" prefixed) renders into this label anymore; both stay
  // real, intact data on the fact.
  if (event === 'sacrifice') return 'sacrifice';
  // The Lunar Whale's own real "you may play the top card of your library"
  // (2026-09-12) — genuinely new vocabulary (CR 601/305's own umbrella
  // "playing," covering both casting and a land drop, whichever the top
  // card's own type turns out to be). `from:'Library'` stays real, intact
  // data on the fact (surfaced in the notes/conditions column), same as
  // every other event branch here — this label doesn't repeat it. See this
  // card's own `definition.ts`/`scripts/verify-synergy.mjs`'s
  // `isLunarWhalePlayFromLibraryFact` for the real, documented double
  // engine gap behind it (no attacked-this-turn tracking, no play-from-
  // library Effect kind).
  if (event === 'play') return 'play a card';
  // `fang-fearless-l-cie`'s own real "Whenever a card leaves your
  // graveyard, ..." sink want — same real camelCase-display bug class as
  // `triggeredAbility`/`costReduction`/`gainControl`/`millIncrease` above
  // (2026-09-15 quick pool-wide check) — this stale comment used to list
  // `graveyardLeaves` as an intentional fall-through case; it was never
  // actually safe to (genuinely camelCase, same as the others), simply not
  // checked before now.
  if (event === 'graveyardLeaves') return 'graveyard leaves';
  // `beginCombat-trigger-structural.ts`'s own real "At the beginning of
  // combat on your turn," precondition sink (2026-09-16, weapons-vendor/
  // fin-40's own remaining coverage gap) — same real camelCase-display bug
  // class as `triggeredAbility`/`costReduction`/`gainControl`/
  // `graveyardLeaves` above (an un-branched camelCase event string would
  // otherwise render as the raw "BeginCombat"). Bare "beginning of combat"
  // always — `controller` stays real, intact data, same single-dimensional
  // label convention every branch here already follows.
  if (event === 'beginCombat') return 'beginning of combat';
  // Generic fallback for every event this function doesn't special-case
  // above (`lifeloss`, `landfall`, `scry`, `surveil`, `counter`, etc. —
  // `damage` got its own bare branch above; `castCreatureSpell`/
  // `preventDamage`/`grantKeyword`/`triggeredAbility`/`costReduction`/
  // `gainControl`/`millIncrease`/`graveyardLeaves` all got theirs above too,
  // once a real camelCase pool instance of each surfaced this fallback's
  // own raw-string display bug — see those branches' own doc comments).
  // Bare `event` string only (2026-09-10) — neither
  // `controller` (who — briefly rendered as a "your"/"opponent's" prefix
  // earlier the same day) nor the `types`/`cmc` qualifier (what kind —
  // e.g. "land landfall") renders into this label anymore; both stay real,
  // intact data on the fact, surfaced in the notes/conditions column
  // instead. `?? '(unknown fact)'` is a real, reachable defensive fallback
  // now (2026-09-11 merge) — `event` used to be a REQUIRED `EventFact`
  // field, so TS itself guaranteed this line's `fact.event` was always a
  // real string; now that `Fact.event` is optional (independent of
  // `to`/`from`), a fact reaching this line with no `event` AND no real
  // `to`/`zone` (isZoneFact's own branch above already returns for any
  // fact with a real zone) would be a genuinely malformed/unauthored fact
  // — this never happens for any real authored fact today, but the
  // fallback keeps the return type honest instead of asserting it away.
  return event ?? '(unknown fact)';
}

/**
 * The one place a `FactAnnotationAuthoring` entry's `sourceText`/`highlight`
 * get turned into a real character range against a face's own real text —
 * the same indexOf-based matching the now-deleted `annotateOracleText` used
 * to do live, kept as a single private helper so `computeFactAnnotations`
 * below has exactly one place this logic lives. Generic over WHICH real
 * text is passed in (`text`) — the oracle text body, or (2026-09-11) a type
 * line — `computeFactAnnotations` decides which one via `authoring.anchor`
 * before calling this. Same "first match, best effort" tolerance the
 * original had: `text.indexOf` and `sourceText.indexOf` both return the
 * FIRST occurrence — a `sourceText`/`highlight` pair repeated verbatim
 * elsewhere in the same text was, for a while, a real ambiguity this
 * silently resolved by picking the earliest match — closed 2026-09-13 by
 * `authoring.line` (see `FactAnnotationAuthoring`'s own doc comment): when
 * present, the search is scoped to that one physical line only, so a
 * repeated phrase on a DIFFERENT line can no longer be mismatched for the
 * intended one. `line` is optional, though — omitted (any authoring entry
 * predating this fix), this still falls back to the original whole-text
 * `indexOf` behavior, ambiguity and all, unchanged. Returns `undefined` (not
 * a hard failure) when there's no authoring entry at all, or the ANCHOR
 * itself (the `line`, or `sourceText` wherever it's searched) fails to
 * resolve — see `FactAnnotationAuthoring`'s own doc comment's "Failure
 * modes" section for the full list of which cases these are and why they're
 * legitimately silent.
 *
 * One case is deliberately NOT folded into that silent `undefined` return,
 * though (2026-09-14): once the anchor DOES resolve to a real, concrete
 * substring of `text` and `authoring.highlight` still isn't found as a
 * substring of THAT — i.e. the line/sourceText this entry points at
 * genuinely exists, but the one phrase meant to name the fact within it
 * doesn't — this throws a real `Error` instead. Before this fix, that case
 * silently returned `undefined` too, indistinguishable from the legitimate
 * "nothing to anchor to" cases above; in practice this meant a typo'd
 * `highlight`, a stale `highlight` left over from a prior wording, or a
 * `line`/`sourceText` pointed at the WRONG line/phrase (so `highlight`
 * genuinely isn't on it) all silently produced "this fact has no
 * annotations" with zero signal anywhere that authoring even ran, let alone
 * failed — caught only, if at all, by `verify-annotation-coverage.mjs`'s
 * narrow opt-in `ANNOTATED_CARD_SLUGS` allowlist, and even then with no way
 * to tell "never authored" apart from "authored wrong." This function
 * itself is the one place both cases already fully resolve (it already
 * computed the concrete `targetLine`/`sourceText` substring before running
 * the failed `highlight` lookup), so throwing here — rather than in some
 * downstream caller that would have to re-derive the same distinction from
 * a bare `undefined` — is the only place this doesn't need re-deriving.
 * `computeFactAnnotations` itself does NOT catch this — it propagates
 * straight through to whichever script called it. The one caller this
 * matters for, `scripts/compute-annotations.mjs` (the actual authoring
 * entries get baked into committed `synergy.json` here), deliberately lets
 * it propagate uncaught too, so a real broken entry hard-crashes that build
 * step instead of silently writing empty `annotations`. The two other real
 * callers (`scripts/check-fact-parity.mjs`, `scripts/
 * prototype-index-path-annotations-fin1-5.mjs`) scan MANY containers
 * pool-wide and need to keep surveying past one bad entry — both catch this
 * specific throw locally and fold it into their own existing
 * "resolution failure" reporting, rather than letting it abort the whole
 * scan.
 */
function rawHighlightRange(text: string, authoring: FactAnnotationAuthoring | null | undefined): { start: number; end: number } | undefined {
  if (!authoring?.highlight) return undefined;
  if (typeof authoring.line === 'number') {
    // Line-scoped resolution (2026-09-13) — compute this one line's own
    // absolute offset within `text` (same split-on-'\n'-and-re-add-the-
    // separator convention `toLineOffset` below uses), then search for
    // `highlight` (narrowed further by `sourceText` first, if given) only
    // within that line's own substring, never the whole multi-line blob.
    const lines = text.split('\n');
    const targetLine = lines[authoring.line];
    if (targetLine === undefined) return undefined;
    let lineOffset = 0;
    for (let i = 0; i < authoring.line; i++) lineOffset += lines[i]!.length + 1; // +1 for the '\n' split() consumed
    let searchText = targetLine;
    let searchOffset = lineOffset;
    if (authoring.sourceText) {
      const sourceIdx = targetLine.indexOf(authoring.sourceText);
      if (sourceIdx === -1) return undefined;
      searchText = authoring.sourceText;
      searchOffset = lineOffset + sourceIdx;
    }
    const highlightIdx = searchText.indexOf(authoring.highlight);
    if (highlightIdx === -1) {
      throw new Error(
        `rawHighlightRange: authoring.highlight ${JSON.stringify(authoring.highlight)} not found ` +
          (authoring.sourceText
            ? `within authoring.sourceText ${JSON.stringify(authoring.sourceText)} on line ${authoring.line}`
            : `on line ${authoring.line}`) +
          ` (resolved line text: ${JSON.stringify(targetLine)}) — stale/typo'd highlight, or a line/sourceText pointing at the wrong text.`,
      );
    }
    return { start: searchOffset + highlightIdx, end: searchOffset + highlightIdx + authoring.highlight.length };
  }
  if (!authoring.sourceText) return undefined;
  const sourceIdx = text.indexOf(authoring.sourceText);
  if (sourceIdx === -1) return undefined;
  const highlightIdx = authoring.sourceText.indexOf(authoring.highlight);
  if (highlightIdx === -1) {
    throw new Error(
      `rawHighlightRange: authoring.highlight ${JSON.stringify(authoring.highlight)} not found within authoring.sourceText ${JSON.stringify(authoring.sourceText)} — stale/typo'd highlight for this authoring entry.`,
    );
  }
  return { start: sourceIdx + highlightIdx, end: sourceIdx + highlightIdx + authoring.highlight.length };
}

/**
 * Converts a whole-text absolute `[start, end)` character range into the
 * line-relative shape `AnnotationRef` stores on disk — see that interface's
 * own doc comment for the indexing convention. Returns `undefined` (rather
 * than guessing) when the range spans more than one line — a `highlight`
 * phrase crossing a `\n` would mean "line" alone can't describe it, and no
 * real fact in the pool needs that today; flag rather than silently pick a
 * line if one ever does.
 *
 * Exported (2026-09-13) so `functional-model/recognizers/*` (the
 * `PRD_AUTOMATED_AUTHORING.md` "annotation as a byproduct of matching"
 * prototype) can convert a regex match's own already-known absolute offset
 * straight into a real `AnnotationRef`, without going through
 * `computeFactAnnotations`'s `sourceText`/`highlight`-indirection — a
 * recognizer already knows exactly which characters it matched, so it
 * doesn't need the two-step "record the phrase, re-find it later" dance
 * `annotations-authoring.json` exists for on the agent-authored side.
 */
export function toLineOffset(oracleText: string, start: number, end: number): AnnotationRef | undefined {
  const lines = oracleText.split('\n');
  let offset = 0;
  for (let line = 0; line < lines.length; line++) {
    const lineLen = lines[line]!.length;
    const lineEnd = offset + lineLen;
    if (start >= offset && end <= lineEnd) {
      return { target: 'oracle', line, start: start - offset, end: end - offset };
    }
    offset = lineEnd + 1; // + 1 for the '\n' this split() consumed
  }
  return undefined;
}

/**
 * Computes one fact's baked `AnnotationRef[]` against the real text of the
 * face it belongs to, from that fact's own `FactAnnotationAuthoring` entry
 * (`cards/<slug>/annotations-authoring.json`, positionally aligned with
 * `synergy.json` — see that type's own doc comment; the caller is
 * responsible for passing the matching authoring entry AND the right
 * face's text, this function doesn't know about multi-face cards or
 * position-matching itself). `authoring.anchor` (default `'oracle'`) picks
 * which of `texts.oracle`/`texts.typeLine` is actually searched — see
 * `AnnotationRef`'s own doc comment for the two resulting shapes. The ONE
 * place this computation happens end-to-end — `scripts/
 * compute-annotations.mjs` calls this once per card, per fact, and bakes
 * the result into the checked-in `synergy.json`; no other caller should
 * ever run this live (see `AnnotationRef`'s own doc comment on why: "card
 * text won't ever change, so we can attach to it specifically" — the whole
 * reason this replaced the old live `annotateOracleText` segment-tree
 * rebuild, since deleted, that used to run on every server request).
 * Currently always zero-or-one-element (derived from a single `highlight`
 * string) — the array shape exists for a future fact that legitimately
 * needs to point at more than one span, not exercised yet. Returns
 * `undefined` when there's no authoring entry at all (`null`/missing) for
 * this fact, or its anchor (`line`/`sourceText`) doesn't resolve — see
 * `FactAnnotationAuthoring`'s own doc comment's "Failure modes" section.
 * Does NOT catch `rawHighlightRange`'s own thrown `Error` (2026-09-14) for
 * the one case that's a genuine authoring bug rather than "nothing to
 * annotate" — an anchor that DOES resolve but whose `highlight` still
 * isn't found within it — that propagates straight through to this
 * function's own caller uncaught, deliberately, so a broken entry hard-
 * fails the actual build step (`scripts/compute-annotations.mjs`) instead
 * of silently producing empty `annotations`. A caller that scans many
 * containers and needs to survive one bad entry (`scripts/
 * check-fact-parity.mjs`, `scripts/prototype-index-path-annotations-
 * fin1-5.mjs`) must catch this itself.
 */
export function computeFactAnnotations(
  texts: { oracle?: string; typeLine?: string },
  authoring: FactAnnotationAuthoring | null | undefined,
): AnnotationRef[] | undefined {
  if ((authoring?.anchor ?? 'oracle') === 'typeLine') {
    if (!texts.typeLine) return undefined;
    const range = rawHighlightRange(texts.typeLine, authoring);
    return range ? [{ target: 'typeLine', start: range.start, end: range.end }] : undefined;
  }
  if (!texts.oracle) return undefined;
  const range = rawHighlightRange(texts.oracle, authoring);
  if (!range) return undefined;
  const loc = toLineOffset(texts.oracle, range.start, range.end);
  return loc ? [loc] : undefined;
}

/**
 * Real bug found+fixed 2026-09-11 during aerith-gainsborough's fact-model
 * migration (same "Fact unification broke an old mutual-exclusivity
 * assumption" class as the `effectiveController`/`factsInteract` zone-read
 * bugs found during summon-bahamut's own migration — see
 * SYNERGY_DESIGN.md's "Fact unification" section). Pre-merge, `isZoneFact`/
 * `isEventFact` were mutually exclusive by construction (a `ZoneFact` vs
 * `EventFact` union), so checking `isEventFact(fact)` here was equivalent
 * to checking `!isZoneFact(fact)` — either told you which of
 * `factsInteract`'s two branches actually produced a given match. Post-merge
 * a single fact can be BOTH (e.g. Aerith's own merged
 * `{event:'entersBattlefield', to:'Battlefield', ...}`), and
 * `factsInteract` ALWAYS takes the zone branch first whenever `isZoneFact`
 * is true on both sides (its zone check `return`s before the event
 * comparison is ever reached) — so `isEventFact(fact)` being true no longer
 * implies the match was actually resolved via event semantics. The old code
 * mislabeled every such zone-branch self-match as `'same-instance'`
 * (implying "the same object experiencing its own event," a same-instance
 * reason) when the real reason is the zone/legend-rule one ("would need a
 * SECOND copy of this card to occupy the wanted zone at the same time as
 * this instance already does" — CR 704.5j for the legendary case). Checking
 * `isZoneFact` first fixes this: `factsInteract`'s own shape gate
 * (`isZoneFact(p) === isZoneFact(w)`, required for any match at all) means
 * `isZoneFact(fact)` being true for a matched self-pair GUARANTEES the zone
 * branch is what fired, regardless of whether `fact` also happens to carry
 * an `event` name. A fact with NEITHER `to`/`from`/`zone` falls through to
 * `same-instance` exactly as before (unaffected — pure event facts, e.g.
 * `lifegain`, were never ambiguous).
 */
function selfInteractionKind(fact: Fact, card: PoolCard): SelfInteractionKind {
  if (isZoneFact(fact)) {
    return typeWordsFromTypeLine(card.card.typeLine).includes('Legendary') ? 'second-copy-legendary' : 'second-copy';
  }
  return 'same-instance';
}

/** Zone/event shapes that represent "a permanent has died"/"arrived in a
 * graveyard" — the two want-shapes a `dies`-CONSEQUENCE SOURCE fact used to
 * satisfy directly (see `satisfiesDestroyImpliesDies`'s own doc comment
 * below for why a `destroy`-event fact now satisfies both of these too,
 * without ever needing to be re-authored as a separate `dies` fact):
 * - a ZONE-shaped presence/arrival want naming the Graveyard specifically
 *   (Ardyn the Usurper's own `{to:'Graveyard', types:{has:['Creature']}}`).
 * - an EVENT-shaped `event:'dies'` want (`dies-trigger-structural.ts`'s own
 *   sink shape — Al Bhed Salvagers, Jenova Ancient Calamity, G'raha Tia).
 */
function isGraveyardArrivalWant(fact: Fact): boolean {
  if (isZoneFact(fact) && effectiveZone(fact) === 'Graveyard') return true;
  if (isEventFact(fact) && fact.event === 'dies') return true;
  return false;
}

/** What a `destroy`-event SOURCE fact's own `target` filter GUARANTEES
 * about whatever it actually kills, for `satisfiesDestroyImpliesDies` below
 * — conservative, `has` only: a `hasAny`/`not`-only (or absent) target
 * guarantees no SPECIFIC type at all (only "some permanent"), so it can
 * only ever satisfy an UNCONSTRAINED graveyard-arrival want, never a
 * type-filtered one. */
function destroyGuaranteedTypes(fact: Fact): string[] {
  const t = fact.target;
  if (!t || typeof t !== 'object') return [];
  return t.types?.has ?? [];
}

/**
 * 2026-09-16 widened match (`.claude/contracts/card-schema.md`,
 * `SYNERGY_DESIGN.md`) — CR 700.4: a `destroy` effect that actually
 * resolves against a real target necessarily moves that target from the
 * battlefield to a graveyard (dying) as its own guaranteed follow-through.
 * `destroy-effect-structural.ts`/`destroyProgram-effect-structural.ts` used
 * to additionally emit a literal, separately-authored `event:'dies'`
 * CONSEQUENCE fact (same target constraint, same annotation span as the
 * `destroy` fact itself) purely so a "wants a creature to arrive in a
 * graveyard" SINK could match it — pure authoring-time redundancy, not new
 * information, since the `destroy` fact's own `target` already says
 * everything the `dies` fact said. Both recognizers dropped that companion
 * fact (see their own module doc comments) in favor of this MATCH-TIME
 * equivalence instead: a `destroy`-event SOURCE fact now satisfies the
 * exact same two want-shapes a `dies` fact would (`isGraveyardArrivalWant`
 * above) directly, with no second fact ever needing to exist on disk.
 *
 * Deliberately narrower than full constraint-vs-constraint implication:
 * only the want's own `types` constraint is checked (against the destroy's
 * own guaranteed `target.types.has`, `destroyGuaranteedTypes` above) — a
 * want with a `cmc`/`power`/`toughness`/`name`/`amount` constraint declines
 * (returns false) rather than asserting a guarantee this fact can't actually
 * back; no real pool sink needs more than a type-shaped graveyard-arrival
 * want today (checked — Ardyn the Usurper, Al Bhed Salvagers, Jenova
 * Ancient Calamity, G'raha Tia are the real cards this closes for, none of
 * which constrain anything but `types`).
 *
 * Reads `p.target` (the destroy fact's own declared filter), never
 * `p.subject` — unlike the ordinary zone-matching branch below (which
 * resolves the PRODUCER's own static attrs via `resolveSubject` for a
 * self-referencing produce), a targeted destroy has no fixed subject at all
 * — the victim varies per resolution — so the only static signal available
 * is the destroy fact's own declared `target` filter.
 *
 * **A want with `target: 'self'`** ("when THIS creature dies," e.g.
 * Aerith Gainsborough's/Ancient Adamantoise's own `dies-trigger-
 * structural.ts`-authored sinks) is a genuinely different, WEAKER claim
 * than the guaranteed-type check above — not "does this destroy GUARANTEE
 * killing something of this type" but "COULD the wanting card itself
 * legally be this destroy's own victim" (the effect targets AT MOST one
 * object, chosen at resolution — it may or may not end up being this
 * specific card). This is exactly the same compatibility check
 * `factsInteract`'s own general event-matching branch already makes for
 * ANY other event kind's own `target` filter against a `target:'self'` want
 * (`satisfiesConstraints(staticAttrsFor(wCard.card), pe.target)` below) —
 * mirrored here rather than reinvented, and NEEDED to avoid a real
 * regression: two real, on-disk (now-removed) `dies` companion facts
 * (Lunatic Pandora, Sephiroth's Intervention) happened to predate the
 * `from`/`to` fields this recognizer family now always sets, so they were
 * — by accident of that staleness, not by design — EVENT-only shaped and
 * therefore reachable by this exact self-target branch; removing them
 * without this branch would silently drop that real compatibility signal.
 * Declines (never vacuously matches) when the destroy has NO `target`
 * filter at all (an unrestricted "destroy target permanent," e.g. Bahamut,
 * Warden of Light's own back face) — unlike the general branch's own
 * `pe.target === undefined` case (which falls back to checking `pe.subject
 * === undefined`), a destroy fact NEVER sets `subject` at all, so that
 * fallback would vacuously match EVERY self-dies want in the entire pool
 * for an unrestricted destroy — a real, much broader invention no removed
 * fact ever backed (an unrestricted destroy's own dies fact always carried
 * real `from`/`to`, so it was never event-only reachable here either);
 * declining keeps this addition scoped to exactly the two real regressions
 * above, not a general new capability.
 */
function satisfiesDestroyImpliesDies(p: Fact, w: Fact, wCard: PoolCard): boolean {
  if (isEventFact(w) && w.target === 'self') {
    if (!p.target || typeof p.target !== 'object') return false;
    return satisfiesConstraints(staticAttrsFor(wCard.card), p.target);
  }
  const wantConstraints: Constraints = isEventFact(w) && w.target && typeof w.target === 'object' ? w.target : constraintsOf(w);
  if (wantConstraints.cmc || wantConstraints.power || wantConstraints.toughness || wantConstraints.name || wantConstraints.amount) return false;
  if (!wantConstraints.types) return true;
  return satisfiesType(destroyGuaranteedTypes(p), wantConstraints.types);
}

/** Does producer fact `p` (belonging to `pCard`) satisfy wanter fact `w` (belonging to `wCard`)? Symmetric to how it's invoked — `mine`/`mineRole` decide which side `p`/`w` actually is. Module-level (not nested in `findInteractionsForCard`) so `matchCountForFact` below can reuse the exact same real matching logic rather than a re-derived approximation. */
function factsInteract(mine: Fact, mineCard: PoolCard, mineRole: 'source' | 'sink', theirs: Fact, theirCard: PoolCard, tokens: Record<string, TokenLike>): boolean {
  const p = mineRole === 'source' ? mine : theirs;
  const pCard = mineRole === 'source' ? mineCard : theirCard;
  const w = mineRole === 'source' ? theirs : mine;
  const wCard = mineRole === 'source' ? theirCard : mineCard;

  // Widened match, checked BEFORE the ordinary shape-partition gate below
  // (a `destroy`-event fact is event-only-shaped — no `to`/`from` — but
  // must still be allowed to satisfy a ZONE-shaped graveyard want too) —
  // see `satisfiesDestroyImpliesDies`'s own doc comment above.
  if (isEventFact(p) && p.event === 'destroy' && isGraveyardArrivalWant(w)) {
    if (!sidesCompatible(effectiveController(p), effectiveController(w))) return false;
    return satisfiesDestroyImpliesDies(p, w, wCard);
  }

  if (isZoneFact(p) !== isZoneFact(w)) return false;
  if (!sidesCompatible(effectiveController(p), effectiveController(w))) return false;

  if (isZoneFact(p) && isZoneFact(w)) {
    // `p` (the producer) is always the SOURCE-role fact in this branch —
    // compare its own `to` (or legacy bare `zone`, same thing) against the
    // sink's plain presence `to`/`zone` (`effectiveZone(w)`, NOT a bare
    // `w.zone` read — fixed 2026-09-11 alongside the `Fact` merge: a sink
    // fact can now legitimately author `to` instead of `zone` too, e.g.
    // this card's own `mega-flare-you`, and a bare `w.zone` read would
    // silently stop matching a sink migrated to `to`). `p.from` is
    // deliberately NOT part of this comparison — a sink only ever
    // declares a plain state-presence want, never "and it must have
    // arrived from X," so a downstream consumer caring only about the
    // `to` side matches regardless of origin (this rework's own explicit
    // design goal — see `Fact`'s own doc comment).
    if (effectiveZone(p) === undefined || effectiveZone(p) !== effectiveZone(w)) return false;
    const wantConstraints = constraintsOf(w);
    if (!hasAnyConstraint(wantConstraints)) return true;
    const attrs = resolveSubject(p.subject, pCard.card, tokens);
    return !!attrs && satisfiesConstraints(attrs, wantConstraints);
  }

  // Plain aliases, not a real cast (`p`/`w` are already `Fact`, which
  // already has every field read below — `EventFact` is now just an alias
  // for `Fact`, see its own doc comment) — kept only so the rest of this
  // branch's existing `pe`/`we` naming didn't need a rename for this pass.
  const pe = p;
  const we = w;
  // Event-to-event matching stays pure `event` string equality — `to`/
  // `from`, when a merged fact also carries them (2026-09-11), are
  // deliberately NOT compared here, same as `targeted`/`tapped`-adjacent
  // fields below; they exist so the fact's own JSON is self-explaining
  // data, not to add a new matching dimension.
  if (pe.event !== we.event) return false;
  if (pe.counterType && we.counterType && pe.counterType !== we.counterType) return false;
  // Reuses `satisfiesType` (the exact `TypeConstraint` matcher `Constraints.types`
  // already uses) against the producer's own real color set — a want's
  // `colors` (or legacy `color`, treated as an implicit one-element `has`)
  // is checked the same "has = all of, hasAny = any of, not = none of" way a
  // type want already is; see `colorSetOf`/`EventFact.colors`'s own doc
  // comment for why this reuses rather than reinvents.
  const wantColors: TypeConstraint | undefined = we.colors ?? (we.color ? { has: [we.color] } : undefined);
  if (wantColors) {
    const produced = colorSetOf(pe);
    if (produced && !satisfiesType(produced, wantColors)) return false;
  }
  if (pe.tapped !== undefined && we.tapped !== undefined && pe.tapped !== we.tapped) return false;

  // "A want with target: 'self' on the consumer side matches a produce
  // whose target filter the consumer card satisfies" (SYNERGY_DESIGN.md).
  if (we.target === 'self') {
    // **Real bug, fixed 2026-09-15** (flagged explicitly, not silently
    // patched over, since this is a shared-matcher correctness question,
    // not a per-card authoring one — surfaced by this session's own
    // `entersBattlefield-self-trigger-structural`/`token-creation-
    // structural` recognizers wiring MANY more real `event:'entersBattlefield'`
    // facts into the pool at once). Used to be `if (pe.target === undefined)
    // return true` unconditionally — treating ANY producer with no `target`
    // field at all as a vacuous match for a self-want, regardless of
    // whether that producer ALSO carries a `subject` narrowing it to a
    // SPECIFIC other object (`token-creation-structural`'s own real
    // `{event:'entersBattlefield', subject:{token:'w_2_2_knight'}}` source
    // fact, e.g. — genuinely about a Knight TOKEN entering, never about
    // "the wanting card itself" entering, even though it has no `target`
    // field to say so explicitly). Confirmed via a real before/after
    // `find-synergies.mjs` diff on Cloud, Midgar Mercenary (fin/10): this
    // fix removes exactly the ~13 real false-positive matches the user's
    // own report named (every OTHER pool card's own token-creation-derived
    // `entersBattlefield` source fact was vacuously "matching" Cloud's own
    // `target:'self'` sink simply for sharing the bare event name), with
    // ZERO real matches lost anywhere else in the pool (re-checked the
    // whole pool's own before/after interaction counts, not just Cloud's).
    // A producer only stays genuinely vacuous (matches ANY self-want) when
    // it ALSO has no `subject` — the true "any qualifying object, no
    // narrowing at all" case (e.g. a plain `{event:'entersBattlefield',
    // controller:'you'}` fact with no type or identity filter whatsoever).
    if (pe.target === undefined) return pe.subject === undefined;
    if (pe.target === 'self') return pCard.name === wCard.name; // same-instance only
    return satisfiesConstraints(staticAttrsFor(wCard.card), pe.target);
  }
  // A want with a `Constraints` target (rare — none of today's cards need
  // it) checks the PRODUCER'S subject the same way a zone want does.
  if (we.target && typeof we.target === 'object') {
    const attrs = resolveSubject(pe.subject, pCard.card, tokens);
    return !!attrs && satisfiesConstraints(attrs, we.target);
  }
  // Neither side names a target — a bare event hook (lifegain, e.g.).
  return true;
}

/**
 * Real CR 702.15e: a permanent with printed Lifelink UNCONDITIONALLY gains
 * its controller life equal to any damage it deals — a card-mechanical
 * fact, not a matter of what its own oracle text happens to also say
 * elsewhere. `card.ts`'s bare-printed-keyword convention (SYNERGY_DESIGN.md:
 * "Not needed for keywords on card. That would be parsed directly - we
 * don't need facts for that") already treats a printed keyword as
 * structured, directly-parseable `CardDefinition.keywords` data rather than
 * something needing its own `Fact` — this reuses exactly that same
 * treatment for Lifelink specifically (checks BOTH `keywords` and
 * `backFace.keywords`, since `face` is purely a rendering hint never
 * consulted by the matcher itself — see `Fact.face`'s own doc comment).
 *
 * 2026-09-14: 12 real pool cards used to carry an explicit, hand-authored
 * `{event:'lifegain', controller:'you'}` SOURCE fact whose ENTIRE basis was
 * this same printed keyword (no separate, distinct lifegain-producing
 * ability text anywhere on the card) — a literal restatement of
 * `keywords.includes('Lifelink')`, not a genuine second fact. Dropped
 * pool-wide in favor of this derivation, so real synergy-matching coverage
 * (a payoff's own SINK wanting `event:'lifegain'`) doesn't regress:
 * `findInteractionsForCard` below used to synthesize the equivalent `Fact`
 * at match time for any card this returns `true` for and that has no OTHER
 * real declared `lifegain` source fact of its own (a card with a genuinely
 * separate lifegain ability, e.g. Battle Menu's own real "Item — you gain 4
 * life" mode, keeps its own real fact untouched and is never double-counted
 * here).
 *
 * 2026-09-14 (later, same day): PARKED by explicit user decision — see
 * `LIFELINK_SYNTHETIC_FACT_ENABLED` below `syntheticLifelinkFact()`. This
 * function and `syntheticLifelinkFact()` are kept as dead/draft code (the
 * pattern may be un-parked later), but the injection is currently disabled
 * and the 12 real cards above have their own explicit `lifegain` fact back.
 */
function hasPrintedLifelink(card: CardDefinition): boolean {
  return !!card.keywords?.includes('Lifelink') || !!card.backFace?.keywords?.includes('Lifelink');
}

/**
 * Real CR 601/303/305 (etc.): a real, non-token permanent (Creature/
 * Artifact/Enchantment/Planeswalker/Battle — a Land is PLAYED, never cast,
 * same exclusion the retired `permanent-enters-battlefield-normally`
 * recognizer's own `PERMANENT_TYPE_WORDS` list used) is, unconditionally,
 * cast from hand and enters the battlefield when it resolves — a
 * card-mechanical fact of what's printed on its OWN type line, not a matter
 * of what its own oracle text happens to also say elsewhere. Same treatment
 * `hasPrintedLifelink` above already establishes for a printed keyword:
 * derived directly from structured `CardDefinition` data, not stored as a
 * `Fact`.
 *
 * 2026-09-14: 210 real pool cards used to carry an explicit, PARSER-derived
 * (`provenance.rule: 'permanent-enters-battlefield-normally'`) `{event:
 * 'cast', from:'Hand', target:'self'}` + `{event:'entersBattlefield',
 * to:'Battlefield', controller:'you', subject:'self', target:'self'}` fact
 * pair — a literal restatement of "this is a normal permanent," not a
 * genuine per-card claim (confirmed pool-wide: every one of the 420 tagged
 * facts across those 210 cards is either the exact canonical shape above or
 * a harmless schema-drift variant of it — a stale pre-`subject`-field
 * `entersBattlefield`, or a redundant explicit `controller:'you'` on `cast`
 * that `effectiveController` already derives for free from `target:'self'`
 * — never a fact carrying any EXTRA real constraint (`tapped`/`colors`/
 * `cmc`/`types`/`power`/`toughness`/a narrower `counterType`) that this
 * bare derivation wouldn't also satisfy). Dropped pool-wide in favor of this
 * derivation, same "don't store the generic default as data" call the
 * Lifelink removal above already made.
 *
 * The recognizer this replaces used to also DECLINE for a card whose own
 * oracle text describes its entrance itself as modified (tapped, with a
 * counter, as a copy, face down — CR 614.12) — a real distinction this
 * function can no longer make: `CardDefinition` has no structured
 * "enters tapped"/"enters with a counter" field anywhere (that nuance, on
 * the handful of real cards that have it — `tonberry`, `shambling-cie-th`,
 * `elixir` — is modeled as an ordinary `onEnter` trigger effect tapping/
 * counter-ing a pool-filtered candidate, structurally IDENTICAL in shape to
 * a genuinely different card's own ETB trigger that targets something else
 * entirely, e.g. `cloudbound-moogle`/`ice-flan`'s own onEnter triggers — see
 * those two files' own comments; there is no reliable, general way to tell
 * "this trigger's own tap/counter effect is secretly about ITSELF" apart
 * from "this trigger targets some other permanent" from the effect's own
 * fields alone). This is a deliberate, small, KNOWN broadening, not an
 * oversight: the CAST and ENTERS-BATTLEFIELD events are still literally
 * true for an entering-tapped permanent (only the OPTIONAL `tapped` field
 * on `entersBattlefield` would need to be `true` for full precision, which
 * this bare derivation simply leaves unconstrained rather than asserting
 * either way — `factsInteract`'s own `tapped` check only rejects a match
 * when BOTH sides specify it and disagree, so an unconstrained producer
 * fact can never wrongly satisfy or wrongly fail a `tapped`-specific want).
 * Confirmed via a real pool scan (2026-09-14): exactly 3 cards newly gain
 * this pair as a result that didn't have it before for this specific reason
 * (`tonberry`, `shambling-cie-th`, `elixir` — all "enters tapped [with a
 * counter]"), plus 17 more that simply had never been run through
 * `apply-recognizers.mjs` at all (either a genuinely not-yet-migrated
 * empty `synergy.json`, or a real card outside that script's own
 * `data/*_scryfall.json` oracle-text lookup, e.g. cards from the
 * historical-sets sweep) — every one of those 17 is an ordinary permanent
 * with nothing resembling a replacement-effect-on-entry in its own
 * `definition.ts`, confirmed by direct inspection, not assumed.
 *
 * A genuinely different real exception this function does NOT need to
 * special-case at all: `zack-fair`'s own hand-authored "enters with a
 * +1/+1 counter" pair (CR 614.12, a real replacement effect, no
 * `provenance` tag — the recognizer always declined it on purpose) is
 * already covered by `findInteractionsForCard`'s own "don't double-author"
 * skip below (a card that already declares its own real self-cast/
 * self-entersBattlefield fact never gets the synthetic one layered on top),
 * the same way a card with its own genuinely separate lifegain ability
 * never gets `syntheticLifelinkFact` layered on top of it.
 */
function isNormalPermanent(card: CardDefinition): boolean {
  const primaryTypes = card.typeLine.split('—')[0]!.trim();
  return ['Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle'].some((w) => primaryTypes.includes(w));
}

/** The `Fact` a normal permanent's printed CAST would have declared by hand
 * before the 2026-09-14 removal (`isNormalPermanent`'s own doc comment) —
 * same "built at MATCH TIME, never written to any `synergy.json`, no
 * `annotations`" treatment `syntheticLifelinkFact` above already
 * establishes, for the same reasons (no authored oracle-text span to point
 * at — the TYPE LINE is the real anchor, and `synergy.ts` has no access to
 * a card's real Scryfall type line to compute a genuine one here either).
 *
 * Reused verbatim (2026-09-14) for `isNormalInstantOrSorcery` below — a
 * normal, non-Adventure Instant/Sorcery's own printed CAST is the exact
 * same real `{event:'cast', from:'Hand', target:'self'}` shape a normal
 * permanent's is (the ONLY thing that differs between the two cases is
 * what happens AFTER resolution — the battlefield vs. the graveyard — see
 * `syntheticEntersBattlefieldFact`/`syntheticInstantSorceryGraveyardFact`
 * below for that half), so this one function already covers both callers
 * rather than forking into two byte-identical siblings.
 */
function syntheticCastFact(): Fact {
  return { role: 'source', event: 'cast', from: 'Hand', target: 'self' } as unknown as Fact;
}

/** The `Fact` a normal permanent's printed ENTERS THE BATTLEFIELD would have
 * declared by hand before the 2026-09-14 removal — see `syntheticCastFact`'s
 * own doc comment immediately above for why this is never annotated/stored. */
function syntheticEntersBattlefieldFact(): Fact {
  return { role: 'source', event: 'entersBattlefield', to: 'Battlefield', controller: 'you', subject: 'self', target: 'self' } as unknown as Fact;
}

/**
 * Real CR 608.2m/`SBA` housekeeping: a resolved Instant/Sorcery with no
 * other instruction is put into its owner's graveyard — a card-mechanical
 * default of how these two card types resolve, not a matter of what each
 * card's own oracle text happens to also say. Same treatment
 * `isNormalPermanent` above already establishes for a permanent's own
 * printed type: derived directly from structured `CardDefinition` data
 * (the type line alone), not stored as a `Fact`.
 *
 * 2026-09-14: 62 real pool cards used to carry an explicit, PARSER-derived
 * (`provenance.rule: 'instant-sorcery-resolves-to-graveyard'`) `{event:
 * 'cast', from:'Hand', target:'self'}` + `{to:'Graveyard', controller:'you',
 * subject:'self'}` fact pair — a literal restatement of "this is a normal
 * Instant/Sorcery," not a genuine per-card claim (confirmed pool-wide: all
 * 124 tagged facts across those 62 cards are the exact canonical shape
 * above, nothing carrying any extra real constraint). Dropped pool-wide in
 * favor of this derivation, same "don't store the generic default as data"
 * call the Lifelink/normal-permanent removals above already made.
 *
 * The retired recognizer (`recognizers/instant-sorcery-resolves-to-
 * graveyard.ts`) declined on exactly two real, structural grounds this
 * function reuses verbatim:
 *   - CR 715.3d: an Adventure instant/sorcery is exiled instead of hitting
 *     the graveyard (`typeLine.split('—')[1]` carrying the literal
 *     "Adventure" subtype — every real Adventure half in this pool prints
 *     it, confirmed pool-wide, same check `isAdventure` in that recognizer
 *     used).
 *   - A genuinely self-referential exile/shuffle override naming "this
 *     card"/"this spell" in the card's own oracle text (only `ultima` in
 *     this pool actually has this — see below).
 *
 * The SECOND ground is the one real, deliberate, KNOWN broadening this
 * function can no longer make: `CardDefinition` carries no oracle text at
 * all (`synergy.ts` has no access to a card's real Scryfall body text to
 * check for a self-override clause), so there is no way to replicate the
 * text-based decline here — same "structural data only, no oracle-text
 * nuance" broadening `isNormalPermanent`'s own doc comment already accepts
 * for "enters tapped/with a counter." Checked directly (2026-09-14): the
 * ONLY real pool card this recognizer ever declined for this reason,
 * `ultima`, already carries its own hand-authored (untagged, no
 * `provenance`) self-cast/self-graveyard fact pair regardless — the
 * recognizer's own module doc comment calls this "a likely-latent gap in
 * that specific hand-authored card, not something this recognizer should
 * replicate," so `ultima` keeping that pair (now via the "already
 * declared, skip the synthetic duplicate" guard below, same as before) is
 * not a new regression, just the same pre-existing state under a new
 * mechanism.
 *
 * Flashback/"cast from a graveyard" cards (`auron-s-inspiration`,
 * `from-father-to-son`, `dreams-of-laguna`, `retrieve-the-esper`, and
 * siblings) are NOT a special case here, on purpose, matching the retired
 * recognizer's own explicit reasoning (its module doc comment: "even
 * though their OWN normal cast-from-hand resolution still goes to the
 * graveyard exactly like any other instant/sorcery"): this function
 * returns `true` for them, and they keep BOTH their own genuinely distinct,
 * separately-authored `{event:'cast', from:'Graveyard', ...}` +
 * `{to:'Exile', ...}` Flashback-recast facts (real, card-specific data —
 * an alternate cost/destination no generic rule predicts) AND the
 * synthetic normal-Hand-cast/graveyard pair below. See
 * `findInteractionsForCard`'s own dedup guard for why the "already
 * declared" check here is narrower than `isNormalPermanent`'s own (checks
 * `from: 'Hand'` specifically) — without that, a Flashback card's own real
 * `from: 'Graveyard'` cast fact would wrongly suppress the synthetic
 * `from: 'Hand'` one.
 */
function isNormalInstantOrSorcery(card: CardDefinition): boolean {
  const primaryType = card.typeLine.split('—')[0]!.trim();
  if (!/^(Instant|Sorcery)\b/.test(primaryType)) return false;
  const subtypes = card.typeLine.split('—')[1];
  if (subtypes?.includes('Adventure')) return false;
  return true;
}

/** The `Fact` a normal Instant/Sorcery's printed resolution-to-graveyard
 * would have declared by hand before the 2026-09-14 removal
 * (`isNormalInstantOrSorcery`'s own doc comment) — same "built at MATCH
 * TIME, never written to any `synergy.json`, no `annotations`" treatment
 * `syntheticCastFact`/`syntheticLifelinkFact` above already establish, for
 * the same reasons (the TYPE LINE is the real anchor here too, and
 * `synergy.ts` has no access to a card's real Scryfall type line to
 * compute a genuine one). No `event` key, matching the retired
 * recognizer's own emitted shape — the movement is fully described by
 * `to` alone. */
function syntheticInstantSorceryGraveyardFact(): Fact {
  return { role: 'source', to: 'Graveyard', controller: 'you', subject: 'self' } as unknown as Fact;
}

/**
 * The `Fact` a printed-Lifelink card would have declared by hand before the
 * 2026-09-14 removal above — built at MATCH TIME, never written to any
 * `synergy.json` (so `scripts/annotation-coverage.mjs`'s file-based
 * `annotations` check never sees it, and it never needs to satisfy that
 * invariant for real). `annotations` is deliberately OMITTED: this fact has
 * no authored oracle-text span of its own to point at (the keyword IS the
 * printed anchor; `synergy.ts` has no access to a card's real Scryfall
 * oracle text to compute a genuine one here), and — same "the TYPE requires
 * it but the runtime already tolerates its absence" situation
 * `factIdentity`'s own doc comment documents for the bulk of this pool's
 * still-unmigrated on-disk facts — nothing in `factsInteract`/`themeOf`/
 * `describeFact` actually dereferences `fact.annotations` for a bare event
 * fact like this one, so an absent array here is genuinely safe, not just
 * hopefully safe. Never rendered as text either: the served
 * `InteractionGroup.fact` this becomes is only ever read for its
 * `role`/`describeFact` LABEL and `factIdentity`'s own hover-key on the
 * card page (`app/pages/app/card/[set]/[number].vue`), never for its
 * `annotations` content directly.
 */
function syntheticLifelinkFact(): Fact {
  return { role: 'source', event: 'lifegain', controller: 'you', subject: 'self' } as unknown as Fact;
}

/**
 * 2026-09-14 (later, same day): PARKED by explicit user decision, not
 * deleted. `hasPrintedLifelink`/`syntheticLifelinkFact` above stay in the
 * file as dead/draft code — this pattern is being reconsidered and may come
 * back later — but the injection below is now a hard no-op: flip this back
 * to `true` (and restore the 12 real cards' own `{event:'lifegain'}` source
 * facts to the opposite state) if/when the pattern is un-parked. Unlike
 * `hasPrintedLifelink`, the OTHER two synthetic patterns injected in the
 * same place (`isNormalPermanent`/`syntheticCastFact`/
 * `syntheticEntersBattlefieldFact` and `isNormalInstantOrSorcery`/
 * `syntheticInstantSorceryGraveyardFact`) are NOT in question and stay
 * active — this flag only gates the Lifelink one.
 *
 * **Still parked here, 2026-09-18 — NOT un-parked by the separate
 * `sink-model/predicates/lifelink.ts` predicate added the same day.** That
 * predicate makes the SAME real-world claim (printed Lifelink implies a
 * Lifegain producer) inside the sink-only/catalog PROTOTYPE matcher
 * (`sink-model/match-sink.ts`'s `deriveOccurrences`/`matchSink`,
 * `functional-model/card-interactions.ts`'s FDN-scoped serving path) — a
 * genuinely separate code path from this file's own `augmentPoolCards`/
 * `findInteractionsForCard`, which is what actually drives FIN's real,
 * served Interactions panel and graph-links output today. This flag was
 * deliberately left exactly as-is; if/when this OLD paired-fact mechanism
 * itself gets un-parked, that's still its own separate decision, not
 * something the new predicate's existence should be read as having already
 * made.
 */
const LIFELINK_SYNTHETIC_FACT_ENABLED = false;

/** Every interaction `cardName` participates in, across `pool` (every card's own facts, itself included — self-interactions are a real, kept output, not filtered out). `tokens` resolves `{token}` subjects; omit for a card set with no token-producing edges yet.
 *
 * `pool` is augmented once, locally, before matching. The Lifelink instance
 * of this (any card with printed Lifelink, via `hasPrintedLifelink`, that
 * doesn't already declare its own real `event:'lifegain'` SOURCE fact
 * getting `syntheticLifelinkFact()` appended) is PARKED as of 2026-09-14 —
 * see `LIFELINK_SYNTHETIC_FACT_ENABLED`'s own doc comment just above this
 * function — and is currently a no-op; the 12 real cards this used to cover
 * are back to carrying their own real, explicit `lifegain` fact instead.
 * Done here, once (when re-enabled), rather than at `PoolCard` construction
 * time (`server/utils/functionalModelPool.ts`/`scripts/find-synergies.mjs`)
 * so every caller of this function — the per-card Interactions panel AND
 * `server/api/graph-links.ts`'s whole-graph
 * edge builder, which walks EVERY card's own `direction:'source'` groups —
 * gets this for free, without either of those call sites needing to know
 * Lifelink is special.
 *
 * Same augmentation, same reasons (2026-09-14): a normal, non-token
 * permanent (`isNormalPermanent`) that doesn't already declare its own real
 * self-`cast`/self-`entersBattlefield` fact gets `syntheticCastFact()`/
 * `syntheticEntersBattlefieldFact()` appended too — see those three
 * functions' own doc comments for the full "why," including the one known,
 * deliberate broadening (entering-tapped/with-a-counter cards) this can no
 * longer distinguish the way the retired recognizer's own oracle-text
 * check could.
 *
 * Same augmentation again, same day, third instance (`isNormalInstantOrSorcery`):
 * a normal, non-Adventure Instant/Sorcery that doesn't already declare its
 * own real self-`cast`-from-Hand fact gets `syntheticCastFact()` appended,
 * and one that doesn't already declare its own real self-graveyard fact
 * gets `syntheticInstantSorceryGraveyardFact()` appended — see
 * `isNormalInstantOrSorcery`'s own doc comment for the full "why," the one
 * known broadening (no oracle-text self-override check, unlike the retired
 * recognizer), and why the cast-fact "already declared" check below is
 * narrower here (`from: 'Hand'` specifically) than `isNormalPermanent`'s
 * own — a Flashback card's genuinely distinct `from: 'Graveyard'` recast
 * fact must NOT suppress this synthetic `from: 'Hand'` one. */
/**
 * The "structural default" synthetic-source-fact augmentation every real
 * matcher entry point over a `PoolCard[]` must apply BEFORE calling
 * `factsInteract` — hoisted out of `findInteractionsForCard` (2026-09-17)
 * so a second, independent consumer (`computeDeckSinkSupply` below) sees
 * the exact same producer facts rather than a re-derived approximation
 * that could silently drift from this one. Same "hoist the shared logic
 * to module scope for a new consumer" precedent `factsInteract` itself
 * already set for `matchCountForFact` (see its own doc comment) — this is
 * that same move applied to the POOL-PREPROCESSING half of the matcher,
 * not just the pairwise predicate half.
 *
 * Pure — never mutates `pool`; returns a new array (new `PoolCard` objects
 * only for entries whose `source` actually gained a fact, `===` for every
 * unaffected entry, matching the original inline `.map()`'s own
 * `source === pc.source ? pc : { ...pc, source }` behavior).
 */
export function augmentPoolCards(pool: PoolCard[]): PoolCard[] {
  return pool.map((pc) => {
    let source = pc.source;
    if (LIFELINK_SYNTHETIC_FACT_ENABLED && !source.some((f) => f.event === 'lifegain') && hasPrintedLifelink(pc.card)) {
      source = [...source, syntheticLifelinkFact()];
    }
    if (isNormalPermanent(pc.card)) {
      if (!source.some((f) => f.event === 'cast' && f.target === 'self')) source = [...source, syntheticCastFact()];
      if (!source.some((f) => f.event === 'entersBattlefield' && f.target === 'self')) source = [...source, syntheticEntersBattlefieldFact()];
    }
    if (isNormalInstantOrSorcery(pc.card)) {
      if (!source.some((f) => f.event === 'cast' && f.from === 'Hand' && f.target === 'self')) source = [...source, syntheticCastFact()];
      if (!source.some((f) => f.to === 'Graveyard' && f.subject === 'self')) source = [...source, syntheticInstantSorceryGraveyardFact()];
    }
    return source === pc.source ? pc : { ...pc, source };
  });
}

export function findInteractionsForCard(cardName: string, pool: PoolCard[], tokens: Record<string, TokenLike> = {}): InteractionGroup[] {
  const augmentedPool = augmentPoolCards(pool);
  const self = augmentedPool.find((p) => p.name === cardName);
  if (!self) return [];

  const groups: InteractionGroup[] = [];

  function matchOne(mine: Fact, mineCard: PoolCard, mineRole: 'source' | 'sink'): InteractionGroup | null {
    const matches: InteractionMatch[] = [];
    for (const other of augmentedPool) {
      const otherFacts = mineRole === 'source' ? other.sink : other.source;
      for (const theirs of otherFacts) {
        if (factsInteract(mine, mineCard, mineRole, theirs, other, tokens)) {
          const isSelf = other.name === mineCard.name;
          matches.push({
            card: other.name,
            selfInteraction: isSelf ? selfInteractionKind(mine, mineCard) : undefined,
            theirFactId: factIdentity(theirs),
          });
        }
      }
    }
    if (!matches.length) return null;
    return { direction: mineRole, fact: mine, theme: themeOf(mine), description: describeFact(mine), matches };
  }

  // Sink before source — same order the card page's own Facts tab renders
  // ([...sink, ...source]; see the card page's own comment for why).
  for (const fact of self.sink) {
    const group = matchOne(fact, self, 'sink');
    if (group) groups.push(group);
  }
  for (const fact of self.source) {
    const group = matchOne(fact, self, 'source');
    if (group) groups.push(group);
  }
  return groups;
}

/**
 * A deck-scoped, quantity-weighted counterpart to `findInteractionsForCard`
 * — 2026-09-17, PRD 01's per-card-quantity sandbox Deck. Deliberately
 * NOT built on top of `findInteractionsForCard`'s own `InteractionGroup[]`
 * output (that stays scoped to whole-POOL edge assembly, one row per
 * MATCH not per DECK QUANTITY, and — per its own doc comment — is a
 * separate concern this function must not depend on so it keeps working
 * if that pipeline is ever deprecated); it DOES reuse the same lower-level
 * primitives both are built on (`factsInteract`, `describeFact`,
 * `augmentPoolCards`) rather than re-deriving an approximation of any of
 * them, same discipline `findInteractionsForCard` itself already follows
 * for `matchCountForFact`.
 *
 * **What it computes**: for `target`'s own SINK facts only (never its
 * SOURCE facts — this is a one-directional "how well is this card's own
 * wants supplied" view, not a symmetric produce/consume graph), one row
 * per distinct sink LABEL (`describeFact(sink)` — see below), whose
 * `count` is the sum of `deck[].qty` for every deck entry that has AT
 * LEAST ONE real source fact `factsInteract`-matching AT LEAST ONE sink
 * fact under that label (a producer with several qualifying facts, or
 * several sink facts sharing one label, still only contributes its own
 * qty ONCE — this counts DECK COPIES of a matching card, not matching
 * FACT PAIRS).
 *
 * **Label = `describeFact(sink)`, not a new taxonomy.** Per
 * SYNERGY_DESIGN.md's "single-dimensional label" convention (already the
 * card page's own Facts-tab rule: a label is the bare category noun for
 * the fact's own zone/event kind — "battlefield presence", "dying",
 * "landfall" — WHO/WHAT-KIND detail is deliberately never folded in here,
 * same as everywhere else `describeFact` is the label). This is also
 * exactly the "group sink facts that mean the same thing" behavior the
 * feature needs for free: two sink facts that render the same bare label
 * (e.g. two differently-constrained "dying" wants) are already merged
 * into one row, with no separate grouping key to invent or keep in sync.
 * Rows are emitted in `target.sink`'s own declared order (first
 * occurrence of each label), the same "facts stay text-ordered" rule the
 * card page's own Facts tab follows — not resorted by count.
 *
 * **Self-interaction policy — SYNERGY_DESIGN.md "Self-interactions"**:
 * "The pair (A, A) is computed like any other and kept in the output,
 * never dropped." That policy is about the POOL-graph question of WHETHER
 * a card's own copy can satisfy its own sink at all (yes) — it predates
 * `Deck`/quantity as a concept entirely and says nothing about how a
 * *quantity* should be weighted, so this function makes the narrowest
 * possible extension consistent with it: if `target` itself appears in
 * `deck` (by name), it IS a normal candidate producer, but exactly ONE
 * unit of its own quantity is withheld — the physical copy this
 * computation is being run FOR cannot count as one of its own external
 * suppliers, but every OTHER real copy in the deck can and does (this is
 * literally SYNERGY_DESIGN's own "second copy on the battlefield" case,
 * made quantity-real: a deck with `qty=1` of `target` contributes 0 to its
 * own sink — collapsing to the same result plain exclusion would give for
 * the common single-copy case — while `qty=4` contributes up to 3, the
 * real other physical copies that could accompany the first). Applied
 * uniformly regardless of which `SelfInteractionKind` the match would tag
 * pool-wide (`same-instance` inherently needs no second copy at all, but
 * this function does not special-case it — see the note above about not
 * re-deriving new matching semantics beyond what's asked for; a same-
 * instance-only self-loop still only contributes via the `qty - 1` other
 * copies rule, same as any other self-match).
 *
 * **Matching — reuses `factsInteract` verbatim**, called the same
 * direction `findInteractionsForCard` calls it for a sink group
 * (`mineRole: 'sink'`), so every existing matching nuance (shape
 * partition, `target: 'self'` same-instance/broadcast rules, controller
 * compatibility, the `destroy`-implies-`dies` widening, etc.) — and every
 * existing KNOWN limitation of it (`Constraints.excludeSelf` is
 * documented-but-not-yet-consulted by `factsInteract`; see its own doc
 * comment) — carries over unchanged, not re-implemented or re-decided
 * here.
 *
 * `tokens` resolves `{token}` subjects on a deck entry's own source facts,
 * same optional parameter `findInteractionsForCard` already takes.
 */
export interface DeckEntry {
  /** Same `PoolCard` shape `findInteractionsForCard`'s own `pool` parameter takes — reused, not a parallel type, so a caller building one deck-loading path gets both functions for free. */
  card: PoolCard;
  /** How many physical copies of `card` are in the deck right now (PRD 01's own per-card-quantity sandbox model). Must be a non-negative integer; a `qty <= 0` entry is simply never a source of any count (same as omitting it). */
  qty: number;
}

export interface SinkSupplyRow {
  /** `describeFact` of the sink fact (or first-occurrence-ordered group of sink facts sharing that same bare label) this row represents — see this function's own doc comment for why this label scheme, not a new one. */
  label: string;
  /** Deck-quantity-weighted count of matching sources for this sink label, summed across every deck entry that has at least one qualifying source fact (see this function's own doc comment for the self-supply `qty - 1` rule). */
  count: number;
}

export function computeDeckSinkSupply(target: PoolCard, deck: DeckEntry[], tokens: Record<string, TokenLike> = {}): SinkSupplyRow[] {
  if (!target.sink.length) return [];
  const augmentedDeck = deck.map((entry) => ({ ...entry, card: augmentPoolCards([entry.card])[0]! }));

  const labelOrder: string[] = [];
  const sinksByLabel = new Map<string, Fact[]>();
  for (const sink of target.sink) {
    const label = describeFact(sink);
    if (!sinksByLabel.has(label)) {
      labelOrder.push(label);
      sinksByLabel.set(label, []);
    }
    sinksByLabel.get(label)!.push(sink);
  }

  return labelOrder.map((label) => {
    const sinks = sinksByLabel.get(label)!;
    let count = 0;
    for (const entry of augmentedDeck) {
      const isSelf = entry.card.name === target.name;
      const effectiveQty = isSelf ? entry.qty - 1 : entry.qty;
      if (effectiveQty <= 0) continue;
      const matches = sinks.some((sink) => entry.card.source.some((source) => factsInteract(sink, target, 'sink', source, entry.card, tokens)));
      if (matches) count += effectiveQty;
    }
    return { label, count };
  });
}
