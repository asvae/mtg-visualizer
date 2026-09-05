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
//   resolveCombatDamage(engine) -> CombatDamageResult        // applies real damage; see its own doc comment for the lethal-flag/no-SBA caveat
//   advance(engine) -> void                                 // pass to next phase directly
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
//    lands (see mana.ts's own scope note — nonbasic lands/mana rocks/mana
//    abilities are NOT recognized sources).
//  - Activated-ability legality (602.1) — same sorcery-speed-timing/
//    affordability shape as casting, plus real `{T}`-cost tapping. Only a
//    {T} + mana-only cost is payable; a real Sacrifice/Crew/Equip/Pay-life/
//    {X} cost component (common among the 312 FIN cards — see
//    `unsupportedCostComponent`'s own doc comment) is REJECTED (a real,
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
//    ENGINE_GAPS.md #2, a separate gap).
// OUT (real, plainly-flagged gaps, not silently assumed away):
//  - Target-legality checking at cast/declare time. This model's own
//    existing effect system (card.ts) resolves/chooses targets LAZILY,
//    inside `resolveCard`, at RESOLUTION time — there is no pre-resolution
//    "declare and validate targets" step anywhere in this codebase to hook
//    a legality check onto. Retrofitting one would mean redesigning
//    `Effect`'s entire resolution model, which is out of scope here.
//  - State-based actions (704) — a lethally-damaged creature (from combat
//    or anything else) doesn't actually die; see ENGINE_GAPS.md #2.
//  - Alternate costs, X spells, split/modal costs, casting from anywhere
//    but hand.
//  - A real "does the AI/player want to respond" decision process —
//    unchanged from priority.ts's own explicit scope: every round's choices
//    are supplied by the caller, never simulated here.

import type { CardDefinition, EffectContext, Actions } from './card';
import { resolveCard } from './card';
import type { GameState, RealCard, RealPlayer } from './state';
import { effectivePT, effectiveTypes } from './state';
import { Stack, type StackObject } from './stack';
import { runPriorityRound, type PriorityChoice, type PriorityOutcome } from './priority';
import { startGame, currentPhase, activePlayer, advancePhase, type TurnState } from './turn';
import { parseManaCost, canAfford, payMana, untappedManaSources } from './mana';

export type ActionResult = { ok: true } | { ok: false; reason: string };

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
}

export function createEngine(state: GameState, players: RealPlayer[]): GameEngine {
  return { state, players, turn: startGame(), stack: new Stack(), enteredThisTurn: new Map(), attackers: [], blockers: new Map() };
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

/** Read-only legality check — same checks `castSpell` performs before it mutates anything, exposed separately so a caller (or a test asserting "this SHOULD be illegal") doesn't have to attempt-and-undo. */
export function canCastSpell(engine: GameEngine, caster: RealPlayer, card: CardDefinition): ActionResult {
  if (!isInstantSpeed(card) && !sorcerySpeedTimingOk(engine, caster)) {
    return { ok: false, reason: `sorcery-speed timing violated (307.1a/117.1a): "${card.name}" can only be cast during your own main phase with an empty stack` };
  }
  const cost = parseManaCost(card.manaCost);
  if (!canAfford(untappedManaSources(caster), cost)) {
    return { ok: false, reason: `cannot afford "${card.name}"'s cost ${card.manaCost} (601.2g/602.2c) — not enough untapped mana sources` };
  }
  return { ok: true };
}

/**
 * Legality-checks, then (if legal) pays the real cost and pushes the spell
 * onto the real stack — `cardReal` is the actual `RealCard` in `caster`'s
 * hand (moved to the Stack zone here, real 405.2), `ctx`/`actions` are the
 * same `EffectContext`/`Actions` `resolveCard` will eventually run against
 * (build them the same way `harness.ts`'s own `runScenario` does). Returns
 * `{ok:false, reason}` and mutates NOTHING if illegal.
 */
export function castSpell(engine: GameEngine, caster: RealPlayer, cardReal: RealCard, card: CardDefinition, ctx: EffectContext, actions: Actions, triggerName?: string): ActionResult {
  const check = canCastSpell(engine, caster, card);
  if (!check.ok) return check;
  const cost = parseManaCost(card.manaCost);
  payMana(engine.state, untappedManaSources(caster), cost);
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
  engine.stack.push({ card: pushedCard, ctx, actions, triggerName });
  return { ok: true };
}

function isPermanentTypeLine(typeLine: string): boolean {
  return !/\b(Instant|Sorcery)\b/.test(typeLine);
}

/** Whether `cost`'s own free text requires tapping the permanent itself ({T}) as part of paying (602.1). `CardDefinition.activationCost` is a plain string — no structured cost grammar exists — so this, like the helpers below, is real but narrow text-pattern detection, not a parser. */
function costRequiresTap(cost: string): boolean {
  return /\{T\}/.test(cost);
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
function unsupportedCostComponent(cost: string): string | undefined {
  const stripped = cost.replace(/\{T\}/g, '').replace(/\([^)]*\)/g, '');
  for (const part of stripped.split(',').map((p) => p.trim()).filter(Boolean)) {
    if (!/^(\{[^}]+\})+$/.test(part)) return part;
  }
  return undefined;
}

/** The activationCost/`Ability.cost` string for one of `card`'s activated abilities — the single default one (`card.activationCost`) when `abilityName` is omitted, matching `resolveCard`'s own default-branch convention, or a named entry from `card.abilities` (Qiqirn Merchant's own pair, e.g.) when given. `undefined` if no such ability exists at all. */
function activationCostFor(card: CardDefinition, abilityName?: string): string | undefined {
  if (abilityName) return card.abilities?.find((a) => a.name === abilityName)?.cost;
  return card.activationCost;
}

/**
 * Real 602.1 activated-ability legality: controls the permanent, real
 * "activate only as a sorcery" timing (a free-text restriction — no
 * structured timing field exists on `CardDefinition.activationCost`, so
 * this is a real but narrow text-pattern check, not a parsed grammar; a
 * cost with NO such text is treated as instant-speed, matching real MTG's
 * own default), and cost affordability (`{T}` + mana only —
 * `unsupportedCostComponent`'s own doc comment lists what a real card's
 * cost can contain that this engine can't pay yet: Sacrifice/Crew/Equip/
 * Pay-life/{X}). Read-only, same shape as `canCastSpell`.
 */
export function canActivateAbility(engine: GameEngine, controller: RealPlayer, permanent: RealCard, card: CardDefinition, abilityName?: string): ActionResult {
  const cost = activationCostFor(card, abilityName);
  if (!cost) return { ok: false, reason: `"${card.name}" has no such activated ability${abilityName ? ` named "${abilityName}"` : ''}` };
  if (permanent.controllerId !== controller.id) return { ok: false, reason: 'you do not control this permanent (602.1)' };
  if (/activate only as a sorcery/i.test(cost) && !sorcerySpeedTimingOk(engine, controller)) {
    return { ok: false, reason: `"${cost}" restricts this to sorcery-speed timing: only during your own main phase with an empty stack` };
  }
  if (costRequiresTap(cost) && permanent.tapped) {
    return { ok: false, reason: `"${card.name}"'s cost requires tapping it, but it's already tapped` };
  }
  const unsupported = unsupportedCostComponent(cost);
  if (unsupported) {
    return { ok: false, reason: `activation cost includes an unsupported component ("${unsupported}") — this engine only pays {T} + mana costs so far` };
  }
  const manaPortion = manaPortionOf(cost);
  if (/\{[^}]+\}/.test(manaPortion)) {
    let parsedMana;
    try {
      parsedMana = parseManaCost(manaPortion);
    } catch (e) {
      return { ok: false, reason: (e as Error).message };
    }
    if (!canAfford(untappedManaSources(controller), parsedMana)) {
      return { ok: false, reason: `cannot afford "${card.name}"'s cost ${cost} — not enough untapped mana sources` };
    }
  }
  return { ok: true };
}

/**
 * Legality-checks, then (if legal) pays the real cost (taps `permanent` if
 * the cost says `{T}`, taps mana sources for the mana portion) and pushes
 * the ability onto the real stack (602.2 — an activated ability uses the
 * stack exactly like a spell). Unlike `castSpell`, the permanent itself
 * does NOT move zones here — see `resolveTop`'s own `isAbility` branch:
 * an activated ability resolving doesn't relocate its own source, only
 * its OWN effects (if any) do that (Jill's own transform ability moves
 * itself via its own `custom` effect's `actions.moveTo` calls, e.g.).
 */
export function activateAbility(engine: GameEngine, controller: RealPlayer, permanent: RealCard, card: CardDefinition, ctx: EffectContext, actions: Actions, abilityName?: string): ActionResult {
  const check = canActivateAbility(engine, controller, permanent, card, abilityName);
  if (!check.ok) return check;
  const cost = activationCostFor(card, abilityName)!;
  const manaPortion = manaPortionOf(cost);
  if (/\{[^}]+\}/.test(manaPortion)) payMana(engine.state, untappedManaSources(controller), parseManaCost(manaPortion));
  if (costRequiresTap(cost)) engine.state.tap(permanent);
  engine.stack.push({ card, ctx, actions, abilityName, isAbility: true });
  return { ok: true };
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
  const resolved = engine.stack.resolveTop();
  if (!resolved) return undefined;
  if (resolved.isAbility) return resolved;
  const real = engine.state.cards.get(resolved.ctx.self.getId());
  if (real) {
    if (isPermanentTypeLine(resolved.card.typeLine)) {
      engine.state.move(real, 'Battlefield');
      engine.enteredThisTurn.set(real.id, engine.turn.turnNumber);
      const enterTrigger = resolved.card.triggers?.find((t) => t.on === 'enter');
      if (enterTrigger) resolveCard(resolved.card, resolved.ctx, resolved.actions, enterTrigger.name);
    } else {
      engine.state.move(real, 'Graveyard');
    }
  }
  return resolved;
}

/**
 * One APNAP round (`priority.ts`'s own `runPriorityRound`), then performs
 * whatever it decided: resolves the stack's top object, or advances to the
 * next phase (running that phase's own automatic action — untap/draw —
 * via `turn.ts`'s `advancePhase`), or does nothing further if someone
 * pushed (that push already happened as a real `castSpell`/activated-
 * ability call before this round; a `{push:...}` choice here is for a
 * caller scripting priority.ts directly rather than going through
 * `castSpell` — same "scripted, not simulated" contract priority.ts's own
 * header already states).
 */
export function stepPriority(engine: GameEngine, choices: PriorityChoice[]): PriorityOutcome {
  const outcome = runPriorityRound(engine.stack, choices);
  if (outcome === 'resolve-stack') resolveTop(engine);
  else if (outcome === 'advance-phase') engine.turn = advancePhase(engine.state, engine.turn, engine.players);
  return outcome;
}

/** Direct phase advance, bypassing priority entirely — for a caller that isn't scripting responses this round and just wants to move on (real games still pass priority around an empty stack first; this is the same shortcut `harness.ts`'s own `advanceToPhase` already takes for the same reason: only the phase transition itself is being demonstrated). */
export function advance(engine: GameEngine): void {
  engine.turn = advancePhase(engine.state, engine.turn, engine.players);
}

/** Real 302.6 (summoning sickness) + 508.1a (a tapped creature can't attack) + 302.6's own Defender clause (302.6's "can't attack" companion rule, 302.6a). Read-only — same "check separately from the mutating action" shape as `canCastSpell`. */
export function canAttack(engine: GameEngine, creature: RealCard): ActionResult {
  if (creature.tapped) return { ok: false, reason: 'tapped creatures cannot attack (508.1a)' };
  if (creature.keywords.includes('Defender')) return { ok: false, reason: "creatures with Defender can't attack (302.6)" };
  const enteredTurn = engine.enteredThisTurn.get(creature.id);
  const sick = enteredTurn === engine.turn.turnNumber && !creature.keywords.includes('Haste');
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
  engine.attackers = attackers;
  engine.blockers = new Map();
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
}

/** 704.5g (damage >= toughness) or 704.5h (any nonzero damage from a Deathtouch source) — the two real state-based-action tests for "this damage was lethal." Does NOT destroy anything (see `resolveCombatDamage`'s own doc comment) — just answers the question. */
function isLethalDamage(state: GameState, card: RealCard, damageTotal: number, tookDeathtouchHit: boolean): boolean {
  if (damageTotal <= 0) return false;
  if (tookDeathtouchHit) return true;
  const [, toughness] = effectivePT(state, card);
  return damageTotal >= toughness;
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
 * Real 510.5's own first/double-strike ordering (two damage sub-steps
 * when at least one combatant has First/Double Strike) is modeled as two
 * internal passes within this ONE call, rather than a second real
 * `turn.ts` phase (`PhaseType.COMBAT_FIRST_STRIKE_DAMAGE`, excluded from
 * `turn.ts`'s own `PHASES` list per that file's header) — a creature dealt
 * lethal damage in the first pass is excluded from dealing OR receiving
 * damage in the second, same as a real 704-SBA check between the two real
 * sub-steps would produce, WITHOUT this function actually destroying it
 * (see below).
 *
 * This function does NOT call `state.destroy` on anything, even a
 * creature this pass computes as lethally damaged — real creature death
 * from combat damage is a state-based action (704.5g/704.5h), and general
 * SBAs are a separate, not-yet-built gap (ENGINE_GAPS.md #2). What this
 * function DOES do: apply every real damage amount via `state.dealDamage`
 * (so player life totals and Lifelink both take their real, correct
 * effect) and report, per creature that took any damage this call,
 * whether that damage was lethal — a future SBA pass consumes this
 * directly rather than recomputing it.
 */
export function resolveCombatDamage(engine: GameEngine): CombatDamageResult {
  const damageTaken = new Map<number, number>();
  const deathtouchHit = new Set<number>();
  const lethalSoFar = new Set<number>();

  const dealsFirst = (c: RealCard) => c.keywords.includes('FirstStrike') || c.keywords.includes('DoubleStrike');
  const dealsRegular = (c: RealCard) => c.keywords.includes('DoubleStrike') || !c.keywords.includes('FirstStrike');

  const defenderOf = (attacker: RealCard): RealPlayer => engine.players.find((p) => p.id !== attacker.controllerId)!;

  function runStep(include: (c: RealCard) => boolean): void {
    for (const attacker of engine.attackers) {
      if (lethalSoFar.has(attacker.id)) continue;
      const originalBlockers = engine.blockers.get(attacker.id) ?? [];
      const isBlockedAtAll = originalBlockers.length > 0;
      const livingBlockers = originalBlockers.filter((b) => !lethalSoFar.has(b.id));
      const defender = defenderOf(attacker);

      if (include(attacker)) {
        const [power] = effectivePT(engine.state, attacker);
        const deathtouch = attacker.keywords.includes('Deathtouch');
        const trample = attacker.keywords.includes('Trample');
        if (!isBlockedAtAll) {
          engine.state.dealDamage(defender, power, attacker);
        } else if (livingBlockers.length === 0) {
          if (trample) engine.state.dealDamage(defender, power, attacker);
        } else {
          let remaining = power;
          for (let i = 0; i < livingBlockers.length; i++) {
            const blocker = livingBlockers[i]!;
            const already = damageTaken.get(blocker.id) ?? 0;
            const [, toughness] = effectivePT(engine.state, blocker);
            const lethalNeeded = deathtouch ? 1 : Math.max(toughness - already, 0);
            const isLast = i === livingBlockers.length - 1;
            const assign = trample ? Math.min(remaining, lethalNeeded) : isLast ? remaining : Math.min(remaining, lethalNeeded);
            if (assign > 0) {
              engine.state.dealDamage(blocker, assign, attacker);
              damageTaken.set(blocker.id, already + assign);
              if (deathtouch) deathtouchHit.add(blocker.id);
              remaining -= assign;
            }
          }
          if (trample && remaining > 0) engine.state.dealDamage(defender, remaining, attacker);
        }
      }

      for (const blocker of livingBlockers) {
        if (include(blocker)) {
          const [blockerPower] = effectivePT(engine.state, blocker);
          const already = damageTaken.get(attacker.id) ?? 0;
          engine.state.dealDamage(attacker, blockerPower, blocker);
          damageTaken.set(attacker.id, already + blockerPower);
          if (blocker.keywords.includes('Deathtouch')) deathtouchHit.add(attacker.id);
        }
      }
    }
  }

  function markLethalPass(): void {
    for (const attacker of engine.attackers) {
      for (const card of [attacker, ...(engine.blockers.get(attacker.id) ?? [])]) {
        if (lethalSoFar.has(card.id)) continue;
        const dmg = damageTaken.get(card.id) ?? 0;
        if (isLethalDamage(engine.state, card, dmg, deathtouchHit.has(card.id))) lethalSoFar.add(card.id);
      }
    }
  }

  runStep(dealsFirst);
  markLethalPass();
  runStep(dealsRegular);
  markLethalPass();

  const entries: CombatDamageEntry[] = [];
  const seen = new Set<number>();
  for (const attacker of engine.attackers) {
    for (const card of [attacker, ...(engine.blockers.get(attacker.id) ?? [])]) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      const damage = damageTaken.get(card.id) ?? 0;
      if (damage > 0) entries.push({ card, damage, lethal: lethalSoFar.has(card.id) });
    }
  }
  return { entries };
}
