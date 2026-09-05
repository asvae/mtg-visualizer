import type { CardDefinition, EffectContext, Actions } from './card';
import { resolveCard } from './card';
import type { Card, Player, ZoneType } from './interfaces';
import { GameState, wrapPlayer, wrapCard, effectiveTypes, effectivePT, type RealCard, type RealPlayer } from './state';
import { PHASES, currentPhase, advancePhase, type Phase } from './turn';

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
  /**
   * Legacy single-sentence label — still supported (used as the `result`
   * fallback when `result` below is omitted) for cards not yet migrated to
   * the 3-part format. New scenarios should set `result` instead and let
   * `setup`/`action` (below) get auto-derived rather than writing a label.
   */
  label?: string;
  /**
   * One-line human summary of what actually happened, relative to `setup`
   * (Fight On!'s own "2 creature cards moved from graveyard to hand") —
   * NOT auto-derived (unlike `setup`/`action`, both fully computed from
   * this scenario's own structured fields — see `describeSetup`/
   * `describeAction` in this file): correctly summarizing an arbitrary
   * effect's real consequence needs a human read of what the card does.
   */
  result?: string;
  /**
   * Override/addition to the auto-generated setup summary (`describeSetup`,
   * derived from `you`/`opponents`/`selfCounters` below) — use when the
   * auto-summary doesn't capture something relevant (a DFC's `face`, a
   * trigger's own `triggerInput`, e.g.). Baseline default every scenario
   * starts from, unless the auto-summary or this says otherwise: the
   * tested card in hand, Main Phase with priority, all other zones empty,
   * unlimited mana.
   */
  setupNote?: string;
  castFrom?: 'hand' | 'graveyard' | 'exile';
  /** Which of `card.triggers` this scenario exercises — omit for a card whose behavior is all in `card.effects` (a cast/activated-ability resolution) instead. */
  trigger?: string;
  /** The value chosen for this card's own printed `X` at cast time (Choco-Comet's own "deals X damage") — mirrors `EffectContext.xPaid`'s own doc comment (card.ts). Omit for a card with no `X` in its mana cost. */
  xPaid?: number;
  /** Which of `card.abilities` this scenario exercises — a permanent with MORE THAN ONE independent activated ability (Qiqirn Merchant's own pair). Omit for a card whose only activated ability is `card.activationCost`+`card.effects` (the common case), same as `trigger` above being omitted for a card with no named triggers. */
  ability?: string;
  /** `'back'` runs against `card.backFace` instead of `card` itself (Braska's Final Aeon's own chapter triggers, reached via Jecht's own `backFace`) — omit (default `'front'`) for every single-faced card. */
  face?: 'front' | 'back';
  /** Which `modal` effect branch was chosen — see card.ts's own `EffectContext.mode`. */
  mode?: number;
  /** A trigger's own fixed variable info (Kain's "that player"/"that much damage") — see card.ts's own `EffectContext.triggerInput`. */
  triggerInput?: Record<string, unknown>;
  /** Real counters already on `self` when this scenario starts (Aerith Gainsborough's own death trigger reads `ctx.self.getCounters('+1/+1')` — needs a way to seed that count before the trigger fires). Omit for a card whose effects don't depend on its own prior counter state. */
  selfCounters?: Record<string, number>;
  /**
   * A synthetic probe — NOT a `card.effects`/`triggers` entry, a real MTG
   * event (this creature dealing combat damage to an opponent) that happens
   * independent of anything a card authors, the same way `trigger` above
   * lets a scenario fire a named trigger without modeling the real
   * triggering event. Exists so a keyword like Lifelink (no `effects` of
   * its own to run — see `state.dealDamage`'s own real Forge citation) is
   * still genuinely scenario-testable. No attack/block/damage-assignment
   * step is modeled (turn.ts has none) — this only stands in for "the
   * damage happened."
   */
  dealsCombatDamage?: { amount: number };
  /**
   * A synthetic probe, same shape as `dealsCombatDamage` above — a second
   * copy of THIS card (same name) enters the controller's battlefield,
   * triggering a real 704.5j legend-rule check (`state.checkLegendRule`,
   * real Forge citation there). Only meaningful for a Legendary card;
   * a no-op otherwise.
   */
  duplicateLegendaryEnters?: boolean;
  /**
   * Advances `turn.ts`'s real phase sequence, starting from Main1 (this
   * harness's own implicit baseline phase — see `setupNote`'s doc comment),
   * forward through each phase up to and including this one, AFTER the main
   * effect above has resolved — draining any `actions.delayUntil` entries it
   * scheduled along the way (Elrond, Moon-Reader's own "return ... at the
   * beginning of the next end step," e.g.), so a delayed effect's real
   * timing is genuinely demonstrated in the trace rather than assumed. Omit
   * for a scenario with no delayed trigger to prove out (the common case) —
   * advancing needlessly would spuriously log intervening phase entries for
   * nothing.
   */
  advanceToPhase?: Phase;
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
  /** Subtypes to tag every generated creature with (Aerith Gainsborough's own "each LEGENDARY creature you control" needs a generated creature that `hasSubtype('Legendary')` actually matches) — applies uniformly to both the nontoken- and token-creature loops below. Omit for a generic, subtype-less creature (the common case). */
  creatureSubtypes?: string[];
  /** Overrides every generated creature's base power (state.ts's own default is `basePower: 1`) — Battle Menu's own "power 4 or greater" filter needs a real candidate that clears the bar. */
  creaturePower?: number;
  /** Artifact library cards specifically, INCLUDED in `libraryCount` (same "included, not additional" convention `nontokenCreaturesCount` already uses against `creaturesCount`) — Ashe's own `dig(validType:'artifact')` and Cloud, Midgar Mercenary's own artifact search need a real typed candidate to find. */
  libraryArtifactCount?: number;
  /** Land library cards specifically, INCLUDED in `libraryCount` (same convention as `libraryArtifactCount` above) — Silvan Rally's own "put up to two LAND cards from among them into hand" and Elven Passage's own basic-land search need a real land candidate to find. */
  libraryLandCount?: number;
  /** Creature library cards of one specific subtype, INCLUDED in `libraryCount` (same convention as `libraryArtifactCount`/`libraryLandCount` above) — Cantankerous Keepers' own "put all Elf cards from among them into hand" needs a real Elf-typed candidate among milled cards. Paired fields (not a bare count) since, unlike Artifact/Land, the subtype varies per card. */
  librarySubtypeCount?: number;
  librarySubtype?: string;
  /** Equipment cards on the battlefield specifically, INCLUDED in `artifactsCount` (same convention) — Adelbert Steiner's own live-recalculated `ptFormula` (state.ts's own real layer-7a CDA) needs real Equipment permanents on the controller's battlefield to count. */
  equipmentCount?: number;
}

/** One logged call — the raw material a synergy matcher reads. Persisted verbatim to functional-model/cards/<slug>/trace.json. */
export interface LogEntry {
  fn: string;
  [key: string]: unknown;
}

export interface TraceResult {
  /**
   * The 3-part scenario summary — `setup`/`action` are ALWAYS computed here
   * (`describeSetup`/`describeAction` below), never author-written, so they
   * can't drift from what the scenario's own fields actually say. `result`
   * is `scenario.result` when set, else `scenario.label` (legacy), else a
   * placeholder for a not-yet-migrated scenario.
   */
  scenario: { setup: string; action: string; result: string };
  log: LogEntry[];
}

const PLAYER_STATE_DEFAULTS: PlayerState = { life: 20 };

/**
 * Turns one `PlayerState`'s non-default fields into readable fragments
 * ("2 creatures in graveyard", "18 life") — omits anything at its default
 * (0/undefined, or 20 life) so a scenario's setup summary only ever states
 * what's DIFFERENT from the baseline (see `Scenario.setupNote`'s own doc
 * comment for that baseline). Never hand-maintained prose: every fragment
 * reads directly off the same fields `setupPlayer` (above) uses to build
 * the real board, so it can't drift from what actually got set up.
 */
function describePlayerState(ps: PlayerState | undefined, whose: string): string[] {
  if (!ps) return [];
  const parts: string[] = [];
  if (ps.life !== undefined && ps.life !== PLAYER_STATE_DEFAULTS.life) parts.push(`${whose} at ${ps.life} life`);
  if (ps.landsCount) parts.push(`${whose} ${ps.landsCount} land(s)`);
  if (ps.creaturesCount) {
    const subtype = ps.creatureSubtypes?.length ? ` ${ps.creatureSubtypes.join(' ')}` : '';
    const power = ps.creaturePower !== undefined ? ` (power ${ps.creaturePower})` : '';
    const nontoken = ps.nontokenCreaturesCount ? `, ${ps.nontokenCreaturesCount} nontoken` : '';
    parts.push(`${whose} ${ps.creaturesCount}${subtype} creature(s)${power}${nontoken}`);
  }
  const plainArtifacts = (ps.artifactsCount ?? 0) - (ps.equipmentCount ?? 0);
  if (plainArtifacts > 0) parts.push(`${whose} ${plainArtifacts} artifact(s)`);
  if (ps.equipmentCount) parts.push(`${whose} ${ps.equipmentCount} Equipment`);
  if (ps.enchantmentsCount) parts.push(`${whose} ${ps.enchantmentsCount} enchantment(s)`);
  if (ps.handCount) parts.push(`${whose} ${ps.handCount} card(s) in hand`);
  if (ps.graveyardCreatureCount) parts.push(`${whose} ${ps.graveyardCreatureCount} creature card(s) in graveyard`);
  const plainLibrary = (ps.libraryCount ?? 0) - (ps.libraryArtifactCount ?? 0) - (ps.libraryLandCount ?? 0) - (ps.librarySubtypeCount ?? 0);
  if (plainLibrary > 0) parts.push(`${whose} ${plainLibrary} card(s) in library`);
  if (ps.libraryArtifactCount) parts.push(`${whose} ${ps.libraryArtifactCount} artifact(s) in library`);
  if (ps.libraryLandCount) parts.push(`${whose} ${ps.libraryLandCount} land(s) in library`);
  if (ps.librarySubtypeCount) parts.push(`${whose} ${ps.librarySubtypeCount} ${ps.librarySubtype ?? 'subtype'}(s) in library`);
  return parts;
}

/** Full setup summary: baseline (implicit, unstated) + every non-default `you`/`opponents`/`selfCounters` fragment + `scenario.setupNote` if given. Empty string means "the default board" — a genuinely unremarkable scenario, not a missing one. */
function describeSetup(scenario: Scenario): string {
  const parts = [
    ...describePlayerState(scenario.you, 'you:'),
    ...(scenario.opponents ?? []).flatMap((ps, i) => describePlayerState(ps, `opp${i}:`)),
    ...(scenario.selfCounters && Object.keys(scenario.selfCounters).length
      ? [`self already has ${Object.entries(scenario.selfCounters).map(([k, v]) => `${v} ${k}`).join(', ')} counter(s)`]
      : []),
  ];
  if (scenario.setupNote) parts.push(scenario.setupNote);
  return parts.join('; ');
}

/** What actually happens this scenario — always computed from `card`/`scenario`'s own fields (never hand-authored), same branching `lifecycleBefore` (below) already uses for the real trace. */
function describeAction(card: CardDefinition, scenario: Scenario): string {
  const parts: string[] = [];
  if (scenario.trigger) parts.push(`"${scenario.trigger}" trigger fires`);
  else if (scenario.ability) parts.push(`"${scenario.ability}" activated`);
  else if (card.activationCost) parts.push(`activated (${card.activationCost})`);
  else {
    const castFrom = scenario.castFrom ?? 'hand';
    parts.push(castFrom === 'hand' ? 'cast from hand' : `cast from ${castFrom}`);
  }
  if (scenario.mode !== undefined) parts.push(`mode ${scenario.mode} chosen`);
  if (scenario.xPaid !== undefined) parts.push(`X=${scenario.xPaid}`);
  if (scenario.face === 'back') parts.push('back face');
  if (scenario.dealsCombatDamage) parts.push(`deals ${scenario.dealsCombatDamage.amount} combat damage`);
  if (scenario.duplicateLegendaryEnters) parts.push('a duplicate legendary copy enters');
  return parts.join(', ');
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
    state.addCard(real, 'Battlefield', {
      name: `${n}-creature-nontoken-${i}`,
      isTokenCard: false,
      types: ['Creature'],
      subtypes: ps.creatureSubtypes,
      basePower: ps.creaturePower,
      baseToughness: ps.creaturePower,
    });
  }
  const tokenCreatures = Math.max(0, (ps.creaturesCount ?? 0) - nontoken);
  for (let i = 0; i < tokenCreatures; i++) {
    state.addCard(real, 'Battlefield', {
      name: `${n}-creature-token-${i}`,
      isTokenCard: true,
      types: ['Creature'],
      subtypes: ps.creatureSubtypes,
      basePower: ps.creaturePower,
      baseToughness: ps.creaturePower,
    });
  }
  const equipment = ps.equipmentCount ?? 0;
  for (let i = 0; i < equipment; i++) {
    state.addCard(real, 'Battlefield', { name: `${n}-equipment-${i}`, types: ['Artifact'], subtypes: ['Equipment'] });
  }
  const plainArtifacts = Math.max(0, (ps.artifactsCount ?? 0) - equipment);
  for (let i = 0; i < plainArtifacts; i++) {
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
  const libraryArtifacts = ps.libraryArtifactCount ?? 0;
  for (let i = 0; i < libraryArtifacts; i++) {
    state.addCard(real, 'Library', { name: `${n}-library-artifact-${i}`, types: ['Artifact'] });
  }
  const libraryLands = ps.libraryLandCount ?? 0;
  for (let i = 0; i < libraryLands; i++) {
    state.addCard(real, 'Library', { name: `${n}-library-land-${i}`, types: ['Land'] });
  }
  const librarySubtyped = ps.librarySubtypeCount ?? 0;
  for (let i = 0; i < librarySubtyped; i++) {
    state.addCard(real, 'Library', {
      name: `${n}-library-${ps.librarySubtype ?? 'subtype'}-${i}`,
      types: ['Creature'],
      subtypes: ps.librarySubtype ? [ps.librarySubtype] : [],
    });
  }
  const libraryPlain = Math.max(0, (ps.libraryCount ?? 0) - libraryArtifacts - libraryLands - librarySubtyped);
  for (let i = 0; i < libraryPlain; i++) {
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

// Real type line shape: "Supertype(s) Type(s) — Subtype(s)" (205.3a-c) —
// everything after the em-dash IS the real subtype list (Human/Cleric/
// Knight/Equipment/Saga/God/...), space-separated. "Legendary" is a real
// SUPERTYPE (205.4a), not a subtype, but this model has no supertype field
// on RealCard at all — folded into the same `subtypes` array instead, the
// same pragmatic approximation aerith-gainsborough's own "each legendary
// creature you control" already established (`hasSubtype('Legendary')`, not
// a real supertype lookup).
function subtypesFromTypeLine(typeLine: string): string[] {
  const subtypes = typeLine.split('—')[1]?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (/\bLegendary\b/.test(typeLine)) subtypes.push('Legendary');
  return subtypes;
}

// ---------------------------------------------------------------------------
// Logging layer — wraps the REAL Player/Card (state.ts's wrapPlayer/wrapCard,
// genuinely mutating) with the exact log entry shapes the earlier static
// mocks used, so trace.json's format/fields are unchanged; only what
// happens underneath a call changed (real mutation, not just a recorded
// intent).
//
// Per-object predicate reads (hasSubtype/isCreature/getCounters/...) used to
// stay QUIET here — a standing rule from the "isCreature spam" fix, back
// when only an aggregate zone-level read (getCardsIn) was the useful,
// discoverable fact. SYNERGY_DESIGN.md's v2 design reverses that: a script
// can't tell "pump each legendary" from "destroy each legendary" apart from
// an aggregate read alone (both call `hasSubtype('Legendary')` on the same
// candidates) — verify-synergy.mjs needs the PER-OBJECT reads themselves as
// evidence for an AI-declared `wants` fact's type/cmc/power/toughness
// constraint. So every Card query method a lambda can branch on now logs
// too (`loggingCard` below), not just the Player-level aggregates.

/** Wraps a real Card the same way `loggingPlayer` wraps a real Player — every query method a card.ts lambda (a `Computed` field, a `custom` effect's `run`) can branch on logs its argument(s) and result. Applied to `self` and to every Card a logging Player hands back (getCreaturesInPlay/getLandsInPlay/getCardsIn/drawCard(s)), so a lambda's own filtering (`.filter(c => c.hasSubtype(...))`) is captured automatically — card.ts's own declarative effects (`matchesValidType`, `battlefieldPool`, etc.) source their candidate pools the exact same way, so this also captures a plain (non-`custom`) effect's own type-gated pool building for free. */
function loggingCard(state: GameState, real: RealCard, log: LogEntry[]): Card {
  const base = wrapCard(state, real);
  const name = real.name;
  const wrapOne = (c: Card | undefined): Card | undefined => (c ? loggingCard(state, state.cards.get(c.getId() as number)!, log) : undefined);
  const wrapAll = (cs: Card[]): Card[] => cs.map((c) => loggingCard(state, state.cards.get(c.getId() as number)!, log));
  return {
    ...base,
    hasSubtype: (subtype: string) => {
      const result = base.hasSubtype(subtype);
      log.push({ fn: 'read:hasSubtype', target: name, subtype, result });
      return result;
    },
    hasKeyword: (keyword: string) => {
      const result = base.hasKeyword(keyword);
      log.push({ fn: 'read:hasKeyword', target: name, keyword, result });
      return result;
    },
    isCreature: () => {
      const result = base.isCreature();
      log.push({ fn: 'read:isCreature', target: name, result });
      return result;
    },
    isLand: () => {
      const result = base.isLand();
      log.push({ fn: 'read:isLand', target: name, result });
      return result;
    },
    isArtifact: () => {
      const result = base.isArtifact();
      log.push({ fn: 'read:isArtifact', target: name, result });
      return result;
    },
    isEnchantment: () => {
      const result = base.isEnchantment();
      log.push({ fn: 'read:isEnchantment', target: name, result });
      return result;
    },
    isTapped: () => {
      const result = base.isTapped();
      log.push({ fn: 'read:isTapped', target: name, result });
      return result;
    },
    getCMC: () => {
      const result = base.getCMC();
      log.push({ fn: 'read:getCMC', target: name, result });
      return result;
    },
    getCounters: (counterType: string) => {
      const result = base.getCounters(counterType);
      log.push({ fn: 'read:getCounters', target: name, counterType, result });
      return result;
    },
    getNetPower: () => {
      const result = base.getNetPower();
      log.push({ fn: 'read:getNetPower', target: name, result });
      return result;
    },
    getNetToughness: () => {
      const result = base.getNetToughness();
      log.push({ fn: 'read:getNetToughness', target: name, result });
      return result;
    },
    getAttachedTo: () => {
      const result = base.getAttachedTo();
      log.push({ fn: 'read:getAttachedTo', target: name, result: result?.getName() ?? null });
      return wrapOne(result);
    },
    getEquippedBy: () => {
      const result = base.getEquippedBy();
      log.push({ fn: 'read:getEquippedBy', target: name, result: result.map((c) => c.getName()) });
      return wrapAll(result);
    },
  } as unknown as Card;
}

function loggingPlayer(state: GameState, real: RealPlayer, log: LogEntry[]): Player {
  const base = wrapPlayer(state, real);
  const name = real.name;
  const toLogging = (c: Card): Card => loggingCard(state, state.cards.get(c.getId() as number)!, log);
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
      return result.map(toLogging);
    },
    drawCards: (n: number) => {
      const result = base.drawCards(n);
      log.push({ fn: 'drawCards', player: name, n });
      return result.map(toLogging);
    },
    getCreaturesInPlay: () => {
      const result = base.getCreaturesInPlay();
      log.push({ fn: 'read:getCreaturesInPlay', player: name, count: result.length });
      return result.map(toLogging);
    },
    getLandsInPlay: () => {
      const result = base.getLandsInPlay();
      log.push({ fn: 'read:getLandsInPlay', player: name, count: result.length });
      return result.map(toLogging);
    },
    getCardsIn: (zone: ZoneType) => {
      const result = base.getCardsIn(zone);
      const creatureCount = result.filter((c) => c.isCreature()).length;
      log.push({ fn: 'read:getCardsIn', player: name, zone, count: result.length, creatureCount });
      return result.map(toLogging);
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
      return made.map((c) => loggingCard(state, c, log));
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
      // Type-checked via `loggingCard` (not raw `effectiveTypes(c)`) so a
      // land/creature/artifact-typed search logs real `read:*` evidence per
      // candidate — same fix `sacrifice`'s own `matches` already got, for
      // the same reason: this used to bypass the logged Card interface
      // entirely, leaving declarative `move`-effect wants (library searches
      // like `reach-the-horizon`'s own) with zero trace evidence for
      // verify-synergy.mjs to check against.
      const matches = (c: RealCard) => {
        if (!validType || validType === 'any') return true;
        const wrapped = loggingCard(state, c, log);
        switch (validType) {
          case 'creature':
            return wrapped.isCreature();
          case 'artifact':
            return wrapped.isArtifact();
          case 'land':
            return wrapped.isLand();
          default:
            return true;
        }
      };
      const chosen = fromArr.filter(matches).slice(0, qty);
      for (const c of chosen) state.move(c, to);
      log.push({ fn: 'move', player: player.getName(), from, to, qty, validType });
      return chosen.map((c) => loggingCard(state, c, log));
    },
    sacrifice: (player, qty, validType, notSelf, tokenFilter) => {
      const real = playerOf(player);
      // Type-checked via `loggingCard` (not raw `effectiveTypes(c)`) so a
      // fodder-type filter (creature/artifact/etc.) logs real `read:*`
      // evidence per candidate — same reasoning `move`'s own targeted
      // branch already gets for free via card.ts's `matchesValidType`
      // (which DOES call through the logged Card interface); this one
      // used to bypass that layer entirely, leaving Namazu Trader/Phantom
      // Train-style "sacrifice a creature or artifact" wants with no
      // trace evidence at all for verify-synergy.mjs to check against.
      const matches = (c: RealCard) => {
        if (notSelf && c.id === selfId) return false;
        if (tokenFilter === 'token' && !c.isTokenCard) return false;
        if (tokenFilter === 'nontoken' && c.isTokenCard) return false;
        if (!validType || validType === 'any') return true;
        const wrapped = loggingCard(state, c, log);
        switch (validType) {
          case 'creature':
            return wrapped.isCreature();
          case 'artifact':
            return wrapped.isArtifact();
          case 'enchantment':
            return wrapped.isEnchantment();
          case 'creature-or-artifact':
            return wrapped.isCreature() || wrapped.isArtifact();
          default:
            return true;
        }
      };
      const chosen = state.sacrifice(real, qty, matches);
      log.push({ fn: 'sacrifice', player: player.getName(), qty, validType, notSelf: !!notSelf, tokenFilter: tokenFilter ?? null });
      return chosen.map((c) => loggingCard(state, c, log));
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
      const destroyed = state.destroy(cardOf(target));
      if (!destroyed) log.push({ fn: 'destroyPrevented', target: target.getName(), cause: 'Indestructible' });
      else log.push({ fn: 'destroy', target: target.getName() });
    },
    dealDamage: (source, target, amount) => {
      const sourceReal = cardOf(source);
      const lifeGained = 'getLife' in target ? state.dealDamage(playerOf(target as Player), amount, sourceReal) : state.dealDamage(cardOf(target as Card), amount, sourceReal);
      log.push({ fn: 'dealDamage', source: source.getName(), target: target.getName(), amount });
      if (lifeGained > 0) log.push({ fn: 'gainLife', player: state.players.get(sourceReal.controllerId)!.name, amount: lifeGained, cause: 'Lifelink' });
    },
    tap: (target) => {
      state.tap(cardOf(target));
      log.push({ fn: 'tap', target: target.getName() });
    },
    untap: (target) => {
      state.untap(cardOf(target));
      log.push({ fn: 'untap', target: target.getName() });
    },
    grantKeyword: (target, keyword) => {
      state.grantKeyword(cardOf(target), keyword);
      log.push({ fn: 'grantKeyword', target: target.getName(), keyword });
    },
    copyPermanent: (source, controller) => {
      const copy = state.copyPermanent(cardOf(source), playerOf(controller));
      log.push({ fn: 'copyPermanent', source: source.getName(), controller: controller.getName() });
      return loggingCard(state, copy, log);
    },
    dig: (player, qty, take, validType) => {
      const matches = (c: RealCard) => !validType || validType === 'any' || (validType === 'artifact' && effectiveTypes(c).includes('Artifact'));
      const found = state.dig(playerOf(player), qty, take, matches);
      log.push({ fn: 'dig', player: player.getName(), qty, take, validType, found: found.length });
      return found.map((c) => loggingCard(state, c, log));
    },
    delayUntil: (phase, run) => {
      state.scheduleDelayedTrigger(phase, run);
      log.push({ fn: 'delayUntil', phase });
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
  if (scenario.ability) {
    const ability = card.abilities?.find((a) => a.name === scenario.ability);
    return [{ fn: 'activate', card: card.name, instanceId, cost: ability?.cost ?? '', ability: scenario.ability }];
  }
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
  if (scenario.trigger || scenario.ability || card.activationCost) return [];
  if (!isInstantOrSorcery(card.typeLine)) {
    state.move(selfReal, 'Battlefield');
    return [{ fn: 'enters', card: card.name, instanceId, zone: 'Battlefield' }];
  }
  const castFrom = scenario.castFrom ?? 'hand';
  const altCost = card.alternateCosts?.find((c) => c.from === castFrom);
  const to = altCost?.thenExile ? 'Exile' : 'Graveyard';
  state.move(selfReal, to);
  const cardType = /\bSorcery\b/.test(card.typeLine) ? 'Sorcery' : 'Instant';
  return [{ fn: 'move', card: card.name, instanceId, from: 'stack', to, cardType }];
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
  const selfZone: ZoneType = scenario.trigger || scenario.ability || effectiveCard.activationCost ? 'Battlefield' : 'Stack';
  const selfReal = state.addCard(you, selfZone, {
    name: effectiveCard.name,
    isTokenCard: false,
    types: typesFromTypeLine(effectiveCard.typeLine),
    subtypes: subtypesFromTypeLine(effectiveCard.typeLine),
    keywords: effectiveCard.keywords,
    ptFormula: effectiveCard.ptFormula,
    basePower: effectiveCard.pt?.[0],
    baseToughness: effectiveCard.pt?.[1],
    cmc: effectiveCard.cmc,
  });
  if (scenario.selfCounters) selfReal.counters = { ...scenario.selfCounters };
  const youLogging = loggingPlayer(state, you, log);
  const opponentsLogging = opponents.map((o) => loggingPlayer(state, o, log));
  const self = loggingCard(state, selfReal, log);
  const ctx: EffectContext = { self, you: youLogging, opponents: opponentsLogging, castFrom: scenario.castFrom ?? 'hand', mode: scenario.mode, triggerInput: scenario.triggerInput, xPaid: scenario.xPaid };
  const actions = loggingActions(state, log, selfReal.id);
  resolveCard(effectiveCard, ctx, actions, scenario.trigger, scenario.ability);
  log.push(...lifecycleAfter(effectiveCard, scenario, instanceId, state, selfReal));
  // Real phase advancement, only when a scenario actually needs to prove a
  // delayed trigger's timing (see `Scenario.advanceToPhase`'s own doc
  // comment) — starts from Main1 (this harness's own implicit baseline
  // phase), not turn.ts's own `startGame()` (Untap/turn 1), so advancing
  // doesn't spuriously fire Untap/Draw's real automatic actions for a
  // scenario that was never "at the start of a turn" to begin with.
  if (scenario.advanceToPhase) {
    const players = [you, ...opponents];
    let turn = { turnNumber: 1, activePlayerIndex: 0, phaseIndex: PHASES.indexOf('Main1') };
    while (currentPhase(turn) !== scenario.advanceToPhase) {
      turn = advancePhase(state, turn, players);
      log.push({ fn: 'phase', phase: currentPhase(turn) });
    }
  }
  // Combat damage happens while a creature is ALREADY on the battlefield —
  // long after casting/entering, which is exactly what `lifecycleAfter`
  // above just resolved — so this synthetic probe (see `Scenario
  // .dealsCombatDamage`'s own doc comment: not a card ability, a real MTG
  // event happening independent of anything a CardDefinition authors) has
  // to run AFTER it, not before, or a creature scenario would be "dealing
  // damage" while still on the stack.
  if (scenario.dealsCombatDamage) {
    const opponent = opponents[0] ?? state.addPlayer('opp0');
    actions.dealDamage(self, wrapPlayer(state, opponent), scenario.dealsCombatDamage.amount);
  }
  // Same "real event, not a card ability" shape as `dealsCombatDamage` above
  // — a second copy of self entering forces the real 704.5j check.
  if (scenario.duplicateLegendaryEnters) {
    state.addCard(you, 'Battlefield', {
      name: effectiveCard.name,
      isTokenCard: false,
      types: typesFromTypeLine(effectiveCard.typeLine),
      subtypes: subtypesFromTypeLine(effectiveCard.typeLine),
    });
    const removed = state.checkLegendRule(you);
    for (const card of removed) log.push({ fn: 'legendRule', card: card.name, player: you.name });
  }
  // A CDA (`ptFormula`) has nothing else that would ever surface its result
  // in the trace — no card here has an EFFECT that reads its own P/T, only
  // Forge's real continuous layer-7a calculation does. Log the real,
  // live-recalculated value once self is actually on the battlefield (a
  // pre-cast/on-the-stack P/T isn't a real fact yet), so a card's own
  // `keywordScenarios()` probe is genuinely observable, not silent.
  if (effectiveCard.ptFormula && selfReal.zone === 'Battlefield') {
    const [power, toughness] = effectivePT(state, selfReal);
    log.push({ fn: 'read:getNetPower', card: effectiveCard.name, power, toughness });
  }
  return {
    scenario: { setup: describeSetup(scenario), action: describeAction(effectiveCard, scenario), result: scenario.result ?? scenario.label ?? '(not yet described)' },
    log,
  };
}

export function runScenarios(card: CardDefinition, scenarios: Scenario[]): TraceResult[] {
  return scenarios.map((s) => runScenario(card, s));
}
