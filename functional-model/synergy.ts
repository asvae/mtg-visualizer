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
}

/** 1-5, computed mechanically (not authored by hand) — real game-mechanical magnitude of a fact, steeply bucketed from the actual number involved (NOT linear: a 1-for-1 effect and a 2-for-1 effect are not "close" in power, so the bucketing jumps hard past 1 — magnitude 1 → 1, magnitude 2 → 4-5, magnitude 3+ → 5 — rather than spreading evenly):
 *  - on a `source` fact: the real number from `trace.json` (tokens/counters/damage/life/cards — whatever the source's own action carries).
 *  - on a `sink` fact: the fact's own declared `amount` constraint (e.g. "wants 3+ creatures" → 3) — no trace involved, it's a static requirement, not an action. A sink with no numeric constraint (most bare event hooks — "wants lifegain," no minimum) has no magnitude concept and stays unset (`factTotal` treats missing as neutral 1, same as a source with no measurable magnitude).
 * Previously paired with a second `ease` (rarity) dimension; dropped in favor of `value` alone on both sides — see git history for the retired rationale. A crude stand-in for real weighting (see SYNERGY_DESIGN.md's parked rarity-weighting note) — recompute if the pool changes meaningfully rather than trusting these to stay accurate. Renamed from `strength` (2026-09-05) — collided with d3-force's own unrelated `.strength()` API/graphRenderer.ts's physics terminology; `power` was tried next but collides with `Constraints.power` (a creature's real power stat), so this landed on `value` instead.
 *
 * `-1` is a distinct sentinel, NOT a real magnitude: "this fact has a value
 * field at all (so it's not merely predating the weight fields — see
 * `factTotal`'s own doc comment for that other, `undefined` case), but it's
 * a manual placeholder authored alongside the fact itself, pending a real
 * `compute-weights.mjs` pass" — e.g. a newly-authored self-referencing fact
 * with no trace magnitude to derive from yet. Stays visible as `-1` in
 * `synergy.json` (a human or a future `compute-weights.mjs` run should be
 * able to find it and replace it for real) but `factTotal` treats it exactly
 * like "unset" for any actual weighting/combination arithmetic — never
 * multiplied in as if it were real. */
export type Weight = -1 | 1 | 2 | 3 | 4 | 5;

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
  /** `event: 'addMana'`'s own free-form detail — the color produced (card.ts's `Effect` `kind: 'addMana'`'s own `color` field, or the single symbol `mana.ts`'s `manaAbilityColorFromStaticText` recognizes off a plain `"{T}: Add {X}."` static-ability string). Superseded by `colors` below for anything NEW (a plain string can't express a real choice-of-color ability as one matchable fact, only as display-equality) — kept only because 11 real single-color cards (Druid of the Cowl, Goobbue Gardener, Llanowar Elves, Midgar, Ishgard, Jidoor, Lindblum, Zanarkand, White Auracite, Willowrush Verge, Elvish Archdruid) already declare this field and migrating them is out of scope for the pass that added `colors` (2026-09-09) — still matched (by plain equality, same as `counterType`) for backward compatibility, and `factsInteract` also treats it as an implicit single-element `colors` set so it stays comparable against a `colors`-shaped want on the other side. */
  color?: string;
  /** `event: 'addMana'`'s own color-SET detail, added 2026-09-09 alongside `playLand` — reuses `TypeConstraint`'s exact `has`/`hasAny`/`not` vocabulary/matching (`satisfiesType`) rather than inventing a fourth constraint pattern, since "does the producer's color set satisfy the consumer's color need" is structurally the identical question `Constraints.types` already answers for card types. On a PRODUCE fact: which color(s) this ability can actually make — `hasAny` for a genuine choice-of-color ability (Vector, Imperial Capital's own "{T}: Add {B} or {R}." → `{hasAny:['B','R']}`, ONE fact instead of two `color:'B'`/`color:'R'` facts — it makes one of these per activation, never both at once, so `has` would misstate it as "makes both simultaneously"; a fixed single-color ability would use `{has:['G']}` if migrated). On a WANT fact: what color(s) the consumer needs — `has:['R']` for "needs R specifically," `hasAny:['W','U']` for "needs any of W or U," `not:['B']` for "needs any non-black source" — matched against the producer's own declared set (see `factsInteract`'s `colorSetOf`/`satisfiesType` reuse below), no separate matching code written for color. Coexists with `color` above (a legacy single-color fact) via the same `colorSetOf` helper, so a `colors`-shaped want still matches a `color`-shaped produce and vice versa. */
  colors?: TypeConstraint;
  /** `event: 'entersBattlefield'`'s own free-form detail — a real "enters the battlefield tapped" replacement (e.g. Vector, Imperial Capital's own "Vector, Imperial Capital enters tapped."). Same "documented free-form field, matched by plain equality when both sides declare it" treatment as `counterType`/`color` — no want declares one yet, so this is purely descriptive today. */
  tapped?: boolean;
  /** Documentary only — this event's own trigger/activation is capped to once per turn on the real card (e.g. Elrond's draw-per-activation), but nothing in state.ts/turn.ts enforces that cap yet (see progress.json's knownGaps). Not matched against anything. */
  oncePerTurn?: boolean;
  value?: Weight;
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
 */
export interface FactAnnotationAuthoring {
  anchor?: 'oracle' | 'typeLine';
  sourceText: string;
  highlight: string;
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

/** `fact.value` (1-5) — `compute-weights.mjs` writes an explicit value on EVERY fact it processes, source and sink alike, `1` (neutral) when the fact has no measurable magnitude (a bare event hook, an unquantified want) rather than leaving it unset. So `undefined` here only means "this fact predates the weight fields entirely" (never run through `compute-weights.mjs`) — genuinely unknown, not neutral — and stays `null` rather than being coerced to 1. `-1` (see `Weight`'s own doc comment) is a different kind of not-real-yet — a manual placeholder pending computation, not a predates-the-fields gap — but for arithmetic purposes it collapses to the same `null` here too: nothing downstream should ever multiply a placeholder in as if it were a real magnitude. A caller wanting a match's full two-sided value combines both sides' `factTotal` (see `server/api/graph-links.ts` — each side floors a `null` to 1 before use, per-side range 1-5, combined range 1-25). */
export function factTotal(fact: Fact): number | null {
  return fact.value != null && fact.value > 0 ? fact.value : null;
}

export interface InteractionMatch {
  card: string;
  /** Present only when `card` names THIS SAME card — the pair (A, A), computed and kept like any other match, never dropped (SYNERGY_DESIGN.md "Self-interactions"). */
  selfInteraction?: SelfInteractionKind;
  /** `factTotal` of the OTHER side's specific fact that satisfied this match (the group's own `fact` is `mine`'s side — see `InteractionGroup`) — a caller wanting this match's full two-sided value combines both (e.g. `Math.sqrt(mine * theirs)`), not just `mine` alone. `null` if that fact predates the weight fields. */
  theirTotal: number | null;
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
  // Generic fallback for every event this function doesn't special-case
  // above (`lifeloss`, `grantKeyword`, `landfall`, `scry`, `surveil`,
  // `graveyardLeaves`, `counter`, etc. — `damage` got its own bare branch
  // above; `castCreatureSpell`/`preventDamage` got theirs above too,
  // 2026-09-12, once real camelCase pool instances of each surfaced this
  // fallback's own raw-string display bug — see those branches' own doc
  // comments). Bare `event` string only (2026-09-10) — neither
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
 * elsewhere in the same text (not observed anywhere in the pool as of
 * 2026-09-11) is a real ambiguity this silently resolves by picking the
 * earliest. Returns `undefined` (not a hard failure by itself) when there's
 * no authoring entry at all, or the match fails — `computeFactAnnotations`'s
 * caller decides what a failed match means (a hard authoring failure for an
 * opted-in card, per `Fact.annotations`'s own required-field doc comment).
 */
function rawHighlightRange(text: string, authoring: FactAnnotationAuthoring | null | undefined): { start: number; end: number } | undefined {
  if (!authoring?.sourceText || !authoring.highlight) return undefined;
  const sourceIdx = text.indexOf(authoring.sourceText);
  if (sourceIdx === -1) return undefined;
  const highlightIdx = authoring.sourceText.indexOf(authoring.highlight);
  if (highlightIdx === -1) return undefined;
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
 */
function toLineOffset(oracleText: string, start: number, end: number): AnnotationRef | undefined {
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
 * this fact, or its `sourceText`/`highlight` don't verifiably match.
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

/** Does producer fact `p` (belonging to `pCard`) satisfy wanter fact `w` (belonging to `wCard`)? Symmetric to how it's invoked — `mine`/`mineRole` decide which side `p`/`w` actually is. Module-level (not nested in `findInteractionsForCard`) so `matchCountForFact` below can reuse the exact same real matching logic rather than a re-derived approximation. */
function factsInteract(mine: Fact, mineCard: PoolCard, mineRole: 'source' | 'sink', theirs: Fact, theirCard: PoolCard, tokens: Record<string, TokenLike>): boolean {
  const p = mineRole === 'source' ? mine : theirs;
  const pCard = mineRole === 'source' ? mineCard : theirCard;
  const w = mineRole === 'source' ? theirs : mine;
  const wCard = mineRole === 'source' ? theirCard : mineCard;
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
    if (pe.target === undefined) return true;
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

/** Every interaction `cardName` participates in, across `pool` (every card's own facts, itself included — self-interactions are a real, kept output, not filtered out). `tokens` resolves `{token}` subjects; omit for a card set with no token-producing effects yet. */
export function findInteractionsForCard(cardName: string, pool: PoolCard[], tokens: Record<string, TokenLike> = {}): InteractionGroup[] {
  const self = pool.find((p) => p.name === cardName);
  if (!self) return [];

  const groups: InteractionGroup[] = [];

  function matchOne(mine: Fact, mineCard: PoolCard, mineRole: 'source' | 'sink'): InteractionGroup | null {
    const matches: InteractionMatch[] = [];
    for (const other of pool) {
      const otherFacts = mineRole === 'source' ? other.sink : other.source;
      for (const theirs of otherFacts) {
        if (factsInteract(mine, mineCard, mineRole, theirs, other, tokens)) {
          const isSelf = other.name === mineCard.name;
          matches.push({
            card: other.name,
            selfInteraction: isSelf ? selfInteractionKind(mine, mineCard) : undefined,
            theirTotal: factTotal(theirs),
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
