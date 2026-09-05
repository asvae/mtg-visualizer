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
//   stepPriority(engine, choices) -> PriorityOutcome        // one APNAP round
//   canAttack(engine, creature) -> ActionResult
//   declareAttackers(engine, attackers) -> ActionResult
//   advance(engine) -> void                                 // pass to next phase directly
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
//  - Summoning sickness (302.6) and Defender/tapped-creature attack
//    restrictions (508.1a).
// OUT (real, plainly-flagged gaps, not silently assumed away):
//  - Target-legality checking at cast/declare time. This model's own
//    existing effect system (card.ts) resolves/chooses targets LAZILY,
//    inside `resolveCard`, at RESOLUTION time — there is no pre-resolution
//    "declare and validate targets" step anywhere in this codebase to hook
//    a legality check onto. Retrofitting one would mean redesigning
//    `Effect`'s entire resolution model, which is out of scope here.
//  - Declaring blockers / real combat damage assignment. `turn.ts`'s own
//    header already flags `CombatDamage` as reachable-but-inert; this file
//    adds attacker-declaration legality on top, nothing about blocking.
//  - Alternate costs, X spells, split/modal costs, casting from anywhere
//    but hand.
//  - A real "does the AI/player want to respond" decision process —
//    unchanged from priority.ts's own explicit scope: every round's choices
//    are supplied by the caller, never simulated here.

import type { CardDefinition, EffectContext, Actions } from './card';
import type { GameState, RealCard, RealPlayer } from './state';
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
}

export function createEngine(state: GameState, players: RealPlayer[]): GameEngine {
  return { state, players, turn: startGame(), stack: new Stack(), enteredThisTurn: new Map() };
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
  engine.stack.push({ card, ctx, actions, triggerName });
  return { ok: true };
}

function isPermanentTypeLine(typeLine: string): boolean {
  return !/\b(Instant|Sorcery)\b/.test(typeLine);
}

/**
 * Resolves the top of the real stack (`Stack.resolveTop`, which runs
 * `resolveCard` for you) and moves the resolved card to its real
 * post-resolution zone — Battlefield (stamping `enteredThisTurn` for
 * summoning-sickness purposes) for a permanent, Graveyard for an instant/
 * sorcery. A no-op, safely, on an empty stack.
 */
export function resolveTop(engine: GameEngine): StackObject | undefined {
  const resolved = engine.stack.resolveTop();
  if (!resolved) return undefined;
  const real = engine.state.cards.get(resolved.ctx.self.getId());
  if (real) {
    if (isPermanentTypeLine(resolved.card.typeLine)) {
      engine.state.move(real, 'Battlefield');
      engine.enteredThisTurn.set(real.id, engine.turn.turnNumber);
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
  return { ok: true };
}
