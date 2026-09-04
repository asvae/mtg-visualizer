import type { CardDefinition, EffectContext, Actions } from './card';
import { resolveCard } from './card';
import type { Card, Player, ZoneType } from './interfaces';
import { GameState, wrapPlayer, wrapCard, effectiveTypes, type RealCard, type RealPlayer } from './state';

/**
 * One card's own test scenario — plain data describing a board state to run
 * the card's effects against, not a pre-built mock object. Counts, not
 * actual card lists: a scenario only needs to say "3 creature cards in the
 * graveyard," the harness below manufactures real cards to match (see
 * functional-model/state.ts — these are now REAL, mutable game objects,
 * not disposable static snapshots).
 * Lives at functional-model/cards/<slug>/scenarios.ts, one array per card.
 */
export interface Scenario {
  label: string;
  castFrom?: 'hand' | 'graveyard' | 'exile';
  /** Which of `card.triggers` this scenario exercises — omit for a card whose behavior is all in `card.effects` (a cast/activated-ability resolution) instead. */
  trigger?: string;
  /** `'back'` runs against `card.backFace` instead of `card` itself (Braska's Final Aeon's own chapter triggers, reached via Jecht's own `backFace`) — omit (default `'front'`) for every single-faced card. */
  face?: 'front' | 'back';
  /** Which `modal` effect branch was chosen — see card.ts's own `EffectContext.mode`. */
  mode?: number;
  /** A trigger's own fixed variable info (Kain's "that player"/"that much damage") — see card.ts's own `EffectContext.triggerInput`. */
  triggerInput?: Record<string, unknown>;
  you?: PlayerState;
  opponents?: PlayerState[];
}
export interface PlayerState {
  life?: number;
  landsCount?: number;
  creaturesCount?: number;
  /** Nontoken creatures specifically — Gaius van Baelsar's own "sacrifice a NONTOKEN creature" mode needs to tell these apart from `creaturesCount`'s tokens. Included IN `creaturesCount`, not additional to it. */
  nontokenCreaturesCount?: number;
  artifactsCount?: number;
  enchantmentsCount?: number;
  handCount?: number;
  graveyardCreatureCount?: number;
  libraryCount?: number;
}

/** One logged call — the raw material a synergy matcher reads. Persisted verbatim to functional-model/cards/<slug>/trace.json. */
export interface LogEntry {
  fn: string;
  [key: string]: unknown;
}

export interface TraceResult {
  scenario: string;
  log: LogEntry[];
}

// ---------------------------------------------------------------------------
// Real board setup from a Scenario's plain-data PlayerState — pushes real
// RealCard objects into a real RealPlayer's real zone arrays (see state.ts).
// Same generic-object conventions the old static mocks used (a "creature"
// is just a card whose `types` includes 'Creature'), just backed by real,
// mutable objects now instead of throwaway snapshots.

function setupPlayer(state: GameState, real: RealPlayer, ps: PlayerState = {}): void {
  real.life = ps.life ?? 20;
  // Every generated name is prefixed with the OWNING player's own name
  // (real.name — "you"/"opp0"/...) — without this, two different players'
  // Nth generic card (e.g. "you"'s creature-token-0 and "opp0"'s
  // creature-token-0) would share an identical name string, and every log
  // entry that reports `target: card.getName()` would become ambiguous
  // about which player's card it actually was. Real ids stay distinct
  // regardless (GameState.addCard always allocates a fresh one), but the
  // LOG's own readability depends on names being unique across players too.
  const n = real.name;
  const nontoken = ps.nontokenCreaturesCount ?? 0;
  for (let i = 0; i < nontoken; i++) {
    state.addCard(real, 'Battlefield', { name: `${n}-creature-nontoken-${i}`, isTokenCard: false, types: ['Creature'] });
  }
  const tokenCreatures = Math.max(0, (ps.creaturesCount ?? 0) - nontoken);
  for (let i = 0; i < tokenCreatures; i++) {
    state.addCard(real, 'Battlefield', { name: `${n}-creature-token-${i}`, isTokenCard: true, types: ['Creature'] });
  }
  for (let i = 0; i < (ps.artifactsCount ?? 0); i++) {
    state.addCard(real, 'Battlefield', { name: `${n}-artifact-${i}`, types: ['Artifact'] });
  }
  for (let i = 0; i < (ps.enchantmentsCount ?? 0); i++) {
    state.addCard(real, 'Battlefield', { name: `${n}-enchantment-${i}`, types: ['Enchantment'] });
  }
  for (let i = 0; i < (ps.graveyardCreatureCount ?? 0); i++) {
    state.addCard(real, 'Graveyard', { name: `${n}-gy-creature-${i}`, types: ['Creature'] });
  }
  for (let i = 0; i < (ps.landsCount ?? 0); i++) {
    state.addCard(real, 'Battlefield', { name: `${n}-land-${i}`, types: ['Land'] });
  }
  for (let i = 0; i < (ps.handCount ?? 0); i++) {
    state.addCard(real, 'Hand', { name: `${n}-hand-${i}`, types: [] });
  }
  for (let i = 0; i < (ps.libraryCount ?? 0); i++) {
    state.addCard(real, 'Library', { name: `${n}-library-${i}`, types: [] });
  }
}

// A stable per-scenario instance id for `self` — see mockSelf's own history
// in this file (kept as SELF_INSTANCE_ID = 1, not a global counter): today's
// scenarios are each an independent, unrelated resolution, so the id never
// needs to differentiate across them (a global counter previously inflated
// flatten-traces.mjs's distinct-fact counts for no reason — confirmed the
// hard way). Real `self` in state.ts gets its own real GameState-assigned
// id for zone-mutation purposes; this constant is only for the LOG's own
// `instanceId` field, which existing traces/dedup already depend on.
const SELF_INSTANCE_ID = 1;

function typesFromTypeLine(typeLine: string): string[] {
  const types: string[] = [];
  if (/\bCreature\b/.test(typeLine)) types.push('Creature');
  if (/\bArtifact\b/.test(typeLine)) types.push('Artifact');
  if (/\bEnchantment\b/.test(typeLine)) types.push('Enchantment');
  if (/\bLand\b/.test(typeLine)) types.push('Land');
  return types;
}

// ---------------------------------------------------------------------------
// Logging layer — wraps the REAL Player/Card (state.ts's wrapPlayer/wrapCard,
// genuinely mutating) with the exact log entry shapes the earlier static
// mocks used, so trace.json's format/fields are unchanged; only what
// happens underneath a call changed (real mutation, not just a recorded
// intent). Per-card predicate reads (isCreature/isToken/hasSubtype/...)
// stay QUIET — see the standing rule this file has carried since the
// "isCreature spam" fix: an aggregate zone-level read (getCardsIn, below)
// is the useful, discoverable fact, not which specific object answered
// true to a per-object predicate.

function loggingPlayer(state: GameState, real: RealPlayer, log: LogEntry[]): Player {
  const base = wrapPlayer(state, real);
  const name = real.name;
  return {
    ...base,
    getLife: () => {
      const result = base.getLife();
      log.push({ fn: 'read:getLife', player: name, result });
      return result;
    },
    gainLife: (amount: number) => {
      const ok = base.gainLife(amount);
      log.push({ fn: 'gainLife', player: name, amount });
      return ok;
    },
    loseLife: (amount: number) => {
      const result = base.loseLife(amount);
      log.push({ fn: 'loseLife', player: name, amount });
      return result;
    },
    drawCard: () => {
      const result = base.drawCard();
      log.push({ fn: 'drawCard', player: name });
      return result;
    },
    drawCards: (n: number) => {
      const result = base.drawCards(n);
      log.push({ fn: 'drawCards', player: name, n });
      return result;
    },
    getCreaturesInPlay: () => {
      const result = base.getCreaturesInPlay();
      log.push({ fn: 'read:getCreaturesInPlay', player: name, count: result.length });
      return result;
    },
    getLandsInPlay: () => {
      const result = base.getLandsInPlay();
      log.push({ fn: 'read:getLandsInPlay', player: name, count: result.length });
      return result;
    },
    getCardsIn: (zone: ZoneType) => {
      const result = base.getCardsIn(zone);
      const creatureCount = result.filter((c) => c.isCreature()).length;
      log.push({ fn: 'read:getCardsIn', player: name, zone, count: result.length, creatureCount });
      return result;
    },
  } as unknown as Player;
}

function loggingActions(state: GameState, log: LogEntry[], selfId: number): Actions {
  const cardOf = (c: Card): RealCard => state.cards.get(c.getId() as number)!;
  const playerOf = (p: Player): RealPlayer => state.players.get(p.getId() as number)!;
  return {
    createToken: (controller, token, qty = 1, opts) => {
      const made = state.createToken(playerOf(controller), token, qty, opts);
      log.push({ fn: 'createToken', controller: controller.getName(), token: token.name, qty, tapped: !!opts?.tapped });
      return made.map((c) => wrapCard(state, c));
    },
    pump: (target, power, toughness) => {
      const name = 'getName' in target ? target.getName() : String(target);
      if ('getId' in target && !('getLife' in target)) state.pump(cardOf(target as Card), power, toughness);
      log.push({ fn: 'pump', target: name, power, toughness });
    },
    moveTo: (target, zone) => {
      state.move(cardOf(target), zone);
      log.push({ fn: 'moveTo', target: target.getName(), zone });
    },
    // Quiet, same reasoning as mockCreature's predicate methods used to be:
    // WHICH specific object got picked is pure targeting mechanics, not a
    // game-state fact. The real consequence (a card actually moving zones,
    // etc.) still logs via whatever action is called on the chosen target
    // right after this.
    chooseTarget: (pool) => pool[0]!,
    move: (player, from, to, qty, validType) => {
      const real = playerOf(player);
      const fromArr = from === 'Hand' ? real.hand : from === 'Library' ? real.library : from === 'Graveyard' ? real.graveyard : from === 'Battlefield' ? real.battlefield : real.exile;
      const matches = (c: RealCard) => !validType || validType === 'any' || (validType === 'creature' && effectiveTypes(c).includes('Creature'));
      const chosen = fromArr.filter(matches).slice(0, qty);
      for (const c of chosen) state.move(c, to);
      log.push({ fn: 'move', player: player.getName(), from, to, qty, validType });
      return chosen.map((c) => wrapCard(state, c));
    },
    sacrifice: (player, qty, validType, notSelf, tokenFilter) => {
      const real = playerOf(player);
      const matches = (c: RealCard) => {
        if (notSelf && c.id === selfId) return false;
        if (tokenFilter === 'token' && !c.isTokenCard) return false;
        if (tokenFilter === 'nontoken' && c.isTokenCard) return false;
        const types = effectiveTypes(c);
        switch (validType) {
          case 'creature':
            return types.includes('Creature');
          case 'artifact':
            return types.includes('Artifact');
          case 'enchantment':
            return types.includes('Enchantment');
          case 'creature-or-artifact':
            return types.includes('Creature') || types.includes('Artifact');
          default:
            return true;
        }
      };
      const chosen = state.sacrifice(real, qty, matches);
      log.push({ fn: 'sacrifice', player: player.getName(), qty, validType, notSelf: !!notSelf, tokenFilter: tokenFilter ?? null });
      return chosen.map((c) => wrapCard(state, c));
    },
    discard: (player, qty) => {
      state.discard(playerOf(player), qty);
      log.push({ fn: 'discard', player: player.getName(), qty });
    },
    putCounter: (target, counterType, amount) => {
      state.putCounter(cardOf(target), counterType, amount);
      log.push({ fn: 'putCounter', target: target.getName(), counterType, amount });
    },
    equip: (equipment, target) => {
      state.equip(cardOf(equipment), cardOf(target));
      log.push({ fn: 'equip', equipment: equipment.getName(), target: target.getName() });
    },
    animate: (target, types) => {
      state.animate(cardOf(target), types);
      log.push({ fn: 'animate', target: target.getName(), types });
    },
    gainControl: (controller, target) => {
      state.gainControl(playerOf(controller), cardOf(target));
      log.push({ fn: 'gainControl', controller: controller.getName(), target: target.getName() });
    },
    // No real card-drafting/library-reordering model for surveil (nothing
    // in the current 12 cards checks post-surveil library contents) — kept
    // log-only, same as before, rather than a fabricated mutation.
    surveil: (player, qty) => {
      log.push({ fn: 'surveil', player: player.getName(), qty });
    },
    destroy: (target) => {
      state.destroy(cardOf(target));
      log.push({ fn: 'destroy', target: target.getName() });
    },
    dealDamage: (source, target, amount) => {
      if ('getLife' in target) state.dealDamage(playerOf(target as Player), amount);
      else state.dealDamage(cardOf(target as Card), amount);
      log.push({ fn: 'dealDamage', source: source.getName(), target: target.getName(), amount });
    },
  };
}

function isInstantOrSorcery(typeLine: string): boolean {
  return /\b(Instant|Sorcery)\b/.test(typeLine);
}

/**
 * Lifecycle events surrounding `card.effects`/`card.triggers` that Forge's
 * engine fires automatically for EVERY spell/ability — never authored
 * per-card (same "derived, not data" reasoning synergy-model/SCHEMA.md
 * already documents for `cast X -> emit cast` and a resolved
 * instant/sorcery's own trip to the graveyard). Missing these was a real
 * gap: `resolveCard()` alone only shows a spell's own payload, not the "you
 * cast a sorcery" / "a card was put into your graveyard" facts another
 * card's own triggers actually key off.
 *
 * Shapes, chosen by what's declared on `card` and the scenario (not
 * guessed):
 *  - `activationCost` present (Warren Elder) -> `activate` only. The source
 *    permanent doesn't change zones just because its ability resolved.
 *  - `scenario.trigger` names one of `card.triggers` -> the permanent is
 *    already on the battlefield (this run isn't testing its cast/ETB at
 *    all) — just a `trigger` event bracketing that one named ability.
 *  - Instant/Sorcery typeLine -> `cast`, then `resolveCard()`'s own effects,
 *    then `move` to graveyard — UNLESS the scenario's `castFrom` matches an
 *    `alternateCosts` entry with `thenExile: true` (Flashback), in which
 *    case it's `move` to exile instead, and critically NEVER graveyard —
 *    real rule text, and the exact fact a "return an instant/sorcery card
 *    from your graveyard" effect elsewhere needs to know didn't happen.
 *  - Anything else (a permanent being cast, its own ETB effects/triggers
 *    running) -> `cast`, then effects, then `enters` the battlefield rather
 *    than moving to a zone.
 */
function lifecycleBefore(card: CardDefinition, scenario: Scenario, instanceId: number): LogEntry[] {
  if (scenario.trigger) return [{ fn: 'trigger', card: card.name, instanceId, name: scenario.trigger }];
  if (card.activationCost) return [{ fn: 'activate', card: card.name, instanceId, cost: card.activationCost }];
  const castFrom = scenario.castFrom ?? 'hand';
  // The cost paid to cast THIS way — the card's own printed mana cost for a
  // normal hand-cast, or the matching `alternateCosts` entry's own cost
  // (Flashback's `{4}{B}{B}`, e.g.) whenever castFrom names one. Matches
  // synergy-model's own `node:castFlashback`'s `cost:{4}{B}{B}` flag — cost
  // is part of the cast fact itself, not left off it.
  const cost = castFrom === 'hand' ? card.manaCost : (card.alternateCosts?.find((c) => c.from === castFrom)?.cost ?? card.manaCost);
  return [{ fn: 'cast', card: card.name, instanceId, from: castFrom, cost }];
}
function lifecycleAfter(card: CardDefinition, scenario: Scenario, instanceId: number, state: GameState, selfReal: RealCard): LogEntry[] {
  if (scenario.trigger || card.activationCost) return [];
  if (!isInstantOrSorcery(card.typeLine)) {
    state.move(selfReal, 'Battlefield');
    return [{ fn: 'enters', card: card.name, instanceId, zone: 'battlefield' }];
  }
  const castFrom = scenario.castFrom ?? 'hand';
  const altCost = card.alternateCosts?.find((c) => c.from === castFrom);
  const to = altCost?.thenExile ? 'Exile' : 'Graveyard';
  state.move(selfReal, to);
  return [{ fn: 'move', card: card.name, instanceId, from: 'stack', to: altCost?.thenExile ? 'exile' : 'graveyard' }];
}

/** Runs `card` through one scenario with a real, mutable GameState (see functional-model/state.ts) — returns the resulting fact log, bracketed by the automatic cast/activate/trigger/move/enters lifecycle events (see lifecycleBefore/After above), not just the effects themselves. Real zone mutation means `getCardsIn`/`getCreaturesInPlay`/etc. reflect actual prior actions within this run (Fight On!'s own two `moveTo` calls really do shrink the graveyard pool for the second pick) — this is what makes a future joint-scenario driver (chaining multiple `runScenario`-style resolutions against ONE shared GameState) possible, though nothing calls it that way yet. */
export function runScenario(card: CardDefinition, scenario: Scenario): TraceResult {
  const effectiveCard = scenario.face === 'back' ? (card.backFace ?? card) : card;
  const instanceId = SELF_INSTANCE_ID;
  const log: LogEntry[] = [...lifecycleBefore(effectiveCard, scenario, instanceId)];

  const state = new GameState();
  const you = state.addPlayer('you');
  setupPlayer(state, you, scenario.you);
  const opponents = (scenario.opponents ?? []).map((ps, i) => {
    const opp = state.addPlayer(`opp${i}`);
    setupPlayer(state, opp, ps);
    return opp;
  });

  // `self` starts on the battlefield for a trigger/activated-ability
  // scenario (the permanent's already there when its own trigger/ability
  // fires) or on the stack for a plain cast (a spell resolving for the
  // first time) — see this function's own header. A REAL RealCard, not a
  // disposable stand-in: Jecht's own "exile this, then return it
  // transformed" really moves this same object through state.move().
  const selfZone: ZoneType = scenario.trigger || effectiveCard.activationCost ? 'Battlefield' : 'Stack';
  const selfReal = state.addCard(you, selfZone, {
    name: effectiveCard.name,
    isTokenCard: false,
    types: typesFromTypeLine(effectiveCard.typeLine),
  });
  const youLogging = loggingPlayer(state, you, log);
  const opponentsLogging = opponents.map((o) => loggingPlayer(state, o, log));
  const self = wrapCard(state, selfReal);
  const ctx: EffectContext = { self, you: youLogging, opponents: opponentsLogging, castFrom: scenario.castFrom ?? 'hand', mode: scenario.mode, triggerInput: scenario.triggerInput };
  resolveCard(effectiveCard, ctx, loggingActions(state, log, selfReal.id), scenario.trigger);
  log.push(...lifecycleAfter(effectiveCard, scenario, instanceId, state, selfReal));
  return { scenario: scenario.label, log };
}

export function runScenarios(card: CardDefinition, scenarios: Scenario[]): TraceResult[] {
  return scenarios.map((s) => runScenario(card, s));
}
