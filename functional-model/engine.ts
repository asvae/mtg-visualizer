// The "pilot one player through a real game" engine — composes pieces that
// already existed independently (turn.ts's phase/turn structure, stack.ts's
// real LIFO stack, priority.ts's scripted-priority-round cycling,
// mana.ts's cost affordability) into one API surface that actually PREVENTS
// an illegal action instead of just recording whatever's declared, which is
// what `harness.ts`'s `Scenario`/`runScenario` does (a different, correct-
// for-its-own-purpose tool: "assert this card's ability really does X, here's
// the trace" for the 312 real FIN cards' synergy verification — untouched,
// not superseded, by this file).
//
// User's own words prompting this: shown a `Scenario.sequence`-based trace,
// "it doesn't have turn order or anything player would do... I was
// expecting scenario to pilot one player," then confirming: "we want full
// fledged engine, that would also prevent you from making invalid moves."
//
// ── How this composes with card.ts ──────────────────────────────────────
// `resolveCard()` (card.ts) is still THE resolution engine for what a spell/
// ability DOES once it's legally allowed to happen — this file never
// reimplements that. Its job is strictly upstream: deciding WHETHER and
// WHEN an action is legal (timing, cost, summoning sickness), performing
// the real state mutation that legality gates (tap mana sources, move the
// card to the stack), and then handing the actual resolution off to
// `stack.ts`'s `Stack.resolveTop()` (which calls `resolveCard` for you).
//
// A caller "pilots one player" by calling, in whatever order the real game
// would allow:
//   createEngine(state, players) -> GameEngine
//   canCastSpell(engine, caster, cardDef) -> ActionResult   // read-only check
//   castSpell(engine, caster, cardReal, cardDef, ctx, actions) -> ActionResult
//   canActivateAbility(engine, controller, permanentReal, cardDef, abilityName?) -> ActionResult
//   activateAbility(engine, controller, permanentReal, cardDef, ctx, actions, abilityName?) -> ActionResult
//   stepPriority(engine, choices) -> PriorityOutcome        // one APNAP round
//   canAttack(engine, creature) -> ActionResult
//   declareAttackers(engine, attackers) -> ActionResult
//   canBlock(engine, blocker, attacker) -> ActionResult
//   declareBlockers(engine, [{blocker, attacker}, ...]) -> ActionResult
//   resolveFirstStrikeCombatDamage(engine) -> CombatDamageResult // ONLY when currentPhase(engine.turn) === 'CombatFirstStrikeDamage' is actually reached (ENGINE_GAPS.md gap #9) — see resolveCombatDamage's own doc comment
//   resolveCombatDamage(engine) -> CombatDamageResult        // applies real damage; see its own doc comment for the lethal-flag/no-SBA caveat
//   advance(engine) -> void                                 // pass to next phase directly
//
// Real state-based actions (704) — checkStateBasedActions(engine.state,
// engine.players) — live in a SEPARATE file, `sba.ts`, not here: SBAs are
// checked against GameState/RealPlayer alone (no stack/turn/priority
// concept needed), matching GameAction.java's own real shape. A caller
// runs it after anything that could have created one (combat damage,
// above, is the main source today) — this file never calls it implicitly.
//
// ── The resolveCard dispatch collision (fixed here) ──────────────────────
// A permanent with BOTH a named ETB trigger AND a later activated ability
// declared the common way (`activationCost`+`effects` — Jill, Shiva's
// Dominant's own shape, also Coeurl/Elvish Archdruid/many real FIN cards)
// creates a real ambiguity: `card.effects` is reserved for the ability
// (card.ts's own doc comment: "an Instant/Sorcery's cast effect, OR an
// activated ability's effect"), never "what happens on cast" for a
// permanent — but `resolveCard(card, ctx, actions)` with NEITHER a
// triggerName NOR abilityName (exactly what resolving a plain CAST does)
// defaults to running `card.effects` regardless. `harness.ts` never hits
// this: its own `lifecycleBefore` treats ANY `activationCost`-bearing
// card's scenario as an ACTIVATION, never a plain cast, so `card.effects`
// there always legitimately means the ability. This engine's own
// `castSpell` genuinely models a plain cast, so it needs its own fix:
// pushes a shallow `{...card, effects: undefined}` view when casting a
// PERMANENT that also has `activationCost` — `triggers` stay intact on
// that same view. A real ETB (`Trigger.on === 'enter'`, card.ts) then
// auto-fires from `resolveTop` once the permanent lands on the
// battlefield — real MTG doesn't require choosing to trigger an ETB, it
// just happens. See ENGINE_GAPS.md for the fuller writeup.
//
// Every action that CAN be illegal returns `ActionResult` (`{ok:true}` or
// `{ok:false, reason}`) rather than throwing or silently doing nothing —
// a caller (or a test asserting "this move should be rejected") always gets
// an explicit answer.
//
// ── Explicit scope for this first slice ─────────────────────────────────
// IN:
//  - Sorcery-speed timing (307.1a/117.1a): a non-Instant, non-Flash spell
//    can only be cast during the caster's own Main1/Main2 with an empty
//    stack. (Real 117.1a also requires the caster HOLD priority at that
//    moment — this simplified priority model, per priority.ts's own header,
//    has no persistent "who currently holds priority" state between calls,
//    so that half isn't separately checked; scripting a `castSpell` call
//    only between `stepPriority` rounds is how a caller keeps this honest.)
//  - Mana-cost affordability (601.2g/602.2c) against real untapped basic
//    lands, PLUS a narrow real slice of non-basic mana sources (a
//    single-color, unrestricted "{T}: Add {X}." static ability — see
//    mana.ts's own scope note for exactly which real cards qualify and
//    which don't yet), with real 302.6 summoning-sickness enforcement
//    for a creature mana source (`payableManaSources`).
//  - Activated-ability legality (602.1) — same sorcery-speed-timing/
//    affordability shape as casting, plus real `{T}`-cost tapping, plus a
//    real Equip {N} mana-only cost (301.5c's own sorcery-speed timing,
//    `isEquipment`), plus real Crew N (702.121b/c — tap creatures with
//    total power >= N, an explicit `crewedBy` list, no sickness/timing
//    restriction on the tapped creatures), plus a real "Sacrifice
//    another/a/two X" cost when the card's OWN `effects` already pay it
//    for real at resolution (Ahriman/Phantom Train/Quina, Qu Gourmet —
//    see `unsupportedCostComponent`'s own doc comment). Only a
//    {T}/Equip/Crew/matched-Sacrifice + mana-only cost is payable; a real
//    self-Sacrifice/Pay-life/{X} cost component (common among the 312 FIN
//    cards — see `unsupportedCostComponent`'s own doc comment) is REJECTED (a real,
//    explicit answer), not silently mispaid.
//  - Summoning sickness (302.6) and Defender/tapped-creature attack
//    restrictions (508.1a).
//  - Blocking legality (509.1: creature/controller/tapped/Unblockable/
//    Flying-Reach) and Menace (509.1b/702.111b), all-or-nothing like
//    `declareAttackers`.
//  - Real combat damage (510): unblocked-vs-blocked-vs-blocked-but-
//    blockers-gone assignment, Trample overflow (702.19c), Deathtouch
//    lethal-amount (702.2e), and First/Double Strike's two-sub-step
//    ordering (510.5) modeled as two internal passes. See
//    `resolveCombatDamage`'s own doc comment for the one real thing it
//    does NOT do (destroy a lethally-damaged creature — that's SBAs,
//    checked separately via `sba.ts`, not this file).
//  - A narrow, real subset of state-based actions (704) — see `sba.ts`,
//    a separate file (not this one): 704.5f/704.5g/704.5h/704.5j.
// OUT (real, plainly-flagged gaps, not silently assumed away):
//  - Target-legality checking at cast/declare time. This model's own
//    existing effect system (card.ts) resolves/chooses targets LAZILY,
//    inside `resolveCard`, at RESOLUTION time — there is no pre-resolution
//    "declare and validate targets" step anywhere in this codebase to hook
//    a legality check onto. Retrofitting one would mean redesigning
//    `Effect`'s entire resolution model, which is out of scope here.
//  - The rest of 704 (player loses at 0 life, planeswalker loyalty 0,
//    damage clearing at cleanup) — see `sba.ts`'s own header for exactly
//    what's covered vs. not.
//  - Alternate costs, X spells, split/modal costs, casting from anywhere
//    but hand.
//  - A real "does the AI/player want to respond" decision process —
//    unchanged from priority.ts's own explicit scope: every round's choices
//    are supplied by the caller, never simulated here.

import type { CardDefinition, EffectContext, Actions, AlternateCost, ActivationCostReduction } from './card';
import type { GameState, RealCard, RealPlayer } from './state';
import { effectivePT, effectiveTypes, effectiveKeywords, isLethallyDamaged, activeSpellCostDiscount, isActivationLocked, hasCounterConditionalAbilityLoss, wrapCard } from './state';
import { Stack, type StackObject } from './stack';
import { fireTrigger } from './triggers';
import { runPriorityRound, type PriorityChoice, type PriorityOutcome } from './priority';
import {
  startGame,
  currentPhase,
  activePlayer,
  advancePhase,
  queueExtraTurn as turnQueueExtraTurn,
  queueExtraPhase as turnQueueExtraPhase,
  isFirstPhaseGroupOccurrenceThisTurn,
  type TurnState,
  type PhaseGroup,
} from './turn';
import { parseManaCost, reduceGenericCost, resolveXCost, formatManaCost, type ParsedManaCost, canAfford, payMana, untappedManaSources, sourceColors } from './mana';
import { advanceSaga, advanceSagasAfterDrawStep } from './saga';
import { checkStateBasedActions } from './sba';

export type ActionResult = { ok: true } | { ok: false; reason: string };

/** `ActionResult` plus, on success, exactly which real mana sources got tapped to pay for it (`mana.ts`'s own `payMana` already picks these deterministically — this just surfaces the choice instead of throwing it away, so a caller like `engine-trace.ts`'s pilot logging can report WHICH lands paid for something instead of only that some real cost was paid). Empty/omitted when nothing needed tapping for mana (a `{T}`-only ability, e.g.). */
export type CastResult = ActionResult & { tappedForMana?: RealCard[] };

export interface GameEngine {
  state: GameState;
  players: RealPlayer[];
  turn: TurnState;
  stack: Stack;
  /**
   * Real card id -> the turn number it entered the battlefield (302.6's own
   * "continuously under that player's control since their most recent turn
   * began"). Tracked here, not on `RealCard` itself (state.ts's own shape is
   * shared with `harness.ts`'s unrelated scenario-setup path, which has no
   * notion of "which turn" a filler permanent was seeded on) — a permanent
   * with no entry here is treated as having always been in play (not sick),
   * matching how a scenario's own initial board setup works.
   */
  enteredThisTurn: Map<number, number>;
  /**
   * This combat's declared attackers (508.1) — needed because tapped state
   * alone can't reconstruct "who's attacking" (a Vigilance attacker never
   * taps at all, `CombatUtil.getAttackers()`'s real equivalent,
   * forge-game/.../combat/Combat.java's own `attackers` list). Set fresh by
   * `declareAttackers` on success; empty otherwise (no attack declared yet,
   * or combat's over).
   */
  attackers: RealCard[];
  /**
   * This combat's blocking assignments (509) — attacker id -> the blockers
   * assigned to it (absent/empty = unblocked), same shape as real Forge's
   * own `Combat.java` `attackerToBlockers` multimap. Set fresh by
   * `declareBlockers` on success.
   */
  blockers: Map<number, RealCard[]>;
  /**
   * Real card id -> the `CardDefinition`/`EffectContext`/`Actions` it
   * resolved with when it last entered the battlefield via THIS engine's
   * own `castSpell`+`resolveTop` — the same triple a `StackObject` already
   * carries, captured here so `fireOnPhaseEnterTriggers` (below) has
   * something to call `resolveCard` with for an `on: 'upkeep'`/`'endStep'`
   * trigger LONG after the spell that put the permanent there already
   * resolved and left the stack. A permanent seeded directly onto the
   * battlefield (scenario setup, never cast through this engine) has no
   * entry here — its upkeep/end-step triggers simply won't auto-fire, a
   * real, documented gap (ENGINE_GAPS.md), not a silent success. Never
   * pruned when a permanent leaves the battlefield (harmless: nothing
   * looks up a card id that's no longer in `battlefield`), same "grows,
   * never explicitly cleaned up" convention `enteredThisTurn` already uses.
   */
  resolvedPermanents: Map<number, { card: CardDefinition; ctx: EffectContext; actions: Actions }>;
}

export function createEngine(state: GameState, players: RealPlayer[]): GameEngine {
  return {
    state,
    players,
    turn: startGame(),
    stack: new Stack(),
    enteredThisTurn: new Map(),
    attackers: [],
    blockers: new Map(),
    resolvedPermanents: new Map(),
  };
}

function isInstantSpeed(card: CardDefinition): boolean {
  return /\bInstant\b/.test(card.typeLine) || (card.keywords?.includes('Flash') ?? false);
}

/** Real 307.1a/117.1a sorcery-speed timing, minus the priority-holder half (see this file's own header). */
function sorcerySpeedTimingOk(engine: GameEngine, caster: RealPlayer): boolean {
  const active = activePlayer(engine.turn, engine.players);
  const phase = currentPhase(engine.turn);
  return active.id === caster.id && (phase === 'Main1' || phase === 'Main2') && engine.stack.isEmpty();
}

/**
 * `untappedManaSources`, further excluding a CREATURE mana source that's
 * still summoning-sick (302.6 — this rule applies to any activated
 * ability with `{T}`/`{Q}` in its own cost, not just attacking/tapping
 * for combat; Haste exempts it, same as `canActivateAbility`'s own
 * identical check). A basic land or non-creature mana-ability source
 * (mana.ts's own narrow slice — Midgar/White Auracite/etc.) is never
 * summoning-sick in the first place (302.6 only ever restricts
 * CREATURES), so this only ever removes real creature-dork sources
 * (Druid of the Cowl/Goobbue Gardener/Llanowar Elves) that entered this
 * same turn.
 */
function payableManaSources(engine: GameEngine, player: RealPlayer): RealCard[] {
  return untappedManaSources(player).filter((c) => {
    if (!effectiveTypes(c).includes('Creature')) return true;
    const enteredTurn = engine.enteredThisTurn.get(c.id);
    // `effectiveKeywords`, not raw `c.keywords` (2026-09-12, ENGINE_GAPS.md
    // gap #14) — a GRANTED Haste (Ardyn's own "Demons... have haste") needs
    // to genuinely exempt sickness, same reasoning `canAttack`/
    // `canActivateAbility`'s own identical checks below get.
    const sick = enteredTurn === engine.turn.turnNumber && !effectiveKeywords(engine.state, c).includes('Haste');
    return !sick;
  });
}

/** Exported (2026-09-12, ENGINE_GAPS.md gap #16) so `canPlayFromLibraryTop`/`engine-trace.ts`'s own real "play from library top" dispatch can reuse this exact 305.1 typeLine check instead of re-deriving it. */
export function isLandTypeLine(typeLine: string): boolean {
  return /\bLand\b/.test(typeLine);
}

/** Real CR 601.2f condition check for `card.ts`'s `CostReduction` — see that interface's own doc comment for the real Forge citation. Only the single condition shape a real card needs is modeled (`tappedCreatureTarget` — Forge's own `ValidTarget$ Creature.tapped`, BOTH a Creature type AND tapped, checked via `effectiveTypes` so a Crew-animated Vehicle counts); `declaredTarget` is the caller-supplied `RealCard` this spell is being cast at (same "caller supplies the real object" shape `crewedBy` already established for Crew) — absent (no target chosen yet, or a non-targeted cast) always means the condition is false, never a silent match. */
function costReductionCondition(condition: 'tappedCreatureTarget', declaredTarget: RealCard | undefined): boolean {
  switch (condition) {
    case 'tappedCreatureTarget':
      return declaredTarget !== undefined && declaredTarget.tapped === true && effectiveTypes(declaredTarget).includes('Creature');
  }
}

/**
 * Real CR 601.2f cost, computed for THIS specific cast — `card.manaCost`
 * (or `alt.cost`, an `AlternateCost` replacement, see `canCastSpell`'s own
 * doc comment), with `{X}` resolved first (CR 601.2b, `x` — a caller-chosen
 * value, same "caller supplies the real choice" shape `declaredTarget`
 * already establishes; defaults to 0 per `resolveXCost`'s own doc
 * comment), THEN discounted by up to THREE independent, real,
 * real-Forge-distinct mechanisms, summed (118.9 lets multiple "costs {N}
 * less" effects stack):
 *  - `card.costReduction.condition`/`.amount` — THIS card's own
 *    target-conditional discount (Fate of the Sun-Cryst), applied only if
 *    its own condition holds against `declaredTarget`.
 *  - `card.costReduction.perControlled` — THIS card's own board-state-
 *    COUNTED discount (Travel the Overworld's own "Affinity for Towns" —
 *    ENGINE_GAPS.md gap #7, closed 2026-09-12), unconditional: `caster`'s
 *    real battlefield permanents whose subtypes include
 *    `perControlled.subtype`, counted fresh, times
 *    `perControlled.amountPerMatch` — the same mechanism
 *    `effectiveActivationCost` already uses for `ActivationCostReduction`
 *    on the activated-ability side, applied here to a spell's own cast cost
 *    instead. Mutually exclusive with the target-conditional case above on
 *    any one card (`card.costReduction` picks one shape or the other);
 *    needs `caster` supplied, same as the broadcast case below.
 *  - `caster`'s own battlefield permanents' `spellCostReductionGrants` — a
 *    flat, unconditional, color-gated BROADCAST discount from a DIFFERENT
 *    permanent (The Wind Crystal's own "White spells you cast cost {1}
 *    less"), via `state.ts`'s `activeSpellCostDiscount`, checked against
 *    THIS spell's own colored mana-cost pips. Omitted (no discount) when
 *    `caster` isn't supplied — same "irrelevant/ignored" treatment
 *    `declaredTarget` already gets for a card with no `costReduction`.
 * None of these apply when `alt` is set (a real `AlternateCost` REPLACES the
 * whole cost, CR 702.32/702.67 — see below). Returns the parsed (for
 * affordability/payment) AND the printed-style string (for trace logging
 * the cost actually paid, not just the nominal one) — see `mana.ts`'s
 * `formatManaCost`. Exported so `engine-trace.ts`'s `pilotCast` can log the
 * real string without re-deriving this logic.
 */
export function effectiveCastCost(card: CardDefinition, alt?: AlternateCost, declaredTarget?: RealCard, x?: number, caster?: RealPlayer): { cost: ParsedManaCost; costString: string; discounted: boolean } {
  const costString = alt?.cost ?? card.manaCost;
  const parsed = parseManaCost(costString);
  const xWasResolved = parsed.xCount > 0;
  const cost = xWasResolved ? resolveXCost(parsed, x) : parsed;
  // Once `{X}` is resolved, the nominal printed `costString` ("{X}{R}{R}")
  // no longer matches what's actually being paid — reformat it the same
  // way a real cost-reduction discount already does below, so trace
  // logging shows the real chosen cost, not the printed template.
  const resolvedCostString = xWasResolved ? formatManaCost(cost) : costString;
  if (alt) {
    // A real `AlternateCost` REPLACES the whole cost (Flashback/Jump-start,
    // CR 702.32/702.67) — both discount mechanisms below are defined
    // against the card's own NORMAL `manaCost`, not against an alternate
    // cost that's already a distinct, separately-printed number, so
    // neither is applied here (no real FIN card has both today; this is
    // the same "don't silently combine two independent cost-modification
    // mechanisms with no real card to check the interaction against"
    // caution `alt`'s own doc comment already applies elsewhere).
    return { cost, costString: resolvedCostString, discounted: false };
  }
  let discount = 0;
  if (card.costReduction?.perControlled) {
    // Board-state-COUNTED case (Travel the Overworld's own "Affinity for
    // Towns") — unconditional, no `declaredTarget` gate at all; needs
    // `caster` to actually count anything (same "irrelevant/ignored
    // without a caster" treatment the broadcast case below already has).
    if (caster) {
      const { amountPerMatch, subtype } = card.costReduction.perControlled;
      const matchCount = caster.battlefield.filter((c) => c.subtypes.includes(subtype)).length;
      discount += amountPerMatch * matchCount;
    }
  } else if (card.costReduction?.condition && costReductionCondition(card.costReduction.condition, declaredTarget)) {
    discount += card.costReduction.amount ?? 0;
  }
  if (caster) {
    const cardColors = Object.entries(cost.colors)
      .filter(([, count]) => (count ?? 0) > 0)
      .map(([color]) => color);
    discount += activeSpellCostDiscount(caster, cardColors);
  }
  if (discount <= 0) {
    return { cost, costString: resolvedCostString, discounted: false };
  }
  const reduced = reduceGenericCost(cost, discount);
  return { cost: reduced, costString: formatManaCost(reduced), discounted: true };
}

/**
 * Read-only legality check — same checks `castSpell` performs before it
 * mutates anything, exposed separately so a caller (or a test asserting
 * "this SHOULD be illegal") doesn't have to attempt-and-undo.
 *
 * `alt` (optional) is one of `card.alternateCosts` — Flashback (CR
 * 702.32), Jump-start, casting from exile, etc. When given, the AFFORDABLE
 * cost checked is `alt.cost` instead of `card.manaCost` (real Forge:
 * `AlternativeCost.java` — the alternate cost REPLACES the mana cost, it
 * doesn't add to it). Timing is unaffected: CR 702.32 explicitly casts a
 * flashback spell "following the normal rules for casting that card" — an
 * Instant is still instant-speed, a Sorcery is still sorcery-speed,
 * regardless of which cost paid for it — so `isInstantSpeed(card)`/
 * `sorcerySpeedTimingOk` are still evaluated against `card` itself, not
 * `alt`. This function does NOT check that the caller actually holds the
 * card in `alt.from`'s zone — same "trust the caller" contract this
 * function already has for a normal hand-cast (no RealCard reference is
 * even passed here to check against).
 *
 * `declaredTarget` (optional) is the real object the caster intends to
 * target with this spell — ONLY consulted for `card.costReduction`'s own
 * condition (real 601.2b targets are chosen before 601.2f's cost is
 * determined; see `card.ts`'s `CostReduction` doc comment for why this is
 * a separate param rather than reusing this model's own lazy,
 * resolution-time target selection). Irrelevant/ignored for a card with no
 * `costReduction`.
 *
 * `x` (optional) is the real value the caster announces for a `{X}` in
 * `card.manaCost` (CR 601.2b, ENGINE_GAPS.md gap #6) — defaults to 0 (a
 * real, legal choice) when omitted, same shape as `declaredTarget`. ONLY
 * affects affordability/payment here — a caller wanting the card's own
 * EFFECT to see the same chosen value (Choco-Comet's own X damage,
 * Doppelgang's own X copies) must also set `ctx.xPaid` to the same number
 * when building the `EffectContext` passed to `castSpell`/`resolveCard`
 * (`card.ts`'s pre-existing `EffectContext.xPaid` field — this function
 * doesn't build or mutate `ctx` at all, so it can't set it for the caller).
 */
export function canCastSpell(engine: GameEngine, caster: RealPlayer, card: CardDefinition, alt?: AlternateCost, declaredTarget?: RealCard, x?: number): ActionResult {
  // Real CR 305.1: playing a land is a special action, NEVER a spell —
  // it has no mana cost to pay, never uses the stack, and isn't subject to
  // 601's casting process at all. Before this guard, neither this function
  // nor `castSpell` branched on `typeLine` at all, so a Land `CardDefinition`
  // passed here would be checked under ordinary spell-casting rules (its
  // empty `manaCost` parses as trivially affordable) and `castSpell` would
  // genuinely push it onto the Stack — a real, structural mistake (see
  // ENGINE_GAPS.md gap #12's own "dormant bug" writeup, checked: unreachable
  // only because no FIN land's own `scenarios.ts` called `castSpell`/
  // `pilotCast` before this pass). `canPlayLand`/`playLand` below are the
  // real, structurally-separate CR 305 path a land must go through instead.
  if (isLandTypeLine(card.typeLine)) {
    return { ok: false, reason: `"${card.name}" is a Land (305.1) — lands are never cast; use canPlayLand/playLand instead` };
  }
  if (!isInstantSpeed(card) && !sorcerySpeedTimingOk(engine, caster)) {
    return { ok: false, reason: `sorcery-speed timing violated (307.1a/117.1a): "${card.name}" can only be cast during your own main phase with an empty stack` };
  }
  const { cost, costString } = effectiveCastCost(card, alt, declaredTarget, x, caster);
  if (!canAfford(payableManaSources(engine, caster), cost)) {
    return { ok: false, reason: `cannot afford "${card.name}"'s ${alt ? `${alt.name} cost` : 'cost'} ${costString} (601.2g/602.2c) — not enough untapped mana sources` };
  }
  return { ok: true };
}

/**
 * Legality-checks, then (if legal) pays the real cost and pushes the spell
 * onto the real stack — `cardReal` is the actual `RealCard` being cast
 * (moved to the Stack zone here, real 405.2 — normally in `caster`'s hand,
 * or wherever `alt.from` names for an alternate-cost cast, see below),
 * `ctx`/`actions` are the same `EffectContext`/`Actions` `resolveCard` will
 * eventually run against (build them the same way `harness.ts`'s own
 * `runScenario` does). Returns `{ok:false, reason}` and mutates NOTHING if
 * illegal.
 *
 * `alt` (optional, one of `card.alternateCosts`) pays `alt.cost` instead of
 * `card.manaCost` (see `canCastSpell`'s own doc comment) and, if
 * `alt.thenExile` is set (Flashback/Jump-start, CR 702.32/702.67), tags
 * the pushed `StackObject` so `resolveTop` sends it to Exile instead of the
 * Graveyard once it resolves. Does NOT itself move `cardReal` out of
 * `alt.from`'s zone first — same "trust the caller already has it there"
 * contract `canCastSpell` documents; `engine.state.move(cardReal, 'Stack')`
 * below splices it out of whatever zone it's actually in.
 *
 * `declaredTarget` (optional) — see `canCastSpell`'s own doc comment for
 * its `card.costReduction`-condition use. ALSO now (ENGINE_GAPS.md gap #4,
 * closed 2026-09-12) genuinely locks in this spell's own real cast-time
 * target: recorded on the pushed `StackObject` (wrapped once via
 * `state.ts`'s `wrapCard`) as `declaredTargets: [declaredTarget]` unless
 * `declaredTargets` (below) is explicitly given instead — `resolveTop`
 * threads it onto `ctx.declaredTargets`, and `card.ts`'s own
 * `resolveTargets` re-validates it against live state at resolution,
 * dropping it (fizzling the effect, CR 608.2b) rather than falling back to
 * a fresh pick if it's no longer legal. Fate of the Sun-Cryst's real shape
 * — a cost-reduction condition keyed on the SAME object the spell's own
 * "destroy target nonland permanent" targets — is exactly why a single
 * `declaredTarget` naturally serves both roles; a card whose cost-reduction
 * target and actual spell target genuinely differ (no real FIN card does)
 * would need `declaredTargets` instead. Still NOT itself legality-checked
 * at cast time — see `card.ts`'s `EffectContext.declaredTargets` doc
 * comment for that documented, narrower scope note. A caller wanting the
 * OLD lazy-`chooseTarget`-at-resolution behavior for a target-bearing
 * effect should still also set `ctx.preferTarget` (unaffected by this,
 * still consulted whenever no `declaredTargets` survive resolution's own
 * `resolveTargets` check — i.e., whenever this param is omitted).
 *
 * `declaredTargets` (optional) — the general, multi-target form of the
 * above (Fight On!'s own "return up to two target creature cards," e.g.) —
 * takes precedence over the `[declaredTarget]` single-element default when
 * given.
 *
 * `x` (optional) — see `canCastSpell`'s own doc comment; same "affects
 * payment only, set `ctx.xPaid` yourself for the effect to see it" caveat.
 */
export function castSpell(engine: GameEngine, caster: RealPlayer, cardReal: RealCard, card: CardDefinition, ctx: EffectContext, actions: Actions, triggerName?: string, alt?: AlternateCost, declaredTarget?: RealCard, x?: number, declaredTargets?: RealCard[]): CastResult {
  const check = canCastSpell(engine, caster, card, alt, declaredTarget, x);
  if (!check.ok) return check;
  const { cost } = effectiveCastCost(card, alt, declaredTarget, x, caster);
  const tappedForMana = payMana(engine.state, payableManaSources(engine, caster), cost);
  fireOnTapLandForManaTriggers(engine, caster, tappedForMana);
  const targets = declaredTargets ?? (declaredTarget ? [declaredTarget] : undefined);
  engine.state.move(cardReal, 'Stack');
  // A permanent with its OWN `activationCost` reserves `card.effects` for
  // that LATER activation (602.1) — real Magic has no "cast effects" for a
  // permanent at all beyond entering the battlefield (that's `triggers`,
  // not `effects`; see card.ts's own `CardDefinition.effects` doc comment:
  // "an Instant/Sorcery's cast effect, OR an activated ability's effect").
  // `resolveCard(card, ctx, actions)` with no trigger/ability name defaults
  // to running `card.effects` — exactly wrong for a plain cast of one of
  // these cards (Jill, Shiva's Dominant's own `{3}{U}{U}, {T}: exile,
  // return transformed` would otherwise fire the instant Jill resolves as
  // a creature, which is not what casting her does). `harness.ts` never
  // hits this because its own `lifecycleBefore` treats ANY
  // `activationCost`-bearing card's scenario as an ACTIVATION, never a
  // plain cast — this engine's own `castSpell` genuinely models a plain
  // cast, so it needs its own fix: push a shallow view with `effects`
  // stripped, so the default branch finds nothing to run. `triggers`
  // (an ETB, e.g.) stay intact on this same view — see `resolveTop`'s own
  // auto-fire of a `Trigger.on === 'enter'` entry below. See
  // ENGINE_GAPS.md for the fuller writeup of why this collision exists.
  const pushedCard = isPermanentTypeLine(card.typeLine) && card.activationCost ? { ...card, effects: undefined } : card;
  engine.stack.push({ card: pushedCard, ctx, actions, triggerName, thenExile: alt?.thenExile, declaredTargets: targets?.map((t) => wrapCard(engine.state, t)) });
  return { ok: true, tappedForMana };
}

function isPermanentTypeLine(typeLine: string): boolean {
  return !/\b(Instant|Sorcery)\b/.test(typeLine);
}

/**
 * Real CR 305 "playing a land" — a genuinely SEPARATE special action from
 * casting (see `canCastSpell`'s own new typeLine guard above), never a
 * spell: no mana cost paid, no trip through the Stack, no priority-response
 * window this action itself creates. Modeled after real Forge's own
 * `Player.canPlayLand`/`Player.playLand` (`Player.java` ~line 1624-1688):
 *  - `canPlayLand` mirrors `Player.canPlayLand`'s own 305.3 timing check —
 *    `Player.canCastSorcery()` (own turn + main phase + empty stack,
 *    `Player.java` ~line 2508-2511) is the EXACT same rule this file's
 *    `sorcerySpeedTimingOk` already implements for a sorcery-speed spell, so
 *    this reuses that gate rather than inventing a second one — plus the
 *    real once-per-turn land-drop limit (`Player.getLandsPlayedThisTurn() <
 *    Player.getMaxLandPlays()`, default max 1 — no FIN card raises the max
 *    yet, see `RealPlayer.landsPlayedThisTurn`'s own doc comment for the one
 *    real, flagged exception this doesn't cover, Zell Dincht).
 *  - `playLand` mirrors `Player.playLand` itself: a real, direct
 *    Hand -> Battlefield move (`game.getAction().moveTo`, no Stack
 *    involved), then fires the real ETB (`TriggerType.LandPlayed` in real
 *    Forge; this engine's own `Trigger.on === 'enter'` convention, same one
 *    `resolveTop` already auto-fires for a cast permanent — a land's own
 *    onEnter trigger, e.g. Vector, Imperial Capital's tap-a-land ETB, is
 *    genuinely real and needs to fire here too), then increments the
 *    per-turn counter (`Player.addLandPlayedThisTurn`). Unlike
 *    `castSpell`+`resolveTop`'s own two-call split (needed because a spell
 *    waits on the Stack for priority), this is ONE call — CR 305.1 lands
 *    never wait for anything, so there's no separate "resolve" step to
 *    pair it with.
 */
export function canPlayLand(engine: GameEngine, caster: RealPlayer, card: CardDefinition): ActionResult {
  if (!isLandTypeLine(card.typeLine)) {
    return { ok: false, reason: `"${card.name}" is not a Land (305.1) — use canCastSpell for a spell instead` };
  }
  if (!sorcerySpeedTimingOk(engine, caster)) {
    return { ok: false, reason: `land-play timing violated (305.3): "${card.name}" can only be played during your own main phase with an empty stack` };
  }
  if ((caster.landsPlayedThisTurn ?? 0) >= 1) {
    return { ok: false, reason: `land-play limit reached (305.1): you've already played a land this turn` };
  }
  return { ok: true };
}

/**
 * Legality-checks, then (if legal) performs the real CR 305.1 special
 * action: moves `cardReal` Hand -> Battlefield directly (never touching the
 * Stack), stamps it for summoning-sickness purposes and mana-ability
 * derivation exactly like `resolveTop` already does for a cast permanent
 * (`enteredThisTurn`/`resolvedPermanents`/`manaAbilities` — a land needs all
 * three same as any other permanent: a creature land could still be
 * summoning-sick, and a mana-producing land like Midgar needs its
 * `manaAbilities` copied the same way any other mana source's are), fires
 * its own real ETB trigger if it has one, then increments the per-turn
 * land-drop counter. Returns `{ok:false, reason}` and mutates NOTHING if
 * illegal.
 */
export function playLand(engine: GameEngine, caster: RealPlayer, cardReal: RealCard, card: CardDefinition, ctx: EffectContext, actions: Actions): ActionResult {
  const check = canPlayLand(engine, caster, card);
  if (!check.ok) return check;
  engine.state.move(cardReal, 'Battlefield');
  engine.enteredThisTurn.set(cardReal.id, engine.turn.turnNumber);
  engine.resolvedPermanents.set(cardReal.id, { card, ctx, actions });
  cardReal.manaAbilities = card.manaAbilities;
  // Same "copy once at resolve time, RealCard keeps no live CardDefinition
  // reference" treatment `resolveTop` gives every other continuous grant —
  // no real FIN land carries `triggerDoubling` today, but a land IS one of
  // the two real entering-permanent shapes Traveling Chocobo's own gate
  // checks for, so this stays consistent rather than a silent asymmetry.
  cardReal.triggerDoubling = card.triggerDoubling;
  caster.landsPlayedThisTurn = (caster.landsPlayedThisTurn ?? 0) + 1;
  const enterTrigger = card.triggers?.find((t) => t.on === 'enter');
  // Real "entersBattlefield" cause (ENGINE_GAPS.md gap #13, Traveling
  // Chocobo's own "a land ... entering causes a triggered ability ... to
  // trigger" gate) — `cardReal` is both the entering permanent AND (when it
  // has one) the trigger's own source, same as a card's own ETB can be the
  // very thing a doubling gate is checking for.
  if (enterTrigger) fireTrigger(engine.state, card, ctx, actions, enterTrigger.name, { kind: 'entersBattlefield', entered: cardReal });
  return { ok: true };
}

/**
 * CR 601/305's own umbrella "play" (ENGINE_GAPS.md gap #16) — real Forge's
 * own `PlayEffect.resolve()` (forge-game/.../ability/effects/PlayEffect.java
 * ~line 330-351) dispatches a played card purely on whether it's a land
 * ability (`tgtSA.isLandAbility()` — resolved directly, `tgtSA.resolve()`,
 * never touching the stack) or an ordinary spell ability
 * (`controller.getController().playSaFromPlayEffect(tgtSA)`, ~line 307-473
 * — the real cast path, same stack/priority flow as an ordinary hand-cast).
 * This is the identical dispatch, reusing this file's own real
 * `canPlayLand`/`playLand` (a land) and `canCastSpell`/`castSpell`
 * (anything else) pairs rather than reimplementing either — The Lunar
 * Whale's own "As long as The Lunar Whale attacked this turn, you may play
 * the top card of your library" (fin/60) is the real FIN card that needs
 * this; Traveling Chocobo (fin/158)'s own "You may play lands and cast Bird
 * spells from the top of your library" carries the identical vocabulary and
 * can reuse this same primitive once/if migrated.
 *
 * Unlike `canCastSpell`/`canPlayLand` (which only need the `CardDefinition`
 * — any hand copy of that card is as legal as any other), this ALSO takes
 * `cardReal` and verifies it's genuinely the real top card of `caster`'s own
 * library right now (`caster.library[0]`) — the one thing that actually
 * makes this CR 601/305's "play the top card of your library" rather than
 * an ordinary hand-cast/land-play. The CALLER (a card's own effect/trigger
 * wiring — The Lunar Whale's "as long as it attacked this turn," e.g.) is
 * responsible for checking whatever permission actually GRANTS this special
 * action in the first place (see `RealCard.attackedThisTurn`, state.ts) —
 * this primitive only ever dispatches the mechanical HOW, never the
 * WHETHER, same "engine primitives don't know about a specific card's own
 * gating condition" split `crewedBy`/`declaredTarget` already establish
 * elsewhere in this file.
 */
export function canPlayFromLibraryTop(engine: GameEngine, caster: RealPlayer, cardReal: RealCard, card: CardDefinition): ActionResult {
  if (caster.library[0]?.id !== cardReal.id) {
    return { ok: false, reason: `"${card.name}" is not the top card of ${caster.name}'s library` };
  }
  return isLandTypeLine(card.typeLine) ? canPlayLand(engine, caster, card) : canCastSpell(engine, caster, card);
}

/**
 * Legality-checks (see `canPlayFromLibraryTop`'s own doc comment for the
 * real Forge citation and the WHETHER/HOW split), then dispatches to the
 * real `playLand` (a land — direct Battlefield move, no stack) or
 * `castSpell` (anything else — real cost paid, pushed onto the real stack;
 * a caller still needs a separate `resolveTop` to actually resolve it, same
 * two-call split every other cast in this engine already has). Returns
 * `{ok:false, reason}` and mutates NOTHING if illegal.
 */
export function playFromLibraryTop(engine: GameEngine, caster: RealPlayer, cardReal: RealCard, card: CardDefinition, ctx: EffectContext, actions: Actions): CastResult {
  const check = canPlayFromLibraryTop(engine, caster, cardReal, card);
  if (!check.ok) return check;
  return isLandTypeLine(card.typeLine) ? playLand(engine, caster, cardReal, card, ctx, actions) : castSpell(engine, caster, cardReal, card, ctx, actions);
}

/** Whether `cost`'s own free text requires tapping the permanent itself ({T}) as part of paying (602.1). `CardDefinition.activationCost` is a plain string — no structured cost grammar exists — so this, like the helpers below, is real but narrow text-pattern detection, not a parser. Exported (2026-09-12, venat-heart-of-hydaelyn-hydaelyn-the-mothercrystal) so `engine-trace.ts`'s own `pilotActivate` can log a real self-tap-for-cost trace line — see that call site's own doc comment for why. */
export function costRequiresTap(cost: string): boolean {
  return /\{T\}/.test(cost);
}

/**
 * Whether `cost`'s own free text requires paying N life as part of the cost
 * (ENGINE_GAPS.md gap #11's real remainder — checked every real
 * `activationCost`/ability `cost` string across the pool: Ring of the
 * Lucii's own "{2}, {T}, Pay 1 life", Elven Passage's own "{T}, Pay 1 life,
 * Sacrifice this land", Dark Knight's Greatsword's own "Equip—Pay 3 life
 * (activate only once each turn)"). Returns the real life total required,
 * or `undefined` if this cost has no such component — same "real but narrow
 * text-pattern detection, not a parser" shape `costRequiresTap` already
 * establishes (`CardDefinition.activationCost` has no structured cost
 * grammar at all).
 */
export function costRequiresLifePayment(cost: string): number | undefined {
  const match = /\bPay (\d+) life\b/i.exec(cost);
  return match ? Number(match[1]) : undefined;
}

/**
 * Whether `cost`'s own free text requires discarding the activating
 * permanent ITSELF as part of the cost (ENGINE_GAPS.md gap #23 — real 702.13
 * Cycling/TypeCycling, `CardFactoryUtil.java` ~lines 3717-3745: `AB$ Draw |
 * Cost$ <mana> Discard<1/CARDNAME> | ActivationZone$ Hand` for plain
 * Cycling, `AB$ ChangeZone | Cost$ <mana> Discard<1/CARDNAME> |
 * ActivationZone$ Hand | Origin$ Library | Destination$ Hand | ChangeType$
 * <type>` for TypeCycling). Real card scripts: `res/cardsfolder/t/
 * tranquil_thicket.txt`'s `K:Cycling:2`, `res/cardsfolder/t/
 * timeless_dragon.txt`'s `K:TypeCycling:Plains:2`. Same "real but narrow
 * text-pattern detection, not a parser" shape `costRequiresTap`/
 * `costRequiresLifePayment` already establish — `CardDefinition.activationCost`
 * has no structured cost grammar at all, so this card's own cost STRING
 * literally spells out "Discard this card" (matching Forge's own
 * `Discard<1/CARDNAME>` cost-string convention), same comma-separated shape
 * `unsupportedCostComponent`'s own loop already parses every other
 * component with.
 *
 * Unlike self-Sacrifice (deliberately left UNSUPPORTED — see
 * `unsupportedCostComponent`'s own doc comment above), discarding the
 * source card as a cost is genuinely SAFE to pay for real here: Cycling's
 * own resolution effect (`drawCard`, or `move`'s real library search) never
 * reads `ctx.self`'s post-discard state the way Zack Fair/Blazing Bomb's own
 * self-sacrifice effects do — a card being cycled just draws/searches, so
 * there's no 608.2h last-known-information concern to work around.
 */
export function costRequiresDiscardSelf(cost: string): boolean {
  return /Discard this card\b/i.test(cost);
}

/** The pure mana-symbol portion of an activationCost string, with `{T}` (handled separately by `costRequiresTap`) and any parenthetical restriction text ("(activate only as a sorcery)") stripped first — `parseManaCost` would otherwise throw trying to parse `{T}` as a color/generic symbol. */
function manaPortionOf(cost: string): string {
  return cost.replace(/\{T\}/g, '').replace(/\([^)]*\)/g, '');
}

/**
 * A real activationCost pool-wide sweep (`grep -ohP "activationCost: '[^']*'"` across every `functional-model/cards/<slug>/definition.ts`)
 * shows this is genuinely common — "Sacrifice another artifact or creature",
 * "{1}, Sacrifice Zack Fair", "Crew 1 (...)", "Equip {1}", "{X}, {T} (...)",
 * "Pay 1 life" all exist among the real 312 cards — so this can't be
 * quietly ignored. Returns the first comma-separated cost component that
 * is NOT pure {T}/mana symbols (after stripping both, see above), or
 * `undefined` if the whole cost is payable through this engine's own
 * mana+tap-only model. `canActivateAbility` rejects (doesn't throw) on a
 * hit — a real, common shape, not a programming error.
 */
function unsupportedCostComponent(cost: string, card: CardDefinition): string | undefined {
  // A real card's own printed "Equip {N}"/"Equip—" cost-string prefix is
  // NOT itself an extra cost component to pay (real Forge's own
  // `Equip.java`/`CostEquip` never generates a Sacrifice/Pay-life/etc.
  // requirement from the bare keyword) — it's just how equip costs are
  // templated. Stripped here the same way `{T}` is, so a mana-only equip
  // cost ("Equip {1}", coral-sword, e.g.) parses as pure mana; a NON-mana
  // equip cost ("Equip—Pay 3 life...", dark-knight-s-greatsword) still
  // correctly falls through to the loop below and gets rejected, since
  // "Pay 3 life" itself remains unsupported.
  const stripped = cost.replace(/^Equip[\s—-]*/, '').replace(/\{T\}/g, '').replace(/\([^)]*\)/g, '');
  for (const part of stripped.split(',').map((p) => p.trim()).filter(Boolean)) {
    // "Sacrifice another X"/"Sacrifice a X"/"Sacrifice two X" (NEVER self —
    // that wording always names a DIFFERENT permanent, unlike "Sacrifice
    // this X"/"Sacrifice <CardName>") is accepted iff `card.effects`
    // already declares a real `{kind:'sacrifice', ...}` effect — checked
    // against the real pool: Ahriman, Phantom Train, and Quina, Qu
    // Gourmet's own `definition.ts` files all already model paying this
    // EXACT cost as the FIRST resolution effect (their own comments say
    // so explicitly — a documented, deliberate "cost modeled as effect #1
    // for trace visibility" simplification, not something this pass
    // invented), so accepting the cost string here causes NO double
    // payment — the real consequence already happens for real once
    // `resolveCard` runs. A card whose OWN `effects` do NOT include a
    // matching `sacrifice` (The Gold Saucer's "Sacrifice two artifacts,"
    // e.g. — its own comment says the sacrifice is cost-only, not
    // modeled) still correctly falls through and gets rejected: accepting
    // it would let the ability resolve with nothing ever actually
    // sacrificed. Self-sacrifice ("Sacrifice this creature"/"Sacrifice
    // Zack Fair") is NOT recognized here at all — Blazing Bomb/Zack
    // Fair's own effects read `ctx.self`'s live state (power/counters)
    // AFTER the ability would resolve, which only stays correct today
    // because the sacrifice never actually happens; genuinely sacrificing
    // `self` as part of paying the cost would need real 608.2h
    // last-known-information tracking (a real, separate, unbuilt gap) to
    // keep those two cards correct, so self-sacrifice deliberately stays
    // unsupported rather than risk that regression.
    if (/^Sacrifice (another|an?|two)\b/i.test(part) && (card.effects ?? []).some((e) => e.kind === 'sacrifice')) continue;
    // "Pay N life" (ENGINE_GAPS.md gap #11's real remainder — Ring of the
    // Lucii/Elven Passage/Dark Knight's Greatsword's own real costs, see
    // `costRequiresLifePayment`'s own doc comment) — accepted here as a
    // real, payable cost component; `canActivateAbility`/`activateAbility`
    // separately check affordability (`controller.life >= N`) and actually
    // deduct it, the same "recognized in the string-parsing loop, paid for
    // real by a dedicated check elsewhere" split `{T}` already has via
    // `costRequiresTap`.
    if (costRequiresLifePayment(part) !== undefined) continue;
    // Real 702.13 Cycling's own "Discard this card" cost component
    // (ENGINE_GAPS.md gap #23) — see `costRequiresDiscardSelf`'s own doc
    // comment for why this is safe to actually pay (unlike self-Sacrifice
    // just above): `canActivateAbility`/`activateAbility` pay this for
    // real (a genuine Hand->Graveyard move, 701.9a), not merely trusted.
    if (/^Discard this card$/i.test(part)) continue;
    if (!/^(\{[^}]+\})+$/.test(part)) return part;
  }
  return undefined;
}

/** Real 301.5c: an Equipment's own equip ability can only be activated as a sorcery (same timing restriction as a land drop) — a real rule tied to the permanent's TYPE, not printed as "activate only as a sorcery" cost text the way other sorcery-speed-restricted activated abilities are (see `canActivateAbility`'s own text-pattern check just below this). Verified against the real pool: every Equipment card's own `definition.ts` here uses its bare top-level `activationCost` as its one equip ability, no `abilities` array — so "this permanent is an Equipment" is a safe, unambiguous stand-in for "this specific activated ability is the equip ability." */
function isEquipment(card: CardDefinition): boolean {
  return /\bEquipment\b/.test(card.typeLine);
}

/** The activationCost/`Ability.cost` string for one of `card`'s activated abilities — the single default one (`card.activationCost`) when `abilityName` is omitted, matching `resolveCard`'s own default-branch convention, or a named entry from `card.abilities` (Qiqirn Merchant's own pair, e.g.) when given. `undefined` if no such ability exists at all. Exported alongside `costRequiresTap` above, same reason. */
export function activationCostFor(card: CardDefinition, abilityName?: string): string | undefined {
  if (abilityName) return card.abilities?.find((a) => a.name === abilityName)?.cost;
  return card.activationCost;
}

/** The real `ActivationCostReduction` for one of `card`'s activated abilities, if it has one — only ever declared on a NAMED `card.abilities` entry today (Qiqirn Merchant's own "bigDraw") since no real card in this pool needs a per-Town-style discount on the single top-level `activationCost` slot; extend here if one ever does. */
function abilityCostReductionFor(card: CardDefinition, abilityName?: string): ActivationCostReduction | undefined {
  if (!abilityName) return undefined;
  return card.abilities?.find((a) => a.name === abilityName)?.costReduction;
}

/**
 * Real 602.1 activation cost, computed for THIS specific activation —
 * generalizes `effectiveCastCost`'s own shape to the activated-ability path
 * (ENGINE_GAPS.md gap #7's third real example, Qiqirn Merchant's own "costs
 * {1} less to activate for each Town you control"): `{X}` resolved first
 * (CR 601.2b, same `x` shape `effectiveCastCost` already uses — Rydia,
 * Summoner of Mist's own real "Summon — {X}, {T}: ..." activated ability
 * needs this), THEN discounted by the named ability's own
 * `ActivationCostReduction` (`abilityCostReductionFor`), a board-state count
 * of real permanents the ACTIVATOR controls whose subtypes include
 * `reduction.subtype`, applied the same generic-only/floored-at-0 way
 * `mana.ts`'s `reduceGenericCost` already does. Returns the discounted
 * `ParsedManaCost` for the ability's own mana portion (`undefined` if this
 * ability's cost has no mana component at all — a pure {T}/Sacrifice-only
 * cost) AND a printed-style `costString` reflecting the REAL cost after any
 * discount (the raw cost string's own FIRST bracketed generic token
 * substituted with the discounted value — the rest of the free text, e.g.
 * "{T}, Sacrifice...", is left exactly as printed), for trace logging the
 * cost actually owed, same "log what genuinely happened" standard
 * `effectiveCastCost` already establishes. Exported so `engine-trace.ts`'s
 * `pilotActivate` can log the real string without re-deriving this logic.
 */
export function effectiveActivationCost(engine: GameEngine, controller: RealPlayer, card: CardDefinition, abilityName?: string, x?: number): { manaPortion?: ParsedManaCost; costString: string } {
  const cost = activationCostFor(card, abilityName);
  if (cost === undefined) return { costString: '' };
  const manaPortionStr = manaPortionOf(cost);
  if (!/\{[^}]+\}/.test(manaPortionStr)) return { costString: cost };
  const parsed = parseManaCost(manaPortionStr);
  const resolved = parsed.xCount > 0 ? resolveXCost(parsed, x) : parsed;
  const reduction = abilityCostReductionFor(card, abilityName);
  if (!reduction) return { manaPortion: resolved, costString: cost };
  const matchCount = controller.battlefield.filter((c) => c.subtypes.includes(reduction.subtype)).length;
  const discount = reduction.amountPerMatch * matchCount;
  if (discount <= 0) return { manaPortion: resolved, costString: cost };
  const reducedParsed = reduceGenericCost(resolved, discount);
  // Substitute the FIRST bracketed generic token (the real mana pip this
  // discount actually reduces) with the discounted value — the rest of the
  // free text (a "{T}"/"Sacrifice ..."/parenthetical restriction) is left
  // untouched. Safe against a coincidental LATER `{N}` elsewhere in the
  // string (Qiqirn Merchant's own cost text names "{1} less" in its own
  // parenthetical) since `.replace` with no `/g` flag only ever touches the
  // first match.
  const costString = cost.replace(/\{\d+\}/, `{${reducedParsed.generic}}`);
  return { manaPortion: reducedParsed, costString };
}

/**
 * Real 602.1 activated-ability legality: controls the permanent, a real
 * query-time "CantBeActivated" lock imposed by a DIFFERENT permanent's own
 * static ability (ENGINE_GAPS.md gap #18, closed 2026-09-12 — see
 * `state.ts`'s own `isActivationLocked` doc comment), real
 * "activate only as a sorcery" timing (a free-text restriction — no
 * structured timing field exists on `CardDefinition.activationCost`, so
 * this is a real but narrow text-pattern check, not a parsed grammar; a
 * cost with NO such text is treated as instant-speed, matching real MTG's
 * own default) OR real 301.5c equip-timing (`isEquipment` — type-based,
 * not text-based, since no real Equipment card prints "activate only as
 * a sorcery" on its own equip cost), OR real Crew N (702.121b/c —
 * `card.crewCost`, a structured field entirely bypassing the free-text
 * cost checks below in favor of validating the caller-supplied
 * `crewedBy` creature list — see below for why this branch is now GATED on
 * `abilityName === undefined`), and cost affordability (`{T}`/Equip + mana
 * only, PLUS a real "Sacrifice another/a/two X" cost trusted whenever the
 * card's own `effects` already pay it for real at resolution, PLUS a real
 * "Pay N life" cost (`costRequiresLifePayment`) — `unsupportedCostComponent`'s
 * own doc comment lists what a real card's cost can still contain that this
 * engine can't pay: self-Sacrifice). Read-only, same shape as `canCastSpell`.
 *
 * `x` (optional) — CR 601.2b's own "announce X," same shape `canCastSpell`
 * already uses — ONLY affects this ability's own mana-portion affordability
 * here (`effectiveActivationCost`); a caller wanting the ability's own
 * EFFECT to see the same chosen value must also set `ctx.xPaid` (same
 * "this function doesn't build/mutate `ctx`" caveat `canCastSpell`'s own
 * doc comment already states).
 *
 * **Real bug fix (ENGINE_GAPS.md gap #11, Cargo Ship-shaped Vehicles):**
 * the `card.crewCost` branch below used to fire UNCONDITIONALLY, before
 * even looking at `abilityName` — so a Vehicle with BOTH `crewCost` AND a
 * separate NAMED ability (`card.abilities`, Cargo Ship's own "mana"
 * ability) would have ANY activation attempt, including one explicitly
 * naming the other ability, incorrectly routed through the crew-cost
 * legality/payment path. Fixed: the crew branch is now gated on
 * `abilityName === undefined` — a caller naming a real `card.abilities`
 * entry (Cargo Ship's own "mana", e.g.) skips the crew path entirely and
 * falls through to the ordinary {T}/mana cost checks below; `abilityName`
 * omitted (Crew's own real convention, per this file's own header — Crew
 * has no name of its own, only `card.activationCost`'s descriptive label)
 * still means "this is the crew activation," unchanged for every existing
 * caller/card. (A caller-supplied `abilityName` that matches NEITHER
 * `card.abilities` NOR the crew slot already fails earlier, at the
 * `activationCostFor`-returns-`undefined` check above — that path never
 * reaches this gate at all, so it needs no special handling here.)
 */
export function canActivateAbility(engine: GameEngine, controller: RealPlayer, permanent: RealCard, card: CardDefinition, abilityName?: string, crewedBy?: RealCard[], x?: number): ActionResult {
  const cost = activationCostFor(card, abilityName);
  if (!cost) return { ok: false, reason: `"${card.name}" has no such activated ability${abilityName ? ` named "${abilityName}"` : ''}` };
  if (permanent.controllerId !== controller.id) return { ok: false, reason: 'you do not control this permanent (602.1)' };
  // Real, query-time "CantBeActivated" lock (613/602.1, ENGINE_GAPS.md gap
  // #18, closed 2026-09-12) — a static effect imposed by a DIFFERENT
  // permanent (Stuck in Summoner's Sanctum's own "its activated abilities
  // can't be activated"), not a restriction on the activator's own state.
  // Checked BEFORE any cost-shape/affordability check below, mirroring real
  // Forge's own `AbilityActivated.checkRestrictions` (forge-game/.../
  // spellability/AbilityActivated.java line 109), which also runs before its
  // own cost-payability check (line 102-103).
  if (isActivationLocked(engine.state, permanent)) {
    return { ok: false, reason: `"${card.name}"'s activated abilities can't be activated — locked by a static ability on another permanent (613/602.1, CantBeActivated)` };
  }
  // Real Forge `RemoveAllAbilities$ True` (613, layer 6, ENGINE_GAPS.md's
  // own "Ultima, Origin of Oblivion" closure) — a permanent currently
  // losing ALL its abilities to an active `counterConditionalGrants` entry
  // (installed by SOME OTHER effect, e.g. Ultima's own blight counter) has
  // no OTHER activated ability left to activate either. The Gold Saucer's
  // own real "{3}, {T}, Sacrifice two artifacts: ..." is the one real FIN
  // card this matters for if it's ever blighted. See `state.ts`'s own
  // `hasCounterConditionalAbilityLoss` doc comment for what this does NOT
  // cover (a TRIGGERED ability has no equivalent suppression anywhere).
  if (hasCounterConditionalAbilityLoss(permanent)) {
    return { ok: false, reason: `"${card.name}" has lost all its abilities (613, RemoveAllAbilities) — no activated ability to activate` };
  }
  if (card.crewCost !== undefined && abilityName === undefined) {
    // Real Crew (702.121b/c): "Tap any number of untapped creatures you
    // control with total power N or greater" — a real, STRUCTURED cost
    // distinct from the free-text `activationCost` (kept only as a
    // descriptive label — see `card.ts`'s own `crewCost` doc comment), so
    // it bypasses the {T}/mana cost-string checks below entirely. No
    // sorcery-speed restriction (crewing is legal any time its controller
    // could cast an instant, same as most activated abilities), and no
    // 302.6 summoning-sickness check on the TAPPED creatures — crewing
    // taps them as a cost of the VEHICLE's own ability, not their own
    // {T} ability, the same real distinction Convoke-shaped tap-as-cost
    // effects rely on elsewhere in real Forge.
    const creatures = crewedBy ?? [];
    if (creatures.length === 0) {
      return { ok: false, reason: `Crew ${card.crewCost}: no creatures specified to tap` };
    }
    for (const c of creatures) {
      if (c.controllerId !== controller.id) return { ok: false, reason: `Crew: "${c.name}" is not a permanent you control` };
      if (!effectiveTypes(c).includes('Creature')) return { ok: false, reason: `Crew: "${c.name}" is not a creature` };
      if (c.tapped) return { ok: false, reason: `Crew: "${c.name}" is already tapped` };
    }
    const totalPower = creatures.reduce((sum, c) => sum + effectivePT(engine.state, c)[0], 0);
    if (totalPower < card.crewCost) {
      return { ok: false, reason: `Crew ${card.crewCost}: tapped creatures' total power (${totalPower}) is less than required` };
    }
    return { ok: true };
  }
  // Real 701.9a + Forge's own `ActivationZone$ Hand` (ENGINE_GAPS.md gap
  // #23, Cycling/TypeCycling): "discard this card" is DEFINED as a
  // Hand->Graveyard move, so an ability whose own cost includes it can only
  // ever be activated from Hand — genuinely different from every OTHER
  // activated ability in this pool, which this engine otherwise never zone-
  // checks at all (implicitly assumed to already be on the Battlefield, per
  // `harness.ts`'s own `selfZone` convention). Checked before any other
  // cost/timing check below, same "real restriction checked up front" shape
  // the Crew/Equip branches above already establish.
  if (costRequiresDiscardSelf(cost) && permanent.zone !== 'Hand') {
    return { ok: false, reason: `"${card.name}"'s cost includes discarding itself (701.9a) — this ability can only be activated from Hand, but "${card.name}" is currently in ${permanent.zone}` };
  }
  if (/activate only as a sorcery/i.test(cost) && !sorcerySpeedTimingOk(engine, controller)) {
    return { ok: false, reason: `"${cost}" restricts this to sorcery-speed timing: only during your own main phase with an empty stack` };
  }
  if (isEquipment(card) && !sorcerySpeedTimingOk(engine, controller)) {
    return { ok: false, reason: `equip abilities can only be activated as a sorcery (301.5c): only during your own main phase with an empty stack` };
  }
  if (costRequiresTap(cost) && permanent.tapped) {
    return { ok: false, reason: `"${card.name}"'s cost requires tapping it, but it's already tapped` };
  }
  if (costRequiresTap(cost)) {
    // Real 302.6: summoning sickness restricts a creature from both
    // attacking AND activating a {T}/{Q}-cost ability, not just attacking
    // (see `canAttack`'s own identical check) — Haste exempts either.
    const enteredTurn = engine.enteredThisTurn.get(permanent.id);
    const sick = enteredTurn === engine.turn.turnNumber && !effectiveKeywords(engine.state, permanent).includes('Haste');
    if (sick) return { ok: false, reason: "summoning sickness (302.6): hasn't been under its controller's control continuously since their most recent turn began, so its {T} cost can't be paid" };
  }
  const unsupported = unsupportedCostComponent(cost, card);
  if (unsupported) {
    return { ok: false, reason: `activation cost includes an unsupported component ("${unsupported}") — this engine only pays {T} + mana costs so far` };
  }
  const lifeCost = costRequiresLifePayment(cost);
  if (lifeCost !== undefined && controller.life < lifeCost) {
    return { ok: false, reason: `cannot pay ${lifeCost} life for "${card.name}"'s cost — only ${controller.life} life remaining` };
  }
  let manaPortion;
  try {
    manaPortion = effectiveActivationCost(engine, controller, card, abilityName, x).manaPortion;
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
  if (manaPortion && !canAfford(payableManaSources(engine, controller), manaPortion)) {
    return { ok: false, reason: `cannot afford "${card.name}"'s cost ${cost} — not enough untapped mana sources` };
  }
  return { ok: true };
}

/**
 * Legality-checks, then (if legal) pays the real cost (taps `permanent` if
 * the cost says `{T}`, taps mana sources for the mana portion, deducts real
 * life for a "Pay N life" component) and pushes the ability onto the real
 * stack (602.2 — an activated ability uses the stack exactly like a
 * spell). Unlike `castSpell`, the permanent itself does NOT move zones
 * here — see `resolveTop`'s own `isAbility` branch: an activated ability
 * resolving doesn't relocate its own source, only its OWN effects (if any)
 * do that (Jill's own transform ability moves itself via its own `custom`
 * effect's `actions.moveTo` calls, e.g.).
 *
 * `x` (optional) — see `canActivateAbility`'s own doc comment; same
 * "affects payment only, set `ctx.xPaid` yourself for the effect to see it"
 * caveat `castSpell`'s own `x` param already has.
 *
 * `declaredTargets` (optional, ENGINE_GAPS.md gap #4) — same real cast-time
 * target-locking `castSpell`'s own `declaredTarget`/`declaredTargets`
 * params establish (602.1's own "activate, then choose targets" step is
 * the exact activated-ability analogue of 601.2c) — recorded on the pushed
 * `StackObject`, re-validated at resolution by `card.ts`'s `resolveTargets`
 * (608.2b fizzle on an illegal one). No real FIN card's own scenario
 * exercises a targeted activated ability through this real cast/stack path
 * yet (Coeurl's own "tap target creature" is piloted directly via
 * `resolveCard`, not through here — see that card's own scenario comment),
 * so this stays real, tested machinery without its own dedicated
 * `cards/*` demonstration this pass.
 */
export function activateAbility(engine: GameEngine, controller: RealPlayer, permanent: RealCard, card: CardDefinition, ctx: EffectContext, actions: Actions, abilityName?: string, crewedBy?: RealCard[], x?: number, declaredTargets?: RealCard[]): CastResult {
  const check = canActivateAbility(engine, controller, permanent, card, abilityName, crewedBy, x);
  if (!check.ok) return check;
  const wrappedTargets = declaredTargets?.map((t) => wrapCard(engine.state, t));
  if (card.crewCost !== undefined && abilityName === undefined) {
    // Real 702.121c: crewing taps the CREATURES paying the cost, never
    // the Vehicle itself. The ability's own effect (real cards here all
    // declare `effects: [{ kind: 'animate', ... }]`, magitek-armor/
    // the-prima-vista/the-lunar-whale) resolves later off the stack
    // exactly like any other activated ability's effects — no new Effect
    // kind needed, `animate` already exists and already grants Creature
    // type through the real, existing `resolveCard` dispatch.
    for (const c of crewedBy!) engine.state.tap(c);
    engine.stack.push({ card, ctx, actions, abilityName, isAbility: true, declaredTargets: wrappedTargets });
    return { ok: true };
  }
  const cost = activationCostFor(card, abilityName)!;
  const { manaPortion } = effectiveActivationCost(engine, controller, card, abilityName, x);
  const tappedForMana = manaPortion ? payMana(engine.state, payableManaSources(engine, controller), manaPortion) : undefined;
  if (tappedForMana) fireOnTapLandForManaTriggers(engine, controller, tappedForMana);
  if (costRequiresTap(cost)) engine.state.tap(permanent);
  const lifeCost = costRequiresLifePayment(cost);
  if (lifeCost !== undefined) controller.life -= lifeCost;
  // Real 702.13 Cycling's own "Discard this card" cost (ENGINE_GAPS.md gap
  // #23) — a genuine Hand->Graveyard move, paid for real HERE, as part of
  // activation, before the ability is even pushed onto the stack (602.1's
  // own cost-payment step happens before the object goes on the stack) —
  // NOT deferred to resolution the way the Sacrifice-cost-trusted shape
  // above is (that deferral exists only to dodge a last-known-information
  // problem `costRequiresDiscardSelf`'s own doc comment explains doesn't
  // apply here). `resolveTop`'s own `isAbility` branch never relocates its
  // source permanent either way (602.1 has no such rule), so there's no
  // conflicting double-move once this already happened here.
  if (costRequiresDiscardSelf(cost)) engine.state.move(permanent, 'Graveyard');
  engine.stack.push({ card, ctx, actions, abilityName, isAbility: true, declaredTargets: wrappedTargets });
  return { ok: true, tappedForMana };
}

/**
 * Resolves the top of the real stack (`Stack.resolveTop`, which runs
 * `resolveCard` for you). A SPELL (not `isAbility`) then moves to its real
 * post-resolution zone — Battlefield (stamping `enteredThisTurn` for
 * summoning-sickness purposes, then auto-firing a real ETB — see
 * `Trigger.on === 'enter'`, card.ts) for a permanent, Graveyard for an
 * instant/sorcery. An ACTIVATED ABILITY (`isAbility`) does neither: 602.1
 * has no "the source moves zones after its ability resolves" rule at all
 * — the permanent just stays wherever it already was, unless its own
 * effects say otherwise. A no-op, safely, on an empty stack.
 */
export function resolveTop(engine: GameEngine): StackObject | undefined {
  const resolved = engine.stack.resolveTop(engine.state);
  if (!resolved) return undefined;
  if (resolved.isAbility) return resolved;
  const real = engine.state.cards.get(resolved.ctx.self.getId());
  if (real) {
    if (isPermanentTypeLine(resolved.card.typeLine)) {
      engine.state.move(real, 'Battlefield');
      engine.enteredThisTurn.set(real.id, engine.turn.turnNumber);
      engine.resolvedPermanents.set(real.id, { card: resolved.card, ctx: resolved.ctx, actions: resolved.actions });
      // Real, structural mana ability/abilities (`card.ts`'s own
      // `CardDefinition.manaAbilities`/`ManaAbility`) — copied here, once,
      // from the resolving CardDefinition, since `RealCard` keeps no live
      // CardDefinition reference to re-derive it from later.
      real.manaAbilities = resolved.card.manaAbilities;
      // Same "copy once at resolve time, RealCard keeps no live
      // CardDefinition reference" treatment for `continuousKeywordGrants`
      // (2026-09-12, ENGINE_GAPS.md gap #14) — a pilot script that builds
      // its own `RealCard` via a hand-picked `addCard` field subset (every
      // engine-trace.ts scenario does) never otherwise gets this real,
      // structured field onto the object `effectiveKeywords` actually
      // reads; real printed `keywords` get the same treatment for the same
      // reason (a scenario-built RealCard's own `keywords` array starts
      // empty regardless of what `addCard`'s caller passed, unless it
      // happens to be resolved through here).
      real.continuousKeywordGrants = resolved.card.continuousKeywordGrants;
      // Same "copy once at resolve time" treatment for the P/T- and
      // creature-type-grant siblings (ENGINE_GAPS.md gap #14's own
      // follow-up, closed 2026-09-12) — `effectivePT`/`effectiveSubtypes`
      // (state.ts) are the real readers.
      real.continuousPTGrants = resolved.card.continuousPTGrants;
      real.continuousTypeGrants = resolved.card.continuousTypeGrants;
      // Same "copy once at resolve time" treatment for `activatedAbilityLock`
      // (ENGINE_GAPS.md gap #18, closed 2026-09-12, Stuck in Summoner's
      // Sanctum's own real "activated abilities can't be activated" clause)
      // — `isActivationLocked` (state.ts) is the one real reader.
      real.activatedAbilityLock = resolved.card.activatedAbilityLock;
      // Same "copy once at resolve time" treatment for `spellCostReductionGrants`
      // (ENGINE_GAPS.md gap #7's second real example, The Wind Crystal's own
      // broadcast cost reduction) — `activeSpellCostDiscount` (state.ts) is
      // the one real reader.
      real.spellCostReductionGrants = resolved.card.spellCostReductionGrants;
      // Same "copy once at resolve time" treatment for `millModifierGrants`
      // (ENGINE_GAPS.md gap #19, closed) — `activeMillModifier` (state.ts)
      // is the one real reader.
      real.millModifierGrants = resolved.card.millModifierGrants;
      // Same "copy once at resolve time" treatment for `triggerDoubling`
      // (ENGINE_GAPS.md gap #13, closed 2026-09-12) — `shouldDoubleTrigger`
      // (state.ts) is the one real reader.
      real.triggerDoubling = resolved.card.triggerDoubling;
      if (resolved.card.keywords) real.keywords = [...resolved.card.keywords];
      // Real 714.2b: a Saga enters with no lore counters, then immediately
      // gets its first (see saga.ts's own header for the full 714 writeup).
      advanceSaga(engine, real, engine.resolvedPermanents.get(real.id)!);
      const enterTrigger = resolved.card.triggers?.find((t) => t.on === 'enter');
      // Real "entersBattlefield" cause (ENGINE_GAPS.md gap #13) — `real` is
      // both the entering permanent AND (when it has one) the trigger's own
      // source, same reasoning `playLand`'s own identical fix above uses.
      if (enterTrigger) fireTrigger(engine.state, resolved.card, resolved.ctx, resolved.actions, enterTrigger.name, { kind: 'entersBattlefield', entered: real });
    } else {
      // Real 702.32/702.67: a Flashback/Jump-start spell (or any future
      // alternate-cost `thenExile` case) goes to exile instead of its
      // owner's graveyard once it resolves — `castSpell` tagged this
      // `StackObject` from the `AlternateCost` it was cast with.
      engine.state.move(real, resolved.thenExile ? 'Exile' : 'Graveyard');
    }
  }
  return resolved;
}

/**
 * Real 603.6b "at the beginning of your upkeep/end step" auto-fire —
 * called right after `engine.turn` advances into Upkeep or EndOfTurn (see
 * `doAdvance` below), for the ACTIVE player's own permanents only (the
 * common "your upkeep/end step" case — an "each player's"/"each
 * opponent's" variant is a real, deferred gap, ENGINE_GAPS.md). Looks up
 * each permanent's registered `resolvedPermanents` entry (see
 * `GameEngine`'s own doc comment on that field for why a directly-seeded
 * permanent has none and is silently skipped, not silently faked).
 */
function fireOnPhaseEnterTriggers(engine: GameEngine): void {
  const phase = currentPhase(engine.turn);
  const on = phase === 'Upkeep' ? 'upkeep' : phase === 'EndOfTurn' ? 'endStep' : undefined;
  if (!on) return;
  const active = activePlayer(engine.turn, engine.players);
  for (const real of active.battlefield) {
    const registered = engine.resolvedPermanents.get(real.id);
    if (!registered) continue;
    const trigger = registered.card.triggers?.find((t) => t.on === on);
    if (!trigger) continue;
    // Real "if it's the first end step of the turn" (ENGINE_GAPS.md gap
    // #17) — Y'shtola Rhul's own real card needs this fact set BEFORE its
    // trigger's own effect runs, since it decides whether to call
    // `actions.queueExtraPhase('EndOfTurn')` (see card.ts's own
    // `EffectContext.firstPhaseGroupOccurrenceThisTurn` doc comment). Only
    // `EndOfTurn` has an auto-fired trigger occasion mapped to a real
    // `PhaseGroup` today — `Upkeep` isn't one of `turn.ts`'s own modeled
    // groups (no FIN card needs "first upkeep of the turn"), so this stays
    // unset (`undefined`) for an upkeep trigger, same as before this pass.
    if (phase === 'EndOfTurn') registered.ctx.firstPhaseGroupOccurrenceThisTurn = isFirstPhaseGroupOccurrenceThisTurn(engine.turn, 'EndOfTurn');
    // No `cause` — real upkeep/end-step triggers aren't "caused by dying" or
    // "caused by a permanent entering," so only a cause-less doubling gate
    // (Cloud's own shape) could ever apply here; none of the 3 real FIN
    // cards needing gap #13 target this specific trigger occasion.
    fireTrigger(engine.state, registered.card, registered.ctx, registered.actions, trigger.name);
  }
}

/**
 * Real Forge `TriggerType.TapsForMana` auto-fire (closed 2026-09-14,
 * ENGINE_GAPS.md gap #5's own Ultima, Origin of Oblivion closure — see
 * `card.ts`'s own `Trigger.on: 'tapLandForMana'`/`tapLandForManaColor` doc
 * comments for the full real Forge citation). Called right after EVERY
 * real `mana.ts` `payMana` call (this engine's only two "tap sources to pay
 * a cost" call sites, `castSpell`/`activateAbility`) with the exact real
 * sources `payMana` just tapped.
 *
 * For each tapped source that's a genuine Land (`ValidCard$ Land`, Forge's
 * own real gate — a non-Land mana source, e.g. a mana rock, never fires
 * this), re-derives which color(s) it actually produced
 * (`mana.ts`'s own `sourceColors`, the SAME function `payMana` itself used
 * to decide what to tap — `payMana` has no engine/trigger-firing context
 * of its own to fire this from directly, so this re-derivation happens
 * here instead of threading a callback all the way through `mana.ts`), then
 * sweeps `controller`'s own `resolvedPermanents`-registered battlefield
 * (`Activator$ You`, Forge's own real gate — same "your own battlefield
 * only" scope `fireOnPhaseEnterTriggers` already establishes) for any
 * trigger with `on: 'tapLandForMana'` whose own `tapLandForManaColor` (if
 * set) is among the colors just produced, firing each real match.
 */
function fireOnTapLandForManaTriggers(engine: GameEngine, controller: RealPlayer, tapped: RealCard[]): void {
  const tappedLands = tapped.filter((c) => c.types.includes('Land'));
  if (tappedLands.length === 0) return;
  for (const land of tappedLands) {
    const colors = sourceColors(land);
    for (const real of controller.battlefield) {
      const registered = engine.resolvedPermanents.get(real.id);
      if (!registered) continue;
      const trigger = registered.card.triggers?.find((t) => t.on === 'tapLandForMana' && (t.tapLandForManaColor === undefined || colors.includes(t.tapLandForManaColor)));
      if (!trigger) continue;
      fireTrigger(engine.state, registered.card, registered.ctx, registered.actions, trigger.name, { kind: 'tapLandForMana', colors });
    }
  }
}

/**
 * Real Forge `TriggerType.Attacks` auto-fire (closed 2026-09-14,
 * ENGINE_GAPS.md — attack-triggered-ability auto-dispatch; see `card.ts`'s
 * own `Trigger.on: 'attacks'` doc comment for the full real Forge citation).
 * Called right after `declareAttackers` legally declares a real attacker
 * batch (508.1) — mirrors real Forge's own `CombatUtil.checkDeclaredAttacker`
 * (forge-game/.../combat/CombatUtil.java ~lines 363-383), which does the same
 * thing per real declared attacker, "right before defending player declares
 * blockers."
 *
 * Only `ValidCard$ Card.Self` scope is modeled — for each declared attacker
 * with a registered `resolvedPermanents` entry (a permanent seeded directly
 * onto the battlefield, never cast through this engine, has none and is
 * silently skipped — same "no entry = gap, not a silent success" convention
 * `fireOnPhaseEnterTriggers`/`fireOnTapLandForManaTriggers` already
 * establish), fires whichever of ITS OWN triggers has `on: 'attacks'`, with
 * that SAME attacker as `ctx.self`. No `cause` is threaded (no real
 * `triggerDoubling` grant in this pool gates on an "attacks" cause today —
 * see `state.ts`'s own `TriggerCause` doc comment).
 */
function fireOnAttackTriggers(engine: GameEngine, attackers: RealCard[]): void {
  for (const attacker of attackers) {
    const registered = engine.resolvedPermanents.get(attacker.id);
    if (!registered) continue;
    const trigger = registered.card.triggers?.find((t) => t.on === 'attacks');
    if (!trigger) continue;
    fireTrigger(engine.state, registered.card, registered.ctx, registered.actions, trigger.name);
  }
}

/**
 * Real 510.5 conditionality for the `CombatFirstStrikeDamage` step
 * (ENGINE_GAPS.md gap #9) — true only when at least one currently-declared
 * attacker OR blocker has First Strike or Double Strike (`effectiveKeywords`,
 * not raw `.keywords`, so a granted First Strike — Coral Sword's own real
 * Equip trigger, e.g. — counts too). Mirrors real Forge's own
 * `Combat.dealDamageThisPhase`/`assignCombatDamage(true)` returning false
 * when nobody in combat has either keyword (`Combat.java` ~lines 906-926) —
 * see `doAdvance` below for how this engine uses it (skip the step outright)
 * vs. how real Forge uses the equivalent check (still transition through the
 * step, just give no priority and assign no damage, `PhaseHandler.java`
 * ~lines 321-332).
 */
function combatHasFirstOrDoubleStrike(engine: GameEngine): boolean {
  const hasEither = (c: RealCard) => {
    const kws = effectiveKeywords(engine.state, c);
    return kws.includes('FirstStrike') || kws.includes('DoubleStrike');
  };
  if (engine.attackers.some(hasEither)) return true;
  for (const blockers of engine.blockers.values()) {
    if (blockers.some(hasEither)) return true;
  }
  return false;
}

function doAdvance(engine: GameEngine): void {
  engine.turn = advancePhase(engine.state, engine.turn, engine.players);
  if (currentPhase(engine.turn) === 'CombatFirstStrikeDamage' && !combatHasFirstOrDoubleStrike(engine)) {
    // Real CR 510.5's own conditional step (ENGINE_GAPS.md gap #9): this
    // engine never PRESENTS the step to a caller at all when it doesn't
    // apply, rather than modeling Forge's own "always transition through it,
    // just silently" shape (see `combatHasFirstOrDoubleStrike`'s own doc
    // comment) — no hook here to represent "entered a phase with no
    // priority" as a distinct thing from "never entered it," and nothing in
    // this pool needs that distinction. `turn.ts`'s own `PHASES` array
    // still lists it unconditionally — this skip is deliberately only ever
    // applied here, at the `engine.ts` level, which is the one place combat
    // state (`engine.attackers`/`engine.blockers`) actually lives.
    engine.turn = advancePhase(engine.state, engine.turn, engine.players);
  }
  // Real, live "whose turn is it" (`state.ts`'s own `activePlayerId`/
  // `effectiveKeywords` doc comments, ENGINE_GAPS.md gap #14) — kept in
  // sync here, right after every real phase/turn change, so a turn-
  // conditional continuous keyword grant (Dion's own Dragonfire Dive)
  // genuinely turns on/off as turns actually pass in an engine-piloted
  // playthrough.
  engine.state.activePlayerId = activePlayer(engine.turn, engine.players).id;
  fireOnPhaseEnterTriggers(engine);
  // Real 714.2c: "after each of its controller's draw steps." Entering
  // Main1 always means the Draw step just ended in this engine's fixed
  // 13-phase list (turn.ts's own PHASES), whether or not a card was
  // actually drawn (the first-turn draw-skip only skips the draw ACTION,
  // not the step itself — see turn.ts's own shouldSkipDraw) — so this is
  // a structurally exact stand-in, not an approximation with edge cases.
  if (currentPhase(engine.turn) === 'Main1') {
    advanceSagasAfterDrawStep(engine, activePlayer(engine.turn, engine.players));
    // Real 704.5a's draw-attempt half (104.3c) — the one loss condition
    // this engine can genuinely hit on its own, autonomously, via the plain
    // automatic draw-step draw (`turn.ts`'s own `runPhaseEntryAction`,
    // called from `advancePhase` just above) rather than only through a
    // caller-driven combat/effect sequence. The other half (0-or-less
    // life) and every OTHER state-based destruction stay caller-invoked,
    // same established design (`sba.ts`'s own header, `resolveCombatDamage`'s
    // own doc comment on why) — this one hook exists because a real game
    // can otherwise silently keep advancing turns past the point it should
    // already be over, with nothing else in this engine ever checking.
    checkStateBasedActions(engine.state, engine.players);
  }
}

/**
 * One APNAP round (`priority.ts`'s own `runPriorityRound`), then performs
 * whatever it decided: resolves the stack's top object, or advances to the
 * next phase (running that phase's own automatic action — untap/draw/
 * cleanup — via `turn.ts`'s `advancePhase`, then firing any real
 * upkeep/end-step triggers — see `fireOnPhaseEnterTriggers`), or does
 * nothing further if someone pushed (that push already happened as a real
 * `castSpell`/activated-ability call before this round; a `{push:...}`
 * choice here is for a caller scripting priority.ts directly rather than
 * going through `castSpell` — same "scripted, not simulated" contract
 * priority.ts's own header already states).
 */
export function stepPriority(engine: GameEngine, choices: PriorityChoice[]): PriorityOutcome {
  const outcome = runPriorityRound(engine.stack, choices);
  if (outcome === 'resolve-stack') resolveTop(engine);
  else if (outcome === 'advance-phase') doAdvance(engine);
  return outcome;
}

/** Direct phase advance, bypassing priority entirely — for a caller that isn't scripting responses this round and just wants to move on (real games still pass priority around an empty stack first; this is the same shortcut `harness.ts`'s own `advanceToPhase` already takes for the same reason: only the phase transition itself is being demonstrated). */
/** Throws if the game is already over (real 704.5a — see `RealPlayer.hasLost`, state.ts) rather than silently continuing to simulate turns past the point a real game would have ended — a deliberate stop, not a guess about what SHOULD happen next once someone's lost. */
export function advance(engine: GameEngine): void {
  const loser = engine.players.find((p) => p.hasLost);
  if (loser) throw new Error(`advance: the game is already over — ${loser.name} has lost (704.5a)`);
  doAdvance(engine);
}

/** Queues `player` to take the next turn once the current one's Cleanup ends (500.7's own extra-turn priority over the normal rotation) — a thin `engine.players`-indexing wrapper over `turn.ts`'s own `queueExtraTurn(TurnState, playerIndex)`. Ultimecia, Time Sorceress's own "take an extra turn after this one" is the real FIN card that needs this. */
export function queueExtraTurn(engine: GameEngine, player: RealPlayer): void {
  turnQueueExtraTurn(engine.turn, engine.players.indexOf(player));
}

/**
 * Queues one more occurrence of `phaseType` to be inserted into the CURRENT
 * turn the moment that same group's current occurrence ends (500-series
 * turn structure, ENGINE_GAPS.md gap #17, closed 2026-09-12) — a thin
 * wrapper over `turn.ts`'s own `queueExtraPhase(TurnState, PhaseGroup)`,
 * same shape `queueExtraTurn` above already establishes for a whole extra
 * TURN. Y'shtola Rhul's own "additional end step," Balthier and Fran/Genji
 * Glove's own "additional combat phase" are the real FIN cards that need
 * this — see `turn.ts`'s own header for the full Forge citation and why
 * this is genuinely distinct from `queueExtraTurn`.
 */
export function queueExtraPhase(engine: GameEngine, phaseType: PhaseGroup): void {
  turnQueueExtraPhase(engine.turn, phaseType);
}

/** Real 302.6 (summoning sickness) + 508.1a (a tapped creature can't attack) + 302.6's own Defender clause (302.6's "can't attack" companion rule, 302.6a). Read-only — same "check separately from the mutating action" shape as `canCastSpell`. */
export function canAttack(engine: GameEngine, creature: RealCard): ActionResult {
  if (creature.tapped) return { ok: false, reason: 'tapped creatures cannot attack (508.1a)' };
  if (effectiveKeywords(engine.state, creature).includes('Defender')) return { ok: false, reason: "creatures with Defender can't attack (302.6)" };
  const enteredTurn = engine.enteredThisTurn.get(creature.id);
  const sick = enteredTurn === engine.turn.turnNumber && !effectiveKeywords(engine.state, creature).includes('Haste');
  if (sick) return { ok: false, reason: "summoning sickness (302.6): hasn't been under its controller's control continuously since their most recent turn began" };
  return { ok: true };
}

/**
 * Legality-checks every proposed attacker, and — only if ALL are legal —
 * taps each one that lacks Vigilance (real 508.1f) as a real declared
 * attacker. All-or-nothing: an illegal creature in the batch means NONE of
 * them tap, same "don't half-apply an illegal action" contract `payMana`
 * already uses.
 */
export function declareAttackers(engine: GameEngine, attackers: RealCard[]): ActionResult {
  if (currentPhase(engine.turn) !== 'CombatDeclareAttackers') {
    return { ok: false, reason: 'attackers can only be declared during the Declare Attackers step (508.1)' };
  }
  for (const creature of attackers) {
    const check = canAttack(engine, creature);
    if (!check.ok) return check;
  }
  for (const creature of attackers) {
    if (!creature.keywords.includes('Vigilance')) engine.state.tap(creature);
  }
  // Real 508.1 "attacked this turn" flag (ENGINE_GAPS.md gap #16,
  // `RealCard.attackedThisTurn`'s own doc comment for the real Forge
  // citation) — The Lunar Whale's own "as long as it attacked this turn,
  // you may play the top card of your library" is the real FIN card that
  // reads this later in the same turn. Set unconditionally for every real
  // declared attacker (real Forge sets it the same way regardless of
  // whether the attack is ultimately blocked/dealt damage — 508.1's own
  // "has attacked" is about the DECLARATION, not the outcome), cleared
  // game-wide at the next real Cleanup (`turn.ts`'s own Cleanup branch).
  for (const creature of attackers) creature.attackedThisTurn = true;
  engine.attackers = attackers;
  engine.blockers = new Map();
  // Real `TriggerType.Attacks` auto-fire (ENGINE_GAPS.md — attack-triggered-
  // ability auto-dispatch), see `fireOnAttackTriggers`'s own doc comment.
  fireOnAttackTriggers(engine, attackers);
  return { ok: true };
}

/**
 * Real 509.1 blocking legality for ONE proposed (blocker, attacker) pair —
 * `CombatUtil.canBlock(Card attacker, Card blocker, ...)`
 * (forge-game/.../combat/CombatUtil.java) is the real equivalent this is
 * checked against: attacker must be a declared attacker THIS combat,
 * blocker must be a creature controlled by an opponent of the attacker's
 * controller, untapped (509.1a — a tapped creature can't be declared as a
 * blocker), unblockable-attacker (`Unblockable` keyword, see card.ts's own
 * doc comment on that entry) rejects any block outright, and Flying
 * (509.1b — needs Flying or Reach on the blocker) is checked. Read-only,
 * same shape as `canAttack`.
 */
export function canBlock(engine: GameEngine, blocker: RealCard, attacker: RealCard): ActionResult {
  if (currentPhase(engine.turn) !== 'CombatDeclareBlockers') {
    return { ok: false, reason: 'blockers can only be declared during the Declare Blockers step (509.1)' };
  }
  if (!engine.attackers.some((a) => a.id === attacker.id)) {
    return { ok: false, reason: `"${attacker.name}" is not a declared attacker this combat` };
  }
  if (!effectiveTypes(blocker).includes('Creature')) {
    return { ok: false, reason: `"${blocker.name}" is not a creature and can't block` };
  }
  if (blocker.controllerId === attacker.controllerId) {
    return { ok: false, reason: 'a creature can only block an attacker controlled by an opponent (509.1a)' };
  }
  if (blocker.tapped) {
    return { ok: false, reason: "tapped creatures can't be declared as blockers (509.1a)" };
  }
  if (attacker.keywords.includes('Unblockable')) {
    return { ok: false, reason: `"${attacker.name}" can't be blocked` };
  }
  if (attacker.keywords.includes('Flying') && !(blocker.keywords.includes('Flying') || blocker.keywords.includes('Reach'))) {
    return { ok: false, reason: `"${attacker.name}" has flying — only a creature with flying or reach can block it (509.1b)` };
  }
  return { ok: true };
}

/**
 * Legality-checks every proposed (blocker, attacker) pair via `canBlock`,
 * plus two whole-batch rules `canBlock` can't check per-pair: a blocker
 * can't be assigned to more than one attacker (509.1c), and an attacker
 * with Menace needs at least 2 blockers or none at all (509.1b/702.111b —
 * `StaticAbilityCantBeBlockedBy`-adjacent real Forge check, actually
 * enforced in `CombatUtil.canBeBlocked` inputs, not a separate class of its
 * own). All-or-nothing, same "don't half-apply an illegal action" contract
 * `declareAttackers`/`payMana` already use — replaces `engine.blockers`
 * only if every assignment is legal.
 */
export function declareBlockers(engine: GameEngine, assignments: Array<{ blocker: RealCard; attacker: RealCard }>): ActionResult {
  if (currentPhase(engine.turn) !== 'CombatDeclareBlockers') {
    return { ok: false, reason: 'blockers can only be declared during the Declare Blockers step (509.1)' };
  }
  const seenBlockers = new Set<number>();
  for (const { blocker, attacker } of assignments) {
    const check = canBlock(engine, blocker, attacker);
    if (!check.ok) return check;
    if (seenBlockers.has(blocker.id)) {
      return { ok: false, reason: `"${blocker.name}" is already assigned to block another attacker — a creature can only block one attacker (509.1c)` };
    }
    seenBlockers.add(blocker.id);
  }
  const byAttacker = new Map<number, RealCard[]>();
  for (const { blocker, attacker } of assignments) {
    if (!byAttacker.has(attacker.id)) byAttacker.set(attacker.id, []);
    byAttacker.get(attacker.id)!.push(blocker);
  }
  for (const attacker of engine.attackers) {
    if (attacker.keywords.includes('Menace') && (byAttacker.get(attacker.id)?.length ?? 0) === 1) {
      return { ok: false, reason: `"${attacker.name}" has menace — it can't be blocked by only one creature (509.1b/702.111b)` };
    }
  }
  engine.blockers = byAttacker;
  return { ok: true };
}

/** One creature that took combat damage this call, and whether that damage was lethal — see `resolveCombatDamage`'s own doc comment for what "lethal" means here and why this engine doesn't act on it directly. */
export interface CombatDamageEntry {
  card: RealCard;
  damage: number;
  lethal: boolean;
}

export interface CombatDamageResult {
  entries: CombatDamageEntry[];
  /**
   * Real creatures whose combat damage THIS call prevented outright
   * (ENGINE_GAPS.md gap #8, closed for a narrow real subset) — `state
   * .dealDamage`'s own `prevented` flag, checked with `{combat:true}` at
   * every real damage-dealing call below. Diamond Weapon's own "Prevent all
   * combat damage that would be dealt to Diamond Weapon" is the reference
   * case (`'CombatDamagePrevention'`, card.ts's own `Keyword` doc comment).
   * Empty when nothing was prevented this call — the common case.
   */
  prevented: RealCard[];
}

/**
 * Real combat damage (510) for the current `engine.attackers`/
 * `engine.blockers` — `CombatUtil`'s own damage-assignment shape
 * (forge-game/.../combat/CombatUtil.java) is the real reference: an
 * unblocked attacker's full power goes to the defending player (with
 * exactly 2 players, "the defending player" is simply the other one — see
 * this file's own "Accepted simplifications" note, ENGINE_GAPS.md); a
 * blocked attacker assigns damage among its living blockers in the order
 * they were declared (a real attacking player chooses this order — not
 * modeled, so declaration order stands in for it), lethal-amount-first
 * (Deathtouch: 1 point counts as lethal, 702.2e) unless Trample (702.19c),
 * in which case only the lethal amount goes to blockers and the rest
 * overflows to the defending player; each living blocker deals its own
 * full power back to the attacker. A blocked attacker whose blockers have
 * ALL already left combat (died in an earlier sub-step, see below) deals
 * NO damage at all UNLESS it has Trample, in which case its full damage
 * goes to the defending player (real 510.1c) — this is deliberately
 * different from "unblocked," which always hits the player regardless of
 * Trample.
 *
 * Real 510.4/510.5's own first/double-strike ordering (a real, distinct
 * `CombatFirstStrikeDamage` step BEFORE the regular `CombatDamage` step,
 * `turn.ts`'s own `PHASES`, ENGINE_GAPS.md gap #9, closed 2026-09-12) is
 * modeled as two SEPARATE exported functions, not two internal passes
 * within one call — `resolveFirstStrikeCombatDamage` (below) for the
 * FIRST real step (creatures with First OR Double Strike only), and THIS
 * function for the regular step (creatures with Double Strike, dealing
 * again, PLUS every creature WITHOUT First Strike — the common case where
 * NOTHING in combat has either keyword is simply "everyone deals damage
 * here, once," identical to this function's own pre-gap-#9 behavior, so a
 * caller with no First/Double Strike creature in play needs no other
 * change at all). A creature already lethally damaged (`isLethallyDamaged`
 * — real, persistent `card.damageMarked`/`deathtouchDamaged` state, so this
 * is genuinely read fresh on EVERY call, not cached across the two real
 * steps) deals no further damage and receives none — same real 704-SBA-
 * shaped exclusion a caller's own `checkStateBasedActions` sweep between
 * the two steps would produce, whether or not that caller actually ran one
 * (this engine still does NOT call `state.destroy` itself — see below).
 *
 * Real reference for the two-step split: `Combat.java`'s own
 * `dealDamageThisPhase(combatant, firstStrikeDamage)` (~lines 906-916,
 * "During first strike damage, double strike and first strike deal
 * damage. During regular strike damage, double strike and anyone who
 * hasn't dealt damage deal damage") — the exact `dealsFirst`/`dealsRegular`
 * predicates below. `PhaseHandler.java`'s own `COMBAT_FIRST_STRIKE_DAMAGE`/
 * `COMBAT_DAMAGE` cases (~lines 321-344) are the real per-step call sites
 * (`combat.assignCombatDamage(firstStrikeDamage)` then
 * `combat.dealAssignedDamage()`), one per real phase, exactly mirrored by
 * `engine.ts`'s own two exported functions each being called once per real
 * phase (see `doAdvance`'s own conditional-skip doc comment for the one
 * real difference: Forge always transitions through the first-strike
 * phase and merely withholds priority/damage when it doesn't apply, this
 * engine skips presenting the phase to a caller at all in that case).
 *
 * This function does NOT call `state.destroy` on anything, even a
 * creature this pass computes as lethally damaged — real creature death
 * from combat damage is a state-based action (704.5g/704.5h), and general
 * SBAs are a separate gap (`sba.ts`'s `checkStateBasedActions`, not called
 * from here — a caller runs that itself, same "caller-invoked" convention
 * every real FS/DS-piloting scenario in this pool now follows between the
 * two real steps). What this function DOES do: apply every real damage
 * amount via `state.dealDamage` (so player life totals, Lifelink, AND
 * `card.damageMarked`/`deathtouchDamaged` all take their real, correct
 * effect — `state.ts`'s own doc comment) and report, per creature that
 * took any damage THIS FAR (a real, accumulated total — see above), whether
 * that's lethal (`isLethallyDamaged`, the SAME shared read `sba.ts` uses,
 * so the two never disagree).
 */
const dealsFirstStrikeDamage = (c: RealCard) => c.keywords.includes('FirstStrike') || c.keywords.includes('DoubleStrike');
const dealsRegularDamage = (c: RealCard) => c.keywords.includes('DoubleStrike') || !c.keywords.includes('FirstStrike');

function runCombatDamageStep(engine: GameEngine, include: (c: RealCard) => boolean): CombatDamageResult {
  const preventedIds = new Set<number>();
  const isOut = (c: RealCard) => isLethallyDamaged(engine.state, c);
  const defenderOf = (attacker: RealCard): RealPlayer => engine.players.find((p) => p.id !== attacker.controllerId)!;

  for (const attacker of engine.attackers) {
    if (isOut(attacker)) continue;
    const originalBlockers = engine.blockers.get(attacker.id) ?? [];
    const isBlockedAtAll = originalBlockers.length > 0;
    const livingBlockers = originalBlockers.filter((b) => !isOut(b));
    const defender = defenderOf(attacker);

    if (include(attacker)) {
      const [power] = effectivePT(engine.state, attacker);
      const deathtouch = attacker.keywords.includes('Deathtouch');
      const trample = attacker.keywords.includes('Trample');
      if (!isBlockedAtAll) {
        engine.state.dealDamage(defender, power, attacker, { combat: true });
      } else if (livingBlockers.length === 0) {
        if (trample) engine.state.dealDamage(defender, power, attacker, { combat: true });
      } else {
        let remaining = power;
        for (let i = 0; i < livingBlockers.length; i++) {
          const blocker = livingBlockers[i]!;
          const already = blocker.damageMarked ?? 0;
          const [, toughness] = effectivePT(engine.state, blocker);
          const lethalNeeded = deathtouch ? 1 : Math.max(toughness - already, 0);
          const isLast = i === livingBlockers.length - 1;
          const assign = trample ? Math.min(remaining, lethalNeeded) : isLast ? remaining : Math.min(remaining, lethalNeeded);
          if (assign > 0) {
            if (engine.state.dealDamage(blocker, assign, attacker, { combat: true }).prevented) preventedIds.add(blocker.id);
            remaining -= assign;
          }
        }
        if (trample && remaining > 0) engine.state.dealDamage(defender, remaining, attacker, { combat: true });
      }
    }

    for (const blocker of livingBlockers) {
      if (include(blocker)) {
        const [blockerPower] = effectivePT(engine.state, blocker);
        if (engine.state.dealDamage(attacker, blockerPower, blocker, { combat: true }).prevented) preventedIds.add(attacker.id);
      }
    }
  }

  const entries: CombatDamageEntry[] = [];
  const seen = new Set<number>();
  for (const attacker of engine.attackers) {
    for (const card of [attacker, ...(engine.blockers.get(attacker.id) ?? [])]) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      const damage = card.damageMarked ?? 0;
      if (damage > 0) entries.push({ card, damage, lethal: isOut(card) });
    }
  }
  const prevented: RealCard[] = [];
  const seenPrevented = new Set<number>();
  for (const attacker of engine.attackers) {
    for (const card of [attacker, ...(engine.blockers.get(attacker.id) ?? [])]) {
      if (preventedIds.has(card.id) && !seenPrevented.has(card.id)) {
        seenPrevented.add(card.id);
        prevented.push(card);
      }
    }
  }
  return { entries, prevented };
}

/**
 * Real `CombatFirstStrikeDamage` step (510.4/510.5, ENGINE_GAPS.md gap #9)
 * — a caller only ever needs to call this when `currentPhase(engine.turn)
 * === 'CombatFirstStrikeDamage'` is actually reached (`doAdvance` skips
 * presenting that phase at all when nothing qualifies, so a caller that
 * never sees it never needs to call this either). See
 * `resolveCombatDamage`'s own doc comment just below for the full real
 * design/reference.
 */
export function resolveFirstStrikeCombatDamage(engine: GameEngine): CombatDamageResult {
  return runCombatDamageStep(engine, dealsFirstStrikeDamage);
}

export function resolveCombatDamage(engine: GameEngine): CombatDamageResult {
  return runCombatDamageStep(engine, dealsRegularDamage);
}
