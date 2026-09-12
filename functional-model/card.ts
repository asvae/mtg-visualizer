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
  sacrifice as realSacrifice,
  discard as realDiscard,
  putCounter as realPutCounter,
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
  play as realPlay,
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
  sacrifice: typeof realSacrifice;
  discard: typeof realDiscard;
  putCounter: typeof realPutCounter;
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
  play: typeof realPlay;
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
   * `manaAbility`/`continuousKeywordGrants` doc comments for the established
   * convention), so whoever pilots "play the top card of your library" must
   * supply it explicitly, the same way `harness.ts`/`engine-trace.ts` build
   * every other `EffectContext` field. Left unset only when there's
   * genuinely no top card (an empty library) — the effect itself checks
   * `ctx.you.getCardsIn('Library')` and no-ops if it's empty, same as
   * `dig`'s own "nothing there" case.
   */
  topLibraryCard?: CardDefinition;
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

/** Who an effect (loseLife/discard/sacrifice/move) applies to — `'each'` covers Gaius van Baelsar's own "each player" (both sides at once), distinct from `'opponents'` (every opponent, not you) and `'you'` (just you). */
export type EffectOwner = 'you' | 'opponents' | 'each';

/**
 * One resolved effect. Every variant except `custom` is plain, inspectable
 * data — no method call hidden inside it that a static reader would have to
 * execute to understand.
 */
export type Effect =
  | { kind: 'createToken'; token: TokenInfo; amount: Computed<number>; tapped?: boolean }
  | { kind: 'gainLife'; amount: Computed<number> }
  | {
      /** `Player.getManaPool().addMana(...)` (see interfaces.ts's own `Player.addMana` doc comment for why this is a deliberately inert observation point, not a real spendable pool). Add for a "{T}: Add X mana" activated ability so it leaves a real, checkable trace line instead of being invisible to scripts/verify-synergy.mjs — same "promote a real ability off the unmodeled-list" reasoning `drawCard` already got (2026-09-05). */
      kind: 'addMana';
      color: string;
      amount: Computed<number>;
    }
  | { kind: 'drawCard'; amount?: Computed<number> }
  | {
      /** Forge's own `PumpAll` (Warren Elder's own "creatures you control get +1/+1 until end of turn") — every creature matching `predicate` gets the same delta, as opposed to `custom`'s one-target `pump`. Only `'creatures-you-control'` modeled so far; extend the union as more predicates show up. */
      kind: 'pumpAll';
      predicate: 'creatures-you-control';
      power: Computed<number>;
      toughness: Computed<number>;
      /** Forge's own real `Creature.YouCtrl+Other` shape ("OTHER creatures you control get...") — excludes `ctx.self` from the affected set, same reasoning as `sacrifice`/`move`'s own `notSelf`. */
      notSelf?: boolean;
      /** A creature subtype filter (Circle of Power's own "Wizards you control get...") — same field `putCounterAll` already carries, omit to match every creature `predicate` selects. */
      subtype?: string;
    }
  | { kind: 'loseLife'; owner: EffectOwner; amount: Computed<number> }
  | { kind: 'discard'; owner: EffectOwner; qty: Computed<number> }
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
      from: ZoneType;
      to: ZoneType;
      qty: Computed<number>;
      validType?: 'creature' | 'artifact' | 'land' | 'any';
      target?: boolean;
      /** "return ANOTHER permanent you control" (Ambrosia Whiteheart) — excludes `ctx.self` from the candidate pool, same reasoning as `sacrifice`'s own `notSelf`. */
      notSelf?: boolean;
      /** Real `Permanent.nonLand` (Jill, Shiva's Dominant's own "return up to one other target NONLAND permanent") — same `nonLand` vocabulary `destroy` already carries, for the same reason: `validType: 'any'` alone can't exclude lands from an otherwise-unrestricted pool. */
      nonLand?: boolean;
      /** Forge's own `OptionalDecider$ You` (Ambrosia Whiteheart's own ETB) — a real binary "you MAY," distinct from qty/pool-exhaustion's own "up to N" (which already yields zero for free when nothing qualifies). Documentary only, same as `sacrifice`/`dig`'s own `optional` field: this model has no player-decision engine anywhere (`chooseTarget` always takes the first pool candidate), so a legal-but-declined target isn't actually modeled yet — set this to record the real card text's intent, not to change resolution behavior. */
      optional?: boolean;
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
    }
  | {
      /** `self` gets a P/T delta with no target/board-wide choice involved (Ambrosia Whiteheart's own Landfall — "CARDNAME gets +1/+0") — a third, narrower shape than `pumpTarget` (chosen) and `pumpAll` (broadcast). */
      kind: 'pumpSelf';
      power: Computed<number>;
      toughness: Computed<number>;
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
       */
      kind: 'grantKeywordAll';
      predicate: 'creatures-you-control' | 'permanents-you-control';
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
      /** `UntapEffect` (forge-game/.../ability/effects/) — Forge's own real counterpart to `tapTarget` above (Magic Damper's own "untap target creature"), same shape, `untap` instead of `tap`. */
      kind: 'untapTarget';
      validType: 'creature' | 'artifact' | 'land' | 'creature-or-artifact' | 'any';
      owner?: EffectOwner;
      /** "untap ANOTHER target permanent" (Formidable Speaker) — excludes `ctx.self` from the pool, same reasoning as `pumpTarget`/`sacrifice`/`move`'s own `notSelf`. */
      notSelf?: boolean;
    }
  | {
      /** `DigEffect` — look at the top `qty` library cards, take up to `take` matching `validType` to hand, rest to bottom (Ashe's own attack trigger). */
      kind: 'dig';
      qty: Computed<number>;
      take: Computed<number>;
      validType?: 'artifact' | 'any';
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
      modes: { describe: string; effects: Effect[] }[];
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
  /** Board-state-COUNTED discount — see this interface's own doc comment above. Mutually exclusive with `amount`/`condition`; a card in this pool needs only one shape at a time. */
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
   * Optional and additive: none of the 312 existing FIN cards' own
   * triggers set any of these yet (picked manually per scenario via
   * `harness.ts`'s own `Scenario.trigger`/`sequence` fields instead,
   * unaffected by this) — retrofitting them is a separate, deferred task
   * (ENGINE_GAPS.md). Real FIN cards that WOULD use `'endStep'` today (Yuna,
   * Hope of Spira; Ultimecia, Time Sorceress) are cited there.
   */
  on?: 'enter' | 'upkeep' | 'endStep';
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
}

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
  readonly abilities?: { name: string; cost: string; effects: Effect[]; costReduction?: ActivationCostReduction }[];
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
  readonly ptFormula?: { kind: 'addPerEquipmentControlled'; power: number; toughness: number } | { kind: 'setToCreaturesControlled' };
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
   */
  readonly continuousPTGrants?: (ContinuousGrantTargeting & { power: number; toughness: number })[];
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
   */
  readonly staticAbilities?: string[];
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
type BattlefieldValidType = 'creature' | 'artifact' | 'land' | 'creature-or-artifact' | 'any';

function matchesValidType(card: Card, validType: BattlefieldValidType | undefined): boolean {
  if (!validType || validType === 'any') return true;
  if (validType === 'creature') return card.isCreature();
  if (validType === 'artifact') return card.isArtifact();
  if (validType === 'land') return card.isLand();
  return card.isCreature() || card.isArtifact();
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
      actions.createToken(ctx.you, effect.token, resolve(effect.amount, ctx), { tapped: effect.tapped });
      return;
    case 'gainLife':
      ctx.you.gainLife(resolve(effect.amount, ctx));
      return;
    case 'addMana':
      ctx.you.addMana(effect.color, resolve(effect.amount, ctx));
      return;
    case 'drawCard': {
      const amount = resolve(effect.amount ?? 1, ctx);
      for (let i = 0; i < amount; i++) ctx.you.drawCard();
      return;
    }
    case 'pumpAll': {
      const power = resolve(effect.power, ctx);
      const toughness = resolve(effect.toughness, ctx);
      for (const creature of ctx.you.getCreaturesInPlay()) {
        if (effect.notSelf && creature.getId() === ctx.self.getId()) continue;
        if (effect.subtype && !creature.hasSubtype(effect.subtype)) continue;
        actions.pump(creature, power, toughness);
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
    case 'sacrifice': {
      const qty = resolve(effect.qty ?? 1, ctx);
      for (const player of playersFor(effect.owner, ctx)) actions.sacrifice(player, qty, effect.validType, effect.notSelf, effect.tokenFilter);
      return;
    }
    case 'move': {
      const qty = resolve(effect.qty, ctx);
      const players = playersFor(effect.owner ?? 'each', ctx);
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
        const pool = players
          .flatMap((player) => player.getCardsIn(effect.from))
          .filter((c) => matchesValidType(c, effect.validType))
          .filter((c) => !effect.notSelf || c.getId() !== ctx.self.getId())
          .filter((c) => !effect.nonLand || !c.isLand());
        const targets = resolveTargets(pool, qty, ctx, actions);
        for (const target of targets) actions.moveTo(target, effect.to);
      } else {
        // Untargeted batch search stays per-player — `actions.move` is
        // scoped to one Player at a time (Suplex/Triple Triad's own
        // `owner:'each'` batch effects genuinely apply independently per
        // player, not as one shared cross-player pool).
        for (const player of players) actions.move(player, effect.from, effect.to, qty, effect.validType);
      }
      return;
    }
    case 'putCounter':
      actions.putCounter(ctx.self, effect.counterType, resolve(effect.amount, ctx));
      return;
    case 'putCounterTarget': {
      const pool = battlefieldPool(playersFor(effect.owner ?? 'each', ctx), effect.validType);
      const qty = resolve(effect.qty ?? 1, ctx);
      const chosen = resolveTargets(pool, qty, ctx, actions);
      for (const target of chosen) actions.putCounter(target, effect.counterType, resolve(effect.amount, ctx));
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
      const pool = playersFor(effect.owner ?? 'each', ctx).flatMap((p) => p.getCreaturesInPlay());
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
      if (target) actions.pump(target, resolve(effect.power, ctx), resolve(effect.toughness, ctx));
      return;
    }
    case 'pumpSelf':
      actions.pump(ctx.self, resolve(effect.power, ctx), resolve(effect.toughness, ctx));
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
      const pool = effect.predicate === 'permanents-you-control' ? ctx.you.getCardsIn('Battlefield') : ctx.you.getCreaturesInPlay();
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
      case 'sacrifice':
        tags.push(`sacrifice:${effect.validType}`);
        break;
      case 'move':
        tags.push(`move:${effect.from}->${effect.to}`);
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
  for (const keyword of card.keywords ?? []) tags.push(`keyword:${keyword}`);
  if (card.ptFormula?.kind === 'addPerEquipmentControlled') tags.push('static:Gets +X/+X for each Equipment you control.');
  if (card.ptFormula?.kind === 'setToCreaturesControlled') tags.push('static:Power is equal to the number of creatures you control.');
  if (card.alternateCosts?.some((c) => c.from === 'graveyard')) tags.push('graveyard-recursion');
  if (card.backFace) tags.push(...synergyTags(card.backFace).map((t) => `backface:${t}`));
  return tags;
}
