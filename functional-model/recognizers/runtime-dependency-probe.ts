// PROMOTED to real production status (2026-09-13, `dealDamage-effect-
// structural.ts`'s own wiring pass) — "runtime dependency probe" (black-box
// execution, scoped to ONE closure), per `PRD_AUTOMATED_AUTHORING.md`'s
// "Flagged future direction, not yet attempted: black-box execution" section
// (2026-09-13, same day). WAS a standalone, unwired prototype
// (`runtime-dependency-probe.prototype.ts`) — now a real dependency of
// `recognizers/dealDamage-effect-structural.ts`'s own tier-2 "scales with X"
// -> paired sink derivation (`probeComputedNumber`, consumed for real by
// `apply-recognizers.mjs`'s wired `RECOGNIZERS` list), exercised against
// Summon: Bahamut's own real chapter IV `amount` closure among others — see
// that recognizer file's own module doc comment for the real wiring. Kept
// as its OWN module (not folded into that recognizer file) since its own
// instrumentation/classification logic is independently testable and,
// per its original design, meant to be reusable by any future recognizer
// needing this same "classify what a Computed<number> closure reads"
// capability, not just this one.
//
// Every OTHER recognizer in this catalog reads a static source
// representation (oracle text, `Effect` structure, Forge script) and hits
// the same wall on a non-literal `Computed<number>` field: an opaque
// closure with nothing to parse. This prototype tries a genuinely
// different angle instead of parsing ANY source form: EXECUTE the closure
// against an instrumented FAKE `EffectContext` and observe which real API
// surface (`interfaces.ts`'s own `Card`/`Player` members, mirrored 1:1 from
// real Forge — see that file's own header) it actually touches. Same
// spirit as Vue's `computed()` dependency tracking: observe what a
// function READS, never try to derive what it computes.
//
// Deliberately narrow, same "false negatives fine, false positives never"
// discipline every structural recognizer in this directory already
// follows: this does NOT try to understand arbitrary JS. It recognizes a
// small, closed vocabulary of call-shapes — ONLY which known `you`/
// `opponents` collection-returning method got called (`getCardsIn(zone)`,
// `getCreaturesInPlay()`, `getLandsInPlay()`), never what happens to that
// collection's contents afterward — and declines everything else outright,
// same discipline as the text recognizers' closed vocabulary of English
// phrasings. See `classifyTrace`'s own doc comment (section 3, below) for
// why this stays scoped to the top-level collection call alone, deliberately
// not reasoning about per-item `.filter()`/`.map()`/`.reduce()` callback
// bodies even loosely.

import type { Card, Player, ZoneType } from '../interfaces';
import type { EffectContext } from '../card';

// ---------------------------------------------------------------------------
// 1. Instrumentation — wrap a value in a Proxy that records every property
//    access / method call made through it, recursively (so a value RETURNED
//    from an instrumented call — `ctx.you.getCardsIn('Battlefield')`'s own
//    array, and every card inside it — stays instrumented too).
// ---------------------------------------------------------------------------

/** One canonical call-site string per probe, e.g.
 * `you.getCardsIn("Battlefield")[*].getCMC()` — array indices are
 * collapsed to `[*]` deliberately (no probe here ever needs to distinguish
 * WHICH specific index of a collection got touched). Every property
 * access and function call reachable from the fake `EffectContext` is
 * recorded here, including per-item calls a `.filter()`/`.reduce()`
 * callback makes on individual elements — real, inspectable evidence kept
 * around for a human to look at, even though `classifyTrace` (section 3,
 * below) deliberately only ever reads the TOP-LEVEL collection-call
 * entries out of this same list. */
type Trace = string[];

function describeArg(a: unknown): string {
  if (typeof a === 'string') return JSON.stringify(a);
  if (typeof a === 'number' || typeof a === 'boolean') return String(a);
  if (a === undefined) return 'undefined';
  if (a === null) return 'null';
  if (typeof a === 'function') return '<fn>';
  return '<obj>';
}

/**
 * Recursively wraps `value` in a `Proxy` that appends a canonical call-site
 * string to `trace` for every property GET and every function CALL made
 * through it. Only ever wraps plain objects/arrays/functions — primitives
 * pass through untouched (nothing to instrument).
 *
 * Structurally side-effect-free by construction, not just by care: every
 * value this is ever called on (see `buildFakeContext` below) is a
 * throwaway mock object created fresh per probe run, and every mirrored
 * `Card`/`Player` member in `interfaces.ts` this pool's closures can reach
 * through `EffectContext` is a pure getter (`getCMC`, `hasSubtype`,
 * `getCardsIn`, ...) — there is no setter/mutator reachable from a
 * `Computed<number>` closure's own single `ctx` argument (contrast
 * `Actions`, which a `Computed` closure never receives at all — `Computed<T>
 * = T | ((ctx: EffectContext) => T)`, card.ts, arity 1, no `actions` param).
 * Even the two Player methods whose real Forge signatures mutate live state
 * (`gainLife`/`loseLife`) are backed here by inert mock implementations that
 * touch nothing outside this call's own throwaway mock closures — there is
 * no real `GameState` anywhere in reach of a probed closure.
 */
function wrap<T>(value: T, path: string, trace: Trace): T {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return value;

  if (typeof value === 'function') {
    return new Proxy(value as unknown as (...a: unknown[]) => unknown, {
      apply(target, thisArg, args) {
        const callPath = `${path}(${args.map(describeArg).join(', ')})`;
        trace.push(callPath);
        const result = Reflect.apply(target, thisArg, args);
        return wrap(result, callPath, trace);
      },
    }) as unknown as T;
  }

  if (Array.isArray(value)) {
    return new Proxy(value, {
      get(target, prop, receiver) {
        if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);
        if (/^\d+$/.test(prop)) return wrap(Reflect.get(target, prop, receiver), `${path}[*]`, trace);
        // `length`/`reduce`/`filter`/`map`/`some`/`every`/`flatMap`/... — log
        // the bare access (real recorded evidence, kept in `trace` even
        // though `classifyTrace` below deliberately never reads it — see
        // that function's own doc comment) but return the RAW, unwrapped
        // native function so `this` stays bound to the array Proxy itself
        // when the closure calls it (`arr.reduce(cb)` — the member-call's
        // own base becomes `thisArg` per standard JS semantics, no
        // explicit `.bind` needed) — Array.prototype.reduce/filter/map's
        // OWN internal element reads (`this[k]`) then flow back through
        // this same `get` trap's numeric-index branch above, so every
        // element the closure's own callback receives is still a wrapped,
        // observed value. This is the one deliberate asymmetry in this
        // wrapper: array METHOD NAMES are logged-but-unwrapped, everything
        // else is logged-and-wrapped.
        trace.push(`${path}.${prop}`);
        return Reflect.get(target, prop, receiver);
      },
    }) as unknown as T;
  }

  return new Proxy(value as object, {
    get(target, prop, receiver) {
      if (typeof prop === 'symbol') return Reflect.get(target, prop, receiver);
      // `path` is `''` only for the root `EffectContext` object itself
      // (`buildFakeContext`'s own `wrap(rawCtx, '', trace)` call) — every
      // property read directly off it (`ctx.you`, `ctx.self`, ...) should
      // start a fresh root path (`you`, `self`), not a leading-dot
      // `.you`/`.self` that would never match any `ROOTS` regex below.
      const childPath = path ? `${path}.${String(prop)}` : String(prop);
      return wrap(Reflect.get(target, prop, receiver), childPath, trace);
    },
  }) as unknown as T;
}

// ---------------------------------------------------------------------------
// 2. Fake context — a minimal, safe, inert `EffectContext`/`Card`/`Player`
//    triple that won't crash on the real interfaces.ts surface. Built ONCE
//    per probe (the original task framing: "run it once") — deliberately
//    generic/undifferentiated (see `classifyTrace`'s own doc comment below
//    for why the exact per-item shape of these mocks doesn't matter to
//    classification at all).
// ---------------------------------------------------------------------------

function mkFakeCard(
  id: number,
  owner: Player,
  opts: { name?: string; cmc?: number; power?: number; toughness?: number; subtypes?: string[]; creature?: boolean; land?: boolean; artifact?: boolean; enchantment?: boolean } = {}
): Card {
  return {
    getId: () => id,
    getName: () => opts.name ?? `Fake Card ${id}`,
    getCounters: () => 0,
    isToken: () => false,
    isAttacking: () => false,
    getOwner: () => owner,
    getController: () => owner,
    getNetPower: () => opts.power ?? 2,
    getNetToughness: () => opts.toughness ?? 2,
    hasSubtype: (s: string) => (opts.subtypes ?? []).includes(s),
    hasKeyword: () => false,
    isCreature: () => opts.creature ?? true,
    isLand: () => opts.land ?? false,
    isEnchantment: () => opts.enchantment ?? false,
    isArtifact: () => opts.artifact ?? false,
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
    addMana: () => {}, // inert mock — interfaces.ts's own doc comment: no real mana pool exists in this model at all
  };
}

/**
 * One fixed, generic fake board — `self` plus two other permanents (a
 * creature and a land, so `isCreature()`/`isLand()`-style per-item calls
 * don't universally return the same thing and a closure that happens to
 * read that far doesn't crash on anything unexpected), one opponent with
 * one creature. The exact composition doesn't drive classification at all
 * (see `classifyTrace`'s own doc comment) — it only needs to be non-empty
 * and non-crashing.
 */
function buildFakeContext(): { ctx: EffectContext; trace: Trace } {
  const trace: Trace = [];
  const self = mkFakeCard(1, null as unknown as Player, { name: 'Fake Self', cmc: 4 });
  const others = [
    mkFakeCard(101, null as unknown as Player, { name: 'Fake Other Creature', cmc: 5, subtypes: ['Elf'] }),
    mkFakeCard(102, null as unknown as Player, { name: 'Fake Other Land', cmc: 0, creature: false, land: true }),
  ];
  const battlefield = [self, ...others];
  const oppCreatures = [mkFakeCard(201, null as unknown as Player, { name: 'Fake Opp Creature', cmc: 3 })];

  const you = mkFakePlayer(900, 'Fake Player (you)', () => battlefield);
  const opponent = mkFakePlayer(901, 'Fake Opponent', () => oppCreatures);

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
  return { ctx: wrap(rawCtx, '', trace), trace };
}

// ---------------------------------------------------------------------------
// 3. Classification — small, closed vocabulary. Declines (no classification)
//    for anything outside it.
// ---------------------------------------------------------------------------

export type ProbeResult =
  | { classified: true; tag: string; evidence: Trace }
  | { classified: false; reason: 'crash'; error: string }
  | { classified: false; reason: 'no-recognized-collection-root' | 'non-numeric-result'; evidence: Trace };

/** Known `EffectContext`-reachable collection getters this vocabulary
 * recognizes as a "root" — each maps a canonical call-site match to a
 * human-readable bucket name. Deliberately closed: anything else declines.
 * The regex's own captured argument (a zone name, `"Battlefield"`/
 * `"Graveyard"`/...) IS part of this top-level call and fair game — that's
 * the "basic zone filter passed as the call's own argument" the scope
 * below still allows; nothing past the closing `)` of the collection call
 * itself is ever consulted. */
const ROOTS: Array<{ match: RegExp; bucket: (zoneOrArgs: string) => string }> = [
  { match: /^you\.getCardsIn\("Battlefield"\)$/, bucket: () => 'permanents you control' },
  { match: /^you\.getCardsIn\("([^"]+)"\)$/, bucket: (zone) => `cards in your ${zone.toLowerCase()}` },
  { match: /^you\.getCreaturesInPlay\(\)$/, bucket: () => 'creatures you control' },
  { match: /^you\.getLandsInPlay\(\)$/, bucket: () => 'lands you control' },
  { match: /^opponents\[\*\]\.getCardsIn\("Battlefield"\)$/, bucket: () => 'permanents opponents control' },
  { match: /^opponents\[\*\]\.getCardsIn\("([^"]+)"\)$/, bucket: (zone) => `cards in opponents' ${zone.toLowerCase()}` },
  { match: /^opponents\[\*\]\.getCreaturesInPlay\(\)$/, bucket: () => 'creatures opponents control' },
  { match: /^opponents\[\*\]\.getLandsInPlay\(\)$/, bucket: () => 'lands opponents control' },
];

/**
 * Classification is deliberately restricted to WHICH top-level,
 * collection-returning method got called on `ctx`/`ctx.you`/
 * `ctx.opponents` (`ROOTS` above), plus that call's OWN argument (a zone
 * name) — and nothing else. It never inspects what a `.filter()`/`.map()`/
 * `.reduce()`/`.some()` callback does with each individual item afterward
 * (`c.getCMC()`, `c.hasSubtype("Elf")`, `c.getId() === ctx.self.getId()`,
 * ...), and it never tries to tell a real running count apart from a
 * presence check or a gated step function by comparing outputs across
 * multiple runs.
 *
 * **This is a deliberate scope narrowing** (2026-09-13, direct instruction
 * on this exact prototype after an earlier draft's own more elaborate
 * classifier over-reached): that earlier draft also read per-item calls to
 * narrow the bucket name (e.g. "Elfs you control" instead of "creatures you
 * control"), detect self-exclusion ("other permanents," motivated by
 * Summon: Bahamut's own chapter IV), and ran the closure TWICE (a small and
 * a large fake board) to tell "scales with X" apart from "gated by X" via
 * output-magnitude comparison. All of that was ruled out as still being
 * "analysis of individual items" in spirit, on top of the arithmetic itself
 * already being out of scope from the very first draft. The `wrap()`
 * instrumentation above still RECORDS every per-item call in the raw trace
 * (harmless, real evidence a human could still look at via a result's own
 * `evidence` field) — `classifyTrace` itself just never reads any of it
 * when deciding the tag.
 *
 * Net effect: Summon: Bahamut's own chapter IV — `ctx.you.getCardsIn
 * ('Battlefield').reduce((sum, c) => (c.getId() === ctx.self.getId() ? sum
 * : sum + c.getCMC()), 0)` — classifies as plain "scales with permanents
 * you control," with NO claim about summing mana values or excluding
 * itself; that CMC-summing, self-excluding behavior is real (and still
 * visible in `evidence` if inspected), just not something this tag
 * asserts.
 */
function classifyTrace(trace: Trace, result: unknown): ProbeResult {
  if (typeof result !== 'number') return { classified: false, reason: 'non-numeric-result', evidence: trace };

  const buckets = new Set<string>();
  for (const entry of trace) {
    // First matching `ROOTS` entry only (`ROOTS` is ordered most-specific-
    // first — e.g. `you.getCardsIn("Battlefield")` before the generic
    // `you.getCardsIn("X")` fallback) — a single literal call-site never
    // produces two competing bucket labels for the same real collection.
    const rootDef = ROOTS.find((r) => r.match.test(entry));
    if (!rootDef) continue;
    const m = entry.match(rootDef.match)!;
    buckets.add(rootDef.bucket(m[1] ?? ''));
  }
  if (buckets.size === 0) return { classified: false, reason: 'no-recognized-collection-root', evidence: trace };

  return { classified: true, tag: `scales with ${[...buckets].join(' + ')}`, evidence: trace };
}

/**
 * Runs `fn` (an opaque `Computed<number>` closure lifted straight out of a
 * real `CardDefinition`) ONCE against a single fake board, wrapped in
 * try/catch so a closure that genuinely can't run safely against a fake
 * context (needs a real `ctx.triggerInput` value never set here, etc.)
 * declines gracefully instead of crashing the whole probe, same discipline
 * every other recognizer in this catalog already follows.
 */
export function probeComputedNumber(fn: (ctx: EffectContext) => number): ProbeResult {
  const { ctx, trace } = buildFakeContext();
  let result: unknown;
  try {
    result = fn(ctx);
  } catch (e) {
    return { classified: false, reason: 'crash', error: String((e as Error)?.message ?? e) };
  }
  return classifyTrace(trace, result);
}

// Re-exported for the standalone pool-wide yield-estimate scratch script
// only — never imported by anything under `functional-model/` proper.
export { buildFakeContext as __buildFakeContextForTesting };
