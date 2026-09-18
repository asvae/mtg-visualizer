// Declarative-first card-definition scaffold — structural prototype, see
// functional-model/cards/the-final-days/ for the first card built on this,
// and functional-model/cards/*/ generally for the growing set.
//
// Deliberately mirrors how Card-Forge itself is actually built (confirmed
// against the real ../mtg-forge checkout, not assumed): there is exactly
// ONE `Card` Java class for every card in the game
// (forge-game/.../card/Card.java) — no per-card subclass anywhere. A card's
// specific behavior is DATA (the .txt script forge-model/data/*.txt copies
// verbatim), parsed by `CardFactory` into generic ability objects. Each
// effect KIND then dispatches through one shared effect class via the
// `ApiType` enum (forge-game/.../ability/ApiType.java) — e.g. every card
// that creates tokens, `Token (TokenEffect.class)`, funnels through the
// SAME `TokenEffect`, not a per-card override. `CardDefinition` below is
// that same shape: a plain data interface (not a base class to extend),
// and `Effect`'s `kind` discriminant + `resolveCard()`'s switch is the
// direct TS analogue of `ApiType` + its effect-class dispatch table.
//
// This was originally built as `abstract class CardDefinition` with one TS
// class PER CARD extending it — an earlier attempt, corrected once actually
// checked against Forge's real architecture (which has no such thing). Kept
// as a cautionary note rather than erased: the class-per-card version type-
// checked fine and "worked," which is exactly why checking against the real
// engine mattered more than internal consistency alone.
//
// The core bet, unchanged from that first attempt: a card's logic should be
// DATA (an `Effect[]`) wherever the effect is a fixed, statically-knowable
// action, and drop to a plain function only for the one field that
// genuinely can't be — never as a shortcut for something that could have
// stayed declarative. This buys two things at once instead of trading one
// for the other:
//   1. Synergy analysis: `synergyTags()` below walks the SAME `effects`
//      array a real game would execute — no separate metadata block that
//      could drift from what the card actually does.
//   2. Digital-game-readiness: `resolveCard()` is a real interpreter over
//      that data — a client holds `CardDefinition[]` (plain records, not
//      instances of N different classes) and calls `resolveCard(card, ctx)`
//      without a switch over card names anywhere.
//
// Trade-off, stated plainly rather than hidden: anything inside a `Computed`
// function (or a `custom` effect's `run`) is OPAQUE to `synergyTags()` — a
// function body can't be introspected without executing it. That opacity is
// the real cost of the functional escape hatch, which is exactly why it's
// meant to be reached for narrowly (one field, like an amount or a
// condition) rather than wrapping a whole effect in `custom` by default.
//
// Extended for FIN #100/102-110 (Fight On!, Gaius van Baelsar, Hecteyes,
// Jecht/Braska's Final Aeon, Kain, Malboro, Namazu Trader, Ninja's Blades,
// Overkill, Phantom Train) with: multiple NAMED triggers per card
// (`triggers`, since a permanent commonly has more than one independent
// triggered ability — Namazu Trader's own ETB AND attack trigger, e.g.),
// `staticAbilities` (a continuous/keyword rule is DATA, not a resolvable
// step — never belongs in `effects`, which means "what happens when this
// resolves"), a `modal` effect (real "choose one —"), and several new
// `Effect` kinds needed by real cards in this batch (`loseLife`, `discard`,
// `sacrifice`, `move`, `putCounter`, `equip`, `animate`).

import type { Card, Player, TokenInfo, ZoneType } from './interfaces';
// Type-only — `mana.ts` never imports `card.ts` (checked; no runtime
// cycle), so this is a plain, non-circular type import. `ManaAbility` below
// reuses this same real WUBRG(+C) union rather than re-declaring one, so a
// `CardDefinition.manaAbilities` entry and `mana.ts`'s own
// `canAfford`/`payMana` are always talking about the identical color space.
import type { ManaColor } from './mana';
// Type-only, and circular (synergy.ts already imports `CardDefinition` from
// THIS file) — safe because both sides are `import type` only, erased before
// emit; no runtime cycle exists. Reused here (rather than re-declaring an
// equivalent shape) for PRD_AUTOMATED_AUTHORING.md's "definition-level
// annotation" prototype (2026-09-13, scoped trial, fin/1-10 only) — see
// `CardDefinition.triggers[].annotation`/`.abilities[].annotation`/
// `.effectsAnnotation`/`.ptFormula`'s own `annotation`/the `modal` Effect
// kind's own `modes[].annotation`/`TriggerDoublingGrant.annotation` below.
// Deliberately the SAME `{anchor?, sourceText?, highlight, line?}` shape
// `cards/<slug>/annotations-authoring.json` already uses, so
// `compute-annotations.mjs`'s existing `computeFactAnnotations` matching
// logic can resolve either source without modification. `line` (added
// 2026-09-13 alongside these fin/1-10 entries) scopes a `highlight` match to
// one physical oracle-text line, closing a real cross-line-ambiguity gap
// `synergy.ts`'s own `rawHighlightRange` doc comment used to admit as
// unresolved — every annotation in this prototype sets it.
import type { Fact, FactAnnotationAuthoring } from './synergy';
// Type-only, circular (combinator.ts itself imports `Actions`/`EffectContext`
// FROM this file) — same accepted "erased before emit, no runtime cycle"
// precedent this file's own header already establishes for its `synergy.ts`
// import above. `runProgram` is imported as a VALUE (the real interpreter
// `applyEffect`'s own `'program'` case below calls) — safe, not a
// value-level cycle, since `combinator.ts` never imports any VALUE back out
// of `card.ts`, only types.
import type { ProgramNode, ValueRef } from './combinator';
import { resolveValue, runProgram } from './combinator';
// `Effect.authoredFact`/`CardDefinition.authoredFacts` (tier 3, below) used
// to embed a full `Fact` — including that fact's own required `annotations`
// — directly in `definition.ts`. Corrected 2026-09-13, per
// PRD_AUTOMATED_AUTHORING.md's "definition-level annotation" design revision
// (fin/1-5 only so far — `cards/<slug>/definition-annotations.json`, keyed by
// an INDEX PATH into the definition structure, e.g.
// `"triggers[1].effects[0].authoredFact[2]"`): the annotation is DATA ABOUT
// the definition, not game logic, so it now lives in that external file
// instead of embedded on the authored Fact object, mirroring the same
// separation `Trigger.annotation`/`effectsAnnotation`/etc. already keep from
// `definition.ts` proper (those were never embedded IN a Fact to begin with;
// this closes the one place a Fact-shaped field still carried its own
// annotation inline). `annotations` merely becomes OPTIONAL here rather than
// removed outright — fin/6-10's own `authoredFact`/`authoredFacts` usage
// (ashe-princess-of-dalmasca, cloud-midgar-mercenary, auron-s-inspiration,
// ambrosia-whiteheart) predates this correction and still embeds
// `annotations` directly; both conventions type-check under this one field.
export type AuthoredFact = Omit<Fact, 'annotations'> & { annotations?: Fact['annotations'] };
// Type-only — interfaces.ts's own header is explicit that these are ambient
// `declare function` signatures with NO body, kept purely so a card
// definition reads as code written against Forge's real shape; nothing here
// is ever meant to run. Importing them as VALUES (as this file used to) and
// wiring them into a `defaultActions` fallback below "worked" only because
// esbuild-based bundlers (vitest, the app) never verify a named import
// actually resolves to a real runtime export — Nitro's dev server routes a
// dynamic `import()` through Rollup, which DOES verify this, and correctly
// 500s trying to link a value with no export to bind. Every real
// `resolveCard()` call site in this codebase already passes an explicit
// `actions` argument (harness.ts's `loggingActions`, engine-trace.ts's
// `pilotActions`, engine.test.ts's own fixtures) — a `defaultActions`
// fallback was dead at the VALUE level from the start, just never linked
// strictly enough for that to surface until now.
import type {
  createToken as realCreateToken,
  pump as realPump,
  moveTo as realMoveTo,
  chooseTarget as realChooseTarget,
  move as realMove,
  mill as realMill,
  sacrifice as realSacrifice,
  discard as realDiscard,
  shuffleLibrary as realShuffleLibrary,
  putCounter as realPutCounter,
  installCounterConditionalGrant as realInstallCounterConditionalGrant,
  equip as realEquip,
  animate as realAnimate,
  gainControl as realGainControl,
  surveil as realSurveil,
  counter as realCounter,
  destroy as realDestroy,
  dealDamage as realDealDamage,
  tap as realTap,
  untap as realUntap,
  dig as realDig,
  grantKeyword as realGrantKeyword,
  copyPermanent as realCopyPermanent,
  delayUntil as realDelayUntil,
  queueExtraPhase as realQueueExtraPhase,
  play as realPlay,
  endTurn as realEndTurn,
} from './interfaces';

/**
 * The free (non-Player-method) action functions an effect can call, factored
 * out as an injectable parameter instead of hardcoded imports — `Player`
 * methods (gainLife, drawCard, ...) are already swappable for free since
 * they live on `ctx.you`/`ctx.opponents`, but a bare `createToken(...)` call
 * would always hit the real (ambient, bodyless) `interfaces.ts` function with
 * no way to substitute a recording mock for tracing (see
 * functional-model/harness.ts). Defaults to the real functions, so every
 * existing call site is unaffected.
 */
export interface Actions {
  createToken: typeof realCreateToken;
  pump: typeof realPump;
  moveTo: typeof realMoveTo;
  chooseTarget: typeof realChooseTarget;
  move: typeof realMove;
  mill: typeof realMill;
  sacrifice: typeof realSacrifice;
  discard: typeof realDiscard;
  shuffleLibrary: typeof realShuffleLibrary;
  putCounter: typeof realPutCounter;
  installCounterConditionalGrant: typeof realInstallCounterConditionalGrant;
  equip: typeof realEquip;
  animate: typeof realAnimate;
  gainControl: typeof realGainControl;
  surveil: typeof realSurveil;
  counter: typeof realCounter;
  destroy: typeof realDestroy;
  dealDamage: typeof realDealDamage;
  tap: typeof realTap;
  untap: typeof realUntap;
  dig: typeof realDig;
  grantKeyword: typeof realGrantKeyword;
  copyPermanent: typeof realCopyPermanent;
  delayUntil: typeof realDelayUntil;
  queueExtraPhase: typeof realQueueExtraPhase;
  play: typeof realPlay;
  endTurn: typeof realEndTurn;
}

/** Everything an effect needs to read at resolution time — the one argument every effect/Computed function receives. */
export interface EffectContext {
  self: Card;
  you: Player;
  opponents: Player[];
  /**
   * Which zone THIS cast actually came from. Forge's own engine tracks this
   * per-cast (`wasCastFromGraveyard`-style SVars, `Cast$ Flashback`, etc.);
   * generalized here to any alternate-cost zone rather than "graveyard"
   * specifically, since Jump-start/Escape/etc. are the same shape from
   * exile or with different costs.
   */
  castFrom: 'hand' | 'graveyard' | 'exile';
  /**
   * Which modal branch was chosen, for a `modal` effect (Gaius van
   * Baelsar's own Charm) — a real player decision, fixed once per
   * resolution the same way `castFrom` is, not something an effect
   * computes. `scenarios.ts` sets this the same way it sets `castFrom`.
   */
  mode?: number;
  /**
   * A trigger's own variable info, fixed ONCE at the moment it triggers
   * (603.3b/603.4) — Kain, Traitorous Dragoon's own "that player"/"that
   * much damage," read back by three separate downstream effects, is the
   * reference case (see synergy-model/SCHEMA.md's `:=`/`=` binding
   * convention, and cards/kain-traitorous-dragoon/definition.ts's own `custom`
   * effect for how this plays out as a plain local variable instead of new
   * schema machinery). A scenario sets this the same way it sets
   * `castFrom`/`mode` — a real player-visible fact fixed by the game event,
   * not something an effect computes on its own.
   */
  triggerInput?: Record<string, unknown>;
  /** Real Forge `Count$xPaid` (Choco-Comet's own "deals X damage," e.g.) — the value chosen for a card's own printed `X` in its mana cost, fixed once at cast time (601.2b/601.2f) the same way `mode`/`castFrom` are, not something an effect computes. A scenario sets this the same way it sets those — a real player-visible fact fixed by the cast, not authored per-effect. */
  xPaid?: number;
  /**
   * Real `TargetMin$ 0` in practice — a player genuinely declining an
   * `optional` targeted effect rather than being forced onto whatever
   * `chooseTarget` would deterministically pick (Summon: Bahamut's own
   * chapter I/II "destroy up to one target nonland permanent" is the
   * reference case: self is always the first candidate in an unrestricted
   * pool, so without this a scenario could only ever demonstrate the card
   * blowing itself up). Set per-trigger by `harness.ts`'s own
   * `Scenario.declineTriggers`, not authored per-effect — same "a real
   * player-visible fact fixed by the event, not computed" pattern
   * `mode`/`castFrom`/`xPaid` already use above. Only `destroy` reads this
   * today; extend to other `optional`-bearing effects only once a real card
   * needs the same demonstration.
   */
  declineOptional?: boolean;
  /**
   * A real player's own manual pick among legal targets — NOT a heuristic
   * (no automated "best" target selection exists or is planned here, see
   * ENGINE_GAPS.md's "no AI / player decision process": that's about
   * `forge-ai`-style weighing, a real, separately-scoped, out-of-scope
   * thing; this is a plain manual override, same category as `mode`/
   * `declineOptional`/`triggerInput` above). Every `chooseTarget` call site
   * in this file passes `ctx.preferTarget` through as `chooseTarget`'s own
   * optional second (predicate) argument (interfaces.ts's own ambient
   * `chooseTarget(pool, predicate?)` signature already declared this,
   * unused until now) — `harness.ts`'s real implementation picks the first
   * pool member matching this predicate, falling back to its old
   * deterministic `pool[0]` when unset or nothing matches. A scenario sets
   * this the same way it sets `mode`/`declineOptional` — fixed per
   * resolution, not computed by an effect.
   */
  preferTarget?: (c: Card) => boolean;
  /**
   * The `CardDefinition` matching whatever `RealCard` is genuinely sitting
   * on top of `you`'s library right now (ENGINE_GAPS.md gap #16) — required
   * for a `kind:'playFromLibraryTop'` effect to do anything real. Same
   * "caller-supplied real fact, not something an effect computes" pattern
   * `castFrom`/`mode`/`xPaid` already use above: `RealCard` carries no live
   * `CardDefinition` reference to derive this from (see `state.ts`'s own
   * `manaAbilities`/`continuousKeywordGrants` doc comments for the established
   * convention), so whoever pilots "play the top card of your library" must
   * supply it explicitly, the same way `harness.ts`/`engine-trace.ts` build
   * every other `EffectContext` field. Left unset only when there's
   * genuinely no top card (an empty library) — the effect itself checks
   * `ctx.you.getCardsIn('Library')` and no-ops if it's empty, same as
   * `dig`'s own "nothing there" case.
   */
  topLibraryCard?: CardDefinition;
  /**
   * Real "if it's the first end step/combat phase of the turn" (ENGINE_GAPS.md
   * gap #17) — Y'shtola Rhul's own "Then if it's the first end step of the
   * turn," Balthier and Fran/Genji Glove's own "if it's the first combat
   * phase of the turn" (real Forge citation: `PhaseHandler.isFirstCombat()`/
   * `Count$FinishedEndOfTurnsThisTurn`, `turn.ts`'s own
   * `isFirstPhaseGroupOccurrenceThisTurn` doc comment for the full trail).
   * Same "caller-supplied real fact, not something an effect computes"
   * pattern `castFrom`/`mode`/`xPaid` already use above — `RealCard`/
   * `CardDefinition` carry no live `TurnState` reference, so whoever fires
   * this trigger (engine.ts's real per-turn count, or a scenario declaring
   * the fact it wants to demonstrate) sets this explicitly before calling
   * `resolveCard`/`fireTrigger`. An effect that queues an extra phase
   * unconditionally on every occurrence (no "first" gating at all,
   * genuinely different from these three cards) simply never reads this.
   */
  firstPhaseGroupOccurrenceThisTurn?: boolean;
  /**
   * The real object(s) chosen as THIS spell/ability's own target(s), locked
   * in at cast/activation time (CR 601.2c/602.1's own "choose targets" step,
   * BEFORE resolution) — ENGINE_GAPS.md gap #4, closed 2026-09-12. Set by
   * `stack.ts`'s `Stack.resolveTop` from the `StackObject.declaredTargets`
   * `engine.ts`'s `castSpell`/`activateAbility` recorded when the spell/
   * ability was originally put on the stack (a real `RealCard` reference,
   * wrapped once via `state.ts`'s `wrapCard` — same "caller supplies the
   * real object, engine records it" shape `crewedBy`/the pre-existing
   * `declaredTarget` cost-reduction param already established, generalized
   * here to also genuinely target the effect, not just gate a cost
   * discount).
   *
   * Every targeted-effect branch below that supports this (`destroy`,
   * `move`'s targeted branch, `putCounterTarget`, `dealDamageTarget`,
   * `fightTarget`, `pumpTarget`, `grantKeywordTarget`, `tapTarget`,
   * `untapTarget` — see `resolveTargets`'s own doc comment) checks this
   * FIRST: when set, resolution uses ONLY these pre-chosen objects (up to
   * however many the effect's own `qty` allows), filtered to whichever ones
   * are STILL present in that branch's own freshly-rebuilt candidate pool —
   * which, since the pool is rebuilt from LIVE game state at the moment
   * `resolveCard` actually runs, doubles as a genuine CR 115 legality
   * re-check (still exists, still in the expected zone, still matches the
   * restriction) without a separate mechanism. A declared target no longer
   * in the pool is DROPPED, never replaced by a fresh pick (CR 608.2b: an
   * illegal target is never swapped for a new one) — if NONE of a single-
   * target effect's declared target(s) survive, that effect simply does
   * nothing (the real "fizzle"), while the spell/ability itself still
   * resolves and moves to its normal post-resolution zone (`engine.ts`'s
   * `resolveTop` does that unconditionally, outside this check). A multi-
   * target effect (`qty > 1`, e.g. Fight On!'s own "return up to two target
   * creature cards") keeps whichever of its own declared targets are still
   * legal and simply omits the rest — real CR 608.2b partial fizzle.
   *
   * Consumed FIFO (`resolveTargets` calls `.shift()`) across the WHOLE
   * resolution, not reset per effect — so a (currently hypothetical; no
   * real FIN card needs this today) card with more than one distinct
   * targeted effect in the same `effects`/`triggers` entry can still divide
   * its own single declared-target list across them, in the same order
   * `card.effects` runs.
   *
   * Left unset (the overwhelming majority of this pool's own scenarios,
   * which drive `card.ts` directly via `harness.ts`'s flat lifecycle, never
   * through `engine.ts`'s real cast/stack path) leaves every targeted
   * branch's behavior EXACTLY as it was before this field existed: a fresh
   * `actions.chooseTarget(pool, ctx.preferTarget)` pick at resolution time,
   * zero regression risk for any existing scenario.
   *
   * **Known, deliberately narrower scope, not attempted this pass**: (1)
   * `dealDamageAnyTarget` ("any target" — a player OR a creature) isn't
   * wired to this, since its own candidate pool mixes `Player`/`Card`
   * rather than the plain `Card[]` shape every other branch shares, and no
   * real FIN card needs a demonstrated fizzle on that specific effect kind
   * yet. (2) This pass does NOT also gate the cast/activation itself on the
   * declared target being legal AT THAT MOMENT (CR 601.2c's own stricter
   * "can't even be put on the stack targeting something illegal" rule) —
   * only the RESOLUTION-time re-check (608.2b) above is real; a caller that
   * casts a spell at an already-illegal target today still puts it on the
   * stack and it correctly fizzles at resolution instead of being rejected
   * up front. The real-game-visible outcome (the spell does nothing) is
   * identical, just one priority-round later than strict 601.2c would place
   * it — verifying "is my declared target currently legal" up front would
   * need the SAME per-effect-kind pool/validity logic exposed a layer
   * higher (in `engine.ts`'s `canCastSpell`/`canActivateAbility`, which
   * today have no visibility into `card.effects` targeting shape at all) —
   * a real, separate, deliberately-deferred extension, not attempted here.
   * (3) When a spell has MORE THAN ONE effect and its only targeted effect
   * fizzles, this pass's model only skips THAT effect — any OTHER,
   * genuinely untargeted effect on the same card (Eject's own unconditional
   * "draw a card," alongside its own targeted "return ... to hand") still
   * runs. Strict CR 608.2b says the WHOLE spell fails to resolve once ALL
   * of its targets (for every instance of the word "target," collectively)
   * are illegal — a real, narrower divergence, flagged here rather than
   * silently assumed correct; no real FIN card's own scenario currently
   * demonstrates or depends on the stricter whole-spell reading.
   */
  declaredTargets?: Card[];
  /**
   * Real 721.1a "end the turn" ruling (Gatherer, Time Stop: "This includes
   * Time Stop, though it will continue to resolve") — the resolving
   * spell/ability itself goes to Exile instead of its normal post-
   * resolution zone (a Graveyard, for an instant/sorcery). Set by
   * `applyEffect`'s own `case 'endTurn'` (below) the moment that effect
   * runs, mid-resolution — `engine.ts`'s own `resolveTop` wrapper reads
   * this back off the SAME `EffectContext` instance once `resolveCard`
   * returns (the object identity is preserved end-to-end: `stack.ts`'s
   * `StackObject.ctx` IS this exact object), the same way it already reads
   * `StackObject.thenExile` for a Flashback/Jump-start spell's own
   * alternate post-resolution zone. Unset (the default) for every other
   * effect — completely inert outside a real engine-piloted playthrough
   * (`harness.ts`'s flat scenarios have no post-resolution zone-move logic
   * to consult it at all).
   */
  selfToExile?: boolean;
}

/**
 * A value that's either fixed (declarative — the default) or computed from
 * live game state (the functional escape hatch) — scoped to ONE field of an
 * otherwise-plain-data effect, so reaching for it doesn't cost the whole
 * effect its shape. Beza, the Bounding Spring's own "if an opponent has more
 * life than you" is the reference case for when this is actually warranted
 * (a real cross-player runtime comparison) rather than reached for out of
 * convenience.
 */
export type Computed<T> = T | ((ctx: EffectContext) => T);

function resolve<T>(value: Computed<T>, ctx: EffectContext): T {
  return typeof value === 'function' ? (value as (ctx: EffectContext) => T)(ctx) : value;
}

/**
 * `createToken.amount`'s own resolver (2026-09-18, Hare Apparent, FDN
 * #15) — that ONE field is typed `Computed<number> | ValueRef` (not just
 * `Computed<number>`, the way every other `amount`-carrying `Effect` kind
 * still is) so a genuine board-count magnitude ("for each OTHER creature
 * you control named Hare Apparent") can be real, walkable `combinator.ts`
 * data (a `QueryChain.count()` `Aggregate`) instead of an opaque raw `(ctx)
 * => ...` closure — see `combinator.ts`'s own `FilterPredicate`/
 * `'sameNameAsSelf'` doc comment and `sink-model/catalog/
 * battlefield-presence-hare-apparent.ts`'s own header for the full "third
 * filter variant" writeup this unblocks. Deliberately scoped to this ONE
 * field, not a widening of the generic `resolve<T>`/`Computed<T>` above —
 * `ValueRef` only ever resolves to a `number`, so folding it into the
 * fully-generic helper (used for `Computed<ZoneType>`/`Computed<string>`
 * colors/etc. elsewhere in this file) would be a type-unsound widening for
 * every OTHER `Computed<T>` call site for no real benefit; every other
 * `amount`-carrying `Effect` kind stays plain `Computed<number>` until a
 * real card forces the same widening there too, same "closed vocabulary,
 * grow on demand" discipline `combinator.ts` itself follows. A plain
 * object check (`typeof === 'object'`) is enough to distinguish a
 * `ValueRef` (always `{kind: ...}`) from a literal `number` or a
 * `Computed<number>` function — no `'kind' in value` narrowing needed
 * beyond that, since nothing else `Computed<number>`-shaped is ever an
 * object.
 */
function resolveCreateTokenAmount(amount: Computed<number> | ValueRef, ctx: EffectContext): number {
  return typeof amount === 'object' && amount !== null ? resolveValue(amount, ctx) : resolve(amount, ctx);
}

/** Who an effect (loseLife/discard/sacrifice/move) applies to — `'each'` covers Gaius van Baelsar's own "each player" (both sides at once), distinct from `'opponents'` (every opponent, not you) and `'you'` (just you). */
export type EffectOwner = 'you' | 'opponents' | 'each';

/**
 * One resolved effect. Every variant except `custom` is plain, inspectable
 * data — no method call hidden inside it that a static reader would have to
 * execute to understand.
 */
export type Effect =
  | { kind: 'createToken'; token: TokenInfo; amount: Computed<number> | ValueRef; tapped?: boolean }
  | { kind: 'gainLife'; amount: Computed<number> }
  | {
      /** `Player.getManaPool().addMana(...)` (see interfaces.ts's own `Player.addMana` doc comment for why this is a deliberately inert observation point, not a real spendable pool). Add for a "{T}: Add X mana" activated ability so it leaves a real, checkable trace line instead of being invisible to scripts/verify-synergy.mjs — same "promote a real ability off the unmodeled-list" reasoning `drawCard` already got (2026-09-05). */
      kind: 'addMana';
      color: string;
      amount: Computed<number>;
    }
  | {
      kind: 'drawCard';
      amount?: Computed<number>;
      /**
       * "You MAY draw a card" (Rook Turret's own real "Loot" idiom, `AB$
       * Discard | ... | Cost$ Draw<1/You>`) — same documentary-only
       * distinction `destroy`'s/`move`'s/`sacrifice`'s own `optional`
       * fields already carry (2026-09-16, coordinator-routed pilot-triage
       * escalation: `drawCard-effect-structural.ts`'s own recognizer
       * previously had no way to tell an optional draw apart from an
       * unconditional one and declined rook-turret's own fact on purpose
       * — see that recognizer's own doc comment). No player-decision
       * engine exists here (same reasoning `EffectContext.declineOptional`'s
       * own doc comment gives for `destroy`), so a legal draw still
       * happens unless `ctx.declineOptional` is explicitly set.
       */
      optional?: boolean;
      /**
       * Who draws — same `EffectOwner` vocabulary `loseLife`/`discard`
       * already carry (below), OPTIONAL here (unlike their own required
       * `owner`) since every real pool card but one just wants the
       * implicit `'you'` default this field preserves when omitted.
       * Real Forge (`forge-game/.../ability/effects/DrawEffect.java`
       * `resolve()`) draws for `getTargetPlayersWithDuplicates(...)` — the
       * exact same generic Player-list mechanism `LoseLifeEffect`/
       * `DiscardEffect` already resolve against, which is what licenses
       * reusing `EffectOwner` here rather than inventing a second
       * player-group vocabulary. Combat Tutorial (fin/48) is the one real
       * pool motivator: "Target player draws two cards" (`ValidTgts$
       * Player`, no `.YouCtrl`/`.Opponent` restriction at all) — a real,
       * single CHOSEN target among every player in the game, which this
       * field still can't express even when set: `EffectOwner`'s 3 values
       * are all fixed GROUPS (you / every opponent / everyone), none of
       * them is "one player, chosen by the caster, could be any side" —
       * the same "no chooseTarget-equivalent for picking a player" gap
       * `stiltzkin-moogle-merchant`'s own definition.ts comment already
       * names. Combat Tutorial's own effect stays at the `'you'` default
       * (unset) for that reason — this field doesn't yet close that real
       * gap, it only gives `drawCard` the same GROUP-target capability
       * (a real, useful "each player draws" broadcast, e.g.) `loseLife`/
       * `discard` already have. The Fact-level honesty for Combat
       * Tutorial's own real "any player" text comes from
       * `drawCard-effect-structural.ts`'s own separate targeted-clause
       * template (oracle-text-driven, not keyed off this field) — see
       * that recognizer's own doc comment.
       */
      owner?: EffectOwner;
    }
  | {
      /** Forge's own `PumpAll` (Warren Elder's own "creatures you control get +1/+1 until end of turn") — every creature matching `predicate` gets the same delta, as opposed to `custom`'s one-target `pump`. `'attacking-creatures'` (2026-09-15, ENGINE_GAPS.md — Auron's Inspiration/fin-8's own real "Attacking creatures get +2/+0," a genuinely SYMMETRIC broadcast, unlike `'creatures-you-control'` — see `Card.isAttacking()`'s own doc comment for the real 508.1 status this reads) broadcasts across `ctx.you` AND `ctx.opponents` both, the one real exception to every other `pumpAll` predicate's own `ctx.you`-only scope. */
      kind: 'pumpAll';
      predicate: 'creatures-you-control' | 'attacking-creatures';
      power: Computed<number>;
      toughness: Computed<number>;
      /** Forge's own real `Creature.YouCtrl+Other` shape ("OTHER creatures you control get...") — excludes `ctx.self` from the affected set, same reasoning as `sacrifice`/`move`'s own `notSelf`. */
      notSelf?: boolean;
      /** A creature subtype filter (Circle of Power's own "Wizards you control get...") — same field `putCounterAll` already carries, omit to match every creature `predicate` selects. */
      subtype?: string;
      /** Real oracle text says "until end of turn" (Warren Elder's own "creatures you control get +1/+1 until end of turn," e.g.) — real 514.2 Cleanup removal, see state.ts's own `pump`/`clearUntilEndOfTurnPumps` doc comments. Omit (default false) for a permanent-within-scenario pump, same default `grantKeywordTarget`'s own field establishes. */
      untilEndOfTurn?: boolean;
    }
  | { kind: 'loseLife'; owner: EffectOwner; amount: Computed<number> }
  | { kind: 'discard'; owner: EffectOwner; qty: Computed<number> }
  | {
      /**
       * Real `Player.mill(int, ZoneType, ...)` (forge-game/.../player/
       * Player.java ~line 1539, ENGINE_GAPS.md gap #19, closed) — a real,
       * dedicated library->graveyard batch move, DISTINCT from a generic
       * `move` (above): milling is its own CR glossary term/event (real
       * Forge dispatches it through its own `MillEffect`/`Player.mill`, not
       * the generic `ChangeZoneEffect` a plain `move` uses), and — the whole
       * reason this needed its own `Effect` kind rather than staying folded
       * into `move` — it's the one real chokepoint a CR 614.2 replacement
       * (The Water Crystal's own "mill that many plus four instead") can
       * actually hook into (`state.ts`'s `GameState.mill`). The Water
       * Crystal's own "{4}{U}{U}, {T}: Each opponent mills cards equal to
       * the number of cards in your hand" is the real FIN card that needs
       * this.
       */
      kind: 'mill';
      owner: EffectOwner;
      amount: Computed<number>;
    }
  | {
      /**
       * Real rule 701.16: sacrifice is its OWN action, distinct from "dies"
       * (any battlefield->graveyard move, whatever the cause) — an
       * aristocrats-style payoff keys off THIS, not a generic `move`.
       * `validType` is Forge's own `SacValid$` vocabulary narrowed to what
       * this batch of cards needs.
       */
      kind: 'sacrifice';
      owner: EffectOwner;
      /** `'creature-or-artifact'` is Forge's own `Sac<1/Creature.Other;Artifact.Other/...>` shape (Namazu Trader's own attack trigger) — a disjunctive predicate on ONE sacrifice ("flexible about what qualifies"), not a choice between two different effects; SCHEMA.md's own `combine:"any"`. */
      validType: 'creature' | 'artifact' | 'enchantment' | 'any' | 'creature-or-artifact';
      notSelf?: boolean;
      /** "you MAY sacrifice..." (Namazu Trader's own attack trigger) vs. "each player sacrifices..." (Gaius van Baelsar's own ETB, not optional). Documentary only, like `move`'s own `optional` field above — no player-decision engine exists here, so this doesn't change resolution behavior (a legal target always gets taken). */
      optional?: boolean;
      /** Forge's own `Creature.token`/`Creature.!token` distinction (Gaius van Baelsar's own first two modes) — omit when the card doesn't care either way. */
      tokenFilter?: 'token' | 'nontoken';
      /** Defaults to 1 — Braska's Final Aeon's own "sacrifices TWO creatures" (chapter III) needs more. */
      qty?: Computed<number>;
    }
  | {
      /**
       * A real zone change that ISN'T sacrifice (see `sacrifice` above) —
       * `target: true` means a player genuinely chooses which qualifying
       * cards move (Fight On!'s own "return up to two TARGET creature
       * cards"), routed through `chooseTarget`+`moveTo` one at a time;
       * `target: false`/omitted is an unchosen batch (Malboro's own "exiles
       * the top three cards of their library"), routed through the single
       * batch `move` action instead. See interfaces.ts's own doc comments
       * on `moveTo` vs `move` for why these are two different real-Forge
       * shapes, not an arbitrary split.
       */
      kind: 'move';
      /** Restricts the candidate pool to one side — omit for the default, every player's matching cards (Jill/Eject/Ice Magic's own real "target [nonland permanent/creature]," no controller clause at all). Same owner-restriction convention `destroy`/`pumpTarget`/`putCounterTarget`/etc. already use — this field used to be required, forcing every `move` effect to hardcode one side even when the real card has no such restriction (confirmed bug, fixed 2026-09-06 — see those three cards' own former comments). */
      owner?: EffectOwner;
      /**
       * `ZoneType[]` (2026-09-15, Delivery Moogle's own real "search your
       * library AND/OR GRAVEYARD" — Forge's own real dual-`Origin` shape,
       * `Origin$ Library | OriginAlternative$ Graveyard`) — a genuine
       * UNION search across more than one hidden zone at once, ONE combined
       * pool (never one pick per zone; CR 701.19 makes no distinction
       * between the zones once they're both eligible). Every OTHER real
       * `move` effect in this pool still sets a single scalar `ZoneType`
       * (checked directly — Delivery Moogle is the only real card needing
       * more than one); `case 'move'` below (and `interfaces.ts`'s own
       * `move` signature/`harness.ts`'s own implementation) normalize a
       * scalar to a one-element array internally rather than branching
       * types, so nothing downstream needs its own array-vs-scalar check.
       */
      from: ZoneType | ZoneType[];
      /**
       * `Computed<ZoneType>` (2026-09-15, From Father to Son's own real
       * "put it into your hand. If this spell was cast from a graveyard,
       * put that card onto the battlefield instead" — a genuine CR 601.2c
       * destination that depends on `ctx.castFrom`, the same real per-cast
       * fact `pumpTarget`'s/`drawCard`'s own `Computed<number>` fields
       * already resolve against). Every OTHER real `move` effect in this
       * pool still sets a single literal `ZoneType` (checked directly —
       * this is the only real card needing a conditional destination);
       * `case 'move'` below resolves it once via `resolve(effect.to, ctx)`,
       * same as every other `Computed` field.
       */
      to: Computed<ZoneType>;
      qty: Computed<number>;
      validType?: 'creature' | 'artifact' | 'land' | 'any';
      /**
       * Real CR 702.13e/generic "with mana value N or less" restriction on
       * the searched/moved card itself (Delivery Moogle's own real "an
       * artifact card with mana value 2 or less" — no existing `move`
       * field could express this at all before this pass: `validType`/
       * `subtype` both filter TYPE, never a numeric card property). Reuses
       * `Card.getCMC()` (interfaces.ts, already cited elsewhere in this
       * file) — an upper bound only (no real pool card needs a `min`/`eq`
       * mana-value search filter yet, so this stays a plain number rather
       * than the fuller `NumConstraint` shape `synergy.ts`'s own `Fact.cmc`
       * uses for the FACT side of this same claim).
       */
      maxCmc?: number;
      /**
       * A NAME filter narrower than any TYPE-based field above can express
       * (Magitek Infantry's own real "Search your library for a card named
       * Magitek Infantry" — real Forge `ChangeType$ Card.namedMagitek
       * Infantry`, `res/cardsfolder/m/magitek_infantry.txt`) — closed
       * 2026-09-15 (fin/16-25 pass). `'self'` is the only real value this
       * pool ever needs (a card tutoring for another copy of ITSELF by
       * name, resolved to `ctx.self.getName()` at effect-resolution time) —
       * kept as this narrow literal rather than a free `string` field: no
       * real card in this pool searches for a DIFFERENT card's name, and an
       * arbitrary string would need its own separate confirmed-template
       * story for `moveSearchLibrary-effect-structural.ts`/`moveSearchLibrary
       * OrGraveyard-effect-structural.ts` to ever assert a fact for it (see
       * `synergy.ts`'s own `Fact.name: {eq: string}` — the FACT side already
       * supports an arbitrary name; this EFFECT-side field intentionally
       * stays narrower until a second real card needs more).
       */
      name?: 'self';
      /**
       * Real Forge `Tapped$ True` on the SAME `ChangeZone` ability (Magitek
       * Infantry's own "...put it onto the battlefield TAPPED" — genuinely
       * distinct from `Card.tapped`'s own default-untapped entry, CR
       * 110.6). Only meaningful for a `to:'Battlefield'` move — applied via
       * `actions.tap` on each card this effect actually moved, right after
       * the move itself (see `case 'move'`'s own untargeted branch below).
       */
      tapped?: boolean;
      target?: boolean;
      /** "return ANOTHER permanent you control" (Ambrosia Whiteheart) — excludes `ctx.self` from the candidate pool, same reasoning as `sacrifice`'s own `notSelf`. */
      notSelf?: boolean;
      /** Real `Permanent.nonLand` (Jill, Shiva's Dominant's own "return up to one other target NONLAND permanent") — same `nonLand` vocabulary `destroy` already carries, for the same reason: `validType: 'any'` alone can't exclude lands from an otherwise-unrestricted pool. */
      nonLand?: boolean;
      /** Forge's own `OptionalDecider$ You` (Ambrosia Whiteheart's own ETB) — a real binary "you MAY," distinct from qty/pool-exhaustion's own "up to N" (which already yields zero for free when nothing qualifies). Documentary only, same as `sacrifice`/`dig`'s own `optional` field: this model has no player-decision engine anywhere (`chooseTarget` always takes the first pool candidate), so a legal-but-declined target isn't actually modeled yet — set this to record the real card text's intent, not to change resolution behavior. */
      optional?: boolean;
      /**
       * A subtype filter narrower than `validType` alone can express (Cloudbound
       * Moogle's real Plainscycling — "search your library for a PLAINS
       * card" — `validType:'land'` alone would accept ANY land; real Forge's
       * own `ChangeType$ Plains` on the expanded `TypeCycling` ability,
       * `CardFactoryUtil.java` ~line 3740). Same `subtype` vocabulary
       * `pumpAll`/`putCounterAll` already use for a creature-type filter,
       * originally read only alongside the TARGETED branch of `move`.
       * **2026-09-15**: now ALSO read for the UNTARGETED branch
       * (`Cloud, Midgar Mercenary`/fin-10's own real "search your library
       * for an Equipment card" — `validType` alone has no `Equipment`
       * option at all; `interfaces.ts`'s own `move` signature and
       * `harness.ts`'s own implementation both gained a matching `subtype`
       * param the same pass). The doc comment used to say "an untargeted
       * batch `move` has no real FIN card needing this yet, so it's not
       * read there" — no longer true, see `card.ts`'s own `case 'move'`
       * untargeted branch below.
       *
       * `string[]` (2026-09-16, coordinator-routed escalation) — an
       * OR-matched subtype SET, not a single value: Phoenix Down's own
       * real targeted mode 2, "exile target Skeleton, Spirit, or Zombie"
       * (Forge's own real `ValidTgts$
       * Creature.Skeleton,Creature.Spirit,Creature.Zombie` comma-list) —
       * `hasSubtype` only ever checks ONE subtype, so a single-string field
       * couldn't express "any one of these three." Every existing real
       * caller still passes a bare `string` (a completely valid `string |
       * string[]` value) — unchanged behavior for all of them.
       */
      subtype?: string | string[];
      /**
       * Real CR 601.2/701.19: searching a hidden zone (the library) always
       * ends with "then shuffle your library" — genuinely distinct from
       * `dig`'s own "look at the top N, no shuffle" shape (a dig never
       * searches the WHOLE library, so nothing needs randomizing after).
       * Shuffles every player in `players` (the SAME set this effect's own
       * `owner` scope already resolved) once the move(s) are applied — a
       * plain library search (Cloudbound Moogle's Plainscycling, e.g.)
       * always sets `owner:'you'`, so only the searching player's own
       * library gets shuffled, matching real 701.19's "you" wording.
       */
      shuffleAfter?: boolean;
    }
  | { kind: 'putCounter'; target: 'self'; counterType: string; amount: Computed<number> }
  | {
      /** A counter on a CHOSEN target (Cloudbound Moogle's "put a +1/+1 counter on target creature," Ultima's "put a blight counter on target land") — as opposed to `putCounter`'s always-self target. `qty` targets chosen the same up-to-N pattern as `move`'s targeted branch. */
      kind: 'putCounterTarget';
      validType: 'creature' | 'land' | 'artifact' | 'creature-or-artifact' | 'any';
      counterType: string;
      amount: Computed<number>;
      qty?: Computed<number>;
      /** See `dealDamageTarget`'s own doc comment above — same owner-restriction fix, same bug. */
      owner?: EffectOwner;
      /**
       * Real Forge `DB$ Effect | RememberObjects$ Targeted | StaticAbilities$
       * ...` (Ultima, Origin of Oblivion's own real shipped script) — see
       * `CounterConditionalGrant`'s own doc comment for the full design and
       * real Forge citation. Installed onto the SAME target(s) this effect
       * puts the counter on, one call to `actions
       * .installCounterConditionalGrant` per target, right alongside
       * `actions.putCounter` (`resolveCard`'s own `putCounterTarget` case).
       * `counterType` is deliberately OMITTED here — it's always this SAME
       * effect's own `counterType` above (`resolveCard` fills it in when
       * installing), so the two fields can never accidentally name different
       * counters.
       */
      grant?: Omit<CounterConditionalGrant, 'counterType'>;
    }
  | {
      /** Forge's own `CountersPut ... | Defined$ ...+ValidType` UNCHOSEN batch shape (Minwu, White Mage's own "put a +1/+1 counter on each Cleric you control") — every creature matching `predicate` gets it, as opposed to `putCounterTarget`'s player-chosen targets. Same `predicate`/`notSelf` shape `pumpAll` uses, not a new vocabulary. */
      kind: 'putCounterAll';
      predicate: 'creatures-you-control';
      counterType: string;
      amount: Computed<number>;
      notSelf?: boolean;
      /** A creature subtype filter (Minwu's own "each CLERIC you control") — omit to match every creature `predicate` selects. */
      subtype?: string;
    }
  | { kind: 'surveil'; qty: Computed<number> }
  | {
      /** `CounterEffect` (see interfaces.ts's own `counter` doc comment for why this is log-only, same as `surveil` — no stack/object model exists to actually remove a target from). `describe` records WHAT was countered (Louisoix's Sacrifice's own real three-way "target activated ability, triggered ability, or noncreature spell"), since there's no real target reference to read it off. */
      kind: 'counter';
      describe: string;
    }
  | {
      /** Real rule 701.6/`DestroyEffect` — as opposed to `sacrifice` (701.16, a cost/effect a player CHOOSES to pay) or a generic `move`, destroy is its OWN action a spell/ability directly causes. `qty` alone covers "up to N" (Summon: Bahamut's own chapters I/II, TargetMin$0) via pool-exhaustion — no separate `optional` field here (nothing else on this effect distinguishes "must" from "may" when a legal target exists; see `move`/`sacrifice`'s own `optional` fields for that same documentary-only distinction). */
      kind: 'destroy';
      validType: 'permanent' | 'creature' | 'land';
      nonLand?: boolean;
      qty: Computed<number>;
      /** "destroy target creature with power N or greater" (Battle Menu's own Magic mode) — filters the candidate pool by `getNetPower()`, omit for no threshold. */
      minPower?: Computed<number>;
      /** Real `TargetMin$ 0` (Summon: Bahamut's own "destroy up to one target nonland permanent") — documentary only, same as `move`/`sacrifice`'s own `optional` field: no player-decision engine exists here, so a legal-but-declined target still gets destroyed. `qty` + pool-exhaustion already cover "0 when nothing qualifies" for free. */
      optional?: boolean;
      /** See `dealDamageTarget`'s own doc comment above — same owner-restriction fix, same bug. */
      owner?: EffectOwner;
    }
  | {
      /** `DB$ DealDamage | Defined$ Player.Opponent` — real Forge shape for "deals damage to each opponent" (Summon: Bahamut's own Mega Flare). Reuses `EffectOwner` (`'opponents'` = every opponent) rather than inventing a second owner vocabulary. */
      kind: 'dealDamage';
      target: EffectOwner;
      amount: Computed<number>;
    }
  | {
      /** A SINGLE targeted creature (any player's, Slash of Light's own "target creature") takes damage — as opposed to `dealDamage`'s player-group target. Same `X`/`XTarget` naming split `pump`/`pumpTarget` and `putCounter`/`putCounterTarget` already use, not a new pattern. */
      kind: 'dealDamageTarget';
      amount: Computed<number>;
      /** Restricts the candidate pool to one side (Ultros' own "target creature an opponent controls") — omit for the prior default, every creature on the battlefield regardless of controller. Same fix `pumpTarget`/`tapTarget`/`putCounterTarget`/`destroy` below all needed: without an owner restriction, `chooseTarget`'s always-take-the-first-candidate rule can land on the source's OWN controller's side (even itself) for a card whose REAL text actually is restricted — Ice Flan's own real "target artifact or creature an opponent controls" is the confirmed case. (Coeurl/Dion, Bahamut's Dominant's own chapter III were checked against this same failure mode and found to be real, printed UNRESTRICTED targeting — `ValidTgts$ Creature.nonEnchantment` / `ValidTgts$ Permanent`, no controller clause at all — so self-targeting there is a legal, if unlucky, `chooseTarget`-determinism outcome, not a bug; they don't set this field.) */
      owner?: EffectOwner;
      /**
       * Real Forge `ValidTgts$ Creature.tapped` (a real, common card-script
       * predicate — same real `Card.isTapped()` (`interfaces.ts:106-107`,
       * `Card.java` ~line 4641) `state.ts`'s own `Card.isTapped()` mirror
       * already reads) — restricts the candidate pool to only TAPPED
       * creatures (Summon: Primal Garuda's own Aerial Blast, fin/37: "deals
       * 4 damage to target TAPPED creature an opponent controls" —
       * previously undeclarable, forcing this Effect kind to be skipped
       * entirely in favor of a bespoke `kind:'custom'` closure for that one
       * real clause). Omit for the prior default, no tapped-status
       * restriction at all. Unlike `Constraints.tapped` (`synergy.ts`,
       * purely documentary, never consulted by the fact matcher), this
       * field IS a real, state-mutating pool filter — `resolveTargets`
       * genuinely can't land on an untapped creature once set.
       */
      tapped?: boolean;
    }
  | {
      /** `DB$ DealDamage | ValidTgts$ Any` — real Forge "any target" (a player OR a creature/planeswalker, Choco-Comet-style burn), as opposed to `dealDamage`'s player-group-only target and `dealDamageTarget`'s creature-only target. Pool is every player plus every creature on the battlefield. */
      kind: 'dealDamageAnyTarget';
      amount: Computed<number>;
      owner?: EffectOwner;
    }
  | {
      /** `FightEffect` (forge-game/.../ability/effects/FightEffect.java) — `self` fights a chosen target creature: each deals damage equal to its own power to the other, simultaneously. A real, distinct Forge action (not two separate `dealDamageTarget` calls a card would author itself). */
      kind: 'fightTarget';
      owner?: EffectOwner;
    }
  | {
      /** A SINGLE targeted creature (any player's — Overkill's own "target creature," not "creatures you control") gets a P/T delta, as opposed to `pumpAll`'s board-wide broadcast. */
      kind: 'pumpTarget';
      power: Computed<number>;
      toughness: Computed<number>;
      /** See `dealDamageTarget`'s own doc comment above — same owner-restriction fix, same bug. */
      owner?: EffectOwner;
      /** "another target creature you control" (Gladiolus Amicitia/Rinoa Heartilly's own Landfall/attack pumps) — excludes `ctx.self` from the pool, same reasoning as `pumpAll`/`sacrifice`/`move`'s own `notSelf`. Without this the pool ordering (self is always added to the battlefield LAST in a scenario — see harness.ts) happens to put self last, so omitting it isn't unsafe today, but a real "another" card should still set this explicitly rather than rely on that ordering. */
      notSelf?: boolean;
      /** Real oracle text says "until end of turn" (Battle Menu's own Ability mode — "target creature gets +0/+4 until end of turn") — real 514.2 Cleanup removal, see state.ts's own `pump`/`clearUntilEndOfTurnPumps` doc comments. Omit (default false) for a permanent-within-scenario pump. */
      untilEndOfTurn?: boolean;
    }
  | {
      /** `self` gets a P/T delta with no target/board-wide choice involved (Ambrosia Whiteheart's own Landfall — "CARDNAME gets +1/+0") — a third, narrower shape than `pumpTarget` (chosen) and `pumpAll` (broadcast). */
      kind: 'pumpSelf';
      power: Computed<number>;
      toughness: Computed<number>;
      /** Real oracle text says "until end of turn" (Ambrosia Whiteheart's own Landfall — "CARDNAME gets +1/+0 until end of turn") — real 514.2 Cleanup removal, see state.ts's own `pump`/`clearUntilEndOfTurnPumps` doc comments. Omit (default false) for a permanent-within-scenario pump. */
      untilEndOfTurn?: boolean;
    }
  | {
      /** Grants a keyword to a SINGLE chosen target (Magic Damper-style "target creature gains X") — same target-picking shape as `pumpTarget`. Mechanically REAL, not just documentary (see state.ts's own `grantKeyword`: it mutates the real card's `keywords`, so a later Lifelink/Indestructible check genuinely reflects it) — DURATION defaults to permanent-within-scenario (same caveat `state.grantKeyword`'s own doc comment explains in full) unless `untilEndOfTurn` is set. */
      kind: 'grantKeywordTarget';
      keyword: Keyword;
      validType?: 'creature' | 'any';
      owner?: EffectOwner;
      /** See `pumpTarget`'s own `notSelf` doc comment above — same "another target creature" exclusion. */
      notSelf?: boolean;
      /** Real oracle text says "until end of turn" (not a bare, permanent grant) — real 514.2 Cleanup removal, see state.ts's own `grantKeyword`/`clearUntilEndOfTurnKeywordGrants` doc comments. Omit (default false) for a permanent grant. */
      untilEndOfTurn?: boolean;
    }
  | {
      /**
       * Grants a keyword to every creature matching `predicate` (Ardyn's own "Demons you control have menace," a real static grant to a GROUP) — same `predicate`/`notSelf`/`subtype` shape `pumpAll`/`putCounterAll` already use. Same duration default as `grantKeywordTarget` above (permanent-within-scenario unless `untilEndOfTurn` is set).
       *
       * `'permanents-you-control'` (Restoration Magic's own Curaga mode —
       * "Permanents you control gain hexproof and indestructible until end
       * of turn," CR: no creature-only restriction, every permanent) added
       * alongside the original creature-only predicate rather than widening
       * it, since `'creatures-you-control'` is real, separately-matched
       * pool vocabulary elsewhere (`subtype` filtering only makes sense for
       * a creature-typed pool) — `subtype` is a no-op under
       * `'permanents-you-control'` and should not be set alongside it.
       *
       * `'attacking-creatures'` (2026-09-16, Cecil, Redeemed Paladin's own
       * real "Other attacking creatures gain indestructible until end of
       * turn") — same real SYMMETRIC broadcast (`ctx.you` AND
       * `ctx.opponents` both) `pumpAll`'s own identical predicate value
       * already established for Auron's Inspiration; genuinely distinct
       * from the "no keyword-grant field at all" gap moogles-valor/
       * restoration-magic/dion-bahamut/ardyn-the-usurper's own comments
       * document (that gap is closed — `grantKeywordAll` itself already
       * exists — this is a separate, narrower missing PREDICATE value).
       * `notSelf` (Cecil's own "OTHER attacking creatures") is the same
       * pre-existing field every other predicate already supports here,
       * not new.
       */
      kind: 'grantKeywordAll';
      predicate: 'creatures-you-control' | 'permanents-you-control' | 'attacking-creatures';
      keyword: Keyword;
      notSelf?: boolean;
      subtype?: string;
      /** See `grantKeywordTarget`'s own `untilEndOfTurn` doc comment — same real 514.2 Cleanup removal, opt-in per effect. */
      untilEndOfTurn?: boolean;
    }
  | {
      /** `self` gains a keyword with no target/board-wide choice (Zack Fair's own "gains indestructible") — third shape mirroring `pumpSelf`. Same duration default as `grantKeywordTarget` above. */
      kind: 'grantKeywordSelf';
      keyword: Keyword;
      /** See `grantKeywordTarget`'s own `untilEndOfTurn` doc comment — same real 514.2 Cleanup removal, opt-in per effect. */
      untilEndOfTurn?: boolean;
    }
  | {
      /** `TapEffect`/`TapAllEffect` (forge-game/.../ability/effects/) — a CHOSEN target tapped (Coeurl's own activated ability), as opposed to `tapAll`'s board-wide predicate. */
      kind: 'tapTarget';
      validType: 'creature' | 'artifact' | 'land' | 'creature-or-artifact' | 'any';
      excludeEnchantment?: boolean;
      /** See `dealDamageTarget`'s own doc comment above — same owner-restriction mechanism, for a card whose real text actually is restricted (Coeurl's own real text is NOT — see that doc comment). */
      owner?: EffectOwner;
    }
  | {
      /** `TapAllEffect` (forge-game/.../ability/effects/) — every land (only predicate needed so far) matching `owner` gets tapped, no target chosen (Shiva, Warden of Ice's own chapter III "Tap all lands your opponents control") — as opposed to `tapTarget`'s single chosen target. Reuses `EffectOwner` the same way `dealDamage`'s player-group target does. */
      kind: 'tapAll';
      predicate: 'lands';
      owner: EffectOwner;
    }
  | {
      /** `UntapEffect` (forge-game/.../ability/effects/) — Forge's own real counterpart to `tapTarget` above (Magic Damper's own "untap target creature"), same shape, `untap` instead of `tap`. `'attacking'` (2026-09-16, Sage's Nouliths' own granted "untap target attacking creature") — see `BattlefieldValidType`'s own doc comment. */
      kind: 'untapTarget';
      validType: 'creature' | 'artifact' | 'land' | 'creature-or-artifact' | 'any' | 'attacking';
      owner?: EffectOwner;
      /** "untap ANOTHER target permanent" (Formidable Speaker) — excludes `ctx.self` from the pool, same reasoning as `pumpTarget`/`sacrifice`/`move`'s own `notSelf`. */
      notSelf?: boolean;
    }
  | {
      /**
       * `DigEffect` — look at the top `qty` library cards, take up to `take`
       * matching `validType` to hand, rest to bottom (Ashe's own attack
       * trigger).
       *
       * `'creature-or-artifact'` (2026-09-16, engine-lane primitive
       * escalation, sidequest-catch-a-fish-cooking-campsite/fin-31) — real
       * Forge `RevealValid$ Artifact,Creature` (`PeekAndRevealEffect.java`
       * lines 24-25/57-59, `res/cardsfolder/s/
       * sidequest_catch_a_fish_cooking_campsite.txt`'s own `SVar:TrigPeek:
       * DB$ PeekAndReveal | ... | RevealValid$ Artifact,Creature`), a genuine
       * creature-OR-artifact union `digReveal-effect-structural.ts` itself
       * already documents as NOT expressible by the pre-existing
       * `'artifact' | 'any'` union (that recognizer's own module comment
       * explicitly declines `validType:'any'` as a dishonest approximation
       * of this exact shape — see its own doc comment). Same union spelling
       * `sacrifice`/`destroy`/`tapTarget`/`putCounterTarget`'s own
       * `validType`/`BattlefieldValidType` unions already use for the
       * identical real disjunction, not new vocabulary.
       */
      kind: 'dig';
      qty: Computed<number>;
      take: Computed<number>;
      validType?: 'artifact' | 'any' | 'creature-or-artifact';
      optional?: boolean;
    }
  | {
      /** Phantom Train's own "becomes a Spirit artifact creature in addition to its other types until end of turn" — see interfaces.ts's own `animate` doc comment for how much real Forge machinery this is standing in for. */
      kind: 'animate';
      target: 'self';
      types: string[];
    }
  | {
      /**
       * CR 601/305's own umbrella "play" (ENGINE_GAPS.md gap #16) — The
       * Lunar Whale's own "As long as The Lunar Whale attacked this turn,
       * you may play the top card of your library." Unlike `dig` (which only
       * ever moves a library card to hand or the bottom), this genuinely
       * PLAYS the revealed top card — a real land-drop or a real cast,
       * whichever the card's own type turns out to be — via `actions.play`,
       * which an engine-aware caller (`engine-trace.ts`'s own pilot Actions)
       * backs with the real `canPlayFromLibraryTop`/`playFromLibraryTop`
       * dispatch (`engine.ts`), reusing the real `playLand`/`canPlayLand` or
       * `castSpell`/`canCastSpell` pairs rather than a fabricated hybrid
       * action (see those functions' own doc comments for the real Forge
       * `PlayEffect.java` citation). No `validType`/target filter — CR
       * 601/305's own "play" dispatch is total over whatever's actually on
       * top, never scoped to a subset (a card wanting a NARROWER version,
       * e.g. Traveling Chocobo's own "lands and Bird spells only," gates
       * whether to invoke this effect at all, same "engine primitives don't
       * know about a specific card's own condition" split this file's other
       * effect kinds already establish).
       */
      kind: 'playFromLibraryTop';
    }
  | {
      /**
       * A real "choose one —" (Gaius van Baelsar's own Charm) — `ctx.mode`
       * (set per-scenario, a real player decision, not computed) selects
       * which ONE of `modes` actually runs. Every mode still contributes
       * its own `describe` to `synergyTags()` regardless of which one a
       * given scenario picked, since all modes are real printed text on
       * the card, not just whichever branch happened to run.
       */
      kind: 'modal';
      modes: {
        describe: string;
        effects: Effect[];
        /**
         * PROTOTYPE (PRD_AUTOMATED_AUTHORING.md, 2026-09-13, scoped trial —
         * fin/1-10 only). Same `Trigger.annotation`/`effectsAnnotation`
         * shape/semantics, applied to ONE mode of a "Choose one —" modal
         * spell rather than the whole card — added specifically because
         * `effectsAnnotation` on the OWNING `Effect`/`CardDefinition` can
         * only point at the shared modal header line (e.g. "Choose one —"),
         * losing every individual mode's own real printed clause (Aerith
         * Rescue Mission/Battle Menu both real "Choose one —" spells whose
         * modes each print on their OWN oracle-text line — see those two
         * cards' own `definition.ts` for the real populated example). Same
         * "purely additive, inert data, not wired into
         * `apply-recognizers.mjs`/`synergy.json`/any recognizer" scope as
         * every other field in this prototype.
         */
        annotation?: FactAnnotationAuthoring;
      }[];
    }
  | {
      /**
       * The true escape hatch, for an effect that isn't any declarative
       * shape above at all — `describe` is REQUIRED specifically so
       * `synergyTags()` still gets something readable out of it instead of
       * silently seeing nothing. Reach for this only when no combination of
       * the variants above (even with a `Computed` field) fits; it should
       * stay rare.
       */
      kind: 'custom';
      describe: string;
      run: (ctx: EffectContext, actions: Actions) => void;
      /**
       * PROTOTYPE (PRD_AUTOMATED_AUTHORING.md, "3-tier waterfall" trial,
       * 2026-09-13, scoped to fin/1-10 only — NOT wired into
       * `apply-recognizers.mjs`/`synergy.json` generation). Tier 3 of that
       * PRD's fallback chain (static structural read, then the runtime-
       * dependency probe, then this) — the thing to reach for ONLY when
       * BOTH of the first two genuinely have nothing to say: a `custom`
       * effect's `run` body is opaque to static structural reads by
       * construction (this file's own header, "Trade-off, stated plainly"),
       * and the runtime probe (`recognizers/runtime-dependency-probe
       * .prototype.ts`) only ever executes an arity-1 `Computed<T>`
       * closure — `run`'s arity-2 `(ctx, actions)` shape is excluded from
       * that probe by design (it can MUTATE real state, `wrap()`'s own doc
       * comment is explicit that side-effect-freedom is what makes probing
       * safe at all).
       *
       * A human/agent who has already read this `run` body and knows what
       * it really does asserts the FULL resulting `Fact` object(s) HERE,
       * co-located with the code that justifies them, instead of in a
       * separately-authored/maintained `synergy.json` entry with no
       * structural link back to this effect at all. Reuses `Fact`'s own
       * real shape verbatim (`synergy.ts`) — `role` stays ON each object
       * (unlike `RecognizedFact.fact`'s `Omit<Fact,'role'>`, which only
       * omits it because the on-disk `SynergyFile` implies role from which
       * array a fact sits in; here there's no array to imply it from, so a
       * `custom` effect asserting facts of BOTH roles at once — e.g. one
       * `source` fact for what it does, one `sink` fact for what it wants
       * present — needs `role` on each entry to disambiguate). A single
       * `Fact` when there's exactly one real claim, an array when the same
       * `run` body backs more than one (Aerith Gainsborough's own onDies
       * custom effect: the `source` putCounter fact it produces, AND
       * (co-located here for the same reason, since neither has any other
       * natural single-effect home) the `sink` fact for what board state
       * makes it worth anything, AND the `sink` fact for the trigger's own
       * "self dies" firing precondition).
       *
       * **Still purely additive/inert data as of this trial** — same
       * "not consulted by anything real yet" status every other
       * `PRD_AUTOMATED_AUTHORING.md` prototype field on this file already
       * has (`Trigger.annotation`, `effectsAnnotation`, etc.). See
       * `CardDefinition.authoredFacts` below for the sibling field one
       * level up, for a fact that has no single owning `Effect` at all.
       *
       * **`annotations` (2026-09-13 correction, fin/1-5 only so far)**: no
       * longer embedded on the Fact object here — see `AuthoredFact`'s own
       * doc comment (this file's imports) for why, and
       * `cards/<slug>/definition-annotations.json` for where it now lives,
       * keyed by this container's own index path (e.g. an array entry here
       * is `"<trigger/effect path>.authoredFact[<i>]"`).
       */
      authoredFact?: AuthoredFact | AuthoredFact[];
    }
  | {
      /**
       * A typed, DATA-shaped combinator AST (`combinator.ts`) for the shape
       * of `custom`-effect logic that's genuinely just Query/Filter/
       * Aggregate/Each/Branch/Sequence over real board state — the DEFAULT
       * way to express new `custom`-style effect logic going forward, per
       * standing project policy (proven first as a hand-translation
       * experiment, 2026-09-14, fin/1-25's own 17 real `kind:'custom'`
       * closures, 100% coverage — see `combinator.ts`'s own header for the
       * full trail). `custom` above stays the true last-resort escape hatch
       * for a genuinely irreducible case — this is what MOST new/migrated
       * cases should use instead.
       *
       * Unlike `custom`'s opaque `run` closure, `program` is real,
       * inspectable DATA: `combinator.ts`'s `walkProgram` reads the SAME
       * `program` value with NO `ctx`/`actions`/board at all (no fake board,
       * no simulated execution) — the whole point of making an effect data
       * instead of code. `resolveCard`'s own `applyEffect` runs it for real
       * via `combinator.ts`'s `runProgram`, which calls the exact same
       * `Actions`/`EffectContext` every other declarative `Effect` kind in
       * this file already uses — genuine game resolution, not a simulation.
       */
      kind: 'program';
      describe: string;
      program: ProgramNode;
      /**
       * Same tier-3 escape hatch as `custom.authoredFact` above (see its own
       * doc comment for the full design) — a `program` effect is genuinely
       * MORE structurally readable than `custom`'s opaque closure, but this
       * pass doesn't build a recognizer that exploits that yet (see
       * `combinator.ts`'s own header), so a fact this AST can't yet derive
       * for itself is still hand-authored here in the meantime. Aerith
       * Gainsborough's own migrated `onDies` effect is the first real user —
       * its magnitude (X, `ctx.self`'s own live `+1/+1` count) is now
       * directly visible in the `program` data itself (a `selfCounters`
       * `ValueRef`, no longer opaque), a real future opportunity to retire
       * this specific `authoredFact` entry once a recognizer is built to
       * read it — not attempted in this pass, flagged rather than silently
       * left stale.
       */
      authoredFact?: AuthoredFact | AuthoredFact[];
    }
  | {
      /**
       * Real 721.1a "end the turn" (`ApiType.EndTurn`, forge-game/.../
       * ability/effects/EndTurnEffect.java — see `interfaces.ts`'s own
       * `endTurn` doc comment for the full real citation/4-step trail).
       * Ultima (fin/38)'s own "End the turn." is the real FIN card this was
       * built for (2026-09-16) — previously an honest, documented
       * `kind:'custom'` no-op (no turn-ending machinery existed at all);
       * now a genuine primitive: `turn.ts`'s own `jumpToCleanup` +
       * `engine.ts`'s own `endTurn` wrapper (stack-exile, end combat, check
       * SBAs, jump straight to Cleanup and run its real automatic action).
       * Bare — no fields of its own; `applyEffect`'s own case below also
       * sets `ctx.selfToExile` (see that field's own doc comment) since the
       * "including this card" ruling is intrinsic to the ability itself,
       * not something a card author chooses per use.
       */
      kind: 'endTurn';
    };

/** An alternate way to cast this card — Flashback, Jump-start, Escape, casting from exile, etc. Real rule text, not a derived fact, so it's declared per-card rather than computed. */
export interface AlternateCost {
  name: string;
  cost: string;
  from: 'graveyard' | 'exile';
  /** Flashback/Jump-start's own real rule: exiled instead of returning to the graveyard afterward. */
  thenExile?: boolean;
}

/**
 * Real CR 601.2f/118.9 cost-reduction, keyed on the CASTER'S OWN CHOSEN
 * TARGET for this spell (Forge: `S:Mode$ ReduceCost | ValidTarget$ ...` —
 * `res/cardsfolder/f/fate_of_the_sun_cryst.txt`'s real shipped script:
 * `S:Mode$ ReduceCost | ValidCard$ Card.Self | Type$ Spell | Amount$ 2 |
 * EffectZone$ All | ValidTarget$ Creature.tapped`). Distinct from
 * `AlternateCost` (which REPLACES the whole cost) — this DISCOUNTS the
 * generic portion of the card's own normal `manaCost`, same as a real
 * "costs {N} less to cast" clause never touches the colored pips (118.9:
 * a cost can't be reduced below what its colored requirement demands).
 *
 * `engine.ts`'s `canCastSpell`/`castSpell` take an optional caller-supplied
 * `declaredTarget: RealCard` (same "caller supplies the real object, engine
 * validates" shape `crewedBy` already established for Crew) — real 601.2b
 * ("choose targets") genuinely happens before 601.2f ("determine cost"), so
 * a real caster always knows their own target before the discount is even
 * computed; this model's own lazy, resolution-time `chooseTarget` machinery
 * (`card.ts`'s `applyEffect`) is unchanged and still picks the ACTUAL
 * resolved target later — a caller keeps the two in sync by also setting
 * `EffectContext.preferTarget` to the same `RealCard` (same convention any
 * other pre-determined-target scenario already uses).
 *
 * Only the single condition shape a real card in this pool needs is
 * modeled today (`condition` is a plain, controlled string — not an
 * executable predicate — same "declarative data, not code" bar every other
 * controlled-vocabulary field in this file holds to; extend the union as a
 * new real card needs a different condition, don't add a function param).
 * A flat, unconditional discount (`condition` omitted) is also real (Forge:
 * The Wind Crystal's own "White spells you cast cost {1} less to cast" —
 * see ENGINE_GAPS.md gap #7) but is a BROADCAST effect (applies to spells
 * OTHER than itself, gated on color, not on this card's own chosen target)
 * — a genuinely different mechanism from this self-discount shape, modeled
 * separately as `SpellCostReductionGrant` below; same for a cost reduction
 * on an ACTIVATED ABILITY's own cost rather than a spell's (Qiqirn
 * Merchant, same gap writeup, `ActivationCostReduction` below).
 *
 * **`perControlled` (closed 2026-09-12, Travel the Overworld/fin-82's
 * migration) — a real board-state-COUNTED discount on THIS SAME card's own
 * cast cost**, unconditional (no chosen-target gate at all — mutually
 * exclusive with `amount`/`condition` above, which is why both are now
 * optional instead of required). Real Forge citation:
 * `res/cardsfolder/t/travel_the_overworld.txt` (Travel the Overworld's own
 * real shipped script) declares `K:Affinity:Town` — real Forge (checked
 * against `tmp/mtg-forge`'s own source, not guessed) expands that keyword
 * into EXACTLY the `ReduceCost$`+board-count pair this doc comment already
 * describes: `forge-game/.../keyword/Keyword.java` line 12 (`AFFINITY`) +
 * `forge-game/.../card/CardFactoryUtil.java`'s `addStaticAbility`
 * (~lines 3749-3766) generates `Mode$ ReduceCost | ValidCard$ Card.Self |
 * Type$ Spell | Amount$ AffinityX | EffectZone$ All` paired with a
 * dynamically-built `SVar:AffinityX:Count$Valid Town.YouCtrl` — the exact
 * same underlying "costs {1} less per [type] you control" reduction Qiqirn
 * Merchant's `ActivationCostReduction` already models on the ACTIVATION
 * side, here on a spell's own CAST cost. Real printed text: "This spell
 * costs {1} less to cast for each Town you control." `engine.ts`'s
 * `effectiveCastCost` computes the real discount the exact same way
 * `effectiveActivationCost` already does for `ActivationCostReduction` —
 * `amountPerMatch * (real permanents `caster` controls whose subtypes
 * include `subtype`)` — re-tallied fresh at cast time, not derived from a
 * fixed number. Only a bare-subtype board count is modeled, same scope
 * `ActivationCostReduction` already restricts itself to.
 */
export interface CostReduction {
  /** Generic mana reduced (Forge's own `Amount$`) — only a fixed integer generic-mana discount is modeled; a variable/dynamic amount (e.g. "for each X you control") would need a `Computed`-style hook, not built here since no real card in this pool needs one yet. Omit when `perControlled` is used instead. */
  amount?: number;
  /**
   * What has to be true about the caster's OWN chosen target (Forge's
   * `ValidTarget$`) for the reduction to apply. `'tappedCreatureTarget'`
   * requires BOTH conditions Forge's own `ValidTarget$ Creature.tapped`
   * checks — the target must be a Creature (`state.ts`'s `effectiveTypes`,
   * so a Crew-animated Vehicle counts) AND tapped — not just "any tapped
   * permanent" (Fate of the Sun-Cryst's own resolved EFFECT can target any
   * nonland permanent, a broader pool than the reduction's own narrower
   * condition — a real, textually-precise distinction, not a simplification).
   * Omit when `perControlled` is used instead (a board-counted discount has
   * no target condition at all).
   */
  condition?: 'tappedCreatureTarget';
  /** Board-state-COUNTED discount — see this interface's own doc comment above. Mutually exclusive with `amount`/`condition`; a card in this pool needs only one shape at a time. `subtype` matches EITHER a creature subtype ("Affinity for Birds"/"Affinity for Elves") OR a card type ("Affinity for Artifacts") — real Forge's own `Affinity` keyword (`Affinity.java`) resolves both through the same generic valid-checking mechanism; `engine.ts`'s own `effectiveCastCost` checks `c.subtypes`/`c.types` both, 2026-09-16 widening. */
  perControlled?: { amountPerMatch: number; subtype: string };
}

/**
 * Real board-state-COUNTED cost-reduction on an ACTIVATED ABILITY's own
 * cost (ENGINE_GAPS.md gap #7's third real example) — a genuinely
 * different mechanism from `CostReduction` above (which is keyed on the
 * CASTER'S CHOSEN TARGET, evaluated once at cast time) and from
 * `SpellCostReductionGrant` below (a BROADCAST onto OTHER cards' spells) —
 * this counts real permanents on the ACTIVATOR's OWN battlefield, re-tallied
 * fresh every time the ability's own cost is computed. Real Forge citation,
 * `res/cardsfolder/q/qiqirn_merchant.txt` (Qiqirn Merchant's own real
 * shipped script): `A:AB$ Draw | Cost$ 7 T Sac<1/CARDNAME> | NumCards$ 3 |
 * ReduceCost$ X | SpellDescription$ Draw three cards. This ability costs
 * {1} less to activate for each Town you control.` paired with `SVar:X:
 * Count$Valid Town.YouCtrl`. `engine.ts`'s `effectiveActivationCost`
 * computes the real discount as `amountPerMatch * (real permanents the
 * activator controls whose subtypes include `subtype`)`, then discounts the
 * ability's own generic mana portion the same generic-only/floored-at-0 way
 * `mana.ts`'s `reduceGenericCost` already does for `CostReduction`. Only a
 * bare-subtype board count is modeled (no compound filter, e.g. "Town you
 * control that's also tapped") since no real card in this pool needs one.
 *
 * Same shape now ALSO reused on `CostReduction.perControlled` below for the
 * CAST-side case (Travel the Overworld's own "Affinity for Towns" — CR
 * 601.2f, the same real board-count mechanism just applied to a spell's own
 * cast cost instead of an activated ability's).
 */
export interface ActivationCostReduction {
  amountPerMatch: number;
  subtype: string;
}

/**
 * Real CR 601.2f cost-reduction this permanent BROADCASTS onto OTHER spells
 * its controller casts, gated on color — a genuinely different mechanism
 * from `CostReduction` above (which discounts THIS SAME card's own cast
 * cost, keyed on a chosen target): this is a static ability a PERMANENT
 * grants to ANY qualifying spell its controller casts, unconditional and
 * flat, for as long as the permanent stays on the battlefield. Real Forge
 * citation, `res/cardsfolder/t/the_wind_crystal.txt` (The Wind Crystal's own
 * real shipped script): `S:Mode$ ReduceCost | ValidCard$ Card.White | Type$
 * Spell | Activator$ You | Amount$ 1 | Description$ White spells you cast
 * cost {1} less to cast.` `engine.ts`'s `effectiveCastCost` sums every
 * matching grant on the caster's OWN battlefield permanents (`state.ts`'s
 * `activeSpellCostDiscount`) and discounts the cast spell's own generic mana
 * portion the same generic-only/floored-at-0 way as `CostReduction`. Only a
 * flat amount gated on a fixed color list is modeled — a variable amount, a
 * non-color gate (type/subtype), or an "until end of turn"-style duration on
 * the grant itself are all real Forge shapes but unneeded by any card in
 * this pool today.
 */
export interface SpellCostReductionGrant {
  amount: number;
  /** Real WUBRG color letters (e.g. `['W']`) — a spell qualifies if ANY of its own colored mana-cost pips matches ANY color named here (mirrors Forge's own `ValidCard$ Card.White`-style color check). */
  colors: string[];
}

/**
 * Real CR 614.2 mill-event replacement this permanent BROADCASTS onto every
 * OPPONENT's own mill event (ENGINE_GAPS.md gap #19, closed) — The Water
 * Crystal's own real shipped script (`res/cardsfolder/t/
 * the_water_crystal.txt`): `R:Event$ Mill | ActiveZones$ Battlefield |
 * ValidPlayer$ Player.Opponent | ReplaceWith$ MillPlus4 | ...` paired with
 * `SVar:MillPlus4:DB$ ReplaceEffect | VarName$ Number | VarValue$ X` +
 * `SVar:X:ReplaceCount$Number/Plus.4` — real Forge's OWN `ReplaceCount$
 * Number/Plus.N` shape is ITSELF a generic "add N to the event's own Number"
 * primitive, not a card-specific one, which is exactly why `amount` is a
 * plain field here rather than a fixed, card-specific keyword the way
 * `'LifegainDouble'` (a boolean, fixed-2x, gap #8b) sufficed — that shape had
 * no per-card parameter to carry; a future "mill N more/fewer" card reuses
 * this exact same field with a different `amount` instead of a new keyword
 * per card. Deliberately scoped to a flat additive delta only (no
 * multiplier, no player-choice-gated variant) — no real FIN card needs
 * either of those broader shapes. `state.ts`'s `activeMillModifier` is the
 * one real reader, scoped to every OTHER player's battlefield (`ValidPlayer$
 * Player.Opponent` is relative to the GRANT's own controller, never to the
 * player being milled — see that function's own doc comment).
 */
export interface MillModifierGrant {
  amount: number;
}

/**
 * Real, structural "this permanent can produce mana" vocabulary — replaces
 * the old `mana.ts`-only text-regex path (`manaAbilityColorFromStaticText`/
 * `manaAbilityColorsFromStaticText`/`deriveManaAbility`, deleted alongside
 * this field) that used to be the ONLY representation of a real mana
 * ability across 30+ real pool cards, invisible to anything but two narrow
 * exact-string patterns. Real Forge citation: every one of these fields is
 * a direct mirror of `AbilityManaPart.java`'s own constructor params
 * (`forge-game/.../spellability/AbilityManaPart.java` lines 106-115) and
 * the real shipped `A:AB$ Mana | ...` card-script line those params come
 * from (`res/cardsfolder/<l>/llanowar_elves.txt`: `Cost$ T | Produced$ G`,
 * e.g.) — NOT invented vocabulary:
 *  - `cost`/`colors`/`amount` mirror `Cost$`/`Produced$`/`Amount$`.
 *  - `restriction` mirrors `RestrictValid$` (`AbilityManaPart
 *    .meetsManaRestrictions`).
 *  - `activationCondition` mirrors `IsPresent$` (a plain activation
 *    precondition, checked before the ability can even be activated at
 *    all — genuinely different from `restriction`, which instead
 *    constrains what the ALREADY-PRODUCED mana can later be spent on).
 *  - `variableAmount` mirrors a dynamic `Amount$ X` paired with its own
 *    `SVar:X:...` formula.
 *
 * Lives alongside `keywords`/`ptFormula` (recognized-and-structured, not
 * necessarily fully enforced — see each field's own note below for exactly
 * what's wired vs. honestly inert) rather than in `staticAbilities`' free
 * text, which `resolveCard()` never executes at all.
 */
export interface ManaAbility {
  /**
   * Real Forge `Cost$` (almost always bare `T` — Forge's own shorthand for
   * `{T}`). Defaults to `'{T}'` when omitted — every real FIN mana source
   * this pool has is a plain tap; a source whose OWN cost is anything else
   * (Capital City's second ability, `Cost$ 1 T`; Starting Town's second,
   * `Cost$ T PayLife<1>`) is a real, typed, but DELIBERATELY UNPAYABLE
   * source through `mana.ts`'s own `canAfford`/`payMana` — those two
   * functions only ever recognize a bare-`{T}` `ManaAbility` as an
   * ordinary source (see `mana.ts`'s own header): paying a MANA ABILITY'S
   * OWN cost with more mana would need a genuine spendable mana-pool
   * mechanism this engine still doesn't have at all (`interfaces.ts`'s own
   * `Player.addMana` doc comment), the same real, load-bearing boundary
   * `restriction` below already documents from the other side.
   */
  cost?: string;
  /**
   * Real Forge `Produced$` — every color this ability can produce. A
   * single-element array is a fixed, single-color source (`Produced$ G`,
   * Llanowar Elves); 2+ elements is a real CHOICE (`Produced$ Combo B R`,
   * Vector, Imperial Capital — `AbilityManaPart.isComboMana()`/
   * `getComboColors`, Forge's own "Combo" prefix marking "produces exactly
   * ONE of these, the payer's choice at the moment it's tapped," not one of
   * each) — `mana.ts`'s `assignManaRequirements` already generalizes over
   * any-length `colors` (built for the 2-color case, but the backtracking
   * itself doesn't care how many), so a genuine 5-color "any one color"
   * ability (`Produced$ Any` — Blitzball, Overgrown Zealot's first ability)
   * is just `colors: ['W','U','B','R','G']`, no separate flag needed.
   */
  colors: ManaColor[];
  /**
   * Real Forge `Amount$` as a FIXED integer — how many mana units ONE
   * activation produces. Defaults to 1 (`AbilityManaPart`'s own `Produced`
   * param default, "1") when omitted. Ring of the Lucii's real `Produced$
   * C | Amount$ 2` (`{T}: Add {C}{C}.`) is the one real pool card that
   * needs a value other than 1 — `mana.ts`'s `canAfford`/`payMana` sum a
   * source's own `amount` toward GENERIC coverage (a real, narrow
   * extension; see that file's own header for the one documented
   * simplification this doesn't cover: an amount>1 source is never also
   * matched against more than one COLORED requirement in a single
   * assignment, harmless here since Ring of the Lucii's own 2 units are
   * colorless-only and colorless is never itself a payable pip in a cast
   * cost — see `mana.ts`'s own `COLORS`). Omit (or leave `undefined`) when
   * `variableAmount` is set instead — a card in this pool never needs
   * both.
   */
  amount?: number;
  /**
   * Real Forge `Amount$ X` paired with a dynamic `SVar:X:...` board-state
   * formula — mutually exclusive with the fixed `amount` above. Two real
   * shapes this pool's cards need, kept as a small closed union (same
   * "controlled vocabulary, extend only when a new real card forces a new
   * shape" discipline `ptFormula`/`Keyword` already hold to) rather than an
   * executable function, so a `ManaAbility` stays plain, inspectable data
   * like every other `Effect`/`CardDefinition` field in this file:
   *  - `{kind:'countSubtypeControlled', subtype}` — Forge's own
   *    `SVar:X:Count$Valid <Subtype>.YouCtrl` (Elvish Archdruid's real
   *    `{T}: Add {G} for each Elf you control`). Elvish Archdruid ITSELF
   *    stays on its own pre-existing, already-real `activationCost`+
   *    `effects:[{kind:'addMana', amount: ctx => ...}]` modeling (already
   *    genuinely executable via a `Computed` function, never text, and so
   *    never part of the free-text violation this field closes) — this
   *    variant exists for OTHER real cards with the identical shape that
   *    only ever had free `staticAbilities` text before now (none in this
   *    pool yet needed it structurally until this pass; kept general
   *    rather than Elvish-Archdruid-specific).
   *  - `{kind:'selfPower'}` — Forge's own `SVar:X:Count$CardPower`
   *    (Woodland Weavemaster's real `{T}: Add X mana of any one color,
   *    where X is this creature's power`) — a genuinely different live
   *    quantity (the permanent's OWN current power, via `effectivePT`) from
   *    the board-count shape above.
   * **Deliberately NOT wired into `mana.ts`'s `canAfford`/`payMana` this
   * pass** — real, named, flagged debt: both functions only ever take a
   * bare `RealCard[]` list of sources with no LIVE controller/board
   * reference to re-derive a variable count from at payment time (the same
   * "narrower, real gap" ENGINE_GAPS.md's non-basic-mana-sources entry
   * already named for Elvish Archdruid's own shape before this pass, now
   * extended to Woodland Weavemaster's `selfPower` shape too) — a real,
   * separate, larger threading change (`sourceColors`/`assignManaRequirements`
   * would need a live `GameState`/controller passed all the way through
   * every `canAfford`/`payMana` call site), assessed and not attempted
   * here. The type itself does NOT preclude wiring this in later — a
   * `ManaAbility` carrying `variableAmount` is real, present, structured
   * data today, just not yet a payable source.
   */
  variableAmount?: { kind: 'countSubtypeControlled'; subtype: string } | { kind: 'selfPower' };
  /**
   * Real Forge `RestrictValid$` — this mana can ONLY be spent on a
   * matching spell/ability (Cargo Ship's own real `Spell.Artifact,
   * Activated.Artifact`; Freya Crescent's own `Spell.Equipment,
   * Activated.Equip`; The Emperor of Palamecia's own `Spell.nonCreature`).
   * Kept as the real, raw Forge validity string (same "free text in a
   * structured slot, not a magic string bucket" treatment `activationCost`/
   * `abilities[].cost` already get elsewhere in this file) rather than
   * parsed further — genuinely UNENFORCED, on purpose, same real boundary
   * `cost` above documents from the other side: no spendable mana POOL
   * exists anywhere in this engine (`interfaces.ts`'s own `Player.addMana`
   * doc comment), so nothing could check what a tapped source's mana later
   * gets spent on even if this string were parsed further. `mana.ts`'s
   * `canAfford`/`payMana` correctly treat ANY `ManaAbility` with a
   * `restriction` set as NOT an ordinarily-payable source (same "correctly
   * not recognized" behavior the old regex path already had for these
   * cards, now honestly typed instead of silently absent/text-only).
   */
  restriction?: string;
  /**
   * Real Forge `IsPresent$` — an activation-time precondition beyond the
   * ordinary tap cost (Willowrush Verge's own second ability: `IsPresent$
   * Forest.YouCtrl,Island.YouCtrl`, "Activate only if you control a Forest
   * or an Island"). Kept as the real, raw Forge condition string, same
   * "unenforced, on purpose, structured slot not a magic bucket" treatment
   * `restriction` gets — no general `IsPresent$`-string evaluator exists in
   * this engine. `mana.ts` excludes a `ManaAbility` with this set from
   * ordinary payability, same as `restriction`.
   */
  activationCondition?: string;
}

/**
 * Real, LIVE continuous effect (613) INSTALLED onto a specific object at the
 * moment a counter is put on it, conditioned on that SAME object continuing
 * to carry the counter — genuinely different from `ContinuousGrantTargeting`
 * (`continuousKeywordGrants`/`continuousPTGrants`/`continuousTypeGrants`
 * above): those broadcast from a SOURCE permanent onto self/a subtype-you-
 * control/whatever it's equipped to; this one has NO relationship to its own
 * source at all once installed — it lives directly on the affected object
 * and stays keyed purely on ITS OWN counter count, independent of whether
 * the granting permanent (or even the game object that created it) still
 * exists. Real Forge citation, Ultima, Origin of Oblivion's own real shipped
 * script (`res/cardsfolder/u/ultima_origin_of_oblivion.txt`):
 * ```
 * T:Mode$ Attacks | ValidCard$ Creature.Self | Execute$ TrigPutCounter | ...
 * SVar:TrigPutCounter:DB$ PutCounter | ValidTgts$ Land | CounterType$ BLIGHT | CounterNum$ 1 | ... | SubAbility$ DBEffect
 * SVar:DBEffect:DB$ Effect | RememberObjects$ Targeted | StaticAbilities$ BlightStatic | ForgetOnMoved$ Battlefield | ForgetCounter$ BLIGHT | Duration$ Permanent
 * SVar:BlightStatic:Mode$ Continuous | Affected$ Card.IsRemembered | RemoveLandTypes$ True | RemoveAllAbilities$ True | AddAbility$ ColorlessMana
 * SVar:ColorlessMana:AB$ Mana | Cost$ T | Produced$ C | SpellDescription$ Add {C}.
 * ```
 * Real Forge creates a genuinely independent `Effect` game object
 * (`DB$ Effect`) that remembers the exact target(s) `PutCounter` chose
 * (`RememberObjects$ Targeted`) and un-remembers them once the BLIGHT
 * counter itself is gone (`ForgetCounter$ BLIGHT`) or the object leaves the
 * battlefield (`ForgetOnMoved$ Battlefield`) — `Duration$ Permanent` means
 * this Effect object itself outlives Ultima (it is NOT tied to Ultima
 * remaining on the battlefield). Approximated here as "any permanent
 * currently carrying >=1 counter of `counterType`" instead of a separate
 * remembered-object-set mechanism — behaviorally identical for this card
 * (no FIN card ever removes a blight counter independent of a zone change,
 * which already wipes `RealCard.counters`/`counterConditionalGrants` via
 * the existing 400.7 reset, `state.ts`'s `GameState.move`) — same "a
 * narrower live check achieves the same real outcome" reasoning
 * ENGINE_GAPS.md's "Stun and finality counters" section already establishes
 * for a comparable per-object counter-keyed replacement.
 *
 * Installed via a new `Actions.installCounterConditionalGrant` (mirrors
 * `putCounter`'s own shape: a free action taking the real target `Card`),
 * called from `resolveCard`'s own `putCounterTarget` case right alongside
 * `actions.putCounter` whenever that effect's own `grant` field is set —
 * see that Effect variant's own doc comment. `state.ts`'s
 * `hasCounterConditionalLandTypeLoss`/`hasCounterConditionalAbilityLoss`/
 * `effectiveSubtypes`/`effectiveKeywords`, and `mana.ts`'s own
 * `sourceColors`/`sourceAmount`/`payableManaAbility`, are the real LIVE
 * readers — every one of them re-checks the affected object's OWN CURRENT
 * counter count on every call, never a value baked in once at install time.
 */
export interface CounterConditionalGrant {
  /** Which counter type gates this effect — filled in automatically from the owning `putCounterTarget` effect's own `counterType` (see that field's own doc comment); never authored separately, so the two can't drift apart. */
  counterType: string;
  /** Real Forge `RemoveLandTypes$ True` (layer 4) — the affected permanent loses every land subtype it has (granted or printed) for as long as the condition holds. */
  removeLandTypes?: boolean;
  /**
   * Real Forge `RemoveAllAbilities$ True` (layer 6) — **only partially
   * enforced, real named gap, not silently worked around**: this engine
   * suppresses the affected permanent's own `manaAbilities` (`mana.ts`'s
   * `sourceColors`/`sourceAmount`/`payableManaAbility`, so its normal mana
   * production genuinely stops) and its own printed `keywords`
   * (`effectiveKeywords`), and rejects activating any OTHER activated
   * ability it has (`engine.ts`'s `canActivateAbility`, mirroring the
   * existing `isActivationLocked`/`CantBeActivated` check, ENGINE_GAPS.md
   * gap #18) — The Gold Saucer's own real "{3}, {T}, Sacrifice two
   * artifacts: ..." is the one real FIN card this last case actually
   * matters for if it's ever the object Ultima blights. **NOT enforced**:
   * a TRIGGERED ability the affected object has (`Trigger`/`fireTrigger`
   * has no per-object "is this specific trigger currently suppressed" gate
   * anywhere in this codebase). Checked the real pool: every real FIN
   * Town-cycle land's own OTHER ability is a one-shot `onEnter` ETB trigger
   * that has ALREADY fired by the time Ultima (an ATTACK trigger,
   * necessarily well after any target land's own ETB) could ever blight
   * it — not live for any card in this pool today, but a hypothetical
   * future land with a repeatable `'upkeep'`/`'endStep'`/`'tapLandForMana'`
   * trigger would still incorrectly keep firing it while blighted. Building
   * a fully general per-object trigger-suppression dispatcher (every real
   * `fireTrigger` call site would need to consult this check first) was
   * assessed and NOT attempted here — flagged, not quietly worked around.
   */
  removeAllAbilities?: boolean;
  /** Real Forge `AddAbility$ ColorlessMana` (`AB$ Mana | Cost$ T | Produced$ C`) — the ONE mana ability the affected permanent has for as long as the condition holds, replacing (not adding to) whatever it normally produces. */
  grantManaAbility?: ManaAbility;
}

/**
 * One NAMED triggered ability. A permanent commonly has more than one,
 * independent of each other (Namazu Trader's own ETB AND attack trigger) —
 * `CardDefinition.triggers` is a list of these rather than a single
 * `effects` array, so a scenario can pick exactly which one it's exercising
 * (see functional-model/harness.ts's own `Scenario.trigger`).
 */
export interface Trigger {
  /** Short label — 'onEnter'/'onAttack'/'onDealsDamage'/etc. Matches a scenario's own `trigger` field. */
  name: string;
  effects: Effect[];
  /**
   * Real Forge `ActivationLimit$ N` (`Trigger.java`'s own `checkActivationLimit`/
   * `getActivationsThisTurn`, ~lines 362-370/596-598 — checked against
   * `Card.getAbilityActivatedThisTurn`, reset game-wide for every card in the
   * game by `Game.onCleanupPhase` -> `Card.resetActivationsPerTurn`,
   * `Game.java` ~line 1227-1229/`Card.java` ~line 7848): this NAMED trigger
   * fires at most `N` times per turn, game-wide reset at Cleanup — a real,
   * common printed cap ("This ability triggers only once each turn"), not a
   * cost or a static ability. Two real FIN cards print this: G'raha Tia's own
   * "The Allagan Eye" (`res/cardsfolder/g/graha_tia.txt`) and Elrond,
   * Moon-Reader's own "activate an ability of a creature, draw a card"
   * (`res/cardsfolder/e/elrond_moon_reader.txt`), both `ActivationLimit$ 1`.
   * Enforced by `triggers.ts`'s own shared `fireTrigger` chokepoint (every
   * real trigger-firing call site in this codebase already funnels through
   * it, see that file's own header) via `state.ts`'s new
   * `triggerActivationsThisTurn` tracking + `resetTriggerActivationsThisTurn`
   * (called from `turn.ts`'s `runPhaseEntryAction` at Cleanup, same
   * "real, game-wide, once per turn boundary" scope `flippedCoinThisTurn`/
   * `untilEndOfTurnKeywordGrants` already use). Omitted = uncapped (the
   * pre-existing default for every other trigger in this pool).
   */
  activationLimit?: number;
  /**
   * PROTOTYPE (PRD_AUTOMATED_AUTHORING.md, 2026-09-13, scoped trial —
   * fin/1-10 only, not a production field yet). Points at the WHOLE printed
   * trigger-condition + effect clause together (e.g. "When this creature
   * enters, destroy target creature." as ONE span) — deliberately coarser
   * than the per-`Effect` precision `annotations-authoring.json` uses for
   * hand-authored Facts today; this is a co-located, easier-to-maintain
   * authoring surface for a whole ability line, not a replacement for
   * per-fact precision. Same exact `{anchor?, sourceText, highlight}` shape
   * as `FactAnnotationAuthoring` (`synergy.ts`) and resolved by the SAME
   * `computeFactAnnotations`/`rawHighlightRange` logic
   * `compute-annotations.mjs` already runs for the authoring-file path — no
   * new resolution code exists for this field, only a new place to author
   * the input. NOT wired into `apply-recognizers.mjs`'s real Fact-generation
   * pipeline, `synergy.json`, or any recognizer — purely additive, inert
   * data as of this trial.
   */
  annotation?: FactAnnotationAuthoring;
  /**
   * Marks this as a real auto-fired trigger event `engine.ts` fires
   * without a player/scenario having to name it explicitly — real MTG
   * doesn't require choosing to trigger an ETB or an upkeep ability, it
   * just happens:
   *  - `'enter'` (603.6b-ish): the real "enters the battlefield" trigger —
   *    `resolveTop` fires it the moment a permanent resolves onto the
   *    battlefield.
   *  - `'upkeep'`/`'endStep'` (603.6b, "at the beginning of your
   *    upkeep/end step"): fired by `engine.ts`'s own
   *    `fireOnPhaseEnterTriggers`, called after every phase advance, for
   *    the ACTIVE player's own permanents only — the common "your
   *    upkeep/end step" case, not the rarer "each player's"/"each
   *    opponent's" variant (a real, deferred gap — see ENGINE_GAPS.md).
   *    Only fires for a permanent that was CAST through this engine's own
   *    `castSpell` (`resolveTop` registers its ctx/actions at that moment,
   *    `engine.ts`'s own `resolvedPermanents` map) — a permanent seeded
   *    directly onto the battlefield (scenario setup, e.g.) has no
   *    registered ctx/actions and its upkeep/end-step triggers won't fire
   *    through this path, same "no entry = gap, not a silent success"
   *    convention `enteredThisTurn` already uses.
   *  - `'tapLandForMana'` (closed 2026-09-14, ENGINE_GAPS.md gap #5's own
   *    Ultima, Origin of Oblivion closure) — real Forge's own
   *    `TriggerType.TapsForMana` (`TriggerTapsForMana.java`, fired from
   *    `AbilityManaPart.tapsForMana` whenever ANY `{T}`-cost mana ability
   *    resolves): "a land you control was tapped for mana." Fired by
   *    `engine.ts`'s new `fireOnTapLandForManaTriggers`, called right after
   *    EVERY real `mana.ts` `payMana` call (`castSpell`/`activateAbility`,
   *    this engine's only two real "tap sources to pay a cost" call
   *    sites) — for each REAL tapped source that's a genuine Land
   *    (`ValidCard$ Land`, Forge's own real gate; a non-Land mana source
   *    tapping never fires this), sweeps every permanent the SAME
   *    controller has registered in `resolvedPermanents` (`Activator$
   *    You`, Forge's own real gate — no FIN card needs "any player,"
   *    checked) for a trigger with this `on` value, additionally gated by
   *    `tapLandForManaColor` below. Same "only fires for a permanent CAST
   *    through this engine" real, documented limitation `'upkeep'`/
   *    `'endStep'` already carry — a permanent seeded directly onto the
   *    battlefield has no registered entry and its own `'tapLandForMana'`
   *    trigger won't fire through this path.
   * Optional and additive: none of the 312 existing FIN cards' own
   * triggers set any of these yet (picked manually per scenario via
   * `harness.ts`'s own `Scenario.trigger`/`sequence` fields instead,
   * unaffected by this) — retrofitting them is a separate, deferred task
   * (ENGINE_GAPS.md). Real FIN cards that WOULD use `'endStep'` today (Yuna,
   * Hope of Spira; Ultimecia, Time Sorceress) are cited there. Ultima,
   * Origin of Oblivion's own `onTapLandForC` trigger is the first real FIN
   * card retrofitted onto `'tapLandForMana'` (2026-09-14) — see
   * `tapLandForManaColor` below for its own real color gate.
   *  - `'attacks'` (closed 2026-09-14, ENGINE_GAPS.md — attack-triggered-
   *    ability auto-dispatch): real Forge `TriggerType.Attacks`
   *    (`TriggerAttacks.java`'s own `performTest`, checked here against
   *    `ValidCard$ Card.Self` scope only), fired from real Forge's own
   *    `CombatUtil.checkDeclaredAttacker` (forge-game/.../combat/
   *    CombatUtil.java ~lines 363-383 - its own doc comment: "checks
   *    triggered effects of attacking creatures, right before defending
   *    player declares blockers") once per real declared attacker.
   *    Mirrored here as `engine.ts`'s new `fireOnAttackTriggers`, called
   *    from `declareAttackers` right after a legal attacker batch is
   *    declared (508.1) - for each declared attacker with a registered
   *    `resolvedPermanents` entry (same "only a permanent CAST through this
   *    engine" real, documented limitation `'upkeep'`/`'endStep'`/
   *    `'tapLandForMana'` already carry) whose own `CardDefinition` has a
   *    trigger with `on: 'attacks'`, fires it with THAT attacker as
   *    `ctx.self` - real Forge's own `ValidCard$ Card.Self` scope (this
   *    creature's own attack, not "any creature attacking"). A broader
   *    "whenever A creature you control attacks" shape (Seifer Almasy/
   *    Squall's own "attacks alone"), an EQUIPMENT's own "whenever equipped
   *    creature attacks" (Genji Glove/Ultima Weapon), or a Vehicle-crewed-
   *    by-a-specific-pair shape (Balthier and Fran) are real, genuinely
   *    different gates this narrow first slice does not attempt - see
   *    ENGINE_GAPS.md's own writeup for the full list this unblocks as
   *    follow-ups. Ashe, Princess of Dalmasca's own "Whenever Ashe attacks,
   *    ..." is the first real FIN card retrofitted onto this (2026-09-14).
   *  - `'equippedAttacks'` (closed 2026-09-16, ENGINE_GAPS.md — the
   *    "EQUIPMENT's own 'whenever equipped creature attacks'" follow-up
   *    `'attacks'`'s own doc comment above already named as unattempted) —
   *    real Forge `TriggerType.Attacks` again, but checked against
   *    `ValidCard$ Card.EquippedBy` instead of `Card.Self` (Genji Glove's
   *    own real script, `res/cardsfolder/g/genji_glove.txt`: `T:Mode$
   *    Attacks | ValidCard$ Card.EquippedBy | ...`; Ultima Weapon's own
   *    identical shape, `res/cardsfolder/u/ultima_weapon.txt`) — this
   *    permanent's OWN trigger fires when the CREATURE IT'S EQUIPPED TO
   *    attacks, not when this permanent itself does (an Equipment never
   *    attacks). White Mage's Staff/Summoner's Grimoire's own real scripts
   *    (`res/cardsfolder/w/white_mages_staff.txt`/`res/cardsfolder/s/
   *    summoners_grimoire.txt`) reach the identical real behavior a
   *    DIFFERENT real Forge way — a genuine `S:...AddTrigger$...` static
   *    ability that grants a whole `Mode$ Attacks | ValidCard$ Card.Self`
   *    trigger onto the equipped creature (Forge's real "add a triggered
   *    ability to another permanent" mechanism, CR 613.1 "functions as
   *    though printed") — but this engine models both real Forge shapes
   *    with the SAME single mechanism: the trigger stays declared on the
   *    EQUIPMENT's own `CardDefinition` (never literally copied onto the
   *    equipped creature), fired with the EQUIPMENT's own registered
   *    `ctx`/`actions` (`ctx.self` stays the Equipment, exactly like
   *    `'attacks'`'s pre-existing `onEquippedAttacks(FirstCombat)` trigger
   *    bodies on Genji Glove/Ultima Weapon already assume) — an effect that
   *    genuinely needs "the equipped creature itself" (not just "you", the
   *    controller) resolves it live via `ctx.self.getAttachedTo()`, the
   *    SAME resolution Genji Glove's own untap effect already uses. This
   *    also means a `triggerDoublingGrant` with `scope:
   *    'selfAndAttachedEquipment'` (Cloud, Midgar Mercenary's own real
   *    "...an Equipment attached to it triggers, that ability triggers an
   *    additional time") correctly doubles an `'equippedAttacks'` firing
   *    for free — `state.ts`'s own `shouldDoubleTrigger` already keys off
   *    `ctx.self` (the Equipment, the real firing source) via the SAME
   *    `firing.attachedToId === source.id` check that scope already reads,
   *    with NO widening needed there. Mirrored here as `engine.ts`'s
   *    widened `fireOnAttackTriggers`, which now ALSO scans (for every
   *    declared attacker) every OTHER real card whose live `attachedToId`
   *    points at that attacker, for a registered `resolvedPermanents` entry
   *    with an `'equippedAttacks'` trigger. Genji Glove/Ultima Weapon's own
   *    pre-existing `onEquippedAttacks(FirstCombat)` triggers (declared
   *    long before this `on` value existed, previously never auto-fired at
   *    all — only ever exercised by a scenario naming them directly) are
   *    retrofitted onto it in the same pass as White Mage's Staff (the
   *    first real FIN card whose OWN granted-trigger gap this closes) —
   *    see each card's own `definition.ts`/`progress.json` for the full
   *    writeup. Summoner's Grimoire's identical real `AddTrigger$` shape is
   *    NOT retrofitted in this same pass — its own granted EFFECT ("put a
   *    creature card from your hand onto the battlefield...") needs a
   *    wholly separate, unbuilt Effect primitive regardless of this trigger
   *    plumbing, so converting just the trigger half with no real
   *    behavioral effect to attach would be a 100%-no-op migration for zero
   *    closure benefit — see that card's own `progress.json`. Astrologian's
   *    Planisphere/Black Mage's Rod's own granted triggers stay unclosed
   *    too — their real Forge `Mode$ SpellCast`/`Mode$ Drawn` occasions are
   *    a GENUINELY DIFFERENT, much larger, still wholly-unbuilt trigger
   *    family (no `'castNoncreatureSpell'`/`'drawNthCardThisTurn'` `on`
   *    value exists anywhere in this union, for ANY card, granted or
   *    native — 17+ real FIN cards share this same unclosed native trigger
   *    family, several needing real mana-spent-magnitude tracking this
   *    engine doesn't have either, see ENGINE_GAPS.md) — genuinely out of
   *    this narrow pass's scope, not the "grant a trigger to another
   *    permanent" problem this `on` value itself already fully solves.
   */
  on?: 'enter' | 'upkeep' | 'endStep' | 'tapLandForMana' | 'attacks' | 'equippedAttacks';
  /**
   * Only consulted when `on === 'tapLandForMana'` — mirrors Forge's own
   * real `Produced$` gate on `T:Mode$ TapsForMana` (`TriggerTapsForMana
   * .performTest`: `runParams.get(Produced)` must CONTAIN this color,
   * checked against every real color the land tap actually produced, via
   * `mana.ts`'s own `sourceColors`) — Ultima, Origin of Oblivion's own real
   * "Whenever you tap a land for {C}, add an additional {C}" needs
   * `'C'` here (`T:Mode$ TapsForMana | ... | Produced$ C`, real Forge
   * citation: `res/cardsfolder/u/ultima_origin_of_oblivion.txt`). Omitted
   * means "any color" (no real FIN card needs that yet, so this stays
   * required-in-practice rather than speculatively optional-and-untested).
   */
  tapLandForManaColor?: ManaColor;
}

/**
 * A controlled vocabulary of real Forge `K:` keyword names — see
 * `CardDefinition.keywords`'s own doc comment for which of these actually
 * change resolution behavior (today: only `Lifelink`/`Indestructible`) vs.
 * are recognized-but-inert structured facts. Deliberately not exhaustive of
 * every real MTG keyword — extend as a real card needs one not listed here.
 *
 * 2026-09-09: `functional-model/keywords/registry.ts` was expanded from a
 * 15-entry FIN-only subset to the FULL historical MTG keyword taxonomy
 * (369 entries, sourced from Scryfall's own public keyword-abilities/
 * keyword-actions/ability-words catalogs) for the "Keywords" coverage page.
 * That expansion deliberately did NOT bulk-extend this union to match —
 * this stays scoped to "an identifier some real CardDefinition/effect
 * actually uses" (the discipline this doc comment already stated), not
 * "every term the coverage page happens to catalog." `Protection` and
 * `Saga` were added here as real, concrete fixes (both were already
 * referenced by registry.ts's own `keywords` field before this pass,
 * despite not being union members — a real inconsistency, not a design
 * choice); `Saga`'s own set-specific mechanical behavior lives in
 * `saga.ts`/`state.ts`'s lore-counter primitives, not a `grantKeyword`-style
 * flag, but it's included here since a Saga's own `CardDefinition.keywords`
 * can legitimately declare it as a structural fact the same way any other
 * entry here does. Everything else the registry now catalogs (354 new
 * entries) intentionally stays OUTSIDE this union — see registry.ts's own
 * `KeywordEntry.keywords` doc comment for why that field is plain
 * `string[]`, not `Keyword[]`, specifically so this stays decoupled.
 */
export type Keyword =
  | 'Flying'
  | 'Reach'
  | 'Trample'
  | 'Vigilance'
  | 'Haste'
  | 'Lifelink'
  | 'Deathtouch'
  | 'Menace'
  | 'FirstStrike'
  | 'DoubleStrike'
  | 'Defender'
  | 'Hexproof'
  | 'Indestructible'
  | 'Ward'
  | 'Flash'
  | 'Convoke'
  | 'Protection'
  | 'Saga'
  /**
   * Not literally a `K:` line — real Forge represents "target creature
   * can't be blocked this turn" (Shiva, Warden of Ice's own Mesmerize) as a
   * temporary static-ability grant (`Mode$ CantBlockBy`, see
   * vampire_gourmand.txt's own `DBUnblockable`/`Unblockable` SVar pair in
   * the real ../mtg-forge checkout), not a permanent keyword. Approximated
   * here via the SAME `grantKeywordTarget`/`hasKeyword` machinery as a real
   * keyword grant anyway — the read/mutate shape (a name pushed onto
   * `RealCard.keywords`, checkable via `hasKeyword`) is identical, and
   * duplicating a parallel primitive for an outcome this model already
   * tracks would be pure overhead. Same "duration not tracked" caveat as
   * every other `grantKeyword*` use: the grant is permanent within a
   * scenario, not cleared at end of turn.
   */
  | 'Unblockable'
  /**
   * Real CR 614.2 damage-PREVENTION replacement effects (ENGINE_GAPS.md gap
   * #8, closed for a narrow real subset) — not literal `K:` lines (real
   * Forge models both as a per-card `R:Event$ DamageDone | Prevent$ True`
   * static replacement, general `ReplacementEffect`/`ReplacementHandler`
   * machinery this engine deliberately doesn't have), approximated via the
   * SAME `keywords`/`hasKeyword`/`effectiveKeywords` machinery a real
   * keyword grant already uses, same "duplicating a parallel primitive
   * would be pure overhead" reasoning `'Unblockable'` above already
   * establishes — checked at the one real chokepoint, `state.dealDamage`
   * (see that method's own doc comment for the full real-Forge citations
   * and exactly how each is scoped):
   *  - `'DamagePrevention'` — ALL damage (combat or otherwise), to whatever
   *    creature(s) currently carry it. Crystal Fragments/Summon:
   *    Alexander's own "Prevent all damage that would be dealt to
   *    creatures you control this turn" — GRANTED (not printed) by that
   *    Saga's own chapter I/II effects, `kind:'grantKeywordAll'` with
   *    `untilEndOfTurn: true` (real 514.2 Cleanup expiry, reusing the
   *    EXISTING until-end-of-turn keyword-grant machinery, not a new one).
   *  - `'CombatDamagePrevention'` — combat damage (510) ONLY, gated inside
   *    `dealDamage` on its own `opts.combat` flag. Diamond Weapon's own
   *    printed "Immune — Prevent all combat damage that would be dealt to
   *    Diamond Weapon" — a PRINTED (not granted) self-only `keywords` entry,
   *    same shape `'Reach'`/`'Deathtouch'` already are.
   */
  | 'DamagePrevention'
  | 'CombatDamagePrevention'
  /**
   * Real CR 614.2 lifegain-doubling self-replacement (ENGINE_GAPS.md gap
   * #8b, closed) — The Wind Crystal's own "If you would gain life, you gain
   * twice that much life instead" (`res/cardsfolder/t/the_wind_crystal.txt`'s
   * real `R:Event$ GainLife | ReplaceWith$ GainDouble ...
   * SVar:X:ReplaceCount$LifeGained/Twice`). Same "not a literal `K:` line,
   * approximated via the existing keyword-grant machinery" treatment as the
   * two damage-shield entries above — checked at the one real chokepoint,
   * `state.gainLife`, against every one of the AFFECTED PLAYER's own
   * Battlefield permanents (a player-level replacement, not a per-creature
   * one — see that method's own doc comment).
   */
  | 'LifegainDouble'
  /**
   * Real CR-614-style replacement on a random coin-flip OUTCOME
   * (ENGINE_GAPS.md gap #15, closed) — Edgar, King of Figaro's own "Two-
   * Headed Coin — The first time you flip one or more coins each turn,
   * those coins come up heads and you win those flips"
   * (`res/cardsfolder/e/edgar_king_of_figaro.txt`'s real `S:Mode$
   * FlipCoinMod | ValidPlayer$ You | CheckSVar$ Count$YouFlipThisTurn |
   * SVarCompare$ EQ0 | Result$ True`). Same not-a-literal-`K:`-line
   * approximation as the two entries above — checked at the one real
   * chokepoint, `state.flipCoin`, against every one of the FLIPPING
   * PLAYER's own Battlefield permanents (same player-level scope
   * `'LifegainDouble'` uses, not a per-creature one).
   */
  | 'TwoHeadedCoin'
  /**
   * Real CR 614.2 continuous replacement on the UNTAP event itself (ENGINE_GAPS.md,
   * new narrow closure — Sleep Magic's own migration, fin/74) — genuinely
   * different in kind from the existing STUN-counter untap-replacement
   * (`state.untap`'s own counter check, ENGINE_GAPS.md's "Stun and finality
   * counters" section): stun is a ONE-SHOT per-counter consumption (the
   * permanent untaps again once every counter is gone), this is an
   * unconditional, always-on lockdown for as long as the source is still
   * attached — real Forge citation, `res/cardsfolder/s/sleep_magic.txt`:
   * `R:Event$ Untap | ActiveZones$ Battlefield | ValidCard$ Creature.EnchantedBy
   * | ValidStepTurnToController$ You | Layer$ CantHappen` (a genuine 614
   * "the event doesn't happen at all" replacement, not a counter-removal
   * substitution). Same "not a literal `K:` line, approximated via the
   * existing keyword-grant machinery, checked at the one real mutation
   * chokepoint" treatment as `'DamagePrevention'`/`'LifegainDouble'` above —
   * checked in `state.untap` against the untapping card's own
   * `effectiveKeywords`, granted (never printed) via `continuousKeywordGrants`'
   * existing `equippedBySelf` targeting (the SAME real `attachedToId`
   * Equipment-broadcast mechanism an Aura's own attachment uses too — Forge's
   * own `ValidCard$ Creature.EnchantedBy` is the Aura-flavored spelling of the
   * identical "whatever this permanent is currently attached to" relationship
   * `state.ts`'s `qualifiesForContinuousGrant` already generalizes over both
   * Equipment and Auras). **Real, deliberate scope limit, checked before
   * building this**: only ONE real FIN card needs a continuous (non-counter)
   * untap lockdown at all — Stuck in Summoner's Sanctum (fin's own second Aura)
   * has the identical clause but is NOT migrated to this keyword in this pass
   * (out of scope — only Sleep Magic's own migration is in scope here); a
   * general 614 replacement-effect dispatcher (letting an arbitrary event be
   * intercepted/replaced) is still NOT built, same accepted scope cut
   * ENGINE_GAPS.md's gap #8 already documents for damage-prevention shields —
   * this is one more narrow hook at one real mutation chokepoint, not that
   * general mechanism.
   */
  | 'CantUntap';

/**
 * Shared recipient-targeting/timing shape for a continuous, QUERY-TIME
 * grant one permanent broadcasts onto other permanents (613, ENGINE_GAPS.md
 * gap #14) — `continuousKeywordGrants`/`continuousPTGrants`/
 * `continuousTypeGrants` below each pair this SAME targeting logic with a
 * different payload (a keyword list / a fixed P/T delta / a subtype list).
 * Factored out once a THIRD payload shape needed the identical resolution
 * rules, rather than tripling the same four fields' own doc comments across
 * three independently-invented targeting schemes — `state.ts`'s own
 * `qualifiesForContinuousGrant` is the one real, shared read-time
 * implementation all three consult (see that function's own doc comment).
 */
interface ContinuousGrantTargeting {
  /** Whether the granting permanent itself is also a recipient (Dion's own "Dion AND other Knights" — true; Ardyn's own "Demons you control," Ardyn himself isn't a Demon — false). */
  includeSelf: boolean;
  /** Real subtype filter for OTHER permanents you control this ALSO applies to (Dion's own 'Knight', Ardyn's own 'Demon') — omit for a self-only grant. */
  subtype?: string;
  /** Real 508/CR "during your turn" gating (`state.ts`'s own `activePlayerId`, kept in sync by `engine.ts`'s `advance()`) — omit for an unconditional, always-on grant (Ardyn's own). */
  onlyDuringYourTurn?: boolean;
  /** Real Equipment-broadcast shape (2026-09-12, Dragoon's Lance's own "During your turn, equipped creature has flying," generalized the same day to the P/T- and type-grant payloads too) — the recipient is whatever real, LIVE creature THIS permanent is currently attached to (`RealCard.attachedToId`, already tracked by `state.equip`/`getEquippedBy`), re-checked fresh on every read same as every other condition here — the grant genuinely moves with the Equipment if it's later re-equipped, and turns off if unattached. Mutually exclusive with `subtype` in every real card checked so far (an Equipment's own broadcast targets its equipped creature, not a controller-wide subtype), but not enforced as exclusive — a future card could plausibly want both. */
  equippedBySelf?: boolean;
}

/**
 * A real "Panharmonicon effect" static grant (ENGINE_GAPS.md gap #13) — see
 * `CardDefinition.triggerDoubling`'s own doc comment for the full writeup,
 * the real Forge citation, and the 3 real FIN cards needing this. `scope`
 * picks WHO a doubled trigger can belong to; `causedBy`/`entersMatch`
 * (mutually relevant only when `causedBy: 'entersBattlefield'`) restrict
 * WHICH real cause of the trigger firing actually qualifies — omit
 * `causedBy` for a gate with no such restriction (Cloud's own shape).
 */
export interface TriggerDoublingGrant {
  scope: 'selfAndAttachedEquipment' | 'equippedSelf' | 'anyPermanentYouControl';
  causedBy?: 'dying' | 'entersBattlefield';
  /** OR list — any one match qualifies (Traveling Chocobo's own "a land OR Bird," `[{isLand:true},{subtype:'Bird'}]`). Only consulted when `causedBy === 'entersBattlefield'`. */
  entersMatch?: { isLand?: boolean; subtype?: string }[];
  /**
   * PROTOTYPE (PRD_AUTOMATED_AUTHORING.md, 2026-09-13, scoped trial —
   * fin/1-10 only). Same `Trigger.annotation`/`effectsAnnotation` shape/
   * semantics, applied to this static "Panharmonicon effect" grant — its own
   * real, standalone printed static-ability sentence (Cloud, Midgar
   * Mercenary's own "As long as Cloud is equipped, if a triggered ability of
   * Cloud or an Equipment attached to it triggers, that ability triggers an
   * additional time." — see that card's own `definition.ts`), separate from
   * whatever `triggers`/`effects` it doubles. Same "purely additive, inert
   * data" scope as every other field in this prototype.
   */
  annotation?: FactAnnotationAuthoring;
}

/**
 * FDN authoring-pipeline-only (2026-09-18) — see `.claude/contracts/
 * card-schema.md`'s "FDN `missingSchemaFunctionality` +
 * `coverageJustification`" section for the full authoring rationale and
 * `functional-model/scripts/validate-card-definition.mjs` for the gate that
 * consumes this. Purely additive/optional — FIN never populates this field
 * (its own ~98 real `staticAbilities` uses are untouched and unaffected by
 * this addition).
 *
 * The ONE sanctioned, structured replacement for what this pipeline's own
 * recent fixes had been doing informally with bare `staticAbilities` free
 * text as a capacity-gap marker (real cards this closed: Inspiring
 * Paladin's second ability, Arahbo's under-scoped ETB trigger, Sire of
 * Seven Deaths'/Zul'Ashur's non-default Ward cost, ...) — an author
 * declares a real, printed clause the schema/engine genuinely can't
 * express via two required, separately-meaningful halves instead of one
 * unstructured string: WHAT the gap is, and WHAT is being asked for to
 * close it. `validate-card-definition.mjs`'s own FDN gate now treats any
 * non-empty array here (still passing every other structural check) as
 * `purple` ("blocked, needs more info from the engine") — never `blue`.
 */
export interface MissingSchemaFunctionality {
  /** The exact real oracle-text clause (or the specific sub-clause/cost
   * parameter) this schema cannot express — quoted verbatim off the real
   * printed card, same discipline every migrated gap-marker string in this
   * pool already followed as free text. */
  readonly clause: string;
  /** The specific capability/schema addition being requested to close this
   * gap, concrete enough for the `engine` agent to act on directly — e.g.
   * "`Keyword` needs a cost-payload field for a non-default Ward cost,"
   * never a bare restatement of `clause` like "make Ward work." */
  readonly demand: string;
}

/**
 * FDN authoring-pipeline-only (2026-09-18) — the per-card, per-clause
 * coverage-justification manifest the redefined `purple`/`blue` gate bar
 * now requires (see `.claude/contracts/card-schema.md`'s new section, and
 * `functional-model/pipeline-status.ts`'s own header for the redefined
 * status semantics). One entry per real, distinct printed clause — a
 * clause with two genuinely independent parts (Ward's own keyword half and
 * its own non-default cost half, e.g.) gets two entries, not one merged
 * blob, so a manifest's own entry COUNT stays a meaningful, if informal,
 * proxy for "did the author actually walk the whole card" rather than one
 * paragraph covering everything at once.
 *
 * Deliberately NOT automatically verified for semantic correctness — the
 * `engine` agent's own prior investigation (see `.claude/agent-memory/
 * engine/topics/fdn-static-abilities-gate-rule.md`) already established
 * that a fully general oracle-text-vs-definition match isn't gate-feasible.
 * This manifest's real value is forcing the reasoning to be WRITTEN DOWN at
 * authoring time and making it inspectable by a human or a smart-tier model
 * later — never a computed correctness guarantee. The gate DOES mechanically
 * check the parts that don't require judgment: the manifest is real/
 * non-empty, every entry has real non-empty `clause`/`reasoning` text, and
 * every `coveredBy` pointer actually resolves to something real on this
 * SAME `CardDefinition` (a named trigger that exists, a
 * `missingSchemaFunctionality` index in range, ...) — see
 * `validateCoverageJustification` in `validate-card-definition.mjs`.
 */
export interface CoverageJustificationEntry {
  /** The exact real oracle-text clause (or sentence/modal-bullet) this
   * entry accounts for — quoted verbatim, same discipline as
   * `MissingSchemaFunctionality.clause`. */
  readonly clause: string;
  /** What in THIS `CardDefinition` covers `clause` — see `CoverageReference`. */
  readonly coveredBy: CoverageReference;
  /** The author's own written reasoning connecting `clause` to `coveredBy`
   * — the user's own phrasing, "this text is covered by this code in
   * definition." Real prose required: never a bare restatement of `clause`
   * or a copy of `coveredBy`. */
  readonly reasoning: string;
}

/**
 * Closed vocabulary for what a `CoverageJustificationEntry` can point
 * at — grows on demand, same "closed union, extend only when a real card
 * needs it" discipline `Keyword`/`Trigger.on` already follow elsewhere in
 * this file. `name`/`field`/`index` are bare STRUCTURAL identifiers (a
 * lookup key into this same `CardDefinition`'s own real arrays/fields),
 * never free-form judgment text — the one thing this union deliberately
 * does NOT allow is a bare descriptive string standing in for "trust me,
 * it's covered," which is exactly the looseness this whole mechanism
 * exists to close off.
 */
export type CoverageReference =
  | { readonly kind: 'keyword'; readonly keyword: Keyword }
  | { readonly kind: 'trigger'; readonly name: string }
  | { readonly kind: 'ability'; readonly name: string }
  | { readonly kind: 'effect'; readonly effectKind: Effect['kind'] }
  | { readonly kind: 'field'; readonly field: CoverageFieldName }
  | { readonly kind: 'missingSchemaFunctionality'; readonly index: number }
  /** Legitimate only for a FIN card, in principle — the FDN gate hard-fails
   * on ANY `staticAbilities` usage at all (see that field's own doc comment
   * below), so this pointer kind can never actually resolve for a real FDN
   * card as things stand; kept in the union for schema generality only. */
  | { readonly kind: 'staticAbilities'; readonly index: number };

/**
 * Any other structured `CardDefinition` field a clause can be covered by,
 * beyond the dedicated `keyword`/`trigger`/`ability`/`effect` pointer kinds
 * above (which each already carry their own real lookup key) — a field
 * like `ptFormula`/`continuousPTGrants`/`costReduction` conveys its own
 * coverage by mere PRESENCE on the card, with no finer sub-key needed.
 * Grows on demand, same discipline as `CoverageReference` itself.
 */
export type CoverageFieldName =
  | 'pt'
  | 'cmc'
  | 'alternateCosts'
  | 'costReduction'
  | 'spellCostReductionGrants'
  | 'millModifierGrants'
  | 'activationCost'
  | 'crewCost'
  | 'manaAbilities'
  | 'ptFormula'
  | 'continuousKeywordGrants'
  | 'continuousPTGrants'
  | 'continuousTypeGrants'
  | 'activatedAbilityLock'
  | 'triggerDoubling'
  | 'typeLine'
  | 'manaCost'
  | 'name';

/**
 * Every card definition is a plain object of this shape — a data RECORD,
 * not an instance of a per-card class (see this file's own header for why:
 * Forge itself has exactly one `Card` class for every printed card, never a
 * subclass per name). `functional-model/cards/the-final-days/definition.ts`
 * exports a `const theFinalDays: CardDefinition = { ... }` object literal,
 * the direct TS analogue of a `.txt` script `CardFactory` would parse into
 * one generic `Card` plus its `SpellAbility` list.
 */
export interface CardDefinition {
  readonly name: string;
  readonly manaCost: string;
  readonly typeLine: string;
  /**
   * Real printed base power/toughness (a Creature/Vehicle's own `PT:` line)
   * — omit for a non-creature, OR for a creature whose power/toughness is
   * itself "*" and fully covered by `ptFormula` (Snow Villiers' own real
   * printed "*&#47;3": power is "*"/omit-equivalent since `ptFormula` sets
   * it, but toughness is a real fixed 3, so `pt: [0, 3]` still carries that
   * half). Without this, `state.ts`'s own `addCard` silently defaults every
   * creature to a fake 1/1 — a real, previously-unnoticed gap this field
   * closes (found while building Snow Villiers' own CDA: its real "*&#47;3"
   * print means only POWER is dynamic, toughness stays a real printed 3 —
   * which exposed that no card anywhere was tracking real base P/T at all).
   */
  readonly pt?: [power: number, toughness: number];
  /** Real mana value (`Card.getCMC()`, see interfaces.ts's own citation) — omit unless a real card's own effect reads its OWN cmc (nothing yet needs another card's, e.g. a revealed library card's — see state.ts's own `RealCard.cmc` doc comment). */
  readonly cmc?: number;
  /** Omit for a card with only its normal hand-cast mode. */
  readonly alternateCosts?: AlternateCost[];
  /** Real CR 601.2f cost-reduction keyed on this spell's OWN chosen target — see `CostReduction`'s own doc comment for the real Forge citation, scope, and what's deliberately NOT covered (broadcast/color-gated discounts, activated-ability cost reductions). Omit for a card with no such clause. */
  readonly costReduction?: CostReduction;
  /** Real CR 601.2f cost-reduction this permanent BROADCASTS onto OTHER spells its controller casts (The Wind Crystal's own real shape) — see `SpellCostReductionGrant`'s own doc comment. Omit for a card with no such static ability. */
  readonly spellCostReductionGrants?: SpellCostReductionGrant[];
  /** Real CR 614.2 mill-event replacement this permanent BROADCASTS onto every opponent's own mill event (The Water Crystal's own real shape, ENGINE_GAPS.md gap #19, closed) — see `MillModifierGrant`'s own doc comment. Omit for a card with no such static ability. */
  readonly millModifierGrants?: MillModifierGrant[];
  /**
   * Present only for an activated ability (Warren Elder's own "{3}{W}:
   * Creatures you control get +1/+1 until end of turn") — `effects` then
   * means "what happens when this is activated," not "what happens when
   * cast."
   */
  readonly activationCost?: string;
  /**
   * TWO OR MORE independent activated abilities on the same permanent
   * (Qiqirn Merchant's own pair of unrelated {T} abilities) — the common
   * single-ability case still just uses `activationCost`+`effects` above
   * unchanged; only reach for this when a card genuinely has more than one.
   * Selected the same way `triggers` is (by name — see `Scenario.ability`,
   * functional-model/harness.ts), not by array position.
   */
  readonly abilities?: {
    name: string;
    cost: string;
    effects: Effect[];
    costReduction?: ActivationCostReduction;
    /** PROTOTYPE — see `Trigger.annotation`'s own doc comment (identical shape/semantics, applied to a named activated ability instead of a triggered one). */
    annotation?: FactAnnotationAuthoring;
  }[];
  /** A Vehicle's own real "Crew N" cost (Phantom Train has none printed — its own ability is a sacrifice-cost activated ability instead — but the field exists for the general case). Distinct from `activationCost`: crewing doesn't pay mana, it taps creatures with total power >= N. */
  readonly crewCost?: number;
  /**
   * The single resolution's own effects — an Instant/Sorcery's cast
   * effect, or an activated ability's effect (paired with
   * `activationCost`). Optional because a permanent whose ONLY behavior is
   * one or more named triggers (see `triggers` below) has nothing to put
   * here — Namazu Trader's `effects` would be empty; its real behavior
   * lives entirely in `triggers`.
   */
  readonly effects?: Effect[];
  /**
   * PROTOTYPE (PRD_AUTOMATED_AUTHORING.md, 2026-09-13, scoped trial —
   * fin/1-10 only) — see `Trigger.annotation`'s own doc comment for the
   * shape/semantics; applied here to the top-level `effects` above (an
   * Instant/Sorcery's cast effect, OR a single activated ability's effect
   * when paired with `activationCost` — whichever meaning `effects` has for
   * this card). Named `effectsAnnotation` (not bare `annotation`) to avoid
   * reading as "annotates the whole card" at this top level.
   */
  readonly effectsAnnotation?: FactAnnotationAuthoring;
  /** Zero or more independent named triggered abilities — see `Trigger` above. */
  readonly triggers?: Trigger[];
  /**
   * Real Forge `K:` lines — a CONTROLLED, executable vocabulary (as opposed
   * to `staticAbilities`' freeform text below), Forge's own real K:/S: split
   * (see e.g. `adelbert_steiner.txt`'s own `K:Lifelink` vs. its separate
   * `S:Mode$ Continuous ...` line). Recognized here doesn't mean
   * MECHANICALLY ENFORCED everywhere real MTG would enforce it — `Lifelink`/
   * `Deathtouch` (`state.dealDamage`), `Indestructible` (`state.destroy`),
   * and (2026-09-12, ENGINE_GAPS.md gaps #8/#8b/#15) `DamagePrevention`/
   * `CombatDamagePrevention` (`state.dealDamage`), `LifegainDouble`
   * (`state.gainLife`), and `TwoHeadedCoin` (`state.flipCoin`) all actually
   * change resolution behavior today — still real, structured facts (not
   * text) even when inert for a keyword this engine doesn't yet enforce,
   * which is strictly better for synergy detection than the old
   * undifferentiated `staticAbilities: string[]` blob these used to live in.
   */
  readonly keywords?: Keyword[];
  /**
   * A real layer-7a characteristic-defining P/T ability (613.3a) —
   * recalculated LIVE from current board state on every read (see
   * `state.ts`'s own `effectivePT`), never a fixed/timestamped delta. Two
   * concrete real Forge shapes built so far:
   *  - `addPerEquipmentControlled` — Forge's own `AddPower$/AddToughness$`
   *    (Adelbert Steiner's "gets +X/+X for each Equipment you control").
   *  - `setToCreaturesControlled` — Forge's own `SetPower$ X` (POWER ONLY —
   *    Snow Villiers' own real printed "*&#47;3": only power is dynamic,
   *    toughness is a real fixed printed 3, carried via `pt` instead). A genuinely
   *    different Forge mechanism than the ADD shape above (SET, not ADD),
   *    still layer 7a as long as the ability is printed on the card itself
   *    and doesn't reference other effects (613.4b). A card whose real
   *    script also has `SetToughness$` would need its own, differently-
   *    named variant — not assumed for free just because this one exists.
   * Anything else (a conditional CDA, a formula over a different
   * subtype/count) stays `staticAbilities` text until a real card needs it.
   */
  readonly ptFormula?:
    | {
        kind: 'addPerEquipmentControlled';
        power: number;
        toughness: number;
        /**
         * PROTOTYPE (PRD_AUTOMATED_AUTHORING.md, 2026-09-13, scoped trial —
         * fin/1-10 only). Same `Trigger.annotation`/`effectsAnnotation`
         * shape/semantics, applied to a layer-7a CDA printed as its own
         * standalone static-ability line (Adelbert Steiner's own real
         * "Adelbert Steiner gets +1/+1 for each Equipment you control." —
         * see that card's own `definition.ts`) rather than a
         * trigger/activated-ability/cast-effect clause. Same "purely
         * additive, inert data, not wired into `apply-recognizers.mjs`/
         * `synergy.json`/any recognizer" scope as every other field in this
         * prototype.
         */
        annotation?: FactAnnotationAuthoring;
      }
    | { kind: 'setToCreaturesControlled'; annotation?: FactAnnotationAuthoring }
    | {
        /**
         * A real, self-only, THRESHOLD-gated layer-7a CDA (closed
         * 2026-09-15, fin/16-25 pass, ENGINE_GAPS.md's own "Gaelicat's/
         * Magitek Infantry's own threshold-CDA gaps" note) — real Forge
         * `S:Mode$ Continuous | Affected$ Card.Self | AddPower$ N |
         * IsPresent$ <Type>[.Other]+YouCtrl | PresentCompare$ GE<min>`
         * (`gaelicat.txt`: `IsPresent$ Artifact.YouCtrl | PresentCompare$
         * GE2 | AddPower$ 2` — "As long as you control two or more
         * artifacts, this creature gets +2/+0"; `magitek_infantry.txt`:
         * `IsPresent$ Artifact.Other+YouCtrl | AddPower$ 1` — implicit
         * `PresentCompare$ GE1` — "This creature gets +1/+0 as long as you
         * control another artifact"). Genuinely different from
         * `addPerEquipmentControlled` above (a fixed on/off bonus once a
         * COUNT THRESHOLD is met, not a per-unit-scaled amount) and from
         * `continuousPTGrants` below (that field's own recipient is a
         * BROADCAST target — equipped creature/subtype/etc — this one only
         * ever affects the card printing the ability itself, real Forge's
         * own `Affected$ Card.Self`). `state.ts`'s `effectivePT` is the
         * real read path; `excludeSelf` mirrors `magitek_infantry.txt`'s own
         * `.Other+` qualifier (Magitek Infantry is itself an Artifact and
         * must not count toward its own threshold; Gaelicat is not an
         * Artifact at all, so `excludeSelf` is moot for it either way, kept
         * `false` for honesty about what the real script says).
         */
        kind: 'thresholdBonus';
        power: number;
        toughness: number;
        condition: { type: string; min: number; excludeSelf?: boolean };
        annotation?: FactAnnotationAuthoring;
      }
    | {
        /**
         * A real, self-only, GRAVEYARD-counted ADD-scaling layer-7a CDA
         * (closed 2026-09-16, static-ability audit) — real Forge
         * `Count$Valid Card.YouOwn+nonCreature+nonLand/GraveyardOnly`
         * (Xande, Dark Mage's own real "gets +1/+1 for each noncreature,
         * nonland card in your graveyard"). Same ADD-scaling shape as
         * `addPerEquipmentControlled` above, counting the controller's own
         * GRAVEYARD (filtered to noncreature, nonland) instead of their
         * battlefield Equipment count — `state.ts`'s `effectivePT` is the
         * real read path. The noncreature/nonland filter is fixed (no real
         * pool card needs a different graveyard filter for this ADD shape
         * yet); a future card needing a different filter needs its own
         * variant, not a silent stretch of this one.
         */
        kind: 'addPerGraveyardCount';
        power: number;
        toughness: number;
        annotation?: FactAnnotationAuthoring;
      }
    | {
        /**
         * A real, self-only, GRAVEYARD-counted SET layer-7a CDA (POWER
         * only, same "toughness stays whatever `pt` already says" scoping
         * `setToCreaturesControlled` establishes) — closed 2026-09-16,
         * static-ability audit. Real Forge `SetPower$ X | SVar:X:
         * Count$Valid Card.YouOwn+IsPermanentCard/GraveyardOnly` (Neo
         * Exdeath, Dimension's End's own real "Neo Exdeath's power is
         * equal to the number of permanent cards in your graveyard") —
         * "permanent card" means Creature/Artifact/Enchantment/Land (same
         * real filter this same card's own front face `onEndStep` transform
         * condition already uses, kept identical for consistency — neither
         * checks Planeswalker; a real, shared, narrow scope, not a new gap
         * introduced by this variant).
         */
        kind: 'setToGraveyardPermanentCount';
        annotation?: FactAnnotationAuthoring;
      }
    | {
        /**
         * A real, self-only, BATTLEFIELD-LAND-counted ADD-scaling layer-7a
         * CDA (closed 2026-09-16, static-ability audit) — real Forge
         * `Count$Valid Land.YouCtrl` (Zell Dincht's own real "gets +1/+0
         * for each land you control"). Same ADD-scaling shape as
         * `addPerEquipmentControlled` above, counting the controller's own
         * battlefield LANDS instead of Equipment.
         */
        kind: 'addPerLandControlled';
        power: number;
        toughness: number;
        annotation?: FactAnnotationAuthoring;
      };
  /**
   * A real, QUERY-TIME continuous keyword grant (613, ENGINE_GAPS.md gap
   * #14, closed 2026-09-12) — "Dion and other Knights you control have
   * flying" (Dion, Bahamut's Dominant's own "Dragonfire Dive," turn-
   * conditional), "Demons you control have menace, lifelink, and haste"
   * (Ardyn, the Usurper, unconditional). Same "recalculated live from
   * current board state on every read, never a fixed/timestamped delta"
   * treatment `ptFormula`/`state.ts`'s own `effectivePT` already establish
   * for a layer-7a CDA — `state.ts`'s own `effectiveKeywords` is this
   * field's read-time counterpart, consulted by `hasKeyword` (and every
   * OTHER real place this engine checks a keyword — combat/sickness/
   * Deathtouch/Lifelink — not a decorative, UI-only label). Copied onto
   * the real `RealCard` at `addCard` time (`RealCard.continuousKeyword
   * Grants`), same as `ptFormula`. No duration tracking beyond the
   * `onlyDuringYourTurn` condition itself (real per-object timestamped
   * layers, 613.6, are still out of scope — see `layers.ts`'s own header)
   * — this is a narrow, real mechanism for exactly this shape ("if
   * <condition>, <permanents matching filter> have <keyword>", not a
   * general replacement/continuous-effect engine. `subtype`-matched
   * recipients are always scoped to the SAME controller as the granting
   * permanent (both real cards' own text: "... you control") — no
   * cross-controller grant shape exists yet, not needed until a real card
   * forces it.
   */
  readonly continuousKeywordGrants?: (ContinuousGrantTargeting & { keywords: Keyword[] })[];
  /**
   * Real, QUERY-TIME continuous P/T grant (613.3, layer 7c) — the FIXED-
   * DELTA sibling of `continuousKeywordGrants` above, same real machinery
   * generalized (ENGINE_GAPS.md gap #14's own "That same card's OTHER
   * static clause" follow-up, closed 2026-09-12): "Equipped creature gets
   * +1/+0" (Dragoon's Lance), "+2/+1" (Paladin's Arms), "+1/+1" (Crystal
   * Fragments, White Mage's Staff), "+1/+0" (Sage's Nouliths) — all real
   * Forge `Mode$ Continuous | Affected$ Creature.EquippedBy | AddPower$ N
   * | AddToughness$ N` static abilities (`StaticAbilityContinuous.java`
   * ~line 143-166 parses `AddPower`/`AddToughness`, ~line 679-702
   * `addPTBoost` applies them at `StaticAbilityLayer.SETPT`/
   * `CHARACTERISTIC`, i.e. this engine's own simplified layer 7 — see
   * `dragoons_lance.txt`/`paladins_arms.txt`/`crystal_fragments_summon_
   * alexander.txt`/`white_mages_staff.txt`/`sages_nouliths.txt` in
   * `../mtg-forge`'s own cardsfolder). Same "recalculated live on every
   * read, never a fixed/timestamped `layers.ts` delta" treatment as
   * `continuousKeywordGrants` (`state.ts`'s own `effectivePT` is this
   * field's read-time counterpart, folded in alongside the existing
   * layer-7a CDA/counters, same additive-total reasoning). Deliberately
   * ONLY a fixed `power`/`toughness` NUMBER, not a `Computed`-style
   * amount — Machinist's Arsenal's own real "+2/+2 for each artifact you
   * control" is a genuinely VARIABLE, board-state-scaled bonus (Forge's
   * own `SVar:X:Count$Valid Artifact.YouCtrl/Times.2` on the identical
   * `AddPower$ X | AddToughness$ X` static ability), a real, separate,
   * still-open gap (same class as `ptFormula`'s own "anything else stays
   * `staticAbilities` text" scope, and Gaelicat's/Magitek Infantry's own
   * threshold-CDA gaps) — NOT modeled by this field, kept as
   * `staticAbilities` text on that one card only.
   *
   * **CLOSED 2026-09-15 (fin/16-25 pass)** — the paragraph above described
   * a real gap that's now fixed: a grant entry may ALSO carry
   * `scalePerType` instead of a fixed `power`/`toughness`, the real
   * `SVar:X:Count$Valid <Type>.YouCtrl/Times.N` shape Machinist's Arsenal's
   * own "+2/+2 for each artifact you control" needs (same `Count$Valid...
   * YouCtrl` scaling mechanism `ptFormula.kind:'addPerEquipmentControlled'`
   * already uses for a SELF-only CDA — this is that identical real Forge
   * mechanism, just applied to a BROADCAST grant's own recipient instead of
   * the granting permanent itself). `state.ts`'s `effectivePT` reads
   * `scalePerType` the same live, query-time way it already reads a fixed
   * `power`/`toughness` pair — recalculated fresh every read, counting the
   * GRANTING permanent's own controller's battlefield (real Forge
   * `YouCtrl` — "you" is whoever controls the ability, i.e. the Equipment,
   * not necessarily the equipped creature's controller, though in every
   * real pool case today they're the same player).
   *
   * **`scalePerSelfCounter`, closed 2026-09-16 (static-ability audit)** —
   * the same real ADD-scaling mechanism as `scalePerType` just above, but
   * counting a COUNTER on the GRANTING permanent itself instead of a
   * creature type its controller controls (real Forge
   * `SVar:X:Count$CardCounters.<TYPE>` on an `AddPower$ X | AddToughness$
   * X` static, rather than `Count$Valid <Type>.YouCtrl`) — Excalibur II's
   * own real "Equipped creature gets +1/+1 for each charge counter on
   * Excalibur II." Still layer 7c, still summed alongside a fixed
   * `power`/`toughness` or `scalePerType` entry on a DIFFERENT grant on the
   * same card; `state.ts`'s `effectivePT` reads `source.counters` directly
   * (no board-wide sweep needed, unlike `scalePerType`).
   */
  readonly continuousPTGrants?: (ContinuousGrantTargeting &
    ({ power: number; toughness: number } | { scalePerType: { type: string; power: number; toughness: number } } | { scalePerSelfCounter: { counterType: string; power: number; toughness: number } }))[];
  /**
   * Real, QUERY-TIME continuous TYPE grant (613.3, layer 4) — the creature-
   * SUBTYPE sibling of `continuousKeywordGrants`/`continuousPTGrants`
   * above, same real machinery generalized again (closed 2026-09-12):
   * "is a Knight/Cleric/Artificer/Wizard in addition to its other types"
   * (Dragoon's Lance/White Mage's Staff/Sage's Nouliths, Machinist's
   * Arsenal, Astrologian's Planisphere — real Forge `AddType$ Knight` etc.
   * on the SAME `Mode$ Continuous | Affected$ Creature.EquippedBy` static
   * ability the P/T bonus above lives on, `StaticAbilityContinuous.java`
   * ~line 371-426/866-867 `addChangedCardTypes` at layer TYPE — this
   * engine's own simplified layer 4, `layers.ts`'s own `computeTypes`
   * scope, though this field is a CROSS-object broadcast grant, not a
   * per-object `layers.ts` timestamped effect, so it's read via `state.ts`'s
   * new `effectiveSubtypes` instead, not `LayerSet`). Adds to `subtypes`
   * (a creature type, e.g. `'Knight'`), not `types` (Land/Creature/
   * Artifact/Enchantment) — every real FIN card needing this grants a
   * CREATURE TYPE, never a card supertype/type; a hypothetical future
   * card broadcasting a full card TYPE (as opposed to Magitek Armor's own
   * SELF-only `animate`-based type change) would need its own, differently-
   * scoped field, not assumed for free from this one. `types` is an array
   * (mirroring `keywords` above) even though every real card here only
   * ever grants exactly one.
   */
  readonly continuousTypeGrants?: (ContinuousGrantTargeting & { types: string[] })[];
  /**
   * Real, QUERY-TIME activated-ability LOCK (613/602.1, ENGINE_GAPS.md gap
   * #18, closed 2026-09-12) — a static effect that makes some OTHER
   * permanent's OWN activated abilities unactivatable, not a restriction on
   * the granting permanent's own abilities (that's the ordinary,
   * already-real case of just never declaring an `activationCost` at all).
   * Real Forge citation, Stuck in Summoner's Sanctum's own second static
   * ability (`res/cardsfolder/s/stuck_in_summoners_sanctum.txt`): `S:Mode$
   * CantBeActivated | ValidCard$ Permanent.EnchantedBy | Secondary$ True |
   * Description$ Enchanted permanent doesn't untap during its controller's
   * untap step and its activated abilities can't be activated.` — a genuine
   * `StaticAbilityMode.CantBeActivated` static ability
   * (`StaticAbilityMode.java` line 22), checked LIVE at
   * `AbilityActivated.checkRestrictions` time (forge-game/.../spellability/
   * AbilityActivated.java line 109, `!StaticAbilityCantBeCast.
   * cantBeActivatedAbility(...)`) by sweeping EVERY card with static
   * abilities on the battlefield and testing `stAb.matchesValidParam
   * ("ValidCard", card)` (`StaticAbilityCantBeCast.java` lines 55-71/156-160)
   * — genuinely query-time, not a fixed delta computed once and cached, the
   * same shape `continuousKeywordGrants`'s own live `effectiveKeywords`
   * sweep already established for a keyword grant. Reuses the SAME
   * `ContinuousGrantTargeting` recipient-resolution shape (no extra payload
   * needed beyond "is this permanent currently a qualifying recipient at
   * all" — presence in this array already means "locked") — Stuck in
   * Summoner's Sanctum's own real shape is `{ includeSelf: false,
   * equippedBySelf: true }` (Forge's `Permanent.EnchantedBy` is the
   * Aura-flavored spelling of the identical "whatever this permanent is
   * currently attached to" relationship `equippedBySelf`'s own doc comment
   * already generalizes over both Equipment and Auras — `state.ts`'s
   * `qualifiesForContinuousGrant` doesn't care which kind of attachment
   * produced the `attachedToId` link). `state.ts`'s new
   * `isActivationLocked` is this field's read-time counterpart, consulted by
   * `engine.ts`'s `canActivateAbility` — a permanent currently qualifying
   * for ANY entry in ANY battlefield permanent's own `activatedAbilityLock`
   * array can't have its own activated ability activated at all (a whole-
   * permanent lock, not a per-named-ability one — no real FIN card needs a
   * narrower per-ability lock). Checked against the real pool: only Stuck in
   * Summoner's Sanctum (fin/76) needs this (grepped every
   * "activated abilities can't be activated"-shaped oracle-text clause
   * across `data/fin/fin_scryfall.json` — exactly one hit). The "doesn't
   * untap" HALF of this same card's clause stays a real, separate, still-OPEN
   * gap (`state.ts`'s `untap()` only special-cases the STUN-counter
   * replacement, no general per-object "can't untap" lock) — not touched by
   * this field, not regressed either.
   */
  readonly activatedAbilityLock?: ContinuousGrantTargeting[];
  /**
   * Real "Panharmonicon effect" — a static ability making some OTHER
   * triggered ability trigger an ADDITIONAL time under a real, checkable
   * gate (ENGINE_GAPS.md gap #13, closed 2026-09-12). Real Forge citation
   * for the general shape: `S:Mode$ Panharmonicon`
   * (`res/cardsfolder/c/cloud_midgar_mercenary.txt`, the real shipped card
   * script — a source checkout wasn't available for this exact file, this
   * is the real shipped script, grepped directly) — Forge itself names this
   * mode after the card that originated the effect and treats it as a
   * general, opt-in condition any card's own script can declare (gated by
   * `ValidCard$`), not a one-off. Checked against the real pool: exactly 3
   * FIN cards need this, each with a genuinely different gate:
   *  - Cloud, Midgar Mercenary: "As long as Cloud is equipped, if a
   *    triggered ability of Cloud or an Equipment attached to it triggers,
   *    that ability triggers an additional time." — `{ scope:
   *    'selfAndAttachedEquipment' }`, no `causedBy` restriction at all (ANY
   *    triggered ability doubles, as long as the precondition — genuinely
   *    equipped right now — holds).
   *  - The Masamune: "Equipped creature has 'If a creature dying causes a
   *    triggered ability of this creature or an emblem you own to trigger,
   *    that ability triggers an additional time.'" — `{ scope:
   *    'equippedSelf', causedBy: 'dying' }`, granted via Equip onto whatever
   *    creature it's attached to (same real `equippedBySelf`-style
   *    recipient resolution `continuousKeywordGrants` already established
   *    for an Equipment-broadcast grant). The "...or an emblem you own"
   *    half is real printed text but genuinely unmodelable — no emblem
   *    mechanism exists anywhere in this engine — so it can never actually
   *    match; a real, accepted, permanent sub-gap, not silently dropped.
   *  - Traveling Chocobo: "If a land or Bird you control entering the
   *    battlefield causes a triggered ability of a permanent you control to
   *    trigger, that ability triggers an additional time." — `{ scope:
   *    'anyPermanentYouControl', causedBy: 'entersBattlefield', entersMatch:
   *    [{isLand:true}, {subtype:'Bird'}] }` — applies to ANY permanent the
   *    controller owns, not just self.
   * `state.ts`'s own `shouldDoubleTrigger` is the one real, shared
   * QUERY-TIME check (same "recalculated on read, never a fixed/timestamped
   * delta" treatment `continuousKeywordGrants`/`effectiveKeywords` already
   * establish) — consulted by the new shared `triggers.ts`'s own
   * `fireTrigger`, which every real trigger-firing call site in this
   * codebase (`stack.ts`, `engine.ts`'s 3 trigger-dispatch sites, `saga.ts`,
   * `harness.ts`'s scenario runner, `engine-trace.ts`'s `pilotFireTrigger`)
   * now funnels a NAMED trigger's resolution through, instead of calling
   * `resolveCard` directly. `RealCard.triggerDoubling` (state.ts) is the
   * duck-typed, structurally-identical field this gets copied onto at
   * resolve time, same "state.ts never imports card.ts, re-declares its own
   * matching shape" convention `continuousKeywordGrants` already
   * establishes.
   */
  readonly triggerDoubling?: TriggerDoublingGrant[];
  /**
   * Continuous rules text that ISN'T a recognized `keywords` entry,
   * `ptFormula`, or `continuousKeywordGrants` — plain description, NEVER
   * executed by `resolveCard()` or read by it. A static rule is a continuous
   * fact about the game state, not a resolvable step; putting it in
   * `effects` would misrepresent it as something that "happens" once. Still
   * surfaced in `synergyTags()` as a `static:...` tag so it isn't invisible
   * to a synergy search. Kain, Traitorous Dragoon's own "Jump — during your
   * turn, NICKNAME has flying" (and tonberry's/yuna-hope-of-spira's own
   * identical "during your turn, has KEYWORD" shape) are real, checked
   * candidates for `continuousKeywordGrants` above once a future pass
   * migrates them — left as text-only here, not touched by this gap's
   * own closure (explicitly scoped to Dion/Ardyn, the two cards the gap
   * was reported against).
   *
   * **A real mana-producing ability is NO LONGER modeled here** (closed
   * 2026-09-14) — see `manaAbilities` below, the real structured
   * replacement for what used to be the single largest category of
   * free-text `staticAbilities` entries in this pool (30+ real cards'
   * ONLY representation of a genuine `{T}: Add ...` ability).
   */
  readonly staticAbilities?: string[];
  /**
   * Zero or more real, structured mana-producing abilities this permanent
   * has ON ITS OWN (as opposed to a mana ability some OTHER permanent
   * GRANTS to this one — A Realm Reborn's own real `S:Mode$ Continuous |
   * AddAbility$ AnyMana` broadcast to every OTHER permanent the controller
   * has is a genuinely different, still-unmodeled mechanism, a mana-ability
   * analogue of `continuousKeywordGrants`/`continuousTypeGrants` that no
   * real FIN card in this pool needs enforced today — flagged, not silently
   * folded into this field). See `ManaAbility`'s own doc comment for the
   * full field-by-field Forge citation. `mana.ts`'s `sourceColors`/
   * `canAfford`/`payMana` are the real consumers (via `RealCard
   * .manaAbilities`, copied at `addCard` time, same convention `ptFormula`/
   * `continuousKeywordGrants` already establish) — an array since a real
   * permanent can have MORE than one independent mana ability at once
   * (Capital City's real `{T}: Add {C}.` PLUS `{1}, {T}: Add one mana of
   * any color.`; Willowrush Verge's real `{T}: Add {U}.` PLUS a second,
   * conditioned `{T}: Add {G}.`).
   */
  readonly manaAbilities?: ManaAbility[];
  /**
   * A transforming DFC's back face (Jecht, Reluctant Guardian // Braska's
   * Final Aeon) — a second, independent `CardDefinition` rather than new
   * schema machinery. A Saga's own chapter abilities (714.3a/b — REAL
   * turn-based actions, not triggered abilities, though modeled here as
   * named `triggers` the same way for simplicity — see
   * cards/jecht-reluctant-guardian-braska-s-final-aeon/definition.ts's own
   * comment on that simplification) are just this face's own `triggers`
   * array, named `chapterI`/`chapterII`/`chapterIII`.
   */
  readonly backFace?: CardDefinition;
  /**
   * PROTOTYPE (PRD_AUTOMATED_AUTHORING.md, "3-tier waterfall" trial,
   * 2026-09-13, scoped to fin/1-10 only — NOT wired into
   * `apply-recognizers.mjs`/`synergy.json` generation). The CARD-LEVEL
   * sibling of `Effect`'s own `authoredFact` (see that field's doc comment
   * for the full tier-3 rationale — repeated only briefly here): for a real
   * Fact that has no single owning `Effect`/`Trigger`/`ability` container to
   * live next to at all. Two real shapes this covers, both genuine gaps the
   * fin/1-10 sample surfaced, neither a `custom`-effect case:
   *  - A baseline self-cast/self-enters pair NOT already covered by the
   *    `permanent-enters-battlefield-normally`/`instant-sorcery-resolves-to-
   *    graveyard` text recognizers for some card-specific reason (none of
   *    the 10 real fin/1-10 cards actually need this — every one of them is
   *    a plain, un-exceptional cast/permanent, so both recognizers already
   *    cover it — kept here as a real, named escape hatch for a FUTURE card
   *    that needs it, not dead speculative surface).
   *  - A sink fact whose real basis is a NAMED trigger's own firing
   *    PRECONDITION rather than anything inside that trigger's `effects`
   *    (Ashe, Princess of Dalmasca's own "wants to attack" sink for her
   *    `onAttack` trigger; Ambrosia Whiteheart's own "wants a landfall" sink
   *    for her `onLandfall` trigger) — `Trigger.name` is a free-text label
   *    (`harness.ts`'s own `Scenario.trigger` match key), not a closed,
   *    typed vocabulary the way `Trigger.on` is for the 3 auto-fired cases
   *    (`'enter'`/`'upkeep'`/`'endStep'`) it already recognizes, so there is
   *    no SAFE general structural rule to derive "this named trigger's
   *    precondition is event X" the way `on: 'enter'` already lets a
   *    (hypothetical, not built in this trial) tier-1 recognizer derive an
   *    entersBattlefield-precondition sink for free. Until `Trigger` grows a
   *    real closed-vocabulary equivalent for attack/dies/landfall-shaped
   *    preconditions, a card needing one of these sinks authors it here
   *    instead of leaving it to only exist in a separately-maintained
   *    `synergy.json`.
   * Same shape/semantics as `Effect.authoredFact` (an array covers more than
   * one card-level fact; `role` stays on each object, same reasoning as
   * there) and same "purely additive, inert data, not consulted by anything
   * real yet" status as every other field in this prototype. Same 2026-09-13
   * `annotations`-externalization correction as `Effect.authoredFact` (see
   * `AuthoredFact`'s own doc comment) — an entry here is keyed
   * `"authoredFacts[<i>]"` in `cards/<slug>/definition-annotations.json`.
   */
  readonly authoredFacts?: AuthoredFact[];
  /** FDN authoring-pipeline-only (2026-09-18) — see `MissingSchemaFunctionality`'s own doc comment above. Purely additive/optional; FIN never populates this. */
  readonly missingSchemaFunctionality?: MissingSchemaFunctionality[];
  /** FDN authoring-pipeline-only (2026-09-18) — see `CoverageJustificationEntry`'s own doc comment above. Purely additive/optional; FIN never populates this. */
  readonly coverageJustification?: CoverageJustificationEntry[];
}

/**
 * Runs one set of `card`'s declared effects — either its single `effects`
 * list (the default, for a cast/activated-ability resolution) or one named
 * entry from `triggers` (pass `triggerName`) — against `ctx`. The TS
 * analogue of Forge's `SpellAbility.resolve()` dispatching each effect
 * through its own `ApiType`'s shared effect class. A free function taking
 * `card` as data (not a method on it) on purpose — matches "one generic
 * engine over many data records" instead of "one method implementation per
 * card."
 */
export function resolveCard(card: CardDefinition, ctx: EffectContext, actions: Actions, triggerName?: string, abilityName?: string): void {
  const effects = triggerName
    ? (card.triggers?.find((t) => t.name === triggerName)?.effects ?? [])
    : abilityName
      ? (card.abilities?.find((a) => a.name === abilityName)?.effects ?? [])
      : (card.effects ?? []);
  for (const effect of effects) applyEffect(effect, ctx, actions);
}

function playersFor(owner: EffectOwner, ctx: EffectContext): Player[] {
  if (owner === 'you') return [ctx.you];
  if (owner === 'opponents') return ctx.opponents;
  return [ctx.you, ...ctx.opponents];
}

/** Shared vocabulary `move`'s targeted branch, `putCounterTarget`, `tapTarget`, and `untapTarget` all filter their candidate pool by — 'land' and 'creature-or-artifact' (Forge's own `Sac<1/Creature.Other;Artifact.Other/...>`-style disjunctive shape, already precedented on `sacrifice`) added alongside the original three. */
/**
 * `'attacking'` (2026-09-16, coordinator-routed pilot-triage escalation —
 * Sage's Nouliths' own granted "untap target ATTACKING creature," the one
 * real card whose `validType` needed a combat-status filter no existing
 * variant covered) reads `Card.isAttacking()` (interfaces.ts/state.ts,
 * real CR 506.4/508.1 status, already wired off `state.attackers` — see
 * that method's own doc comment) rather than any printed type/subtype.
 * Only `untapTarget`'s own field exposes this literal today (see that
 * `Effect` variant's own `validType` union below) — `tapTarget`/
 * `putCounterTarget` share this SAME implementation type but neither has a
 * real card needing an attacking-filtered tap/counter yet, so their own
 * inline `validType` unions weren't widened; extend those the day a real
 * card needs it, not speculatively.
 */
type BattlefieldValidType = 'creature' | 'artifact' | 'land' | 'creature-or-artifact' | 'any' | 'attacking';

function matchesValidType(card: Card, validType: BattlefieldValidType | undefined): boolean {
  if (!validType || validType === 'any') return true;
  if (validType === 'creature') return card.isCreature();
  if (validType === 'artifact') return card.isArtifact();
  if (validType === 'land') return card.isLand();
  if (validType === 'attacking') return card.isAttacking();
  return card.isCreature() || card.isArtifact();
}

/** `move.subtype`'s own OR-match helper (2026-09-16, Phoenix Down's own
 * real "target Skeleton, Spirit, or Zombie") — a single string is checked
 * exactly as before; an array is OR-matched (any ONE hit is enough), since
 * `Card.hasSubtype` itself only ever checks one subtype at a time. Shared
 * by `case 'move'`'s own targeted branch AND `harness.ts`'s `move` action
 * implementation (the untargeted/batch-search path) — same field, same
 * semantics either way. */
function matchesSubtype(card: Card, subtype: string | string[] | undefined): boolean {
  if (!subtype) return true;
  const subtypes = Array.isArray(subtype) ? subtype : [subtype];
  return subtypes.some((s) => card.hasSubtype(s));
}

/** `players`' combined Battlefield pool, filtered by `matchesValidType` — the shared candidate-pool builder `putCounterTarget`/`tapTarget`/`untapTarget` all use (see `matchesValidType`'s own doc comment). */
function battlefieldPool(players: Player[], validType: BattlefieldValidType | undefined): Card[] {
  return players.flatMap((p) => p.getCardsIn('Battlefield')).filter((c) => matchesValidType(c, validType));
}

/**
 * The one shared chokepoint every targeted-effect branch below that
 * supports cast-time target-locking (ENGINE_GAPS.md gap #4) calls instead
 * of a raw `actions.chooseTarget` loop — see `EffectContext.declaredTargets`'s
 * own doc comment for the full CR 601.2c/608.2b design writeup this
 * implements. `pool` is the CALLING branch's own already-filtered candidate
 * list (validType/owner/notSelf/etc. already applied) — this function
 * itself does no filtering beyond membership-by-id, since `pool` IS the
 * legality check.
 *
 * When `ctx.declaredTargets` is set: takes up to `qty` entries off the
 * FRONT of it (FIFO, shared across the whole resolution — see that field's
 * own doc comment) that are STILL present in `pool` (by `getId()`, not
 * object identity — `harness.ts`/`engine-trace.ts`'s own `Player.getCardsIn`
 * wrapping produces a FRESH `Card` wrapper object per call, never a stable
 * reference), silently dropping (never replacing) any that aren't. Returns
 * however many survive — 0 to `qty`, inclusive — with NO fallback to a
 * fresh `chooseTarget` pick (608.2b: an illegal target is dropped, not
 * substituted).
 *
 * When unset: byte-for-byte the SAME loop every targeted branch already ran
 * before this pass — a fresh `actions.chooseTarget(remaining, ctx.preferTarget)`
 * pick per slot, stopping once the pool is exhausted.
 */
function resolveTargets(pool: Card[], qty: number, ctx: EffectContext, actions: Actions): Card[] {
  if (ctx.declaredTargets) {
    const chosen: Card[] = [];
    while (chosen.length < qty && ctx.declaredTargets.length > 0) {
      const next = ctx.declaredTargets.shift()!;
      if (pool.some((c) => c.getId() === next.getId())) chosen.push(next);
      // else: this declared target is no longer legal (608.2b) — dropped, not replaced.
    }
    return chosen;
  }
  const targets: Card[] = [];
  for (let i = 0; i < qty; i++) {
    const remaining = pool.filter((c) => !targets.includes(c));
    if (remaining.length === 0) break;
    targets.push(actions.chooseTarget(remaining, ctx.preferTarget));
  }
  return targets;
}

function applyEffect(effect: Effect, ctx: EffectContext, actions: Actions): void {
  switch (effect.kind) {
    case 'createToken':
      actions.createToken(ctx.you, effect.token, resolveCreateTokenAmount(effect.amount, ctx), { tapped: effect.tapped });
      return;
    case 'gainLife':
      ctx.you.gainLife(resolve(effect.amount, ctx));
      return;
    case 'addMana':
      ctx.you.addMana(effect.color, resolve(effect.amount, ctx));
      return;
    case 'drawCard': {
      // Same `declineOptional` gate as `destroy`'s own (see that case's
      // doc comment) — only meaningful when `optional` is actually set.
      if (effect.optional && ctx.declineOptional) return;
      const amount = resolve(effect.amount ?? 1, ctx);
      // `playersFor` (same helper `loseLife`/`discard` use below) — an
      // omitted `owner` keeps the original `ctx.you`-only behavior every
      // existing `drawCard` effect already relies on.
      for (const player of playersFor(effect.owner ?? 'you', ctx)) {
        for (let i = 0; i < amount; i++) player.drawCard();
      }
      return;
    }
    case 'pumpAll': {
      const power = resolve(effect.power, ctx);
      const toughness = resolve(effect.toughness, ctx);
      // `'attacking-creatures'` is the one real SYMMETRIC predicate (both
      // `ctx.you` AND `ctx.opponents`) — every other predicate here stays
      // `ctx.you`-only, unchanged.
      const pool =
        effect.predicate === 'attacking-creatures'
          ? [ctx.you, ...ctx.opponents].flatMap((p) => p.getCreaturesInPlay()).filter((c) => c.isAttacking())
          : ctx.you.getCreaturesInPlay();
      for (const creature of pool) {
        if (effect.notSelf && creature.getId() === ctx.self.getId()) continue;
        if (effect.subtype && !creature.hasSubtype(effect.subtype)) continue;
        actions.pump(creature, power, toughness, { untilEndOfTurn: effect.untilEndOfTurn });
      }
      return;
    }
    case 'loseLife': {
      const amount = resolve(effect.amount, ctx);
      for (const player of playersFor(effect.owner, ctx)) player.loseLife(amount);
      return;
    }
    case 'discard': {
      const qty = resolve(effect.qty, ctx);
      for (const player of playersFor(effect.owner, ctx)) actions.discard(player, qty);
      return;
    }
    case 'mill': {
      const qty = resolve(effect.amount, ctx);
      for (const player of playersFor(effect.owner, ctx)) actions.mill(player, qty);
      return;
    }
    case 'sacrifice': {
      const qty = resolve(effect.qty ?? 1, ctx);
      for (const player of playersFor(effect.owner, ctx)) actions.sacrifice(player, qty, effect.validType, effect.notSelf, effect.tokenFilter);
      return;
    }
    case 'move': {
      const qty = resolve(effect.qty, ctx);
      const to = resolve(effect.to, ctx);
      const players = playersFor(effect.owner ?? 'each', ctx);
      // Normalize once here — every branch below (and every recognizer)
      // deals with a single, real scalar `ZoneType` array, never has to
      // branch on `Array.isArray(effect.from)` itself. See `from`'s own
      // doc comment above for why a real card ever needs more than one.
      const fromZones = Array.isArray(effect.from) ? effect.from : [effect.from];
      if (effect.target) {
        // Real MTG rule (601.2c): ALL targets are chosen together, once,
        // when the spell is cast — BEFORE it resolves. The effect is then
        // applied to each of them at resolution. `resolveTargets` is what
        // actually enforces this now (ENGINE_GAPS.md gap #4) when a caller
        // locked in real cast-time targets via `ctx.declaredTargets` —
        // dropping (never replacing) one that became illegal in between,
        // real CR 608.2b; falls back to this file's original lazy
        // choose-at-resolution loop when unset (see that function's own
        // doc comment).
        //
        // ONE combined pool across every returned player (same shape
        // `destroy`/`putCounterTarget`'s own `battlefieldPool` already
        // uses), not a per-player loop — `qty` is a total across whichever
        // players `owner` resolves to (Jill's own "up to ONE nonland
        // permanent," any player's, means ONE total, not one per side).
        // Same flattening now also unions every zone in `fromZones` (real
        // motivating case is untargeted — see below — but the targeted
        // branch gets the identical treatment for free, no real card needs
        // it there yet).
        const pool = players
          .flatMap((player) => fromZones.flatMap((zone) => player.getCardsIn(zone)))
          .filter((c) => matchesValidType(c, effect.validType))
          .filter((c) => matchesSubtype(c, effect.subtype))
          .filter((c) => !effect.notSelf || c.getId() !== ctx.self.getId())
          .filter((c) => !effect.nonLand || !c.isLand())
          .filter((c) => effect.maxCmc === undefined || c.getCMC() <= effect.maxCmc);
        const targets = resolveTargets(pool, qty, ctx, actions);
        for (const target of targets) {
          actions.moveTo(target, to);
          // `effect.tapped` (2026-09-16, Phoenix Down's own real "return
          // target creature card ... to the battlefield TAPPED") — this
          // field already existed (Magitek Infantry's own untargeted
          // name-tutor, 2026-09-15) but was only ever applied on the
          // UNTARGETED branch below; a targeted move had no way to enter
          // tapped at all. Only meaningful for a `to:'Battlefield'` move,
          // same real scope `tapped`'s own doc comment already documents.
          if (effect.tapped) actions.tap(target);
        }
      } else {
        // Untargeted batch search stays per-player — `actions.move` is
        // scoped to one Player at a time (Suplex/Triple Triad's own
        // `owner:'each'` batch effects genuinely apply independently per
        // player, not as one shared cross-player pool).
        // `effect.subtype` (2026-09-15) is now read for the untargeted
        // branch too — `move.subtype`'s own doc comment used to say "not
        // read there," closed for real by `Cloud, Midgar Mercenary`'s own
        // tutor-Equipment need (ENGINE_GAPS.md).
        //
        // `fromZones` (2026-09-15) — `actions.move` itself now takes the
        // real array (Delivery Moogle's own two-zone search); passing
        // `effect.from` straight through (not the normalized-to-array
        // `fromZones` local) is deliberate: `interfaces.ts`'s own `move`
        // signature accepts EITHER shape and normalizes internally too
        // (see that declaration's own doc comment) — no reason to
        // normalize twice.
        //
        // `effect.maxCmc` (2026-09-15) — same real "mana value N or less"
        // filter as the targeted branch above, now threaded through to
        // `actions.move` for the untargeted (batch search) shape.
        //
        // `effect.name`/`effect.tapped` (2026-09-15, Magitek Infantry's own
        // real name-tutor) — `name:'self'` resolves to `ctx.self.getName()`
        // right here (never passed as the literal string `'self'` itself
        // down to `actions.move`, which knows nothing about "self"); the
        // real cards this effect moved are then tapped, one `actions.tap`
        // call per result, only when `effect.tapped` is set (see that
        // field's own doc comment).
        for (const player of players) {
          const moved = actions.move(player, effect.from, to, qty, effect.validType, effect.subtype, effect.maxCmc, effect.name === 'self' ? ctx.self.getName() : undefined);
          if (effect.tapped) for (const c of moved) actions.tap(c);
        }
      }
      // Real 601.2/701.19 "then shuffle" — see `shuffleAfter`'s own doc
      // comment above for why this is a search-specific requirement, not
      // folded into every `move`.
      if (effect.shuffleAfter) for (const player of players) actions.shuffleLibrary(player);
      return;
    }
    case 'putCounter':
      actions.putCounter(ctx.self, effect.counterType, resolve(effect.amount, ctx));
      return;
    case 'putCounterTarget': {
      const pool = battlefieldPool(playersFor(effect.owner ?? 'each', ctx), effect.validType);
      const qty = resolve(effect.qty ?? 1, ctx);
      const chosen = resolveTargets(pool, qty, ctx, actions);
      for (const target of chosen) {
        actions.putCounter(target, effect.counterType, resolve(effect.amount, ctx));
        // Real Forge `DB$ Effect | RememberObjects$ Targeted | StaticAbilities$
        // ...` (Ultima, Origin of Oblivion) — see `CounterConditionalGrant`'s
        // own doc comment. Installed onto the SAME target the counter just
        // went on, `counterType` threaded from THIS effect's own field so
        // the grant and the counter it's keyed on can never name different
        // counters.
        if (effect.grant) actions.installCounterConditionalGrant(target, { ...effect.grant, counterType: effect.counterType });
      }
      return;
    }
    case 'putCounterAll': {
      const amount = resolve(effect.amount, ctx);
      for (const creature of ctx.you.getCreaturesInPlay()) {
        if (effect.notSelf && creature.getId() === ctx.self.getId()) continue;
        if (effect.subtype && !creature.hasSubtype(effect.subtype)) continue;
        actions.putCounter(creature, effect.counterType, amount);
      }
      return;
    }
    case 'destroy': {
      // A real player genuinely declining the "up to one" — see
      // `EffectContext.declineOptional`'s own doc comment. Only meaningful
      // when `optional` is actually set (TargetMin$0); an effect that MUST
      // find a target ignores this.
      if (effect.optional && ctx.declineOptional) return;
      const minPower = effect.minPower === undefined ? undefined : resolve(effect.minPower, ctx);
      const pool = playersFor(effect.owner ?? 'each', ctx)
        .flatMap((p) => p.getCardsIn('Battlefield'))
        .filter(
          (c) =>
            (effect.validType === 'creature' ? c.isCreature() : effect.validType === 'land' ? c.isLand() : true) &&
            (!effect.nonLand || !c.isLand()) &&
            (minPower === undefined || c.getNetPower() >= minPower)
        );
      const qty = resolve(effect.qty, ctx);
      const targets = resolveTargets(pool, qty, ctx, actions);
      for (const target of targets) actions.destroy(target);
      return;
    }
    case 'dealDamage': {
      const amount = resolve(effect.amount, ctx);
      for (const player of playersFor(effect.target, ctx)) actions.dealDamage(ctx.self, player, amount);
      return;
    }
    case 'dealDamageTarget': {
      const pool = playersFor(effect.owner ?? 'each', ctx)
        .flatMap((p) => p.getCreaturesInPlay())
        .filter((c) => !effect.tapped || c.isTapped());
      const target = resolveTargets(pool, 1, ctx, actions)[0];
      if (target) actions.dealDamage(ctx.self, target, resolve(effect.amount, ctx));
      return;
    }
    case 'dealDamageAnyTarget': {
      // `chooseTarget` only ever operates over `Card[]` (see interfaces.ts's
      // own doc comment — no heterogeneous Card|Player choice mechanism
      // exists), so a real "any target" pick is approximated as: prefer a
      // creature (deterministic first-candidate, same convention every
      // other targeted effect here already uses), fall back to the first
      // eligible player only when no creature qualifies. Not a real player
      // CHOICE between the two — same acknowledged limitation as every
      // other targeted effect in this file.
      const amount = resolve(effect.amount, ctx);
      const players = playersFor(effect.owner ?? 'each', ctx);
      const creaturePool = players.flatMap((p) => p.getCreaturesInPlay());
      if (creaturePool.length > 0) {
        const target = actions.chooseTarget(creaturePool, ctx.preferTarget);
        if (target) actions.dealDamage(ctx.self, target, amount);
      } else if (players[0]) {
        actions.dealDamage(ctx.self, players[0], amount);
      }
      return;
    }
    case 'fightTarget': {
      const pool = playersFor(effect.owner ?? 'each', ctx).flatMap((p) => p.getCreaturesInPlay());
      const target = resolveTargets(pool, 1, ctx, actions)[0];
      if (target) {
        actions.dealDamage(ctx.self, target, ctx.self.getNetPower());
        actions.dealDamage(target, ctx.self, target.getNetPower());
      }
      return;
    }
    case 'animate':
      actions.animate(ctx.self, effect.types);
      return;
    case 'surveil':
      actions.surveil(ctx.you, resolve(effect.qty, ctx));
      return;
    case 'counter':
      actions.counter(effect.describe);
      return;
    case 'pumpTarget': {
      const pool = playersFor(effect.owner ?? 'each', ctx)
        .flatMap((p) => p.getCreaturesInPlay())
        .filter((c) => !effect.notSelf || c.getId() !== ctx.self.getId());
      const target = resolveTargets(pool, 1, ctx, actions)[0];
      if (target) actions.pump(target, resolve(effect.power, ctx), resolve(effect.toughness, ctx), { untilEndOfTurn: effect.untilEndOfTurn });
      return;
    }
    case 'pumpSelf':
      actions.pump(ctx.self, resolve(effect.power, ctx), resolve(effect.toughness, ctx), { untilEndOfTurn: effect.untilEndOfTurn });
      return;
    case 'grantKeywordTarget': {
      // `validType` defaults to 'creature' (the original, only-ever-used
      // behavior before Restoration Magic's own "target permanent" mode
      // forced a real 'any' pool) — see `battlefieldPool`'s own
      // `matchesValidType` for why an explicit default is required here
      // rather than passing `effect.validType` straight through: an
      // *omitted* validType must still mean "creature only" for every
      // existing caller (seifer-almasy, gladiolus-amicitia, etc.), not
      // `matchesValidType`'s own "undefined = match everything" default.
      const pool = battlefieldPool(playersFor(effect.owner ?? 'each', ctx), effect.validType ?? 'creature').filter((c) => !effect.notSelf || c.getId() !== ctx.self.getId());
      const target = resolveTargets(pool, 1, ctx, actions)[0];
      if (target) actions.grantKeyword(target, effect.keyword, { untilEndOfTurn: effect.untilEndOfTurn });
      return;
    }
    case 'grantKeywordAll': {
      // Same `pumpAll`-established symmetric-broadcast exception as that
      // effect's own doc comment above — `'attacking-creatures'` reads
      // BOTH players' battlefields, every other predicate stays
      // `ctx.you`-only.
      const pool =
        effect.predicate === 'attacking-creatures'
          ? [ctx.you, ...ctx.opponents].flatMap((p) => p.getCreaturesInPlay()).filter((c) => c.isAttacking())
          : effect.predicate === 'permanents-you-control'
            ? ctx.you.getCardsIn('Battlefield')
            : ctx.you.getCreaturesInPlay();
      for (const card of pool) {
        if (effect.notSelf && card.getId() === ctx.self.getId()) continue;
        if (effect.subtype && !card.hasSubtype(effect.subtype)) continue;
        actions.grantKeyword(card, effect.keyword, { untilEndOfTurn: effect.untilEndOfTurn });
      }
      return;
    }
    case 'grantKeywordSelf':
      actions.grantKeyword(ctx.self, effect.keyword, { untilEndOfTurn: effect.untilEndOfTurn });
      return;
    case 'tapTarget': {
      const pool = battlefieldPool(playersFor(effect.owner ?? 'each', ctx), effect.validType).filter((c) => !effect.excludeEnchantment || !c.isEnchantment());
      const target = resolveTargets(pool, 1, ctx, actions)[0];
      if (target) actions.tap(target);
      return;
    }
    case 'untapTarget': {
      const pool = battlefieldPool(playersFor(effect.owner ?? 'each', ctx), effect.validType).filter((c) => !effect.notSelf || c.getId() !== ctx.self.getId());
      const target = resolveTargets(pool, 1, ctx, actions)[0];
      if (target) actions.untap(target);
      return;
    }
    case 'tapAll': {
      for (const player of playersFor(effect.owner, ctx)) for (const land of player.getLandsInPlay()) actions.tap(land);
      return;
    }
    case 'dig': {
      actions.dig(ctx.you, resolve(effect.qty, ctx), resolve(effect.take, ctx), effect.validType);
      return;
    }
    case 'playFromLibraryTop': {
      const top = ctx.you.getCardsIn('Library')[0];
      if (!top) return; // a real, legal case (CR 601/305's own "play" dispatch has nothing to do against an empty library) — same "nothing there" no-op `dig` already has.
      actions.play(ctx.you, top, ctx.topLibraryCard);
      return;
    }
    case 'modal': {
      const chosen = effect.modes[ctx.mode ?? 0];
      if (chosen) for (const inner of chosen.effects) applyEffect(inner, ctx, actions);
      return;
    }
    case 'custom':
      effect.run(ctx, actions);
      return;
    case 'program':
      runProgram(effect.program, ctx, actions);
      return;
    case 'endTurn':
      // Real 721.1a "including this card" — see `EffectContext.selfToExile`'s
      // own doc comment for why this is set HERE (mid-resolution, on the
      // shared `ctx` object) rather than threaded through `Actions.endTurn`
      // itself (which mirrors Forge's real zero-arg API surface, no
      // `EffectContext` concept at all — see `interfaces.ts`).
      ctx.selfToExile = true;
      actions.endTurn();
      return;
    default: {
      const _exhaustive: never = effect;
      throw new Error(`unhandled effect kind: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Synergy-analysis view over a card definition — walks the SAME `effects`
 * (and now `triggers`/`staticAbilities`) data `resolve()` reads, not a
 * hand-maintained duplicate. This is the whole point of keeping effects
 * declarative: this function never runs a game to know that a card produces
 * tokens, it just reads the data. A `custom` effect can only ever contribute
 * its own `describe` string here — see this file's own header for why
 * that's an accepted, explicit trade-off rather than a gap to close later.
 */
export function synergyTags(card: CardDefinition): string[] {
  const tags: string[] = [];
  function tagEffect(effect: Effect): void {
    switch (effect.kind) {
      case 'createToken':
        tags.push(`produces:${effect.token.name.toLowerCase()}`);
        break;
      case 'gainLife':
        tags.push('lifegain');
        break;
      case 'addMana':
        tags.push(`mana:${effect.color}`);
        break;
      case 'drawCard':
        tags.push('draw');
        break;
      case 'pumpAll':
        tags.push(`anthem:${effect.predicate}${effect.subtype ? `:${effect.subtype}` : ''}`);
        break;
      case 'loseLife':
        tags.push('lifeloss');
        break;
      case 'discard':
        tags.push('discard');
        break;
      case 'mill':
        tags.push('mill');
        break;
      case 'sacrifice':
        tags.push(`sacrifice:${effect.validType}`);
        break;
      case 'move':
        // `Array.isArray` check (2026-09-15, `from`'s own widening) —
        // `${effect.from}` alone would silently stringify a real 2-zone
        // array via `Array.prototype.toString` (comma-joined, no real
        // delimiter) instead of a clearer, deliberate `/`-joined tag.
        // `typeof effect.to === 'function'` check (2026-09-15, `to`'s own
        // widening to `Computed<ZoneType>`, From Father to Son) — a
        // closure has no meaningful string form; tagged `'varies'` rather
        // than stringifying the function source.
        tags.push(
          `move:${Array.isArray(effect.from) ? effect.from.join('/') : effect.from}->${typeof effect.to === 'function' ? 'varies' : effect.to}`,
        );
        break;
      case 'putCounter':
        tags.push(`counters:${effect.counterType}`);
        break;
      case 'putCounterTarget':
        tags.push(`counters-target:${effect.counterType}:${effect.validType}`);
        break;
      case 'putCounterAll':
        tags.push(`counters-all:${effect.counterType}${effect.subtype ? `:${effect.subtype}` : ''}`);
        break;
      case 'destroy':
        tags.push(`removal:destroy:${effect.validType}`);
        break;
      case 'dealDamage':
        tags.push('damage');
        break;
      case 'dealDamageTarget':
        tags.push('damage');
        break;
      case 'dealDamageAnyTarget':
        tags.push('damage');
        break;
      case 'fightTarget':
        tags.push('fight');
        break;
      case 'animate':
        tags.push('animate');
        break;
      case 'surveil':
        tags.push('surveil');
        break;
      case 'counter':
        tags.push('counter');
        break;
      case 'pumpTarget':
        tags.push('removal-or-pump:target-creature');
        break;
      case 'pumpSelf':
        tags.push('pump:self');
        break;
      case 'grantKeywordTarget':
        tags.push(`grant:keyword:${effect.keyword}`);
        break;
      case 'grantKeywordAll':
        tags.push(`grant:keyword:${effect.keyword}${effect.subtype ? `:${effect.subtype}` : ''}`);
        break;
      case 'grantKeywordSelf':
        tags.push(`grant:keyword:${effect.keyword}`);
        break;
      case 'tapTarget':
        tags.push('tap:target-creature');
        break;
      case 'untapTarget':
        tags.push('untap:target-creature');
        break;
      case 'tapAll':
        tags.push(`tap-all:${effect.predicate}:${effect.owner}`);
        break;
      case 'dig':
        tags.push(`dig:${effect.validType ?? 'any'}`);
        break;
      case 'playFromLibraryTop':
        tags.push('play:library-top');
        break;
      case 'modal':
        for (const mode of effect.modes) for (const inner of mode.effects) tagEffect(inner);
        break;
      case 'custom':
        tags.push(`custom:${effect.describe}`);
        break;
      case 'program':
        // Same tag namespace/shape as `custom` above (`describe` is the
        // same free-text summary a `program` effect still carries) —
        // deliberately NOT a richer tag derived from `walkProgram` here:
        // this keeps `synergyTags()`'s own output byte-for-byte unchanged
        // for every migrated card (same describe string, same tag), so
        // migrating a closure from `custom` to `program` has zero effect on
        // synergy-tag-derived matching. A future pass MAY want a richer
        // `program`-aware tag (the AST is now genuinely walkable, unlike
        // `custom`'s opaque closure) — not attempted here, out of this
        // migration's own scope.
        tags.push(`custom:${effect.describe}`);
        break;
      default: {
        const _exhaustive: never = effect;
        throw new Error(`unhandled effect kind: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }
  for (const effect of card.effects ?? []) tagEffect(effect);
  for (const trigger of card.triggers ?? []) for (const effect of trigger.effects) tagEffect(effect);
  for (const ability of card.abilities ?? []) for (const effect of ability.effects) tagEffect(effect);
  for (const rule of card.staticAbilities ?? []) tags.push(`static:${rule}`);
  for (const ability of card.manaAbilities ?? []) tags.push(`mana:${ability.colors.join('/')}`);
  for (const keyword of card.keywords ?? []) tags.push(`keyword:${keyword}`);
  if (card.ptFormula?.kind === 'addPerEquipmentControlled') tags.push('static:Gets +X/+X for each Equipment you control.');
  if (card.ptFormula?.kind === 'setToCreaturesControlled') tags.push('static:Power is equal to the number of creatures you control.');
  if (card.ptFormula?.kind === 'thresholdBonus') tags.push('static:Gets a bonus as long as a board-state threshold is met.');
  if (card.ptFormula?.kind === 'addPerGraveyardCount') tags.push('static:Gets +X/+X for each card in your graveyard.');
  if (card.ptFormula?.kind === 'setToGraveyardPermanentCount') tags.push('static:Power is equal to the number of permanent cards in your graveyard.');
  if (card.ptFormula?.kind === 'addPerLandControlled') tags.push('static:Gets +X/+X for each land you control.');
  if (card.alternateCosts?.some((c) => c.from === 'graveyard')) tags.push('graveyard-recursion');
  if (card.backFace) tags.push(...synergyTags(card.backFace).map((t) => `backface:${t}`));
  return tags;
}
