// Shared, GENERAL `kind:'program'` AST walker (2026-09-16) — reads
// `combinator.ts`'s own `Query`/`Filter`/`Each`/`SelectUpTo`/`ApplyToBound`
// node shapes directly (never oracle text, never a card-specific shape
// check) and extracts a flat list of `ProgramOccurrence`s: "this
// `EachAction` fires against a pool with these real characteristics
// (owner/type filter), reached via this real targeting shape (a board-wide
// broadcast, or a single pick via `SelectUpTo`)."
//
// **Why this exists, and how "general" it actually is** — every structural
// recognizer in this catalog before this one (`destroy-effect-structural.ts`,
// `drawCard-effect-structural.ts`, etc.) reads ONE fixed declarative `Effect`
// KIND directly off `card.ts` (`kind:'destroy'`, `kind:'drawCard'`, ...).
// `kind:'program'` effects have no such fixed per-effect-kind shape — the
// SAME `EachAction` (`'destroy'`, `'equip'`, ...) can appear at the top level
// of a program (a board-wide broadcast, `ultima`'s own "destroy all artifacts
// and creatures"), inside a `SelectUpTo`/`ApplyToBound` pair (a single
// resolution-time pick, `coliseum-behemoth`'s own "Destroy target artifact or
// enchantment"), or nested two `SelectUpTo`s deep (`gilgamesh-master-at-
// arms`'s own "attach one of them to a Samurai you control", picking BOTH the
// equipment AND the creature it attaches to). A recognizer keyed on "the
// program's own top-level `kind`" the way `sequenceExileReturn-effect-
// structural.ts`/`selectUpTo-effect-structural.ts`/`selectUpToGainControl-
// effect-structural.ts` are would need one new file per shape-of-nesting, not
// just per action — this module exists so that doesn't have to keep
// happening: it walks the WHOLE tree once, generically, and hands back real,
// typed occurrences regardless of how deep the `SelectUpTo` nesting goes or
// whether the action fired via a broadcast `Each` or a single `ApplyToBound`.
//
// **What's actually general vs. what's still closed vocabulary** — the TREE
// WALK itself (`extractOccurrences` below) is fully general over
// `ProgramNode`/`Query`/`Filter` STRUCTURE: it recurses into every
// `SelectUpTo`/`Branch`/`Sequence`/`Each`/`ApplyToBound` node this file
// (`combinator.ts`) can produce, threading `SelectUpTo` bindings down so a
// later `ApplyToBound`/`equip.to` reference resolves correctly no matter how
// many `SelectUpTo` layers deep it sits. What's still a CLOSED, real-card-
// confirmed vocabulary (same "grow only when a real card forces it"
// discipline every recognizer in this catalog already follows) is: (a) which
// `EachAction.action` values this walker knows how to describe as an
// occurrence at all (`'destroy'`/`'equip'`/`'pump'`/`'dealDamage'`/
// `'putCounter'`/`'grantKeyword'` today — see `actionOccurrence` below; a
// `'tap'`/`'untap'`/`'gainControl'` EachAction is walked structurally but
// simply has no occurrence shape built for it yet, see this file's own
// header note on extending it), plus the one bare-player `DrawCard`
// `ProgramNode` (not an `EachAction` at all — walked directly in `walk()`'s
// own `case 'drawCard'`, see `DrawCardOccurrence`'s own doc comment), and
// (b) which `Query`/`Filter` POOL shapes `readPool` below can confidently
// reduce to a `Constraints['types']` value (a bare `Query`, one `cardType`/
// `subtype` filter, or `excludeSelf` — never two competing type-narrowing
// filters at once, see `readPool`'s own doc comment for the exact declines).
// Both (a) and (b) are meant to be widened incrementally by future
// recognizer work, exactly the same way `destroy-effect-structural.ts`'s own
// `validType`
// vocabulary or `drawCard-effect-structural.ts`'s own confirmed `amount`
// literals were widened — never by guessing ahead of a real confirming card.
//
// **Extending to a new action family** (e.g. a hypothetical future
// `EachAction.action: 'sacrifice'`): needs (1) a case in `actionOccurrence`
// below recognizing that action and building its own `ProgramOccurrence`
// variant (most actions only need the ONE pool this file already threads
// through; `'equip'` is the one exception needing a SECOND pool, the
// `to: BoundRef` target — see `EquipOccurrence` below for that shape), and
// (2) a new consuming recognizer file (parallel to
// `destroyProgram-effect-structural.ts`/`equipProgram-effect-structural.ts`)
// that maps ITS OWN real per-shape English clause templates onto the
// occurrences this walker now hands back — the walk itself
// (`extractOccurrences`/`readPool`/binding-threading) does NOT need to
// change again for that, which is the whole point of factoring it out here
// rather than copy-pasting a bespoke walk into every new action-family
// recognizer the way the pre-`structural-effects.ts` recognizers used to.
import type { Effect, Keyword } from '../card';
import type { ApplyToBound, BoundRef, CardTypeWord, CompareCondition, Each, EachAction, Filter, HasSubtypeCondition, ProgramNode, Query, SelectUpTo, ValueRef } from '../combinator';
import type { TypeConstraint } from '../synergy';
import { allEffects, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

type ProgramEffect = Extract<Effect, { kind: 'program' }>;

export function isProgramEffect(e: Effect): e is ProgramEffect {
  return e.kind === 'program';
}

/** Every `kind:'program'` effect on a face — thin wrapper over the shared
 * `allEffects` walk (`structural-effects.ts`), same as every other
 * structural recognizer's own first filtering step. */
export function programEffects(input: StructuralRecognizerInput): ProgramEffect[] {
  return allEffects(input).map((o) => o.effect).filter(isProgramEffect);
}

// ---------------------------------------------------------------------------
// Pool description — reduces a `Query`/`Filter` chain to the same
// `Constraints['types']` vocabulary `destroy-effect-structural.ts`'s own
// `buildTargetConstraint` already uses, plus which player(s) own it.

const CARD_TYPE_WORD: Record<CardTypeWord, string> = { creature: 'Creature', artifact: 'Artifact', land: 'Land', enchantment: 'Enchantment' };

export interface PoolDescriptor {
  owner: 'you' | 'opponents' | 'any';
  /** `undefined` for a genuinely unrestricted pool (a bare `permanentsInPlay`
   * query with no narrowing filter at all) — mirrors `destroy-effect-
   * structural.ts`'s own "no `target` key at all" convention for an
   * unrestricted "Destroy target permanent." */
  types?: TypeConstraint;
  /**
   * A chained `.filter('excludeSelf')` (2026-09-16, `putCounter`/
   * `grantKeyword` occurrence support pass, `venat-heart-of-hydaelyn-
   * hydaelyn-the-mothercrystal`'s own real "put a +1/+1 counter on ANOTHER
   * target creature you control") — mirrors `synergy.ts`'s own
   * `Constraints.excludeSelf` field exactly, meant to be copied straight
   * onto a consuming recognizer's own emitted `target`. Omitted (not
   * `false`) for a pool with no such filter. See `readPool`'s own doc
   * comment for why this used to be an unconditional decline and is now a
   * real, carried field instead.
   */
  excludeSelf?: boolean;
  /**
   * `true` only for a `Query.source:'equippedSelf'` pool (2026-09-16,
   * zack-fair's own equip-recognizer widening — see `readPool`'s own doc
   * comment). Distinguishes "Equipment currently attached to THIS card"
   * (`ctx.self.getEquippedBy()`, real Forge `Card.java` ~3850's own
   * `getEquippedBy()`, `interfaces.ts:125`) from an ordinary
   * `you.permanentsInPlay().filter(...,'Equipment')` controlled-Equipment
   * pool (weapons-vendor's own real "target Equipment you control") — both
   * reduce to the SAME `types:{has:['Equipment']}` word, so a consuming
   * recognizer needs this separate marker to tell them apart rather than
   * risk a wrong template (or an unresolved-mismatch hard-fail) picking the
   * wrong real English clause. Omitted (not `false`) for every other pool
   * shape, same "carried only when true" convention `excludeSelf` already
   * uses.
   */
  attachedToSelf?: true;
}

/**
 * Reduces a `Query`/`Filter` chain to a `PoolDescriptor` — `undefined`
 * (decline, never guess) the moment it sees anything outside this walker's
 * own real, confirmed vocabulary:
 *   - `excludeSelf` — **widened 2026-09-16** (`putCounter`/`grantKeyword`
 *     occurrence support pass, `venat-heart-of-hydaelyn-hydaelyn-the-
 *     mothercrystal`'s own real "put a +1/+1 counter on ANOTHER target
 *     creature you control") — used to be an unconditional decline
 *     ("no confirmed destroy/equip template combines 'another' with either
 *     action yet"); now carried forward as `PoolDescriptor.excludeSelf`
 *     instead of silently dropped, since `putCounterBoundProgram-effect-
 *     structural.ts`/`grantKeywordBoundProgram-effect-structural.ts` (the
 *     first REAL consumers of this bit) copy it straight onto their own
 *     emitted `target.excludeSelf` (`synergy.ts`'s own established field —
 *     same "another" semantics `pumpTarget-effect-structural.ts`'s own
 *     `notSelf`-sourced facts already carry). Still a real, live decline
 *     risk for `destroy`/`equip` specifically, NOT a solved problem there:
 *     neither `destroyProgram-effect-structural.ts` nor `equipProgram-
 *     effect-structural.ts` reads this new field off the `PoolDescriptor`
 *     they receive, so an `excludeSelf`+destroy/equip card would silently
 *     get a Fact with the "another" qualifier dropped rather than a clean
 *     decline — confirmed safe for NOW only because 0 real pool cards
 *     combine `excludeSelf` with `destroy`/`equip` today (checked
 *     pool-wide); widen those 2 recognizers to read/emit it before a real
 *     card needs that combination, don't rely on this note alone.
 *   - two DIFFERENT type-narrowing filters chained on the SAME pool with
 *     neither being redundant (a `subtype` filter always wins over a
 *     `cardType` filter when both are chained — Beatrix's own real
 *     `.filter('cardType','artifact').filter('subtype','Equipment')` is
 *     exactly this shape, and the base type word is dropped in favor of the
 *     more specific subtype, matching this pool's own existing hand-authored
 *     convention for the identical real card) — but two `subtype` filters,
 *     or a `cardType` array PLUS a `subtype`, has no real card to confirm a
 *     combined template against, so it declines.
 *   - `Query.source:'equippedSelf'` — **widened 2026-09-16** (zack-fair's
 *     own "attach an Equipment that was attached to Zack Fair to that
 *     creature") — this source is inherently Equipment-typed by real
 *     construction (`Card.getEquippedBy()`, `interfaces.ts:125`; unlike
 *     `'creaturesInPlay'`, which merely IMPLIES a word, an equip target can
 *     only ever be Equipment), so it resolves to `types:{has:['Equipment']}`
 *     PLUS the new `attachedToSelf: true` marker (see `PoolDescriptor`'s own
 *     doc comment for why a separate marker, not just the bare word, is
 *     needed). Declines (rather than guessing) if any `subtype`/`cardType`
 *     filter is ALSO chained on top — zack-fair's own real chain
 *     (`selfCard.equippedSelf()`, no further filter) is the sole real card
 *     confirming this source at all, so a filtered variant has nothing to
 *     confirm a combined template against.
 */
export function readPool(node: Query | Filter): PoolDescriptor | undefined {
  let cardTypeWords: string[] | undefined;
  let subtypeWord: string | undefined;
  let excludeSelf = false;
  let cur: Query | Filter = node;
  for (;;) {
    if (cur.kind === 'query') break;
    // cur.kind === 'filter'
    if (cur.predicate.field === 'excludeSelf') {
      excludeSelf = true;
      cur = cur.input;
      continue;
    }
    if (cur.predicate.field === 'sameNameAsSelf') {
      // 2026-09-18, Hare Apparent (FDN #15) — a real `FilterPredicate`
      // variant, but ONLY ever authored today on a bare `createToken.amount`
      // `ValueRef` (`card.ts`'s own `resolveCreateTokenAmount`, resolved
      // directly, never through a `kind:'program'` Effect at all — see
      // `sink-model/match-sink.ts`'s own `isSameNameCountValueRef`, a
      // dedicated, narrower walker for exactly that shape). No real
      // `kind:'program'` effect in this pool chains this predicate, so this
      // walker (built for `extractOccurrences`'s own program-AST-broadcast
      // pool descriptors) declines rather than guessing at a
      // `PoolDescriptor` shape nothing here has ever confirmed — same
      // "closed vocabulary, no real card to confirm against" discipline
      // every other branch in this function already follows.
      return undefined;
    }
    if (cur.predicate.field === 'subtype') {
      if (subtypeWord !== undefined) return undefined; // two subtype filters chained — no real card to confirm against
      subtypeWord = cur.predicate.value;
    } else {
      // cur.predicate.field === 'cardType'
      if (cardTypeWords !== undefined) return undefined; // two cardType filters chained — no real card to confirm against
      const value = cur.predicate.value;
      cardTypeWords = (Array.isArray(value) ? value : [value]).map((w) => CARD_TYPE_WORD[w]);
    }
    cur = cur.input;
  }
  const query: Query = cur;
  const excl = excludeSelf ? { excludeSelf: true as const } : {};

  if (query.source === 'equippedSelf') {
    // See this function's own doc comment — inherently Equipment-typed by
    // construction, plus the `attachedToSelf` marker a consuming recognizer
    // needs to tell it apart from an ordinary controlled-Equipment pool.
    if (subtypeWord !== undefined || cardTypeWords !== undefined) return undefined; // no real card confirms a filtered variant of this source
    return { owner: query.owner, types: { has: ['Equipment'] }, attachedToSelf: true, ...excl };
  }

  const words: string[] = [];
  if (query.source === 'creaturesInPlay') words.push('Creature'); // the Query source itself already implies this word — real precedent: `gilgamesh-master-at-arms`'s own existing hand-authored Samurai-pool sink is `{has:['Creature','Samurai']}`, not bare `{has:['Samurai']}`
  if (subtypeWord !== undefined) {
    // A subtype filter supersedes a chained cardType filter's own word (real
    // precedent: `beatrix-loyal-general`'s own existing hand-authored
    // Equipment-pool sink is bare `{has:['Equipment']}`, not
    // `{has:['Artifact','Equipment']}`, even though its own real chain is
    // `.filter('cardType','artifact').filter('subtype','Equipment')`).
    words.push(subtypeWord);
    return { owner: query.owner, types: { has: words }, ...excl };
  }
  if (cardTypeWords !== undefined) {
    if (cardTypeWords.length > 1) return { owner: query.owner, types: { hasAny: [...words, ...cardTypeWords] }, ...excl };
    return { owner: query.owner, types: { has: [...words, ...cardTypeWords] }, ...excl };
  }
  if (words.length > 0) return { owner: query.owner, types: { has: words }, ...excl };
  return { owner: query.owner, ...excl }; // genuinely unrestricted pool (bare permanentsInPlay, no filter at all) except for a possible `excludeSelf`
}

/**
 * A resolved "wants N+ of this pool present" magnitude, read off a real
 * `Branch`'s own `CompareCondition` (2026-09-16, `'pump'`/`'dealDamage'`
 * occurrence support pass, `you're-not-alone`'s own real motivating card —
 * see `PumpOccurrence.guard`'s own doc comment for where this attaches).
 * Same output shape `ptFormula-scalingPump-structural.ts`'s own
 * `thresholdBonus` branch already builds by hand for a DIFFERENT structural
 * gate (`CardDefinition.ptFormula`, not a program-AST `Branch`) — this is
 * the program-AST-walker equivalent of that same real "wants a controlled-
 * permanent count >= min" claim.
 *
 * **Closed vocabulary, confirmed against exactly one real card** (you're-
 * not-alone's own `compare(you.creaturesInPlay().count(), '>=', 3)` —
 * `SVar:X:Count$Compare Y GE3.4.2`/`SVar:Y:Count$Valid Creature.YouCtrl`):
 * only `op:'>='` with a `left` that's a plain `Aggregate{op:'count'}` and a
 * `right` that's a plain numeric `literal` resolves to anything — every
 * other real shape (a `sum` aggregate, `selfCounters`, an `AddValue`, a
 * non-`>=` operator, a non-literal `right`) declines (`undefined`), same
 * "never guess past what a real card has confirmed" discipline every other
 * function in this file already follows.
 */
export function readGuardCondition(condition: CompareCondition): { pool: PoolDescriptor; min: number } | undefined {
  if (condition.op !== '>=') return undefined;
  if (condition.left.kind !== 'aggregate' || condition.left.op !== 'count') return undefined;
  if (condition.right.kind !== 'literal') return undefined;
  const pool = readPool(condition.left.input);
  if (!pool) return undefined;
  return { pool, min: condition.right.value };
}

/**
 * The categorical counterpart to `readGuardCondition` above — a
 * `HasSubtypeCondition`'s own `subtype`, for `DrawCardOccurrence.guard`
 * (2026-09-16, Venat/Hydaelyn's own "if that creature is legendary, draw a
 * card"). Deliberately does NOT check `condition.target` against any
 * particular binding name — this walker already only reaches a `Branch` via
 * the shared `bindings` map any earlier `SelectUpTo` set up, and a
 * consuming recognizer that cares WHICH bound item the condition names (as
 * opposed to just "some subtype gate is active") can still read
 * `condition.target` itself directly off the original AST; this helper only
 * extracts the one piece every real card so far has needed. Always
 * resolves (unlike `readGuardCondition`, which has real declines) — a
 * `HasSubtypeCondition`'s own shape has no unconfirmed sub-variant to guard
 * against yet.
 */
export function readSubtypeGuardCondition(condition: HasSubtypeCondition): { subtype: string } {
  return { subtype: condition.subtype };
}

// ---------------------------------------------------------------------------
// Occurrences — one real `EachAction` firing against a real pool, reached via
// a real targeting shape. `targeted: false` = board-wide broadcast (a bare
// top-level `Each` over a `Query`/`Filter`, never wrapped in a
// `SelectUpTo`); `targeted: true` = a single resolution-time pick (an
// `ApplyToBound`, or an `Each` broadcasting onto a bound `SelectUpTo` pick —
// see `EquipOccurrence` below for that second shape).

export interface DestroyOccurrence {
  kind: 'destroy';
  targeted: boolean;
  pool: PoolDescriptor;
}

/**
 * `equipmentPool` — the pool the Equipment itself is drawn from.
 * `equipmentTargeted` — `false` when EVERY item in `equipmentPool` gets
 * attached (a broadcast `Each`, `beatrix-loyal-general`'s own real "attach
 * ANY NUMBER of Equipment you control" — no per-item pick at all); `true`
 * when exactly one Equipment was itself picked via its own `SelectUpTo`
 * before being attached (`gilgamesh-master-at-arms`'s own real "attach ONE
 * OF THEM" — the equipment pool is picked from just as much as the target
 * is). `targetPool` — the pool the creature being attached TO is drawn from
 * (always reached via a `SelectUpTo`, CR 301.5c requires a chosen legal
 * creature either way).
 */
export interface EquipOccurrence {
  kind: 'equip';
  equipmentPool: PoolDescriptor;
  equipmentTargeted: boolean;
  targetPool: PoolDescriptor;
}

/**
 * A `'pump'`/`'dealDamage'` `EachAction` occurrence (2026-09-16, added for
 * `you're-not-alone`/`slash-of-light` — both real cards already migrated
 * onto `kind:'program'` but with no consuming recognizer able to read
 * either action family; see this file's own header, "what's still closed
 * vocabulary," for why these two were previously unbuilt). `amount`/
 * `power`/`toughness` are the raw `ValueRef`s straight off the `EachAction`
 * — a consuming recognizer decides what real English template (if any) a
 * given `ValueRef` shape (a literal, an `AddValue` sum, ...) maps to; this
 * walker itself never interprets the VALUE, only the STRUCTURE (same
 * "structure, not text" split every other occurrence kind here keeps).
 *
 * `guard` — the innermost enclosing `Branch`'s own `CompareCondition`,
 * resolved via `readGuardCondition` above, ONLY when this occurrence sits
 * inside that branch's `then` list (never `else` — a `then`-side bonus
 * really does "want" the guard's own threshold met; the `else`-side
 * fallback doesn't, see `readGuardCondition`'s own doc comment for the
 * real motivating card). `undefined` for an occurrence with no enclosing
 * `Branch` at all (slash-of-light's own shape — a flat `ApplyToBound`, no
 * `Branch` anywhere in its program) or one whose enclosing condition isn't
 * a resolvable `CompareCondition` (a `HasSubtypeCondition`, or a
 * `CompareCondition` `readGuardCondition` itself declines).
 */
export interface PumpOccurrence {
  kind: 'pump';
  targeted: boolean;
  pool: PoolDescriptor;
  power: ValueRef;
  toughness: ValueRef;
  untilEndOfTurn?: boolean;
  guard?: { pool: PoolDescriptor; min: number };
}

export interface DealDamageOccurrence {
  kind: 'dealDamage';
  targeted: boolean;
  pool: PoolDescriptor;
  amount: ValueRef;
  guard?: { pool: PoolDescriptor; min: number };
}

/**
 * A `'putCounter'`/`'grantKeyword'` `EachAction` occurrence (2026-09-16,
 * added for Venat, Heart of Hydaelyn/Hydaelyn, the Mothercrystal's own
 * Blessing of Light — "put a +1/+1 counter on another target creature you
 * control. Until your next turn, it gains indestructible." — the walker's
 * own header already flagged both actions as "walked structurally but
 * simply has no occurrence shape built for it yet" before this pass). Same
 * "raw `ValueRef`/keyword straight off the `EachAction`, `guard` scoped to
 * the innermost `then`-side `Branch`" shape `PumpOccurrence`/
 * `DealDamageOccurrence` already establish — see their own doc comments,
 * not repeated here. `pool.excludeSelf` (see `PoolDescriptor`'s own doc
 * comment) is how "another" surfaces for either of these — a consuming
 * recognizer copies it straight onto its own emitted `target.excludeSelf`.
 */
export interface PutCounterOccurrence {
  kind: 'putCounter';
  targeted: boolean;
  pool: PoolDescriptor;
  counterType: string;
  amount: ValueRef;
  guard?: { pool: PoolDescriptor; min: number };
}

export interface GrantKeywordOccurrence {
  kind: 'grantKeyword';
  targeted: boolean;
  pool: PoolDescriptor;
  keyword: Keyword;
  untilEndOfTurn?: boolean;
  guard?: { pool: PoolDescriptor; min: number };
}

/**
 * A bare `DrawCard` `ProgramNode` occurrence (2026-09-16, same Venat/
 * Hydaelyn motivator as `PutCounterOccurrence`/`GrantKeywordOccurrence`
 * above — "...if that creature is legendary, draw a card"). Unlike every
 * other occurrence here, this ISN'T an `EachAction` reached through
 * `actionOccurrence` at all (`DrawCard` acts on the PLAYER, not a matched
 * `Card` item — see `combinator.ts`'s own `DrawCard` doc comment), so it's
 * walked directly in `walk()`'s own `case 'drawCard'` below, not via
 * `actionOccurrence`. `guard` — same "innermost enclosing `Branch`'s own
 * resolved condition" shape as every other occurrence, but ALSO widened to
 * carry a resolved `HasSubtypeCondition` (`{ subtype }`), since that's the
 * one real gate Venat's own draw sits behind — `CompareCondition`-shaped
 * numeric guards (`readGuardCondition`) stay exactly as before.
 */
export interface DrawCardOccurrence {
  kind: 'drawCard';
  amount: ValueRef | 1;
  guard?: { pool: PoolDescriptor; min: number } | { subtype: string };
}

export type ProgramOccurrence = DestroyOccurrence | EquipOccurrence | PumpOccurrence | DealDamageOccurrence | PutCounterOccurrence | GrantKeywordOccurrence | DrawCardOccurrence;

/** `undefined` value = a real `SelectUpTo` binding whose own `readPool` call
 * declined (out-of-vocabulary filter chain) — kept as an explicit map entry
 * (not just "absent") so a later `ApplyToBound`/`equip.to` reference against
 * it can tell "declined" apart from "never bound at all," though both
 * currently decline the same way (`actionOccurrence` returns `undefined`
 * either way). */
type Bindings = Map<string, PoolDescriptor | undefined>;

function resolveBoundRef(bindings: Bindings, ref: BoundRef): PoolDescriptor | undefined {
  return bindings.get(ref.name);
}

/** Walks one `ProgramNode` (and everything nested inside it), threading
 * `SelectUpTo` bindings down so a later `ApplyToBound`/`equip.to` reference
 * anywhere further down the SAME tree resolves against the pool it was
 * actually picked from — see this file's own header for why this walk needs
 * to be a real recursive tree walk rather than a single-level scan. */
export function extractOccurrences(node: ProgramNode, bindings: Bindings = new Map()): ProgramOccurrence[] {
  const out: ProgramOccurrence[] = [];
  walk(node, bindings, out);
  return out;
}

function actionOccurrence(
  action: EachAction,
  pool: PoolDescriptor | undefined,
  targeted: boolean,
  bindings: Bindings,
  guard: { pool: PoolDescriptor; min: number } | undefined,
): ProgramOccurrence | undefined {
  if (!pool) return undefined;
  if (action.action === 'destroy') return { kind: 'destroy', targeted, pool };
  if (action.action === 'equip') {
    const targetPool = resolveBoundRef(bindings, action.to);
    if (!targetPool) return undefined; // the `to` binding's own pool declined (readPool) or doesn't exist — no confirmed template to build without it
    return { kind: 'equip', equipmentPool: pool, equipmentTargeted: targeted, targetPool };
  }
  // `'pump'`/`'dealDamage'` occurrence support (2026-09-16, `you're-not-
  // alone`/`slash-of-light`'s own recognizer-lane triage) — see
  // `PumpOccurrence`/`DealDamageOccurrence`'s own doc comments above for
  // the real motivating cards and the `guard` field's own scoping.
  if (action.action === 'pump') {
    return { kind: 'pump', targeted, pool, power: action.power, toughness: action.toughness, ...(action.untilEndOfTurn ? { untilEndOfTurn: true as const } : {}), ...(guard ? { guard } : {}) };
  }
  if (action.action === 'dealDamage') {
    return { kind: 'dealDamage', targeted, pool, amount: action.amount, ...(guard ? { guard } : {}) };
  }
  // `'putCounter'`/`'grantKeyword'` occurrence support (2026-09-16, Venat,
  // Heart of Hydaelyn/Hydaelyn, the Mothercrystal's own Blessing of Light) —
  // see `PutCounterOccurrence`/`GrantKeywordOccurrence`'s own doc comments
  // above.
  if (action.action === 'putCounter') {
    return { kind: 'putCounter', targeted, pool, counterType: action.counterType, amount: action.amount, ...(guard ? { guard } : {}) };
  }
  if (action.action === 'grantKeyword') {
    return { kind: 'grantKeyword', targeted, pool, keyword: action.keyword, ...(action.untilEndOfTurn ? { untilEndOfTurn: true as const } : {}), ...(guard ? { guard } : {}) };
  }
  // Every other `EachAction` (`tap`/`untap`/`gainControl`) is walked
  // structurally (nothing here throws or skips the surrounding tree) but has
  // no occurrence shape built yet — see this file's own header, "Extending
  // to a new action family."
  return undefined;
}

function walk(
  node: ProgramNode,
  bindings: Bindings,
  out: ProgramOccurrence[],
  guard?: { pool: PoolDescriptor; min: number },
  subtypeGuard?: { subtype: string },
): void {
  switch (node.kind) {
    case 'each': {
      if (node.input.kind === 'bound') {
        // `Each{input:{kind:'bound',...}}` — no real destroy/equip card in
        // the pool uses this shape (both real `equip`-broadcast cards this
        // walker was built against iterate an independent `Query`/`Filter`
        // pool, never a re-read of a PRIOR `SelectUpTo` pick) — structurally
        // walked (no throw) but no occurrence built for it yet.
        return;
      }
      const pool = readPool(node.input);
      const occ = actionOccurrence(node.action, pool, false, bindings, guard);
      if (occ) out.push(occ);
      return;
    }
    case 'applyToBound': {
      const pool = bindings.get(node.name);
      const occ = actionOccurrence(node.action, pool, true, bindings, guard);
      if (occ) out.push(occ);
      return;
    }
    case 'selectUpTo': {
      const pool = readPool(node.from);
      const nested = new Map(bindings);
      nested.set(node.as, pool);
      for (const step of node.then) walk(step, nested, out, guard, subtypeGuard);
      return;
    }
    case 'branch': {
      // `guard` threading (2026-09-16, `'pump'`/`'dealDamage'` occurrence
      // support pass) — see `PumpOccurrence.guard`'s own doc comment: only
      // the `then` list inherits this branch's own `CompareCondition` (an
      // occurrence inside `else` fires exactly when the guard is FALSE, so
      // it never "wants" the guard's own threshold met — `else` always just
      // threads through whatever OUTER guard, if any, was already active).
      // A non-`'compare'` condition (`HasSubtypeCondition`) or one
      // `readGuardCondition` itself can't resolve leaves `then` with
      // whatever outer guard was already active too — no real card nests
      // two independent guards today, so this single-level "innermost
      // resolvable compare wins" rule is deliberately not composing them.
      const thenGuard = node.condition.kind === 'compare' ? readGuardCondition(node.condition) ?? guard : guard;
      // `subtypeGuard` threading (2026-09-16, `DrawCardOccurrence`'s own
      // categorical-gate support, Venat's own real "if that creature is
      // legendary, draw a card") — same `then`-only inheritance rule as
      // `guard` above, just for `HasSubtypeCondition` instead of
      // `CompareCondition`. Kept as a wholly separate parameter (not merged
      // into `guard`'s own union) since `PumpOccurrence`/`DealDamageOccurrence`/
      // `PutCounterOccurrence`/`GrantKeywordOccurrence` only ever carry the
      // numeric shape — only `DrawCardOccurrence` reads this one.
      const thenSubtypeGuard = node.condition.kind === 'hasSubtype' ? readSubtypeGuardCondition(node.condition) ?? subtypeGuard : subtypeGuard;
      for (const step of node.then) walk(step, bindings, out, thenGuard, thenSubtypeGuard);
      for (const step of node.else ?? []) walk(step, bindings, out, guard, subtypeGuard);
      return;
    }
    case 'sequence':
      // Plain, fixed, self-targeted zone moves — no `Each`/`ApplyToBound`
      // anywhere inside (`combinator.ts`'s own `Sequence` doc comment); no
      // destroy/equip occurrence can ever appear here.
      return;
    case 'drawCard': {
      // See `DrawCardOccurrence`'s own doc comment — not an `EachAction`,
      // so this bypasses `actionOccurrence` entirely. Whichever guard
      // (numeric or categorical) is currently active wins; no real card
      // nests both at once today (same tolerance `guard`/`thenGuard` above
      // already accept for two independent numeric guards).
      out.push({ kind: 'drawCard', amount: node.amount ?? 1, ...(subtypeGuard ? { guard: subtypeGuard } : guard ? { guard } : {}) });
      return;
    }
    default: {
      const _exhaustive: never = node;
      throw new Error(`unhandled ProgramNode kind: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

// Re-exported so a consuming recognizer never has to import combinator.ts's
// own node types directly just to type its own helper functions.
export type { Each, SelectUpTo, ApplyToBound, Query, Filter };
