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
//   pool — consulting `ctx.declaredTargets` first (2026-09-16), then falling
//   back to `actions.chooseTarget` (same pool-exhaustion loop `card.ts`'s
//   own `resolveTargets` already uses for a targeted `move`/`destroy`/etc.,
//   mirrored by this file's own `selectPool` helper), binds them under a
//   name, then runs `then` with that binding visible.
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
import type { Actions, EffectContext, Keyword } from './card';
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
 * speculatively.
 *
 * `'permanentsInPlay'` (2026-09-16, coordinator-routed pilot-triage
 * escalation) — real Forge equivalent `Player.getCardsIn(ZoneType.
 * Battlefield)` (interfaces.ts), unfiltered by card type. Motivating real
 * card: `stiltzkin-moogle-merchant`'s own "gains control of ANOTHER
 * target PERMANENT you control" — genuinely broader than
 * `'creaturesInPlay'` (an artifact/land/enchantment all legally qualify,
 * not just a creature), so narrowing that pool to `'creaturesInPlay'`
 * would have been a real behavior change, not just a representation one.
 *
 * `'libraryTop'` (2026-09-16, engine-lane primitive escalation, sidequest-
 * catch-a-fish-cooking-campsite/fin-31) — the READ half of a real Forge
 * `PeekAndReveal`/`Dig`-shaped ability (`PeekAndRevealEffect.java` lines
 * 24-25/57-59: `PeekAmount$` — how many cards to look at — and
 * `SourceZone$`, defaulting to `ZoneType.Library`), returning the top
 * `amount` cards of the scoped player(s)' own `Library` in their real,
 * current order (`interfaces.ts`'s pre-existing `Player.getCardsIn`
 * zone-array convention — index 0 is the top card, the same ordering
 * `card.ts`'s own `EffectContext.topLibraryCard`/`GameState.dig` already
 * rely on). Deliberately narrow: this is ONLY the peek — a real `dig`'s
 * other half ("of the ones you didn't take, put the rest back on the
 * BOTTOM in the same order," `GameState.dig`, state.ts) has no
 * `ProgramNode`/`EachAction` counterpart yet, since no real card has been
 * migrated onto this Query source (found needing it, not yet built for —
 * see sidequest-catch-a-fish-cooking-campsite's own `definition.ts`
 * comment). A card whose own effect needs the FULL dig (take some, bottom
 * the rest) still needs a `kind:'custom'` closure (or a future,
 * separately-scoped `ProgramNode`) until that half is built; this Query
 * source alone only unblocks READING the top N library cards from this
 * DSL, nothing more.
 *
 * `'equippedSelf'` (2026-09-16, engine-lane primitive escalation,
 * zack-fair/fin-45) — real Forge equivalent `Card.getEquippedBy()`
 * (interfaces.ts:126, `Card.java` ~line 3850): every Equipment currently
 * attached to `ctx.self` specifically, the REVERSE of `'permanentsInPlay'`
 * (which reads a PLAYER's whole battlefield) — this reads off one
 * particular CARD instead, so it's NOT player-owner-scoped at all (`owner`
 * is ignored, see that field's own doc comment). Real motivating card:
 * Zack Fair's own "attach an Equipment that was attached to Zack Fair to
 * that creature" — `zack-fair`'s own `definition.ts` used to read
 * `ctx.self.getEquippedBy()` directly inside a `kind:'custom'` closure
 * specifically because no `Query` source could express "attached to self"
 * at all (checked directly — `'creaturesInPlay'`/`'permanentsInPlay'` are
 * both player-scoped, `'libraryTop'` is zone-scoped, neither is
 * card-scoped). Reached via the SAME `selfCard` entry point object
 * `you`/`opponents`/`anyPlayer` already establish the pattern for (a
 * dedicated object, not a 4th method tacked onto one of those three, since
 * this query is never actually owner-scoped). */
export interface Query {
  kind: 'query';
  /**
   * `'graveyard'` (2026-09-18, FDN schema-completeness pass) — real Forge
   * `Count$Valid Card.YouOwn/GraveyardOnly`-style graveyard read, the
   * counting half of a real Threshold clause ("...if there are seven or
   * more cards in your graveyard" — `crypt-feaster`'s own real oracle
   * text, among several other real FDN cards' own declared
   * `missingSchemaFunctionality` gaps). Genuinely engine-ENFORCED, unlike
   * `card.ts`'s own new `BoardStateCondition` (see that type's own doc
   * comment): `resolveQuery` below reads `Player.getCardsIn('Graveyard')`,
   * an already-real, already-live method every OTHER `source` here already
   * calls the sibling of — no new engine plumbing needed, since a `Player`
   * is already a real, live object every `kind:'program'` Effect resolves
   * against. Lets a real Threshold-family clause be expressed as genuine,
   * executable `branch(compare(...))` logic for a ONE-SHOT (triggered/cast)
   * effect — it does NOT by itself make a CONTINUOUS static ability
   * (`card.ts`'s own `ContinuousGrantTargeting.condition`) live-conditional,
   * since a `program` only runs at one resolution moment, never re-read
   * continuously the way `state.ts`'s own `effectivePT`/`effectiveKeywords`
   * are.
   */
  source: 'creaturesInPlay' | 'permanentsInPlay' | 'libraryTop' | 'equippedSelf' | 'graveyard';
  /** `'any'` (2026-09-15) — BOTH sides unioned, real motivating case:
   * `aerith-rescue-mission`'s own "Tap up to three target creatures" (no
   * owner restriction printed at all, unlike every prior migrated closure's
   * own `you`/`opponents`-scoped need) — same real pool composition
   * (`[...ctx.you.getCreaturesInPlay(), ...ctx.opponents.flatMap(p =>
   * p.getCreaturesInPlay())]`) the closure it replaces already used.
   * Ignored (not player-scoped at all) for `source:'equippedSelf'` — see
   * that source's own doc comment; always write `'you'` there by
   * convention (same "unused but still required" treatment `amount`
   * already gets for every OTHER source). */
  owner: 'you' | 'opponents' | 'any';
  /** Only meaningful for, and REQUIRED when, `source: 'libraryTop'` (real
   * Forge `PeekAmount$`, see above) — how many cards, counting from the
   * top, to include in the returned pool. Enforced at runtime by
   * `resolveQuery` (throws, doesn't silently default), not the type system
   * — same "closed vocabulary, no static cross-field proof" tradeoff every
   * other optional field in this file already accepts. Unused/ignored for
   * every other `source` value. */
  amount?: number;
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

/** The 4 real, callable card-TYPE checks `Card` (interfaces.ts) actually
 * has today — `isCreature`/`isArtifact`/`isLand`/`isEnchantment`. No
 * `isPlaneswalker`/`isBattle` exists anywhere in this engine yet (checked
 * — unlike `recognizers/entersBattlefield-self-trigger-structural.ts`'s
 * own `TYPE_WORDS`, which matches against ORACLE TEXT and can name a type
 * this engine has no callable check for at all; this is a real, executable
 * board-state filter, so it can only ever list what `Card` can actually
 * answer). Extend the day a real card needs Planeswalker/Battle filtering
 * AND this engine gains the matching `Card.isX()` method — not
 * speculatively. */
export type CardTypeWord = 'creature' | 'artifact' | 'land' | 'enchantment';

/** A named, parameterized predicate over a `Query`/`Filter`'s own result —
 * `'subtype'` mirrors `Card.hasSubtype` (Aerith Gainsborough's own
 * "legendary creature" narrowing); `'excludeSelf'` mirrors the `notSelf`-
 * style `c.getId() !== ctx.self.getId()` exclusion several existing
 * declarative `Effect` kinds (`pumpAll`, `sacrifice`, `move`, ...) already
 * carry as a plain boolean field, generalized here to a first-class
 * predicate node so a `Filter` can compose more than one condition later
 * without redesigning this union.
 *
 * `'cardType'` (2026-09-16, coordinator-routed escalation — a fresh
 * definition-lane read of Ultima/fin-38's own "destroy all artifacts and
 * creatures" `kind:'custom'` closure, whose own comment explains it was
 * `custom` specifically because no combinator primitive could express a
 * printed-TYPE filter): `value` accepts either ONE `CardTypeWord` or an
 * ARRAY (OR-matched, any one matching is enough — Ultima's own real "all
 * artifacts AND creatures" needs exactly this union-of-two-types shape, not
 * an intersection; a plain `Filter` chain can only ever narrow further/AND
 * together, so a single-value `'subtype'`-style field couldn't express
 * "either of these two types" on its own). Checked the real pool first
 * (2026-09-16, real-sibling-count discipline): 25 OTHER real cards have a
 * near-identical `custom`-closure card-TYPE filter shape (grepped
 * `.filter((c) => ... c.is(Artifact|Creature|Land|Enchantment)())` across
 * `cards/*\/definition.ts` — see `.claude/agent-memory/engine/notes.md`'s
 * own dated entry for the full list), so this is real, general-purpose
 * vocabulary, not a one-card special case. ~10 of those 25 filter a
 * `Battlefield` pool (`beatrix-loyal-general`, `coliseum-behemoth`,
 * `judgment-bolt`, `elrond-moon-reader`, `gilgamesh-master-at-arms`,
 * `stuck-in-summoner-s-sanctum`, `golbez-crystal-collector`,
 * `sleep-magic`, `sandworm`, `airship-crash`) and are immediately eligible
 * for this predicate today (`Query.source` already covers Battlefield);
 * the remaining ~15 filter Graveyard/Library/Exile, which this predicate
 * alone doesn't unblock — those would ALSO need a new `Query.source` for
 * that zone (not built here, real future work if a real card needs it).
 * Migrating any of these cards onto this predicate is definition-lane
 * work, not done here.
 *
 * `'sameNameAsSelf'` (2026-09-18, engine-lane escalation — Hare Apparent,
 * FDN #15's own "create a 1/1 Rabbit token for each OTHER creature you
 * control named Hare Apparent"). Mirrors `'excludeSelf'`'s own shape
 * exactly — no `value` parameter, always resolved relative to `ctx.self` —
 * but compares `Card.getName()` instead of `Card.getId()`, and BAKES IN the
 * self-exclusion itself (`c.getId() !== ctx.self.getId()`) rather than
 * requiring a separately-composed `'excludeSelf'` filter: counting "other
 * copies of this same card" is one single real concept ("this card cares
 * about the board-state COUNT of a filtered set of permanents you
 * control," the same family `sink-model/catalog/battlefield-presence-cats
 * .ts`/`-creatures.ts` already name, just filtered on same-NAME instead of
 * same-SUBTYPE/-type — see that pair's own header and
 * `sink-model/catalog/battlefield-presence-hare-apparent.ts`'s own header
 * for the full "third filter variant" writeup), not two independently
 * composable predicates that happen to always appear together for this
 * shape. This was the SPECIFIC gap that used to force Hare Apparent's own
 * "create a Rabbit token" `createToken.amount` to stay a raw, structurally
 * opaque `(ctx) => ...` closure (`Computed<number>`'s own function
 * variant) — every other migrated closure in this file's own history
 * needed a NEW `Query.source`/`EachAction`/`Condition` primitive; this one
 * only needed a new `FilterPredicate`, since `Query.source:
 * 'creaturesInPlay'` + `Aggregate{op:'count'}` (both pre-existing) already
 * expressed everything else about the shape. */
export type FilterPredicate = { field: 'subtype'; value: string } | { field: 'excludeSelf' } | { field: 'cardType'; value: CardTypeWord | CardTypeWord[] } | { field: 'sameNameAsSelf' };

/** `matchesCardType(c, 'artifact')` reads `Card.isArtifact()` — one
 * dispatch point for every `CardTypeWord`, shared by both the real
 * predicate-evaluation branch (`resolveQuery`) and (indirectly, via that
 * same real `Card` interface) anything else in this engine that already
 * checks card type; not duplicated logic, just a named switch over which
 * real `Card` method to call. */
function matchesCardType(c: Card, t: CardTypeWord): boolean {
  switch (t) {
    case 'creature':
      return c.isCreature();
    case 'artifact':
      return c.isArtifact();
    case 'land':
      return c.isLand();
    case 'enchantment':
      return c.isEnchantment();
    default: {
      const _exhaustive: never = t;
      throw new Error(`unhandled card type word: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

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

/**
 * Two `ValueRef`s summed — 2026-09-16, coordinator-routed escalation.
 * Real motivating card: Slash of Light's own real "damage equal to the
 * number of creatures you control PLUS the number of Equipment you
 * control" (`Count$Valid Creature.YouCtrl/Plus.Y`, `Y:Count$Valid
 * Equipment.YouCtrl` — Forge's own real script sums two INDEPENDENT
 * counts, not a union-pool count; checked against the real Forge script,
 * not assumed — a card with an Equipment that's ALSO a creature would
 * genuinely double-count under this real, literal semantics, matching
 * Forge's own). Grepped the real pool for this shape first: this is the
 * ONLY real card whose own formula needs a genuine two-value SUM (as
 * opposed to a single `Aggregate`/`selfCounters` read, or a threshold
 * ternary — see `Branch`'s own doc comment for how a threshold-style
 * "if count >= N then A else B" is expressed instead, without needing
 * this node at all). Still real, general vocabulary (not fabricated for
 * one card) since a "sum of two differently-scoped counts" is a genuine,
 * distinct shape from a single `Aggregate`. */
export interface AddValue {
  kind: 'add';
  left: ValueRef;
  right: ValueRef;
}

/** A value an effect reads at resolution time: a fixed constant, `ctx.self`'s
 * own current counter count (`Card.getCounters`, interfaces.ts — Aerith
 * Gainsborough's own "X, the number of +1/+1 counters on this"), an
 * `Aggregate` computed over a `Query`/`Filter`, or the `AddValue` sum of
 * two such values. */
export type ValueRef = { kind: 'literal'; value: number } | { kind: 'selfCounters'; counterType: string } | Aggregate | AddValue;

// ---------------------------------------------------------------------------
// Each — apply a named action to every item of a Query/Filter result.

/**
 * A reference into a NAMED binding from an enclosing `SelectUpTo` — how one
 * `EachAction` (`'equip'`) reaches a SECOND, independently-picked object
 * instead of just the one item it's already being applied to (see
 * `'equip'` below).
 */
export interface BoundRef {
  name: string;
  index: number;
}

/** The one action `Each`/`ApplyToBound` applies to a matched item — a
 * closed, parameterized union (never an arbitrary callback), same "named
 * action from `Actions`" shape every other declarative `Effect` kind in
 * `card.ts` already uses. Extend as a real future card needs a different
 * broadcast action (see this file's own header).
 *
 * `'untap'` / `'gainControl'` / `'grantKeyword'` / `'equip'` (2026-09-16,
 * coordinator-routed pilot-triage escalation — no declarative `Effect` kind
 * anywhere in `card.ts` wraps `Actions.gainControl`, forcing `kind:'custom'`
 * on 4 real cards: `stolen-uniform`, `stiltzkin-moogle-merchant`,
 * `zidane-tantalus-thief`, `unexpected-request` — see each of those cards'
 * own `definition.ts` comments for the exact real text). Rather than a
 * dedicated top-level `gainControlTarget` `Effect` kind (which couldn't by
 * itself express "gain control of X, THEN untap/grant-keyword/equip that
 * SAME X" — the real shape all 4 of those cards need), these land here
 * instead: `SelectUpTo`/`ApplyToBound` already solve exactly this "act on
 * the object a PRIOR step just picked" problem (see this file's own header,
 * "`SelectUpTo`/`ApplyToBound`/`BoundSet`") — the only piece actually
 * missing was action vocabulary beyond `putCounter`/`tap`.
 * - `'gainControl'` — `controller: 'you' | 'opponent'` mirrors the same
 *   "no chooseTarget-equivalent for picking a PLAYER, so `ctx.opponents[0]`
 *   stands in for a chosen opponent" simplification `stiltzkin-moogle-
 *   merchant`'s own (pre-migration) `custom` comment already documented —
 *   not a new simplification, just relocated.
 * - `'grantKeyword'` mirrors `card.ts`'s own `grantKeywordTarget` Effect's
 *   `untilEndOfTurn` field exactly (`Actions.grantKeyword`'s own real
 *   `opts.untilEndOfTurn`, interfaces.ts).
 * - `'equip'` is the one action needing a SECOND bound object (the
 *   creature to attach TO, not just the item it's applied to) — `to:
 *   BoundRef` names which other `SelectUpTo` binding (and which index into
 *   it) supplies that second `Card`. Resolves to a no-op if that binding
 *   doesn't have an item at `to.index` (same "fewer than expected picked"
 *   tolerance `ApplyToBound` itself already has).
 *
 * `'destroy'` (2026-09-16, same escalation as the `cardType` `FilterPredicate`
 * above — added alongside it, not separately asked for, because the filter
 * predicate ALONE still couldn't have unblocked Ultima/fin-38's own real
 * "destroy all artifacts and creatures": `actions.destroy` is a real, wired
 * single-`Card` action (interfaces.ts), but no `EachAction` variant called
 * it, so even with a working `Filter{field:'cardType'}` pool, an `Each`
 * over that pool would have had nothing to DO to each item. Mirrors
 * `'tap'`/`'untap'`'s own no-parameters shape exactly.
 *
 * `'dealDamage'` / `'pump'` (2026-09-16, coordinator-routed escalation —
 * `slash-of-light`'s/`you-re-not-alone`'s own board-state-magnitude
 * `Computed<number>` closures on the plain declarative `dealDamageTarget`/
 * `pumpTarget` `Effect` kinds, which stay opaque to any recognizer since a
 * raw JS closure can never become structured data). These are the single-
 * target counterparts to `card.ts`'s own `dealDamage`/`pump` real Actions,
 * meant to be reached via `SelectUpTo`(max 1)/`ApplyToBound` (pick ONE
 * target, then act on it with a computed `ValueRef` amount) rather than a
 * board-wide `Each` broadcast — though nothing stops a real future card
 * from using either as a genuine broadcast too, same as every other action
 * here. `amount`/`power`/`toughness` are real `ValueRef`s (a `literal`, an
 * `Aggregate`, or an `AddValue` sum — Slash of Light's own real "creatures
 * you control PLUS Equipment you control" needs the `AddValue` sum
 * specifically; You're Not Alone's own "+4/+4 instead if you control 3+
 * creatures" is a `Branch`-level dispatch instead — see `Branch`'s own doc
 * comment — not a value-level ternary, so no new `ValueRef` variant was
 * needed for that half). `'pump'`'s own `untilEndOfTurn` mirrors
 * `Actions.pump`'s own real `opts.untilEndOfTurn`, same as `'grantKeyword'`
 * above. `'dealDamage'`'s source is always `ctx.self` (no real card in
 * this pool needs a damage source other than the resolving card itself).
 */
export type EachAction =
  | { action: 'putCounter'; counterType: string; amount: ValueRef }
  | { action: 'tap' }
  | { action: 'untap' }
  | { action: 'destroy' }
  | { action: 'dealDamage'; amount: ValueRef }
  | { action: 'pump'; power: ValueRef; toughness: ValueRef; untilEndOfTurn?: boolean }
  | { action: 'gainControl'; controller: 'you' | 'opponent' }
  | { action: 'grantKeyword'; keyword: Keyword; untilEndOfTurn?: boolean }
  | { action: 'equip'; to: BoundRef };

export interface Each {
  kind: 'each';
  input: Query | Filter | BoundSet;
  action: EachAction;
}

// ---------------------------------------------------------------------------
// SelectUpTo / ApplyToBound — see this file's own header, "`SelectUpTo`/
// `ApplyToBound`/`BoundSet`," for the real motivating card and design.

/** Picks up to `max` DISTINCT items from `from` — first draining any real
 * cast-time-declared targets off `ctx.declaredTargets` (CR 601.2c/608.2b:
 * target choice locks in at CAST time, not resolution — see `card.ts`'s own
 * `resolveTargets` and `EffectContext.declaredTargets` doc comments for the
 * full mechanism), then falling back to a fresh `actions.chooseTarget`
 * pool-exhaustion loop for whatever's left (same algorithm `card.ts`'s own
 * `resolveTargets` uses for a targeted `move`/`destroy`/etc. — see this
 * file's own `selectPool` helper, which mirrors it). Binds the picked list
 * under `as`, then runs `then` with that binding visible (to a nested
 * `Each{input:{kind:'bound',...}}` or `ApplyToBound`).
 *
 * **`ctx.declaredTargets` consultation (2026-09-16, coordinator-routed
 * pilot-triage escalation).** Before this, `selectUpTo` called
 * `actions.chooseTarget` directly with NO `declaredTargets` check at all —
 * a real gap for any Aura whose own onEnter "attach to enchanted permanent"
 * effect needs to honor the SAME target actually declared at cast time
 * (601.2c), not roll a fresh one at resolution. Two real cards,
 * `stuck-in-summoner-s-sanctum` and `sleep-magic`, both carry a real,
 * load-bearing hand-authored `custom` closure doing exactly this
 * reconciliation (see either card's own `definition.ts` comment, and
 * ENGINE_GAPS.md gap #18) — migrating either to `kind:'program'` before
 * this fix would have silently REGRESSED that fix (a fresh `chooseTarget`
 * roll instead of the cast-time-declared target). Neither card is migrated
 * by this change; this only makes migrating them SAFE for a future pass. */
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

/** Numeric comparison. */
export interface CompareCondition {
  kind: 'compare';
  left: ValueRef;
  op: CompareOp;
  right: ValueRef;
}

/** A genuinely categorical branch condition (2026-09-16, engine-lane
 * primitive escalation, venat-heart-of-hydaelyn-hydaelyn-the-mothercrystal/
 * fin-39) — real motivating card: Blessing of Light's own "...put a +1/+1
 * counter on another target creature you control. Until your next turn, it
 * gains indestructible. If that creature is legendary, draw a card." —
 * `CompareCondition`'s numeric-only shape has no way to gate an action on a
 * PREVIOUSLY-BOUND object's own subtype/supertype, only on a literal
 * number; a card-results-lane investigation confirmed there was no
 * `Condition` shape at all for this before this pass. Mirrors
 * `FilterPredicate`'s own `{field:'subtype', value}` check (`Card.
 * hasSubtype` — this engine's own `effectiveSubtypes` already folds
 * "Legendary" in as a subtype-like token for exactly this reason, same real
 * precedent `aerith-gainsborough`'s/`serah-farron-crystallized-serah`'s own
 * `.filter('subtype', 'Legendary')` calls already establish — see
 * `FilterPredicate`'s own doc comment), applied to a SINGLE bound item
 * (named via `BoundRef`, the same "which `SelectUpTo` binding, which index"
 * reference `ApplyToBound`/`'equip'`'s own `to` field already use) instead
 * of to a whole `Query`/`Filter` pool. Resolves `false` — same "fewer than
 * expected picked" tolerance `ApplyToBound` itself already has — when that
 * binding has no item at `target.index`.
 *
 * **Real, honestly-scoped limit, checked and confirmed before landing,
 * not silently glossed over**: widening `Condition` alone does NOT, by
 * itself, make Venat/Hydaelyn's own Blessing of Light effect migratable off
 * `kind:'custom'` today. Two further, independent gaps remain, neither
 * closed by this addition: (1) `recognizers/program-ast-walker.ts`'s own
 * header (see that file directly) already documents that a bound
 * `'putCounter'`/`'grantKeyword'` `EachAction` is "walked structurally but
 * simply has no occurrence shape built for it yet" — no recognizer reads
 * one today regardless of how the enclosing `Branch`/`SelectUpTo` is
 * shaped, a recognizer-lane gap, not an engine-core one; (2) this file has
 * NO `ProgramNode`/`EachAction` for "draw a card" at all (checked directly
 * — `ProgramNode` is `Each | Branch | Sequence | SelectUpTo |
 * ApplyToBound`, none of which can express a bare player action untied to
 * any Card item), so even a perfectly-walked `Branch` still has nothing to
 * put in its own `then` list for this specific card's real "draw a card"
 * consequence. Both are real, separately-scoped follow-ups (recognizer
 * lane for (1); a new engine-core `ProgramNode` variant for (2), not
 * built here since it wasn't the primitive actually escalated this pass —
 * see `.claude/agent-memory/engine/notes.md` for the full writeup). */
export interface HasSubtypeCondition {
  kind: 'hasSubtype';
  target: BoundRef;
  subtype: string;
}

export type Condition = CompareCondition | HasSubtypeCondition;

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
// DrawCard — a bare PLAYER action, untied to any matched `Card` item at all
// (2026-09-16, engine-lane primitive build, `venat-heart-of-hydaelyn-
// hydaelyn-the-mothercrystal`/fin-39's own real motivating card: Blessing of
// Light's "...if that creature is legendary, draw a card"). Every OTHER
// `ProgramNode`/`EachAction` shape in this file ultimately acts on a matched
// `Card` (`Each`/`ApplyToBound`'s own `item` parameter) — `combinator.ts`'s
// own header used to note flatly that "no `EachAction` variant calls
// `Player.drawCard()` directly" (see `stiltzkin-moogle-merchant`'s own
// definition.ts comment, which worked around this the same day by keeping
// its own "you draw a card" as a plain top-level `card.ts` `kind:'drawCard'`
// Effect SIBLING, never nested inside the program at all — a real option
// when the draw is unconditional, but not for Venat's own draw, which is
// gated behind a real `Branch`/`HasSubtypeCondition` that only a
// `ProgramNode` can express). `amount` mirrors `card.ts`'s own `kind:
// 'drawCard'` Effect's `amount?: Computed<number>` (omitted = 1, same
// resolution-time default) — a `ValueRef`, not a raw closure, so this stays
// real, inspectable data the same way every other node here does.
export interface DrawCard {
  kind: 'drawCard';
  amount?: ValueRef;
}

// ---------------------------------------------------------------------------

/** The top-level node kind a `card.ts` `kind:'program'` Effect's own
 * `program` field holds — one of the "does something"/"picks something"
 * shapes above, PLUS `DrawCard` (2026-09-16 — the one bare-player-action
 * exception; see its own doc comment for why it doesn't fit the
 * item-bound `Each`/`ApplyToBound` mold) — `Query`/`Filter`/`Aggregate`/
 * `ValueRef` are never top-level themselves, only ever nested inputs to
 * one of these. */
export type ProgramNode = Each | Branch | Sequence | SelectUpTo | ApplyToBound | DrawCard;

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
  filter(field: 'sameNameAsSelf'): QueryChain;
  filter(field: 'cardType', value: CardTypeWord | CardTypeWord[]): QueryChain;
  filter(field: FilterPredicate['field'], value?: string | CardTypeWord | CardTypeWord[]): QueryChain {
    const predicate: FilterPredicate =
      field === 'subtype'
        ? { field: 'subtype', value: value as string }
        : field === 'cardType'
          ? { field: 'cardType', value: value as CardTypeWord | CardTypeWord[] }
          : field === 'sameNameAsSelf'
            ? { field: 'sameNameAsSelf' }
            : { field: 'excludeSelf' };
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
  /** See `Query.source`'s own `'permanentsInPlay'` doc comment. */
  permanentsInPlay: (): QueryChain => new QueryChain({ kind: 'query', source: 'permanentsInPlay', owner: 'you' }),
  /** See `Query.source`'s own `'libraryTop'` doc comment. */
  libraryTop: (amount: number): QueryChain => new QueryChain({ kind: 'query', source: 'libraryTop', owner: 'you', amount }),
};
export const opponents = {
  creaturesInPlay: (): QueryChain => new QueryChain({ kind: 'query', source: 'creaturesInPlay', owner: 'opponents' }),
  permanentsInPlay: (): QueryChain => new QueryChain({ kind: 'query', source: 'permanentsInPlay', owner: 'opponents' }),
  libraryTop: (amount: number): QueryChain => new QueryChain({ kind: 'query', source: 'libraryTop', owner: 'opponents', amount }),
};
/** Both sides unioned — see `Query.owner`'s own doc comment. */
export const anyPlayer = {
  creaturesInPlay: (): QueryChain => new QueryChain({ kind: 'query', source: 'creaturesInPlay', owner: 'any' }),
  permanentsInPlay: (): QueryChain => new QueryChain({ kind: 'query', source: 'permanentsInPlay', owner: 'any' }),
  libraryTop: (amount: number): QueryChain => new QueryChain({ kind: 'query', source: 'libraryTop', owner: 'any', amount }),
};
/** A dedicated entry point for card-scoped (not player-scoped) queries —
 * `you`/`opponents`/`anyPlayer` above all read a PLAYER's own board/library,
 * this reads off `ctx.self` directly. Only one real source exists today
 * (`equippedSelf` — see `Query.source`'s own doc comment); add a sibling
 * method here the day a real card needs a different self-scoped read, not
 * speculatively. */
export const selfCard = {
  equippedSelf: (): QueryChain => new QueryChain({ kind: 'query', source: 'equippedSelf', owner: 'you' }),
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

/** Sums two `ValueRef`s (or plain numbers, wrapped via `toValueRef`) — see
 * `AddValue`'s own doc comment for the real motivating card (Slash of
 * Light's own "creatures you control PLUS Equipment you control"). */
export function add(left: ValueRef | number, right: ValueRef | number): ValueRef {
  return { kind: 'add', left: toValueRef(left), right: toValueRef(right) };
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

/** Untaps every matched item — no parameters, mirrors `tap()` above. */
export function untap(): EachAction {
  return { action: 'untap' };
}

/** Destroys every matched item — no parameters, mirrors `tap()`/`untap()`
 * above. Real motivating card: Ultima's own "destroy all artifacts and
 * creatures" (paired with a `Filter{field:'cardType'}` pool). */
export function destroyEach(): EachAction {
  return { action: 'destroy' };
}

/** Deals `amount` damage (a plain `number` or any `ValueRef`) from
 * `ctx.self` to every matched item — real motivating card: Slash of
 * Light's own "damage equal to the number of creatures you control plus
 * the number of Equipment you control." */
export function dealDamageEach(amount: ValueRef | number): EachAction {
  return { action: 'dealDamage', amount: toValueRef(amount) };
}

/** Pumps every matched item by `power`/`toughness` (each a plain `number`
 * or any `ValueRef`) — real motivating card: You're Not Alone's own
 * "+2/+2, or +4/+4 instead if you control three or more creatures" (paired
 * with a `Branch` picking which literal amount applies — see `Branch`'s
 * own doc comment). */
export function pumpEach(power: ValueRef | number, toughness: ValueRef | number, untilEndOfTurn?: boolean): EachAction {
  return untilEndOfTurn === undefined
    ? { action: 'pump', power: toValueRef(power), toughness: toValueRef(toughness) }
    : { action: 'pump', power: toValueRef(power), toughness: toValueRef(toughness), untilEndOfTurn };
}

/** Gains control of every matched item for `controller` ('you' or a
 * chosen opponent, `ctx.opponents[0]` — see `EachAction`'s own doc comment
 * for why there's no genuine player-picker here). Real motivating cards:
 * zidane-tantalus-thief/unexpected-request/stolen-uniform (`'you'`),
 * stiltzkin-moogle-merchant (`'opponent'`). */
export function gainControl(controller: 'you' | 'opponent'): EachAction {
  return { action: 'gainControl', controller };
}

/** Grants `keyword` to every matched item — `untilEndOfTurn` mirrors
 * `Actions.grantKeyword`'s own real `opts.untilEndOfTurn` exactly. */
export function grantKeyword(keyword: Keyword, untilEndOfTurn?: boolean): EachAction {
  return untilEndOfTurn === undefined ? { action: 'grantKeyword', keyword } : { action: 'grantKeyword', keyword, untilEndOfTurn };
}

/** Attaches every matched item (an Equipment) onto the item at
 * `boundName[boundIndex]` of a SEPARATE `SelectUpTo` binding — the one
 * `EachAction` needing a second bound object; see `EachAction`'s own doc
 * comment. */
export function equipTo(boundName: string, boundIndex: number): EachAction {
  return { action: 'equip', to: { name: boundName, index: boundIndex } };
}

/** A `Branch`'s own numeric condition. `left`/`right` each accept a plain
 * `number` or any `ValueRef`, same as `putCounter`'s own `amount`. */
export function compare(left: ValueRef | number, op: CompareOp, right: ValueRef | number): Condition {
  return { kind: 'compare', left: toValueRef(left), op, right: toValueRef(right) };
}

/** A `Branch`'s own categorical condition — see `HasSubtypeCondition`'s own
 * doc comment. `target` names a previously-bound `SelectUpTo` selection the
 * same way `equipTo`/`applyToBound` already do (`{name, index}`). */
export function hasSubtype(boundName: string, boundIndex: number, subtype: string): Condition {
  return { kind: 'hasSubtype', target: { name: boundName, index: boundIndex }, subtype };
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

/** A bare "draw a card" `ProgramNode` — see `DrawCard`'s own doc comment.
 * `amount` accepts a plain `number` or any `ValueRef`, omit for the same
 * "resolves to 1" default `card.ts`'s own `kind:'drawCard'` Effect uses. */
export function drawCard(amount?: ValueRef | number): DrawCard {
  return amount === undefined ? { kind: 'drawCard' } : { kind: 'drawCard', amount: toValueRef(amount) };
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
    // `'equippedSelf'` is card-scoped (`ctx.self`), not player-scoped — read
    // before `players` is even computed, since `owner` is meaningless here
    // (see `Query.source`'s own doc comment).
    if (input.source === 'equippedSelf') return ctx.self.getEquippedBy();
    const players = input.owner === 'you' ? [ctx.you] : input.owner === 'opponents' ? ctx.opponents : [ctx.you, ...ctx.opponents];
    if (input.source === 'libraryTop') {
      if (!input.amount || input.amount < 1) throw new Error("Query source:'libraryTop' requires a positive amount (PeekAmount$)");
      const amount = input.amount;
      return players.flatMap((p) => p.getCardsIn('Library').slice(0, amount));
    }
    if (input.source === 'graveyard') return players.flatMap((p) => p.getCardsIn('Graveyard'));
    return input.source === 'permanentsInPlay' ? players.flatMap((p) => p.getCardsIn('Battlefield')) : players.flatMap((p) => p.getCreaturesInPlay());
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
    case 'sameNameAsSelf':
      return base.filter((c) => c.getName() === ctx.self.getName() && c.getId() !== ctx.self.getId());
    case 'cardType': {
      // Same local-narrowing note as `subtype` above.
      const types = predicate.value;
      const typeList = Array.isArray(types) ? types : [types];
      return base.filter((c) => typeList.some((t) => matchesCardType(c, t)));
    }
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

/**
 * Exported (2026-09-18, for Hare Apparent's own `createToken.amount` — see
 * `card.ts`'s own `resolveCreateTokenAmount` and this file's own
 * `FilterPredicate`/`'sameNameAsSelf'` doc comment) so a plain declarative
 * `Effect` field typed `Computed<number> | ValueRef` (today only
 * `createToken.amount`) can resolve a bare `ValueRef` — a QueryChain's own
 * `.count()`/`.sum()` `Aggregate`, e.g. — WITHOUT being wrapped in a
 * `kind:'program'` Effect at all. Every other real consumer of `ValueRef`
 * resolution stays internal to `runProgram` (`resolveEachActionValues`/
 * `evalCondition`'s own `resolveValue` calls, unchanged).
 */
export function resolveValue(ref: ValueRef, ctx: EffectContext): number {
  switch (ref.kind) {
    case 'literal':
      return ref.value;
    case 'selfCounters':
      return ctx.self.getCounters(ref.counterType);
    case 'aggregate':
      return resolveAggregate(ref, ctx);
    case 'add':
      return resolveValue(ref.left, ctx) + resolveValue(ref.right, ctx);
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

/** `Branch.condition`'s own real dispatch — `'compare'` (numeric, unchanged)
 * or `'hasSubtype'` (categorical, reads a bound item — see
 * `HasSubtypeCondition`'s own doc comment). */
function evalCondition(condition: Condition, ctx: EffectContext, bindings: Bindings): boolean {
  switch (condition.kind) {
    case 'compare': {
      const left = resolveValue(condition.left, ctx);
      const right = resolveValue(condition.right, ctx);
      return evalCompareOp(left, condition.op, right);
    }
    case 'hasSubtype': {
      const item = (bindings[condition.target.name] ?? [])[condition.target.index];
      return item ? item.hasSubtype(condition.subtype) : false;
    }
    default: {
      const _exhaustive: never = condition;
      throw new Error(`unhandled condition: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Every `ValueRef`-carrying `EachAction`'s own resolved number(s) — computed
 * ONCE per `Each`/`ApplyToBound` node (by `runProgram`'s own two call sites
 * below), never re-read per item — this mirrors every real migrated
 * closure's own original imperative shape (`const x = ...; for (...)
 * actions.putCounter(item, type, x)`, Aerith Gainsborough's own onDies
 * closure being the concrete example) rather than re-evaluating a live
 * `ValueRef` per iteration, which would let an EARLIER iteration's own
 * mutation (a `putCounter` onto `ctx.self` itself, when self happens to be
 * one of the matched items — a real, checked case in this file's own test
 * suite) silently change a LATER iteration's own amount. Real CR 608.2h
 * "locked in once" semantics, not a per-object recomputation. `'pump'` needs
 * TWO resolved numbers (power AND toughness) at once, hence a small bag
 * instead of a single `number | undefined` (2026-09-16, widened from the
 * original single-`amount` shape when `'dealDamage'`/`'pump'` landed).
 */
interface ResolvedEachValues {
  amount?: number;
  power?: number;
  toughness?: number;
}

function resolveEachActionValues(action: EachAction, ctx: EffectContext): ResolvedEachValues {
  switch (action.action) {
    case 'putCounter':
    case 'dealDamage':
      return { amount: resolveValue(action.amount, ctx) };
    case 'pump':
      return { power: resolveValue(action.power, ctx), toughness: resolveValue(action.toughness, ctx) };
    default:
      return {};
  }
}

function runEachAction(action: EachAction, item: Card, resolved: ResolvedEachValues, actions: Actions, ctx: EffectContext, bindings: Bindings): void {
  switch (action.action) {
    case 'putCounter':
      actions.putCounter(item, action.counterType, resolved.amount!);
      return;
    case 'tap':
      actions.tap(item);
      return;
    case 'untap':
      actions.untap(item);
      return;
    case 'destroy':
      actions.destroy(item);
      return;
    case 'dealDamage':
      actions.dealDamage(ctx.self, item, resolved.amount!);
      return;
    case 'pump':
      actions.pump(item, resolved.power!, resolved.toughness!, { untilEndOfTurn: action.untilEndOfTurn });
      return;
    case 'gainControl': {
      // `ctx.opponents[0]` stands in for "a chosen opponent" — same
      // no-player-picker simplification stiltzkin-moogle-merchant's own
      // (pre-migration) `custom` comment already documented; see this
      // action's own doc comment on `EachAction` above.
      const controller = action.controller === 'you' ? ctx.you : ctx.opponents[0];
      if (controller) actions.gainControl(controller, item);
      return;
    }
    case 'grantKeyword':
      actions.grantKeyword(item, action.keyword, { untilEndOfTurn: action.untilEndOfTurn });
      return;
    case 'equip': {
      const target = (bindings[action.to.name] ?? [])[action.to.index];
      if (target) actions.equip(item, target); // no-op if that binding didn't pick enough items — same `ApplyToBound` tolerance
      return;
    }
    default: {
      const _exhaustive: never = action;
      throw new Error(`unhandled each action: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/** Picks up to `max` distinct items from `pool` for a `SelectUpTo` node —
 * mirrors `card.ts`'s own (private, not exported) `resolveTargets` algorithm
 * exactly: drain `ctx.declaredTargets` first (real cast-time targets,
 * CR 601.2c/608.2b), then fall back to a fresh `actions.chooseTarget`
 * pool-exhaustion loop for whatever's left. Duplicated here (not imported)
 * to avoid a runtime `card.ts` <-> `combinator.ts` import cycle — the two
 * files already have a type-only cycle (this file's own header), but
 * `card.ts` also calls this file's `runProgram` at runtime, so a reverse
 * runtime call back into `card.ts` would be a genuine cycle, not just a
 * type-erased one. Keep both copies in sync; a divergence here is a real
 * bug. See `SelectUpTo`'s own doc comment above for the motivating cards. */
function selectPool(pool: Card[], max: number, ctx: EffectContext, actions: Actions): Card[] {
  if (ctx.declaredTargets) {
    const chosen: Card[] = [];
    while (chosen.length < max && ctx.declaredTargets.length > 0) {
      const next = ctx.declaredTargets.shift()!;
      if (pool.some((c) => c.getId() === next.getId())) chosen.push(next);
      // else: this declared target is no longer legal (608.2b) — dropped, not replaced.
    }
    return chosen;
  }
  const picked: Card[] = [];
  for (let i = 0; i < max; i++) {
    const remaining = pool.filter((c) => !picked.includes(c));
    if (remaining.length === 0) break;
    picked.push(actions.chooseTarget(remaining, ctx.preferTarget));
  }
  return picked;
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
      const resolved = resolveEachActionValues(node.action, ctx);
      for (const item of items) runEachAction(node.action, item, resolved, actions, ctx, bindings);
      return;
    }
    case 'branch': {
      const branch = evalCondition(node.condition, ctx, bindings) ? node.then : (node.else ?? []);
      for (const step of branch) runProgram(step, ctx, actions, bindings);
      return;
    }
    case 'sequence': {
      for (const step of node.steps) actions.moveTo(ctx.self, step.to);
      return;
    }
    case 'selectUpTo': {
      const pool = resolveQuery(node.from, ctx, bindings);
      const picked = selectPool(pool, node.max, ctx, actions);
      const nextBindings: Bindings = { ...bindings, [node.as]: picked };
      for (const step of node.then) runProgram(step, ctx, actions, nextBindings);
      return;
    }
    case 'applyToBound': {
      const item = (bindings[node.name] ?? [])[node.index];
      if (!item) return; // fewer than index+1 items actually picked — a no-op, see this node's own doc comment
      const resolved = resolveEachActionValues(node.action, ctx);
      runEachAction(node.action, item, resolved, actions, ctx, bindings);
      return;
    }
    case 'drawCard': {
      // Real `ctx.you.drawCard()` — mirrors `card.ts`'s own `kind:'drawCard'`
      // Effect resolution exactly (a loop of single draws, one real trace
      // line per card, not a single bulk `drawCards(n)` call — see that
      // Effect's own `applyEffect` case).
      const amount = node.amount ? resolveValue(node.amount, ctx) : 1;
      for (let i = 0; i < amount; i++) ctx.you.drawCard();
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
  node: 'query' | 'filter' | 'aggregate' | 'each' | 'branch' | 'sequence' | 'bound' | 'selectUpTo' | 'applyToBound' | 'drawCard';
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
    case 'add':
      return `add(${describeValue(v.left)}, ${describeValue(v.right)})`;
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
    case 'cardType':
      return `cardType=${Array.isArray(p.value) ? p.value.join('|') : p.value}`;
    case 'sameNameAsSelf':
      return 'sameNameAsSelf';
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
    case 'untap':
      return 'untap';
    case 'destroy':
      return 'destroy';
    case 'dealDamage':
      return `dealDamage(${describeValue(a.amount)})`;
    case 'pump':
      return `pump(${describeValue(a.power)}, ${describeValue(a.toughness)}${a.untilEndOfTurn ? ', untilEndOfTurn' : ''})`;
    case 'gainControl':
      return `gainControl(${a.controller})`;
    case 'grantKeyword':
      return `grantKeyword(${a.keyword}${a.untilEndOfTurn ? ', untilEndOfTurn' : ''})`;
    case 'equip':
      return `equip(to=${a.to.name}[${a.to.index}])`;
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
    events.push({ node: 'query', detail: `${input.source}(${input.owner}${input.source === 'libraryTop' ? `, amount=${input.amount}` : ''})` });
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
  else if (v.kind === 'add') {
    walkValue(v.left, events);
    walkValue(v.right, events);
  }
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
/** Walks whatever `ValueRef`(s) an `EachAction` itself carries — shared by
 * `walkProgram`'s own `'each'`/`'applyToBound'` cases, same dispatch shape
 * `resolveEachActionValues` already established for the real interpreter
 * side. */
function walkEachActionValues(action: EachAction, events: WalkEvent[]): void {
  if (action.action === 'putCounter' || action.action === 'dealDamage') walkValue(action.amount, events);
  else if (action.action === 'pump') {
    walkValue(action.power, events);
    walkValue(action.toughness, events);
  }
}

export function walkProgram(node: ProgramNode, events: WalkEvent[] = []): WalkEvent[] {
  switch (node.kind) {
    case 'each':
      walkQuery(node.input, events);
      walkEachActionValues(node.action, events);
      events.push({ node: 'each', detail: describeEachAction(node.action) });
      return events;
    case 'branch': {
      if (node.condition.kind === 'compare') {
        walkValue(node.condition.left, events);
        walkValue(node.condition.right, events);
        events.push({ node: 'branch', detail: `compare(${describeValue(node.condition.left)} ${node.condition.op} ${describeValue(node.condition.right)})` });
      } else {
        events.push({ node: 'branch', detail: `hasSubtype(bound(${node.condition.target.name}[${node.condition.target.index}]), ${node.condition.subtype})` });
      }
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
    case 'drawCard': {
      if (node.amount) walkValue(node.amount, events);
      events.push({ node: 'drawCard', detail: `drawCard(${node.amount ? describeValue(node.amount) : 1})` });
      return events;
    }
    default: {
      const _exhaustive: never = node;
      throw new Error(`unhandled program node: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
