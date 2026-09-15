// PROMOTED to real production status (2026-09-13, `putCounter-broadcast-
// structural.ts`'s own wiring pass) — extends `runtime-dependency-probe.ts`'s
// own read-only, `ctx`-only instrumentation to ALSO instrument `actions`
// (`kind:'custom'`'s real arity-2 `run(ctx, actions)` shape) — per
// `PRD_AUTOMATED_AUTHORING.md`'s tier-3-elimination follow-up task
// (2026-09-13, "extending it to ALSO safely instrument actions"). WAS a
// standalone, unwired prototype (`runtime-action-probe.prototype.ts`) — now
// a real dependency of `recognizers/putCounter-broadcast-structural.ts`
// (`probeBroadcastPutCounter`, consumed for real by `apply-recognizers.mjs`'s
// wired `RECOGNIZERS` list), checked against the real pool's every
// `actions.putCounter`-using `kind:'custom'` closure (18 real candidates;
// exactly 3 classify — Aerith Gainsborough, Dion Bahamut's Dominant's own
// back face, The Crystal's Chosen — see that recognizer file's own module
// doc comment for the full real-pool check).
//
// **Same safety discipline as the read-only probe, extended to cover
// mutation too**: every fake `Actions` method below is an INERT MOCK — none
// of them touch any real `GameState`/`RealCard` (there is none in reach of
// this module at all). `putCounter`/`tap` are no-ops that only get OBSERVED
// (never actually mutate the fake board's own P/T/tapped-state), same
// "instrumented but harmless" contract the read-only probe's own
// `gainLife`/`loseLife` mocks already establish.
//
// **Scope, deliberately narrow, same "false negatives fine, false
// positives never" discipline every recognizer in this catalog follows**:
// this module only knows how to classify ONE real closure shape —
// `actions.putCounter(target, counterType, amount)` called in a loop over
// EVERY element of a single, same-side collection filtered by a per-item
// `hasSubtype`/type-predicate check, with NO `actions.chooseTarget` call
// anywhere (i.e. a genuine unconditional BROADCAST, never a player's own
// choice among candidates). Declines everything else outright — see
// `probeBroadcastPutCounter`'s own doc comment below for the exact decline
// conditions, and the "Aerith Rescue Mission" section further down for a
// REAL, hand-traced case this module's own author explored and then
// deliberately declined to mechanize, not just skipped.
//
// **A real, generically-useful bug this exploration found and fixed here**:
// the read-only probe's own `wrap()` (sibling file) unconditionally
// re-wraps EVERY function call's return value in a brand new `Proxy`, even
// when that return value is ALREADY one of its own proxies (e.g.
// `actions.chooseTarget(pool)` returning `pool[0]`, itself already a
// wrapped `Card` proxy). This silently breaks any closure logic relying on
// reference identity across statements — `Array.prototype.includes`
// (`tapped.includes(c)`), specifically, is the real shape `aerith-rescue-
// mission`'s own closure needs (see below). Fixed here via a `pathOf`
// `WeakMap` (every proxy this module's own `wrap()` produces is registered
// against the path it was created with) checked FIRST: a value that's
// ALREADY one of this module's own proxies is returned UNCHANGED rather
// than wrapped a second time, preserving `===` identity across repeated
// round-trips through an instrumented function call.
import type { Card, Player, ZoneType } from '../interfaces';
import type { Actions, EffectContext } from '../card';

type Trace = string[];

function describeArg(a: unknown): string {
  if (typeof a === 'string') return JSON.stringify(a);
  if (typeof a === 'number' || typeof a === 'boolean') return String(a);
  if (a === undefined) return 'undefined';
  if (a === null) return 'null';
  if (typeof a === 'function') return '<fn>';
  if (Array.isArray(a)) return `[${a.length} items]`;
  return '<obj>';
}

interface ActionLogEntry {
  method: string;
  args: unknown[];
}

/**
 * Same recursive-`Proxy` instrumentation as `runtime-dependency-probe
 * .prototype.ts`'s own `wrap()`, plus two additions: (1) the identity-
 * preserving `pathOf` check described in this module's own header, and (2)
 * `actionLog` — a STRUCTURED (not just flattened-to-a-string) record of
 * every call made through a property path beginning `actions.` (the real
 * target OBJECT reference is needed later, to resolve which known fixture
 * candidate it corresponds to — a flat string can't carry that).
 */
function wrap<T>(value: T, path: string, trace: Trace, pathOf: WeakMap<object, string>, actionLog: ActionLogEntry[]): T {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;
  if (pathOf.has(value as object)) return value; // already one of OUR proxies — never double-wrap, see module header

  if (typeof value === 'function') {
    const proxy = new Proxy(value as unknown as (...a: unknown[]) => unknown, {
      apply(target, thisArg, args) {
        const callPath = `${path}(${args.map(describeArg).join(', ')})`;
        trace.push(callPath);
        if (path.startsWith('actions.')) actionLog.push({ method: path.slice('actions.'.length), args });
        const result = Reflect.apply(target, thisArg, args);
        return wrap(result, callPath, trace, pathOf, actionLog);
      },
    }) as unknown as T;
    pathOf.set(proxy as object, path);
    return proxy;
  }

  if (Array.isArray(value)) {
    const proxy = new Proxy(value, {
      get(target, prop, receiver) {
        if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);
        if (/^\d+$/.test(prop)) return wrap(Reflect.get(target, prop, receiver), `${path}[*]`, trace, pathOf, actionLog);
        trace.push(`${path}.${prop}`);
        return Reflect.get(target, prop, receiver);
      },
    }) as unknown as T;
    pathOf.set(proxy as object, path);
    return proxy;
  }

  const proxy = new Proxy(value as object, {
    get(target, prop, receiver) {
      if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);
      const childPath = path ? `${path}.${String(prop)}` : String(prop);
      return wrap(Reflect.get(target, prop, receiver), childPath, trace, pathOf, actionLog);
    },
  }) as unknown as T;
  pathOf.set(proxy as object, path);
  return proxy;
}

// ---------------------------------------------------------------------------
// Fake board — deliberately RICHER than the read-only probe's own fixture:
// this module's own classification needs at least one POSITIVE and one
// NEGATIVE candidate for the one subtype (`Legendary`) it's being asked to
// recover, on BOTH sides of the board (a "you" and an "opponent" copy of
// each), so a closure that only ever reads `ctx.you` (never `ctx.opponents`
// at all) is genuinely, observably distinguishable from one that doesn't —
// even though NEITHER of the two facts this module ultimately derives
// encodes a controller restriction on `target` itself (see
// `probeBroadcastPutCounter`'s own doc comment for why not — matches this
// pool's own real, established convention).
// ---------------------------------------------------------------------------

interface FakeCandidate {
  id: number;
  raw: Card;
  side: 'you' | 'opponent';
  creature: boolean;
  land: boolean;
  subtypes: string[];
}

function mkFakeCard(
  id: number,
  opts: { name?: string; cmc?: number; subtypes?: string[]; creature?: boolean; land?: boolean; counters?: Record<string, number> } = {}
): Card {
  return {
    getId: () => id,
    getName: () => opts.name ?? `Fake Card ${id}`,
    getCounters: (t: string) => opts.counters?.[t] ?? 0,
    isToken: () => false,
    isAttacking: () => false,
    getOwner: () => null as unknown as Player,
    getController: () => null as unknown as Player,
    getNetPower: () => 2,
    getNetToughness: () => 2,
    hasSubtype: (s: string) => (opts.subtypes ?? []).includes(s),
    hasKeyword: () => false,
    isCreature: () => opts.creature ?? true,
    isLand: () => opts.land ?? false,
    isEnchantment: () => false,
    isArtifact: () => false,
    isTapped: () => false,
    getCMC: () => opts.cmc ?? 3,
    getAttachedTo: () => undefined,
    getEquippedBy: () => [],
  };
}

function mkFakePlayer(id: number, name: string, cardsThunk: () => Card[]): Player {
  return {
    getId: () => id,
    getName: () => name,
    getCounters: () => 0,
    getLife: () => 20,
    gainLife: () => true, // inert mock — no real life total exists to mutate
    loseLife: () => 0, // inert mock — no real life total exists to mutate
    drawCard: () => cardsThunk().slice(0, 1),
    drawCards: (n: number) => cardsThunk().slice(0, n),
    getCreaturesInPlay: () => cardsThunk().filter((c) => c.isCreature()),
    getLandsInPlay: () => cardsThunk().filter((c) => c.isLand()),
    getCardsIn: (_zone: ZoneType) => cardsThunk(),
    addMana: () => {}, // inert mock, same as the read-only probe's own
  };
}

/** Every fake `Actions` method the real `Actions` interface requires. Only
 * `putCounter`/`chooseTarget`/`tap` have any real (still fully inert —
 * see module header) behavior; every other member is a bare, harmless
 * no-op — this module doesn't classify any effect that would need them,
 * but `Actions` itself has no optional members, so a real object literal
 * satisfying the whole interface is required either way. */
function mkFakeActions(): Actions {
  const noop = () => undefined as never;
  return {
    createToken: noop,
    pump: noop,
    moveTo: noop,
    chooseTarget: (pool: Card[]) => pool[0]!,
    move: noop,
    mill: noop,
    sacrifice: noop,
    discard: noop,
    putCounter: noop,
    equip: noop,
    animate: noop,
    gainControl: noop,
    surveil: noop,
    counter: noop,
    destroy: noop,
    dealDamage: noop,
    tap: noop,
    untap: noop,
    dig: noop,
    grantKeyword: noop,
    copyPermanent: noop,
    delayUntil: noop,
    queueExtraPhase: noop,
    play: noop,
  } as unknown as Actions;
}

function buildFakeActionContext(
  trace: Trace,
  actionLog: ActionLogEntry[],
  pathOf: WeakMap<object, string>,
  opts: { selfCounters?: Record<string, number> }
): { ctx: EffectContext; actions: Actions; registry: FakeCandidate[] } {
  const self = mkFakeCard(1, { name: 'Fake Self', counters: opts.selfCounters });
  const youOthers: FakeCandidate[] = [
    { id: 101, raw: mkFakeCard(101, { name: 'Fake Other Creature', subtypes: ['Elf'] }), side: 'you', creature: true, land: false, subtypes: ['Elf'] },
    { id: 102, raw: mkFakeCard(102, { name: 'Fake Other Legendary Creature', subtypes: ['Legendary'] }), side: 'you', creature: true, land: false, subtypes: ['Legendary'] },
    { id: 103, raw: mkFakeCard(103, { name: 'Fake Other Land', creature: false, land: true }), side: 'you', creature: false, land: true, subtypes: [] },
  ];
  const oppOthers: FakeCandidate[] = [
    { id: 201, raw: mkFakeCard(201, { name: 'Fake Opp Creature' }), side: 'opponent', creature: true, land: false, subtypes: [] },
    { id: 202, raw: mkFakeCard(202, { name: 'Fake Opp Legendary Creature', subtypes: ['Legendary'] }), side: 'opponent', creature: true, land: false, subtypes: ['Legendary'] },
  ];
  const registry: FakeCandidate[] = [{ id: 1, raw: self, side: 'you', creature: true, land: false, subtypes: [] }, ...youOthers, ...oppOthers];

  const battlefield = [self, ...youOthers.map((c) => c.raw)];
  const oppBattlefield = oppOthers.map((c) => c.raw);

  const you = mkFakePlayer(900, 'Fake Player (you)', () => battlefield);
  const opponent = mkFakePlayer(901, 'Fake Opponent', () => oppBattlefield);

  const rawCtx: EffectContext = {
    self,
    you,
    opponents: [opponent],
    castFrom: 'hand',
    mode: undefined,
    triggerInput: {},
    xPaid: undefined,
    declineOptional: undefined,
    preferTarget: undefined,
    topLibraryCard: undefined,
    firstPhaseGroupOccurrenceThisTurn: undefined,
    declaredTargets: undefined,
  };
  const ctx = wrap(rawCtx, '', trace, pathOf, actionLog);
  const actions = wrap(mkFakeActions(), 'actions', trace, pathOf, actionLog);
  return { ctx, actions, registry };
}

// ---------------------------------------------------------------------------
// Classification — `actions.putCounter` broadcast-to-a-filtered-collection
// shape only. See module header for the exact scope.
// ---------------------------------------------------------------------------

export interface BroadcastPutCounterFact {
  event: 'putCounter';
  counterType: string;
  controller: 'you';
  target: { types: { has: string[] } };
  targeted: boolean;
}

export type ActionProbeResult =
  | { classified: true; fact: BroadcastPutCounterFact; trace: Trace }
  | { classified: false; reason: string; trace: Trace };

/**
 * Runs `fn` (a `kind:'custom'` effect's own `run(ctx, actions)` body) once
 * against the fake board above, then classifies ONLY the narrow shape
 * described in this module's own header. Every other observed pattern
 * declines with a specific `reason` — never a guess.
 *
 * **Target-constraint derivation, precisely**: this module OWNS the fixture
 * (it built every fake candidate itself, see `FakeCandidate` above), so it
 * resolves which known candidate each `actions.putCounter` target argument
 * corresponds to by calling that argument's own real `getId()` (routes
 * harmlessly through the same instrumentation, returns the literal id) and
 * matching against `registry` BY ID — no path-string parsing needed for
 * this half. A subtype is added to the derived `target.types.has` only when
 * it's a real, CONFIRMED narrowing signal: every touched candidate carries
 * it AND at least one untouched (but still creature-typed) candidate lacks
 * it — logical induction over ground truth this module already knows, not
 * correlation with a raw trace string.
 *
 * **Why the derived fact never encodes a controller restriction on
 * `target`, even though the real closure only ever reads `ctx.you`'s own
 * creatures** (confirmed real pool convention, not an oversight): every
 * existing hand-authored "wants type X present"-shaped `target`/sink
 * Constraints object in this pool (`mirroredPresenceSinks`'s own emitted
 * shape, e.g.) omits `controller` entirely — a produce fact's own top-level
 * `controller: 'you'` field already says who's producing it; the nested
 * `target` Constraints only ever narrows WHAT kind of thing, never who
 * controls it, matching `aerith-gainsborough`'s own real hand-authored fact
 * exactly (`target:{types:{has:['Creature','Legendary']}}`, no
 * `target.controller`).
 */
export function probeBroadcastPutCounter(fn: (ctx: EffectContext, actions: Actions) => void, opts: { selfCounters?: Record<string, number> } = {}): ActionProbeResult {
  const trace: Trace = [];
  const actionLog: ActionLogEntry[] = [];
  const pathOf = new WeakMap<object, string>();
  const { ctx, actions, registry } = buildFakeActionContext(trace, actionLog, pathOf, opts);

  try {
    fn(ctx, actions);
  } catch (e) {
    return { classified: false, reason: `crash: ${String((e as Error)?.message ?? e)}`, trace };
  }

  const chooseTargetCalls = actionLog.filter((c) => c.method === 'chooseTarget');
  if (chooseTargetCalls.length > 0) {
    // A real player CHOICE was made somewhere in this closure — this
    // module's own scope (see header) only classifies an unconditional
    // BROADCAST; a chosen-target shape is a materially different real
    // pattern (see `aerith-rescue-mission`'s own write-up, this file's
    // sibling report) this module deliberately declines rather than guess
    // at.
    return { classified: false, reason: 'actions.chooseTarget was called — a chosen-target shape, not an unconditional broadcast; out of this module\'s own scope', trace };
  }

  const putCounterCalls = actionLog.filter((c) => c.method === 'putCounter');
  if (putCounterCalls.length === 0) {
    return { classified: false, reason: 'no actions.putCounter call observed against this fake board', trace };
  }

  const counterTypes = new Set(putCounterCalls.map((c) => c.args[1]));
  if (counterTypes.size !== 1) {
    return { classified: false, reason: `putCounter called with ${counterTypes.size} distinct counterType arguments — ambiguous`, trace };
  }
  const counterType = [...counterTypes][0] as string;

  const touchedIds = new Set<number>();
  for (const call of putCounterCalls) {
    const targetArg = call.args[0] as Card | undefined;
    if (!targetArg || typeof targetArg.getId !== 'function') {
      return { classified: false, reason: 'a putCounter target argument is not a recognizable Card (no getId())', trace };
    }
    touchedIds.add(targetArg.getId());
  }

  const touched = registry.filter((c) => touchedIds.has(c.id));
  if (touched.length === 0) {
    return { classified: false, reason: 'putCounter targets did not resolve to any known fixture candidate', trace };
  }
  if (!touched.every((c) => c.creature)) {
    return { classified: false, reason: 'a putCounter target was not one of the fixture\'s creature candidates — cannot confidently assert a Creature type constraint', trace };
  }

  const untouchedCreatures = registry.filter((c) => !touchedIds.has(c.id) && c.creature);
  const typesHas = new Set<string>(['Creature']);
  const candidateSubtypes = new Set(touched.flatMap((c) => c.subtypes));
  for (const subtype of candidateSubtypes) {
    const everyTouchedHasIt = touched.every((c) => c.subtypes.includes(subtype));
    const someUntouchedLacksIt = untouchedCreatures.some((c) => !c.subtypes.includes(subtype));
    if (everyTouchedHasIt && someUntouchedLacksIt) typesHas.add(subtype);
  }

  return {
    classified: true,
    trace,
    fact: {
      event: 'putCounter',
      counterType,
      controller: 'you',
      target: { types: { has: [...typesHas] } },
      targeted: false,
    },
  };
}

// ---------------------------------------------------------------------------
// Aerith Rescue Mission — explored, NOT mechanized. Recorded here (rather
// than silently omitted) because the exploration itself is real, checked
// work, not a hand-wave "too hard."
// ---------------------------------------------------------------------------
//
// `cards/aerith-rescue-mission/definition.ts`'s own second modal effect
// combines a multi-target `actions.chooseTarget`+`actions.tap` loop (up to
// 3 iterations, over a COMBINED `[...you creatures, ...opponent creatures]`
// pool) with a single trailing `actions.putCounter(tapped[0], 'stun', 1)` —
// the first-tapped creature gets the stun counter. This module's own
// identity-preserving `wrap()` fix (see module header) is REQUIRED for this
// closure to even run with its own internally-correct semantics (without
// it, `tapped.includes(c)` silently breaks across iterations, since a
// `chooseTarget`-returned proxy would otherwise never `===`-match the same
// element read back out of `pool`/`remaining` — confirmed by hand-tracing
// the unfixed behavior: `remaining` would incorrectly never shrink, so the
// SAME first candidate would be picked and tapped 3 times in a row instead
// of 3 distinct creatures).
//
// Even WITH that fix, this closure's real target-selection shape is
// FUNDAMENTALLY heterogeneous across TWO root collections (`you`'s AND
// opponents'), combined into one plain array BEFORE any candidate is ever
// chosen. `tapped[0]` — the specific creature `putCounter`'s own real
// target argument resolves to — ends up deterministically equal to
// whichever element the MOCK's own `chooseTarget` (`pool => pool[0]`)
// picks FIRST, which is an artifact of THIS FIXTURE'S OWN ARRAY
// CONSTRUCTION ORDER (`[...you.getCreaturesInPlay(), ...opponents...]`
// always lists "you" first) — NOT a real fact about the card's own actual
// behavior (the real oracle text is "tap up to three target creatures,"
// with no controller restriction at all). A single-run probe over one
// fixed board composition cannot distinguish "this closure only ever picks
// from your own side" (a real, narrower claim) from "this closure combines
// both sides and just happened to pick from yours first, this run" (the
// real, true shape here) — confirmed by hand-tracing exactly this: with
// the current mock, `tapped[0]` is ALWAYS a "you"-side creature, every
// single run, purely because of array-construction order, which would make
// this module assert an incorrect `target.controller`-style narrowing (via
// this file's own bucket-derivation logic, if it were extended to look at
// controller too) that the real card's own text does not support.
//
// Reliably telling these two cases apart would need either (a) multiple
// probe runs with DELIBERATELY VARIED board compositions/orderings (a
// materially bigger redesign of this module's own single-fixed-board
// contract, and still statistical rather than a proof), or (b) tracking
// which ROOT COLLECTION(S) fed the ARGUMENT PASSED TO `chooseTarget` itself
// (not just the one element it happened to return), and correctly
// combining two symmetric "you"/"opponents" roots into an unrestricted
// claim only when NEITHER side's presence is incidental — real, additional
// inference this module does not attempt. Per this whole recognizer
// catalog's own "false positives never" rule, this card's own facts
// (the `putCounter` stun-counter source fact and its paired "wants a
// creature present to tap" sink) are NOT mechanized by this module and stay
// tier-3/agent-derived, with this concrete, hand-traced reason recorded
// rather than a bare "declined."
