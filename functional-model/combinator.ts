// Combinator AST for `card.ts`'s `kind: 'program'` Effect — DATA, not code,
// for the shape of `custom`-effect logic that's genuinely just
// Query/Filter/Aggregate/Each/Branch/Sequence over real board state. Real
// production infrastructure (not a prototype): a `kind:'program'` Effect
// stays alongside `kind:'custom'` in `card.ts`'s `Effect` union (`custom`
// remains the true last-resort escape hatch — nothing here removes it),
// but per standing project policy this is now the DEFAULT way to express
// new `custom`-style effect logic, and existing `custom` closures that turn
// out to be pure Query/Filter/Aggregate/Each/Branch/Sequence shapes should
// be migrated onto this instead of staying opaque.
//
// Proven first as a hand-translation experiment (2026-09-14, fin/1-25's own
// 17 real `kind:'custom'` closures, 100% coverage — see
// `.claude/agent-memory/engine/notes.md`'s "combinator DSL" entries / the
// project's own `project_combinator_dsl_experiment` memory) — this file is
// that vocabulary built for REAL: a genuine interpreter (`runProgram`) that
// `card.ts`'s `applyEffect` calls exactly like `custom`'s own `run(ctx,
// actions)`, AND a genuine SYMBOLIC walker (`walkProgram`) that reads the
// identical AST with NO `ctx`/`actions`/board at all — the whole point of
// making an effect DATA instead of CODE: structure is directly enumerable,
// not inferred by instrumenting one concrete execution the way
// `recognizers/runtime-dependency-probe.ts`/`runtime-action-probe.ts` (a
// DIFFERENT, code-execution-based approach, contrasted here on purpose, not
// reused) have to.
//
// Scope, deliberately narrow (this pass migrates 8 real closures — see
// each of those cards' own `definition.ts` comments): only the node kinds
// those 8 real cases need are implemented below (`Query.source:
// 'creaturesInPlay'`, `Filter.predicate: 'subtype' | 'excludeSelf'`,
// `EachAction.action: 'putCounter' | 'tap'`, `ValueRef.kind: 'literal' |
// 'selfCounters' | 'aggregate'`, `Branch` with a numeric `compare`
// condition, and a plain self-targeted `Sequence` of `moveSelf` steps).
// `Aggregate` itself isn't needed by any of the 8 real migrations this pass
// touches but is still implemented for real (both interpreter and walker)
// and covered by this file's own test, since it's part of the vocabulary
// this pass is chartered to build — extend the closed unions below (never
// widen a field to an executable function) the next time a real card's own
// closure needs a shape not yet listed here.
//
// **`Choose`/`ChooseUpTo`/`Bind`/`ContextEquals`** (player-selected subsets,
// cross-step object references, categorical `EffectContext` branches) are
// explicitly OUT of scope for this file — the experiment above found 4 real
// closures needing one of those, and the follow-up production task building
// them is deliberately separate. A card whose closure turns out to need one
// of those (this pass found 2 — see dragoon-s-lance/machinist-s-arsenal's
// own `definition.ts` comments) stays a `kind:'custom'` closure until that
// follow-up lands, rather than being force-fit here.
//
// **`SelectUpTo`/`ApplyToBound`/`BoundSet` (2026-09-15) — the `Bind` case
// above, landed for real, scoped narrowly.** Motivating real card:
// `aerith-rescue-mission`'s own "Take 59 Flights of Stairs" mode ("Tap up to
// three target creatures. Put a stun counter on one of them.") — a real
// cross-step reference (the counter-placement step needs to know WHICH
// object(s) the earlier selection step picked), the exact shape this file's
// header used to call out of scope. Kept intentionally narrow, same "only
// the node kinds a real card needs" discipline as every other node here:
// - `SelectUpTo` picks up to `max` DISTINCT items from a `Query`/`Filter`
//   pool (via `actions.chooseTarget`, same pool-exhaustion loop `card.ts`'s
//   own `resolveTargets` already uses for a targeted `move`/`destroy`/etc.),
//   binds them under a name, then runs `then` with that binding visible.
// - `BoundSet` is a THIRD `Each.input` variant (alongside `Query`/`Filter`)
//   that reads a previously-bound selection instead of querying the board
//   again — this is how "tap EACH of the ones just picked" is expressed.
// - `ApplyToBound` applies one `EachAction` to a SINGLE item at a fixed
//   `index` into a binding (`index: 0` = "one of them," the real card's own
//   "put a stun counter on one of them" — this engine has no player-
//   decision system, so, same as every other `optional`/`chooseTarget`
//   convention in this codebase, "one of them" deterministically means the
//   first one actually picked, not a genuine choice).
// A binding is plain runtime data (`Bindings`, a `Record<string, Card[]>`),
// threaded through `runProgram`'s own recursive calls — never persisted
// anywhere outside one `program` effect's own resolution, same lifetime a
// local variable would have in the equivalent imperative closure. No static
// scope-checking exists (an `ApplyToBound`/`BoundSet` naming a binding no
// enclosing `SelectUpTo` ever defines simply resolves to an empty list at
// runtime/no items to walk) — same "closed vocabulary, no executable
// functions, but no compile-time scope proof either" tradeoff every other
// node in this file already accepts.
import type { Card } from './interfaces';
import type { Actions, EffectContext } from './card';
// Type-only import from `card.ts`, which itself imports `ProgramNode` (below)
// as a type for its own `Effect` union — a circular TYPE-ONLY import, erased
// before emit, same accepted "no runtime cycle" precedent `card.ts`'s own
// header already documents for its `synergy.ts` import of `Fact`.

// ---------------------------------------------------------------------------
// Query / Filter — a source collection, optionally narrowed by a named,
// parameterized predicate (never an arbitrary JS predicate function).

/** A source collection read directly off `EffectContext` — real Forge
 * equivalent: `Player.getCreaturesInPlay()` (interfaces.ts), scoped to
 * either the effect's own controller (`ctx.you`) or every opponent
 * (`ctx.opponents`, unioned) — the only two owner scopes the 8 real
 * migrated closures need; extend with a real card's own need, not
 * speculatively. */
export interface Query {
  kind: 'query';
  source: 'creaturesInPlay';
  /** `'any'` (2026-09-15) — BOTH sides unioned, real motivating case:
   * `aerith-rescue-mission`'s own "Tap up to three target creatures" (no
   * owner restriction printed at all, unlike every prior migrated closure's
   * own `you`/`opponents`-scoped need) — same real pool composition
   * (`[...ctx.you.getCreaturesInPlay(), ...ctx.opponents.flatMap(p =>
   * p.getCreaturesInPlay())]`) the closure it replaces already used. */
  owner: 'you' | 'opponents' | 'any';
}

/** A THIRD `Each.input` source (alongside `Query`/`Filter`) — reads a
 * previously-bound `SelectUpTo` selection by name instead of querying the
 * board again (see this file's own header, "`SelectUpTo`/`ApplyToBound`/
 * `BoundSet`"). Never itself narrowed by a `Filter` (no real card needs to
 * filter a selection it just made) — extend `Filter.input`'s own union the
 * day one does. */
export interface BoundSet {
  kind: 'bound';
  name: string;
}

/** A named, parameterized predicate over a `Query`/`Filter`'s own result —
 * `'subtype'` mirrors `Card.hasSubtype` (Aerith Gainsborough's own
 * "legendary creature" narrowing); `'excludeSelf'` mirrors the `notSelf`-
 * style `c.getId() !== ctx.self.getId()` exclusion several existing
 * declarative `Effect` kinds (`pumpAll`, `sacrifice`, `move`, ...) already
 * carry as a plain boolean field, generalized here to a first-class
 * predicate node so a `Filter` can compose more than one condition later
 * without redesigning this union. */
export type FilterPredicate = { field: 'subtype'; value: string } | { field: 'excludeSelf' };

/** Narrows a `Query` (or another `Filter`, so predicates compose) by one
 * `FilterPredicate`. */
export interface Filter {
  kind: 'filter';
  input: Query | Filter;
  predicate: FilterPredicate;
}

// ---------------------------------------------------------------------------
// Aggregate — `.sum()`/`.count()` over a `Query`/`Filter` result.

/** `op:'count'` mirrors a plain `.length`; `op:'sum'` mirrors Forge's own
 * per-card numeric reads this codebase already exposes (`Card.getNetPower`/
 * `getNetToughness`/`getCMC`, interfaces.ts) totalled across every item —
 * `field` is required (and only meaningful) for `'sum'`. */
export interface Aggregate {
  kind: 'aggregate';
  op: 'sum' | 'count';
  input: Query | Filter;
  field?: 'power' | 'toughness' | 'cmc';
}

// ---------------------------------------------------------------------------
// Leaf value reads — a named reference, not inline code.

/** A value an effect reads at resolution time: a fixed constant, `ctx.self`'s
 * own current counter count (`Card.getCounters`, interfaces.ts — Aerith
 * Gainsborough's own "X, the number of +1/+1 counters on this"), or an
 * `Aggregate` computed over a `Query`/`Filter`. */
export type ValueRef = { kind: 'literal'; value: number } | { kind: 'selfCounters'; counterType: string } | Aggregate;

// ---------------------------------------------------------------------------
// Each — apply a named action to every item of a Query/Filter result.

/** The one action `Each` applies to every matched item — a closed,
 * parameterized union (never an arbitrary callback), same "named action from
 * `Actions`" shape every other declarative `Effect` kind in `card.ts` already
 * uses. Only the two shapes the 8 real migrated closures need are modeled;
 * extend as a real future card needs a different broadcast action (see this
 * file's own header). */
export type EachAction = { action: 'putCounter'; counterType: string; amount: ValueRef } | { action: 'tap' };

export interface Each {
  kind: 'each';
  input: Query | Filter | BoundSet;
  action: EachAction;
}

// ---------------------------------------------------------------------------
// SelectUpTo / ApplyToBound — see this file's own header, "`SelectUpTo`/
// `ApplyToBound`/`BoundSet`," for the real motivating card and design.

/** Picks up to `max` DISTINCT items from `from` (via `actions.chooseTarget`,
 * same pool-exhaustion loop `card.ts`'s own `resolveTargets` already uses),
 * binds the picked list under `as`, then runs `then` with that binding
 * visible (to a nested `Each{input:{kind:'bound',...}}` or `ApplyToBound`). */
export interface SelectUpTo {
  kind: 'selectUpTo';
  from: Query | Filter;
  max: number;
  as: string;
  then: ProgramNode[];
}

/** Applies one `EachAction` to a SINGLE item at `index` into a named
 * binding — "put a stun counter on ONE of them" (`index: 0`, the first item
 * `SelectUpTo` actually picked; see this file's own header for why "one of
 * them" is deterministic here, not a genuine player choice). A no-op
 * (matches this card's own real "if tapped.length > 0" guard) when the
 * binding has fewer than `index + 1` items — a `SelectUpTo` pool can
 * legitimately exhaust before reaching `max`. */
export interface ApplyToBound {
  kind: 'applyToBound';
  name: string;
  index: number;
  action: EachAction;
}

// ---------------------------------------------------------------------------
// Branch — a real two-continuation split, BOTH sides always walkable.

export type CompareOp = '<=' | '<' | '>=' | '>' | '==' | '!=';

/** Numeric comparison only (widen this union — not `ValueRef`/`Condition`
 * itself — the day a real card needs a categorical `EffectContext` branch,
 * e.g. `ctx.castFrom`; that's the deferred `ContextEquals` node, see this
 * file's own header). */
export interface Condition {
  kind: 'compare';
  left: ValueRef;
  op: CompareOp;
  right: ValueRef;
}

/**
 * `condition ? then : (else ?? [])` — deliberately NOT an if-with-no-else
 * shorthand: `else` stays a real, optional, independently-walkable list so a
 * symbolic reader can traverse it even when it's empty (Aerith Gainsborough's
 * own `x<=0` early return is `then: []`, `else: [the real putCounter Each]`
 * — both sides genuinely present in the data, not inferred).
 */
export interface Branch {
  kind: 'branch';
  condition: Condition;
  then: ProgramNode[];
  else?: ProgramNode[];
}

// ---------------------------------------------------------------------------
// Sequence — a plain ordered list of fixed, self-targeted actions with NO
// query/filter/target selection at all (a genuinely linear action list, not
// forced into Query/Filter shape it doesn't need — see this file's own
// header). Only the one real shape needed by the 3 migrated
// exile-then-return-to-battlefield closures is modeled; a card whose linear
// sequence needs to reference an object an EARLIER step just created (the
// real `Bind` case — Dragoon's Lance/Machinist's Arsenal's own "create a
// token, then equip THAT token" Job-select closures) is explicitly out of
// scope here, see this file's own header.

export type SequenceStep = { action: 'moveSelf'; to: 'Hand' | 'Library' | 'Graveyard' | 'Battlefield' | 'Exile' | 'Stack' | 'Command' };

export interface Sequence {
  kind: 'sequence';
  steps: SequenceStep[];
}

// ---------------------------------------------------------------------------

/** The top-level node kind a `card.ts` `kind:'program'` Effect's own
 * `program` field holds — one of the three "does something" shapes above
 * (`Query`/`Filter`/`Aggregate`/`ValueRef` are never top-level themselves,
 * only ever nested inputs to one of these). */
export type ProgramNode = Each | Branch | Sequence | SelectUpTo | ApplyToBound;

// ---------------------------------------------------------------------------
// Fluent builder layer — construction-only ergonomics over the SAME AST types
// above; nothing below this comment changes `runProgram`/`walkProgram` or the
// `Query`/`Filter`/`Aggregate`/`ValueRef`/`Each`/`Branch`/`Sequence`/
// `ProgramNode` types themselves, and nothing here ever touches `ctx`/
// `actions`/`GameState` — a builder call only ASSEMBLES a plain data value,
// so the "enumerable without execution" property this whole file exists to
// prove (see the header above) doesn't regress: every AST produced here is
// byte-identical, ordinary data, indistinguishable from a hand-written object
// literal — just pleasant to author instead of nesting `{kind:'each',
// input:{kind:'filter', input:{kind:'query', ...}, predicate:{...}},
// action:{...}}` by hand.
//
// Motivating case (Aerith Gainsborough's own onDies effect,
// `cards/aerith-gainsborough/definition.ts`):
//
//   branch(compare(selfCounters('+1/+1'), '<=', 0), [], [
//     you.creaturesInPlay().filter('subtype', 'Legendary')
//       .each(putCounter('+1/+1', selfCounters('+1/+1'))),
//   ])
//
// `QueryChain` wraps a `Query`/`Filter` and offers `.filter()` (returns
// another `QueryChain`, so predicates compose the same way the underlying
// `Filter.input: Query | Filter` union already allows — no real migrated card
// needs two composed predicates yet, but the chain supports it structurally
// the same way the plain AST always did), plus 3 TERMINAL reads that consume
// the chain and hand back a plain, finished AST value: `.each()` (-> `Each`,
// itself a top-level `ProgramNode`), `.count()`/`.sum()` (-> `Aggregate`,
// itself already a valid `ValueRef` — no separate "unwrap" step, it plugs
// directly into `compare()`/`putCounter()`). Every OTHER node kind
// (`EachAction`/`Condition`/`Branch`/`Sequence`/`ValueRef` leaves) below is a
// single plain function returning one finished node, not a class — a future
// node kind (`Choose`/`ChooseUpTo`/`Bind`/`ContextEquals`, explicitly out of
// scope for this file, see its own header above) just adds one more
// standalone builder function returning its own AST shape; nothing here needs
// restructuring to make room for it.

/** A chainable wrapper over a `Query`/`Filter` node — `.filter()` narrows and
 * returns another `QueryChain`; `.each()`/`.count()`/`.sum()` are TERMINAL:
 * each consumes the chain and returns a plain, finished AST value (an `Each`
 * `ProgramNode`, or an `Aggregate`, itself already a valid `ValueRef`). */
export class QueryChain {
  constructor(readonly node: Query | Filter) {}

  /** Narrows this chain by one more `FilterPredicate` (see that type's own
   * doc comment for what each `field` means). */
  filter(field: 'subtype', value: string): QueryChain;
  filter(field: 'excludeSelf'): QueryChain;
  filter(field: FilterPredicate['field'], value?: string): QueryChain {
    const predicate: FilterPredicate = field === 'subtype' ? { field: 'subtype', value: value! } : { field: 'excludeSelf' };
    return new QueryChain({ kind: 'filter', input: this.node, predicate });
  }

  /** Terminal: applies `action` to every item this chain matches — a plain
   * `Each`, ready to use directly as a `Branch` `then`/`else` entry or as the
   * whole `Effect.program` value. */
  each(action: EachAction): Each {
    return { kind: 'each', input: this.node, action };
  }

  /** Terminal: `Aggregate` op:'count' over this chain's own result. */
  count(): Aggregate {
    return { kind: 'aggregate', op: 'count', input: this.node };
  }

  /** Terminal: `Aggregate` op:'sum' over one numeric `field` of this chain's
   * own result. */
  sum(field: NonNullable<Aggregate['field']>): Aggregate {
    return { kind: 'aggregate', op: 'sum', field, input: this.node };
  }
}

/** The two owner-scoped entry points into a `QueryChain` — the only two
 * `Query.owner` values this AST supports (see `Query`'s own doc comment).
 * `creaturesInPlay()` is the only `Query.source` today; add a sibling method
 * to each of these the day a real card needs a different source, not
 * speculatively. */
export const you = {
  creaturesInPlay: (): QueryChain => new QueryChain({ kind: 'query', source: 'creaturesInPlay', owner: 'you' }),
};
export const opponents = {
  creaturesInPlay: (): QueryChain => new QueryChain({ kind: 'query', source: 'creaturesInPlay', owner: 'opponents' }),
};
/** Both sides unioned — see `Query.owner`'s own doc comment. */
export const anyPlayer = {
  creaturesInPlay: (): QueryChain => new QueryChain({ kind: 'query', source: 'creaturesInPlay', owner: 'any' }),
};

/** Every leaf/terminal builder below accepts a plain `number` wherever a
 * `ValueRef` belongs and wraps it as `literal` — the common case (a fixed
 * amount) reads as a bare number, not `literal(1)`, without losing the
 * ability to pass a real `ValueRef` (`selfCounters(...)`, a `QueryChain`'s
 * own `.count()`/`.sum()`) in the same slot. */
function toValueRef(v: ValueRef | number): ValueRef {
  return typeof v === 'number' ? { kind: 'literal', value: v } : v;
}

/** A fixed constant `ValueRef` — spelled out mostly for symmetry/
 * discoverability; every builder that accepts `ValueRef | number` below
 * already wraps a plain number via `toValueRef`, so authoring `literal(1)`
 * explicitly is rarely needed in practice. */
export function literal(value: number): ValueRef {
  return { kind: 'literal', value };
}

/** `ctx.self`'s own live counter count — see `ValueRef`'s own doc comment
 * for the real-card motivation (Aerith Gainsborough's own magnitude X). */
export function selfCounters(counterType: string): ValueRef {
  return { kind: 'selfCounters', counterType };
}

/** An `Each` action broadcasting a counter to every matched item. `amount`
 * accepts a plain `number` or any `ValueRef` (`selfCounters(...)`, a
 * `QueryChain.count()`/`.sum()` `Aggregate`, ...). */
export function putCounter(counterType: string, amount: ValueRef | number): EachAction {
  return { action: 'putCounter', counterType, amount: toValueRef(amount) };
}

/** An `Each` action tapping every matched item — matches `EachAction`'s own
 * `{action:'tap'}` shape, no parameters. */
export function tap(): EachAction {
  return { action: 'tap' };
}

/** A `Branch`'s own numeric condition. `left`/`right` each accept a plain
 * `number` or any `ValueRef`, same as `putCounter`'s own `amount`. */
export function compare(left: ValueRef | number, op: CompareOp, right: ValueRef | number): Condition {
  return { kind: 'compare', left: toValueRef(left), op, right: toValueRef(right) };
}

/**
 * A real two-continuation `Branch`. `elseBranch` stays genuinely OPTIONAL
 * (mirroring `Branch.else?`) rather than defaulting to `[]` when omitted —
 * a caller that wants a present-but-empty `else` (an explicit "and do
 * nothing on this side" arm, as opposed to no `else` at all) still passes
 * `[]` and gets it back verbatim, keeping that structural distinction
 * `walkProgram`'s own test suite already relies on (an empty array is
 * walked, zero times, but is not the same as an absent key).
 */
export function branch(condition: Condition, then: ProgramNode[], elseBranch?: ProgramNode[]): Branch {
  return elseBranch === undefined ? { kind: 'branch', condition, then } : { kind: 'branch', condition, then, else: elseBranch };
}

/** A linear list of fixed, self-targeted zone moves — `sequence('Exile',
 * 'Battlefield')` reads as "exile this, then return it to the battlefield",
 * the exact shape every migrated exile-then-return closure needs (see
 * `Sequence`'s own doc comment for why this stays a plain zone list rather
 * than Query/Filter-shaped). */
export function sequence(...steps: SequenceStep['to'][]): Sequence {
  return { kind: 'sequence', steps: steps.map((to) => ({ action: 'moveSelf', to })) };
}

/** A named binding's own selection, for use as an `Each.input` (e.g.
 * `{kind:'each', input:bound('tapped'), action:tap()}` — "tap each of the
 * ones just picked"). See this file's own header,
 * "`SelectUpTo`/`ApplyToBound`/`BoundSet`." */
export function bound(name: string): BoundSet {
  return { kind: 'bound', name };
}

/** Picks up to `max` distinct items from `from` and binds them under `as`
 * for `then` to reference (via `bound(as)`/`applyToBound(as, ...)`). Accepts
 * either a raw `Query`/`Filter` node or a fluent `QueryChain`
 * (`anyPlayer.creaturesInPlay()`, etc.) — same "builder or raw AST, either
 * way" ergonomics every other node in this file's fluent layer already
 * has. */
export function selectUpTo(from: Query | Filter | QueryChain, max: number, as: string, then: ProgramNode[]): SelectUpTo {
  return { kind: 'selectUpTo', from: from instanceof QueryChain ? from.node : from, max, as, then };
}

/** Applies `action` to the item at `index` of a previously-bound selection
 * (`index: 0` = "one of them" — see `ApplyToBound`'s own doc comment). */
export function applyToBound(name: string, index: number, action: EachAction): ApplyToBound {
  return { kind: 'applyToBound', name, index, action };
}

// ---------------------------------------------------------------------------
// Concrete interpreter — reads the AST and executes against a real
// `EffectContext`/`Actions`, exactly like `custom`'s own `run(ctx, actions)`.

/** A `SelectUpTo`'s own picked list, keyed by its `as` name — plain runtime
 * data threaded through `runProgram`'s own recursive calls, never persisted
 * anywhere outside one `program` effect's own resolution (see this file's
 * own header, "`SelectUpTo`/`ApplyToBound`/`BoundSet`"). */
type Bindings = Record<string, Card[]>;

function resolveQuery(input: Query | Filter | BoundSet, ctx: EffectContext, bindings: Bindings): Card[] {
  if (input.kind === 'bound') return bindings[input.name] ?? [];
  if (input.kind === 'query') {
    const players = input.owner === 'you' ? [ctx.you] : input.owner === 'opponents' ? ctx.opponents : [ctx.you, ...ctx.opponents];
    return players.flatMap((p) => p.getCreaturesInPlay());
  }
  const base = resolveQuery(input.input, ctx, bindings);
  const predicate = input.predicate;
  switch (predicate.field) {
    case 'subtype': {
      // Narrowed to a local plain `string` before the closure below — TS's
      // control-flow narrowing on `predicate.field` doesn't persist through
      // an arrow-function boundary that closes over `predicate` itself.
      const subtype = predicate.value;
      return base.filter((c) => c.hasSubtype(subtype));
    }
    case 'excludeSelf':
      return base.filter((c) => c.getId() !== ctx.self.getId());
    default: {
      const _exhaustive: never = predicate;
      throw new Error(`unhandled filter predicate: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function resolveAggregate(agg: Aggregate, ctx: EffectContext): number {
  // `Aggregate.input` stays typed `Query | Filter` (never `BoundSet` — no
  // real card needs to sum/count a selection yet, see this file's own
  // header), so no binding lookup is ever needed here; `{}` is inert.
  const items = resolveQuery(agg.input, ctx, {});
  if (agg.op === 'count') return items.length;
  if (!agg.field) throw new Error("Aggregate op:'sum' requires a field");
  const field = agg.field;
  return items.reduce((total, c) => total + (field === 'power' ? c.getNetPower() : field === 'toughness' ? c.getNetToughness() : c.getCMC()), 0);
}

function resolveValue(ref: ValueRef, ctx: EffectContext): number {
  switch (ref.kind) {
    case 'literal':
      return ref.value;
    case 'selfCounters':
      return ctx.self.getCounters(ref.counterType);
    case 'aggregate':
      return resolveAggregate(ref, ctx);
    default: {
      const _exhaustive: never = ref;
      throw new Error(`unhandled value ref: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

// Named `evalCompareOp`, not `compare` — this file's own fluent builder
// layer above exports a public `compare()` (assembles a `Condition`); this is
// the unrelated internal numeric evaluator `runProgram`'s `'branch'` case
// calls at resolution time, kept distinctly named to avoid the collision.
function evalCompareOp(left: number, op: CompareOp, right: number): boolean {
  switch (op) {
    case '<=':
      return left <= right;
    case '<':
      return left < right;
    case '>=':
      return left >= right;
    case '>':
      return left > right;
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    default: {
      const _exhaustive: never = op;
      throw new Error(`unhandled compare op: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * `resolvedAmount` is computed ONCE per `Each` node (by `runProgram`'s own
 * `'each'` case below), never re-read per item — this mirrors every real
 * migrated closure's own original imperative shape (`const x = ...; for
 * (...) actions.putCounter(item, type, x)`, Aerith Gainsborough's own onDies
 * closure being the concrete example) rather than re-evaluating a live
 * `ValueRef` per iteration, which would let an EARLIER iteration's own
 * mutation (a `putCounter` onto `ctx.self` itself, when self happens to be
 * one of the matched items — a real, checked case in this file's own test
 * suite) silently change a LATER iteration's own amount. Real CR 608.2h
 * "locked in once" semantics, not a per-object recomputation.
 */
function runEachAction(action: EachAction, item: Card, resolvedAmount: number | undefined, actions: Actions): void {
  switch (action.action) {
    case 'putCounter':
      actions.putCounter(item, action.counterType, resolvedAmount!);
      return;
    case 'tap':
      actions.tap(item);
      return;
    default: {
      const _exhaustive: never = action;
      throw new Error(`unhandled each action: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/** The real interpreter — `card.ts`'s `applyEffect` calls this for a
 * `kind:'program'` Effect exactly the way it calls a `custom` effect's own
 * `run(ctx, actions)`. Genuine game resolution, not a simulation: every leaf
 * action goes through the same real `Actions`/`EffectContext` every other
 * declarative `Effect` kind already uses. */
export function runProgram(node: ProgramNode, ctx: EffectContext, actions: Actions, bindings: Bindings = {}): void {
  switch (node.kind) {
    case 'each': {
      const items = resolveQuery(node.input, ctx, bindings);
      // Resolved ONCE, before the loop — see `runEachAction`'s own doc
      // comment for why this must not be re-read per item.
      const resolvedAmount = node.action.action === 'putCounter' ? resolveValue(node.action.amount, ctx) : undefined;
      for (const item of items) runEachAction(node.action, item, resolvedAmount, actions);
      return;
    }
    case 'branch': {
      const left = resolveValue(node.condition.left, ctx);
      const right = resolveValue(node.condition.right, ctx);
      const branch = evalCompareOp(left, node.condition.op, right) ? node.then : (node.else ?? []);
      for (const step of branch) runProgram(step, ctx, actions, bindings);
      return;
    }
    case 'sequence': {
      for (const step of node.steps) actions.moveTo(ctx.self, step.to);
      return;
    }
    case 'selectUpTo': {
      // Same pool-exhaustion "pick up to N distinct items" loop `card.ts`'s
      // own `resolveTargets` already uses for a targeted `move`/`destroy`/
      // `putCounterTarget`/etc. — see this file's own header.
      const pool = resolveQuery(node.from, ctx, bindings);
      const picked: Card[] = [];
      for (let i = 0; i < node.max; i++) {
        const remaining = pool.filter((c) => !picked.includes(c));
        if (remaining.length === 0) break;
        picked.push(actions.chooseTarget(remaining));
      }
      const nextBindings: Bindings = { ...bindings, [node.as]: picked };
      for (const step of node.then) runProgram(step, ctx, actions, nextBindings);
      return;
    }
    case 'applyToBound': {
      const item = (bindings[node.name] ?? [])[node.index];
      if (!item) return; // fewer than index+1 items actually picked — a no-op, see this node's own doc comment
      const resolvedAmount = node.action.action === 'putCounter' ? resolveValue(node.action.amount, ctx) : undefined;
      runEachAction(node.action, item, resolvedAmount, actions);
      return;
    }
    default: {
      const _exhaustive: never = node;
      throw new Error(`unhandled program node: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Symbolic walker — reads the SAME AST with NO `ctx`/`actions`/board at all.
// This is the "enumerable without execution" property the whole file exists
// to prove out: every node this walker visits is read directly off the data,
// never inferred from running anything. A `Branch` node visits BOTH `then`
// and `else` unconditionally — neither side is "picked" the way `runProgram`
// picks exactly one based on a concrete `ctx` value.

/** One structural event the walker recorded — `detail` is a plain, readable
 * description of the node (not itself meant to be machine-parsed further;
 * a future consumer wanting structured data should read the AST node
 * directly, this is a human-facing trace of the walk). */
export interface WalkEvent {
  node: 'query' | 'filter' | 'aggregate' | 'each' | 'branch' | 'sequence' | 'bound' | 'selectUpTo' | 'applyToBound';
  detail: string;
}

function describeValue(v: ValueRef): string {
  switch (v.kind) {
    case 'literal':
      return `literal(${v.value})`;
    case 'selfCounters':
      return `selfCounters(${v.counterType})`;
    case 'aggregate':
      return `aggregate(${v.op}${v.field ? `:${v.field}` : ''})`;
    default: {
      const _exhaustive: never = v;
      throw new Error(`unhandled value ref: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function describePredicate(p: FilterPredicate): string {
  switch (p.field) {
    case 'subtype':
      return `subtype=${p.value}`;
    case 'excludeSelf':
      return 'excludeSelf';
    default: {
      const _exhaustive: never = p;
      throw new Error(`unhandled filter predicate: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function describeEachAction(a: EachAction): string {
  switch (a.action) {
    case 'putCounter':
      return `putCounter(${a.counterType}, ${describeValue(a.amount)})`;
    case 'tap':
      return 'tap';
    default: {
      const _exhaustive: never = a;
      throw new Error(`unhandled each action: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function walkQuery(input: Query | Filter | BoundSet, events: WalkEvent[]): void {
  if (input.kind === 'bound') {
    events.push({ node: 'bound', detail: `bound(${input.name})` });
    return;
  }
  if (input.kind === 'query') {
    events.push({ node: 'query', detail: `creaturesInPlay(${input.owner})` });
    return;
  }
  walkQuery(input.input, events);
  events.push({ node: 'filter', detail: describePredicate(input.predicate) });
}

/** Walks `agg.input` too (an `Aggregate` is itself a `ValueRef`, reachable
 * from a `Branch` condition or an `Each` action's own `amount` — this helper
 * is called from `walkValue` below, not from `walkProgram` directly, since an
 * `Aggregate` never appears as a top-level `ProgramNode`). */
function walkAggregate(agg: Aggregate, events: WalkEvent[]): void {
  walkQuery(agg.input, events);
  events.push({ node: 'aggregate', detail: `${agg.op}${agg.field ? `:${agg.field}` : ''}` });
}

function walkValue(v: ValueRef, events: WalkEvent[]): void {
  if (v.kind === 'aggregate') walkAggregate(v, events);
}

/**
 * Walks the AST with ZERO execution — no `ctx`, no `actions`, no board.
 * Returns the flat, ordered list of every node visited; a `Branch` always
 * visits both `then` and `else` (never picks one, unlike `runProgram`).
 * `events` is an accumulator param (defaults to a fresh array) purely so a
 * caller walking a `Sequence` of several `ProgramNode`s can share one list
 * across calls if it wants to — every call site in this codebase today
 * passes a single top-level node and reads the return value.
 */
export function walkProgram(node: ProgramNode, events: WalkEvent[] = []): WalkEvent[] {
  switch (node.kind) {
    case 'each':
      walkQuery(node.input, events);
      if (node.action.action === 'putCounter') walkValue(node.action.amount, events);
      events.push({ node: 'each', detail: describeEachAction(node.action) });
      return events;
    case 'branch': {
      walkValue(node.condition.left, events);
      walkValue(node.condition.right, events);
      events.push({ node: 'branch', detail: `compare(${describeValue(node.condition.left)} ${node.condition.op} ${describeValue(node.condition.right)})` });
      for (const step of node.then) walkProgram(step, events);
      for (const step of node.else ?? []) walkProgram(step, events);
      return events;
    }
    case 'sequence':
      for (const step of node.steps) events.push({ node: 'sequence', detail: `moveSelf -> ${step.to}` });
      return events;
    case 'selectUpTo': {
      walkQuery(node.from, events);
      events.push({ node: 'selectUpTo', detail: `selectUpTo(${node.max}) as ${node.as}` });
      for (const step of node.then) walkProgram(step, events);
      return events;
    }
    case 'applyToBound': {
      events.push({ node: 'applyToBound', detail: `applyToBound(${node.name}[${node.index}], ${describeEachAction(node.action)})` });
      return events;
    }
    default: {
      const _exhaustive: never = node;
      throw new Error(`unhandled program node: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
