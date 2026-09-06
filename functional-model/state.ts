// Real, mutable game state — ported from actual Card-Forge behavior
// (../mtg-forge, a local checkout, same citation discipline interfaces.ts
// already uses) rather than the earlier static, non-mutating mocks
// harness.ts used to build directly. This is what makes multiple
// resolutions chainable against ONE evolving board: `GameState` holds real
// zone arrays that `move()` genuinely splices cards out of and into, so a
// second resolution run against the same `GameState` sees the real
// consequences of the first.
//
// Deliberately narrow — real zone/counter/control mutation for the action
// vocabulary card.ts/harness.ts already use, NOT a rules engine. Explicitly
// NOT built here (see the conversation this came out of — the user
// rejected a full engine, Java isn't even installed in this sandbox):
//   - state-based actions (a 0-toughness creature doesn't automatically die
//     here — nothing in the current 12 cards' scenarios needs it)
//   - target/cost legality checking beyond what card.ts's own effect
//     handlers already do
// Turn/phase structure (turn.ts), a real stack (stack.ts), priority
// (priority.ts), and the layers system (613, layers.ts) are now built on
// TOP of this file — see those modules' own headers. `pump`/`animate`
// below route through `layers.ts`'s `LayerSet` (real, if narrow,
// continuous-effect recalculation) instead of the direct, permanent deltas
// this file used before that existed.

import type { Card, Player, TokenInfo, ZoneType } from './interfaces';
import { LayerSet, nextLayerTimestamp } from './layers';
// Type-only — turn.ts itself imports GameState/RealPlayer from this file
// (also type-only), so this is a type-level-only cycle: TS erases both sides
// before anything runs, no runtime circular dependency.
import type { Phase } from './turn';
// Type-only, same erased-cycle reasoning as the `turn.ts` import above —
// `mana.ts` itself imports `GameState`/`RealCard`/`RealPlayer` from this
// file (also type-only).
import type { ManaColor } from './mana';

let nextObjectId = 1;

/**
 * A real card/token object living in the state — mutable fields a real
 * Card.java instance also carries (`currentState`, counters, `controller`),
 * not a snapshot recomputed per read. `zone` is this object's own
 * bookkeeping of which array it currently lives in, kept in sync by
 * `GameState.move()`.
 */
export interface RealCard {
  id: number;
  name: string;
  isTokenCard: boolean;
  /** Printed (base) types — layer 4 effects (`animate`) apply on top of this via `layers`, never mutate it directly. Use `effectiveTypes()` below to read what the card CURRENTLY is. */
  types: string[];
  subtypes: string[];
  basePower: number;
  baseToughness: number;
  counters: Record<string, number>;
  /** Real (if narrow) layers-system (613) continuous effects — see layers.ts. Recalculated on read, not baked into a stored delta. */
  layers: LayerSet;
  tapped: boolean;
  ownerId: number;
  controllerId: number;
  zone: ZoneType;
  attachedToId?: number;
  /** Real Forge `K:` lines this card carries — a controlled, executable vocabulary (see card.ts's own `Keyword` type), distinct from `staticAbilities`' freeform text. Copied from the resolving `CardDefinition` at scenario setup (harness.ts); only `self` ever has a non-empty value today (nothing seeds a keyword onto a generated filler card). */
  keywords: string[];
  /**
   * A real layer-7a characteristic-defining P/T ability — see card.ts's own
   * `CardDefinition.ptFormula` doc comment for the two real Forge shapes
   * built so far (ADD-per-Equipment, SET-to-creature-count). Deliberately
   * NOT a timestamped `layers.ts` delta: a CDA is recalculated live from
   * CURRENT board state every time P/T is read (713.1), not fixed at the
   * moment a continuous effect was created.
   */
  ptFormula?: { kind: 'addPerEquipmentControlled'; power: number; toughness: number } | { kind: 'setToCreaturesControlled' };
  /** Real mana value (Card.java's own `getCMC()`, ~line 7227) — omit when nothing needs it (most cards, and every generated filler object). Dark Confidant's own upkeep life-loss is the reference case (needs a REAL number off the revealed card, not a `triggerInput`-supplied stand-in). */
  cmc?: number;
  /** Real 120.3 "damage marked on it" — `Card.java`'s own `damage` field (~line 219/`addDamage`). Persists across multiple `dealDamage` calls (a creature blocked by two attackers accumulates both) until cleared — 514.2's own cleanup-step clearing is a real, separate, not-yet-implemented gap (ENGINE_GAPS.md's turn-structure-completeness item), so this only ever goes up within a single test/pilot session today. Consumed by `isLethallyDamaged`/`sba.ts`'s `checkStateBasedActions` (704.5g); never read by `state.ts` itself for anything else. */
  damageMarked?: number;
  /** Whether ANY of this card's marked damage came from a source with Deathtouch (702.2b/704.5h) — any nonzero amount from such a source is lethal regardless of accumulated total, so this is tracked as a flag rather than trying to recover "was source X deathtouch" from the summed `damageMarked` number alone. Same clearing caveat as `damageMarked`. */
  deathtouchDamaged?: boolean;
  /**
   * A real, structural "{T}: Add {X}." mana ability (narrow slice of
   * ENGINE_GAPS.md gap #5 — a single, unrestricted, fixed color; see
   * `mana.ts`'s own `manaAbilityColorFromStaticText`), derived from the
   * resolving `CardDefinition.staticAbilities` text at the moment this
   * permanent enters the battlefield (`resolveTop`, `engine.ts`) — NOT
   * live-derived from a stored `CardDefinition` reference (`RealCard` has
   * none), so this is the one place that fact is captured. A card seeded
   * directly onto the battlefield (never cast through the engine) has no
   * value here, same documented convention `enteredThisTurn`/
   * `resolvedPermanents` already established for ETB-derived bookkeeping.
   */
  manaAbility?: ManaColor;
}

/** Layer 4 (TYPE) applied — the card's CURRENT type list, not just its printed one. Use this instead of raw `card.types` anywhere "is this a creature/artifact/etc. right now" matters (an `animate`d permanent really does count). */
export function effectiveTypes(card: RealCard): string[] {
  return card.layers.computeTypes(card.types);
}

/**
 * Layer 7's own P/T calculation: layer 7a (a real, live-recalculated CDA —
 * `ptFormula`, see `RealCard`'s own doc comment) applied FIRST, THEN counters
 * (simplified to Forge's own layer 7d, +1/+1-style only) and timestamp-
 * ordered continuous effects (`layers.ts`'s own 7b/7c) on top — real 613.3's
 * own sublayer order, CDA before counters/other continuous effects.
 * `state` is required (not optional) because a CDA needs to count OTHER
 * cards on the controller's own battlefield — genuinely live, not a value
 * this card object alone can answer.
 */
export function effectivePT(state: GameState, card: RealCard): [number, number] {
  let base = card.basePower;
  let baseT = card.baseToughness;
  const controller = state.players.get(card.controllerId);
  if (card.ptFormula?.kind === 'addPerEquipmentControlled') {
    const equipmentCount = controller ? controller.battlefield.filter((c) => c.subtypes.includes('Equipment')).length : 0;
    base += card.ptFormula.power * equipmentCount;
    baseT += card.ptFormula.toughness * equipmentCount;
  } else if (card.ptFormula?.kind === 'setToCreaturesControlled') {
    // Real `SetPower$ X` ONLY (Snow Villiers' own `PT:*/3`) — toughness
    // stays whatever the card's own real printed base is (`pt`/`baseToughness`),
    // not also overridden. A card whose real script also carries a
    // `SetToughness$` would need its own, differently-named variant here —
    // not assumed for free just because this one exists.
    const creatureCount = controller ? controller.battlefield.filter((c) => effectiveTypes(c).includes('Creature')).length : 0;
    base = creatureCount;
  }
  base += card.counters['+1/+1'] ?? 0;
  baseT += card.counters['+1/+1'] ?? 0;
  return card.layers.computePT(base, baseT);
}

/**
 * Real 704.5g (marked damage >= toughness) or 704.5h (any nonzero damage
 * from a Deathtouch source, 702.2b) — the two damage-based state-based-
 * action tests (`GameAction.java`'s own state-based-effects pass, rule
 * citations directly in that method's comments, ~lines 1455-1760).
 * Deliberately does NOT cover 704.5f (toughness <= 0, which bypasses
 * Indestructible entirely — a different rule, checked separately by
 * `sba.ts`'s `checkStateBasedActions`, not folded in here since 704.5f
 * isn't itself a "damage" test). The single shared source both `sba.ts`
 * (which acts on it) and `engine.ts`'s `resolveCombatDamage` (which only
 * REPORTS it — see that function's own doc comment) read, so the two never
 * compute "was this lethal" differently.
 */
export function isLethallyDamaged(state: GameState, card: RealCard): boolean {
  const damage = card.damageMarked ?? 0;
  if (damage <= 0) return false;
  if (card.deathtouchDamaged) return true;
  const [, toughness] = effectivePT(state, card);
  return damage >= toughness;
}

export interface RealPlayer {
  id: number;
  name: string;
  life: number;
  hand: RealCard[];
  library: RealCard[];
  graveyard: RealCard[];
  battlefield: RealCard[];
  exile: RealCard[];
}

function zoneArray(player: RealPlayer, zone: ZoneType): RealCard[] | undefined {
  switch (zone) {
    case 'Hand':
      return player.hand;
    case 'Library':
      return player.library;
    case 'Graveyard':
      return player.graveyard;
    case 'Battlefield':
      return player.battlefield;
    case 'Exile':
      return player.exile;
    default:
      return undefined; // 'Stack'/'Command' — not real tracked zones here, see header
  }
}

/** A real MTG delayed trigger (703.4) — "return those cards to the battlefield ... at the beginning of the next end step" (Elrond, Moon-Reader's own activation, e.g.): the effect is fixed at resolution time, but doesn't actually RUN until the game later reaches `phase`. `turn.ts`'s `advancePhase` drains due entries as it enters each new phase. */
export interface DelayedTrigger {
  phase: Phase;
  run: () => void;
}

export class GameState {
  players = new Map<number, RealPlayer>();
  cards = new Map<number, RealCard>();
  delayedTriggers: DelayedTrigger[] = [];

  /** Schedules `run` to fire the next time the game enters `phase` (see `DelayedTrigger` above) — real 603.7 duration only, not a repeating/every-turn trigger: fires once, then this entry is gone (drained by `turn.ts`'s `advancePhase`). */
  scheduleDelayedTrigger(phase: Phase, run: () => void): void {
    this.delayedTriggers.push({ phase, run });
  }

  addPlayer(name: string): RealPlayer {
    const player: RealPlayer = { id: nextObjectId++, name, life: 20, hand: [], library: [], graveyard: [], battlefield: [], exile: [] };
    this.players.set(player.id, player);
    return player;
  }

  /**
   * Adds a real card object directly into `zone` (scenario setup — "3
   * creature cards in the graveyard" becomes 3 real RealCard objects pushed
   * into that player's real `graveyard` array), not a mutation of an
   * existing object.
   */
  addCard(owner: RealPlayer, zone: ZoneType, opts: Partial<Omit<RealCard, 'id' | 'ownerId' | 'controllerId' | 'zone'>> & { name: string }): RealCard {
    const card: RealCard = {
      id: nextObjectId++,
      name: opts.name,
      isTokenCard: opts.isTokenCard ?? false,
      types: opts.types ?? ['Creature'],
      subtypes: opts.subtypes ?? [],
      basePower: opts.basePower ?? 1,
      baseToughness: opts.baseToughness ?? 1,
      counters: {},
      layers: new LayerSet(),
      tapped: false,
      ownerId: owner.id,
      controllerId: owner.id,
      zone,
      keywords: opts.keywords ?? [],
      ptFormula: opts.ptFormula,
      cmc: opts.cmc,
      manaAbility: opts.manaAbility,
    };
    this.cards.set(card.id, card);
    const arr = zoneArray(owner, zone);
    arr?.push(card);
    return card;
  }

  /**
   * Real zone change — mirrors `Zone.java`'s own `add`/`remove`
   * (forge-game/.../zone/Zone.java ~line 88/162) via
   * `GameAction.changeZone` (forge-game/.../GameAction.java ~line 89):
   * remove the object from its CURRENT zone's real collection, push it onto
   * the destination's, update its own `.zone` field. Never a copy — the
   * same object, relocated.
   *
   * A TOKEN that leaves the battlefield ceases to exist entirely rather
   * than becoming graveyard stock (synergy-model/SCHEMA.md §3
   * Derivations: "a token instead just ceases to exist") — real Forge
   * behavior, not a simplification: a token has no other-zone printed
   * existence to move to. `to` is ignored for a battlefield-leaving token;
   * it's deleted from `this.cards` and every zone array instead.
   */
  move(card: RealCard, to: ZoneType): void {
    // Real 122.1d-shaped replacement, `FINALITY` counter (Card.java
    // ~line 7067-7076: `Event$ Moved | Origin$ Battlefield |
    // Destination$ Graveyard | ... "If CARDNAME would die, exile it
    // instead"` — a static per-object replacement keyed off the
    // counter's presence, same as `STUN`'s own untap-replacement
    // below). Checked the real pool: only Relentless X-ATM092 puts one
    // on itself (its own graveyard-recursion ability), preventing it
    // from ever dying a second time instead of exiling. No counter
    // removal needed on the redirect — moving to Exile already wipes
    // `card.counters` via 400.7 below, same as every other zone change.
    if (card.zone === 'Battlefield' && to === 'Graveyard' && (card.counters['finality'] ?? 0) > 0) {
      to = 'Exile';
    }
    if (card.zone === 'Battlefield' && to !== 'Battlefield' && card.isTokenCard) {
      const owner = this.players.get(card.ownerId);
      const arr = owner && zoneArray(owner, 'Battlefield');
      if (arr) {
        const i = arr.indexOf(card);
        if (i !== -1) arr.splice(i, 1);
      }
      this.cards.delete(card.id);
      return;
    }
    const owner = this.players.get(card.ownerId);
    if (owner) {
      const fromArr = zoneArray(owner, card.zone);
      if (fromArr) {
        const i = fromArr.indexOf(card);
        if (i !== -1) fromArr.splice(i, 1);
      }
      const toArr = zoneArray(owner, to);
      toArr?.push(card);
    }
    // Real rule 400.7: a permanent becomes a new object when it changes
    // zones — counters, P/T modifications, and control changes don't
    // survive. Reset alongside the zone update, not left stale.
    if (card.zone !== to) {
      card.counters = {};
      card.layers = new LayerSet();
      card.controllerId = card.ownerId;
      card.attachedToId = undefined;
      card.tapped = false;
    }
    card.zone = to;
  }

  /**
   * Real token creation — `CardFactory`'s token-creation path
   * (forge-game/.../card/CardFactory.java; `TokenEffect`,
   * forge-game/.../ability/effects/TokenEffect.java, is the real dispatch
   * target for `AB$/DB$ Token`) makes a genuinely NEW `Card` object per
   * token, not a shared reference — `qty` tokens here are `qty` distinct
   * `RealCard`s, each with their own id.
   */
  createToken(controller: RealPlayer, token: TokenInfo, qty: number, opts?: { tapped?: boolean }): RealCard[] {
    const made: RealCard[] = [];
    // `token.types` is the token's FULL real type-line word list (e.g.
    // `['Creature', 'Wizard']` — see cards/circle-of-power/definition.ts's own
    // Wizard token), the same convention `TokenInfo`'s own doc comment
    // describes — not core-types-only. A prior bug hardcoded `subtypes: []`
    // regardless, so a just-made token never matched `hasSubtype()` (Circle
    // of Power's own "Wizards you control" pump missed its own token). Real
    // subtypes are everything in `token.types` that isn't one of the four
    // core types this model tracks (see harness.ts's own `typesFromTypeLine`
    // for the same core-type list).
    const subtypes = token.types.filter((t) => !['Creature', 'Artifact', 'Enchantment', 'Land'].includes(t));
    for (let i = 0; i < qty; i++) {
      made.push(
        this.addCard(controller, 'Battlefield', {
          name: token.name,
          isTokenCard: true,
          types: token.types,
          subtypes,
          basePower: token.basePower,
          baseToughness: token.baseToughness,
          keywords: token.keywords ?? [],
        })
      );
    }
    return made;
  }

  /** `Player.discard` (forge-game/.../player/Player.java ~line 1416) — real hand->graveyard move for `qty` cards (this prototype discards from the front of hand; real Forge lets the player/AI choose which). */
  discard(player: RealPlayer, qty: number): RealCard[] {
    const discarded: RealCard[] = [];
    for (let i = 0; i < qty && player.hand.length > 0; i++) {
      const card = player.hand[0]!;
      this.move(card, 'Graveyard');
      discarded.push(card);
    }
    return discarded;
  }

  /** `GameAction.sacrifice` (forge-game/.../GameAction.java ~line 2097) — real removal from the battlefield into the graveyard (or nonexistence, for a token — `move()` already encodes that rule). Picks the first `qty` real matches; real Forge lets the controller choose among legal ones. */
  sacrifice(player: RealPlayer, qty: number, matches: (c: RealCard) => boolean): RealCard[] {
    const pool = player.battlefield.filter(matches);
    const chosen = pool.slice(0, qty);
    for (const card of chosen) this.move(card, 'Graveyard');
    return chosen;
  }

  /** `Player.drawCard`/`drawCards` (forge-game/.../player/Player.java ~line 1113/1117) — real top-of-library -> hand move, in library order. */
  drawCards(player: RealPlayer, n: number): RealCard[] {
    const drawn: RealCard[] = [];
    for (let i = 0; i < n && player.library.length > 0; i++) {
      const card = player.library[0]!;
      this.move(card, 'Hand');
      drawn.push(card);
    }
    return drawn;
  }

  /** `Card.addCounterInternal` (forge-game/.../card/Card.java ~line 1745) — real, persistent per-card counter count. */
  putCounter(card: RealCard, counterType: string, amount: number): void {
    card.counters[counterType] = (card.counters[counterType] ?? 0) + amount;
  }

  /** Layer 7 (P/T) — real Forge layered pump machinery (see layers.ts's own header for the real `StaticAbilityLayer` citation). Each call adds ONE timestamped continuous effect rather than mutating a stored delta — two pumps on the same card both persist and apply in creation order (`LayerSet.computePT`), not last-write-wins. */
  pump(card: RealCard, powerDelta: number, toughnessDelta: number): void {
    card.layers.add({ layer: 7, timestamp: nextLayerTimestamp(), apply: (p, t) => [p + powerDelta, t + toughnessDelta] });
  }

  /** `Card.setController`/a control-change effect — real reassignment of `controllerId`, distinct from `ownerId` (Forge's own owner/controller split, e.g. `Card.java`'s `getOwner()`/`getController()` at ~3696/~3710). */
  gainControl(newController: RealPlayer, card: RealCard): void {
    card.controllerId = newController.id;
  }

  /** `Card.attachToEntity` (forge-game/.../card/Card.java ~line 3930) — real, persistent attachment link. */
  equip(equipment: RealCard, target: RealCard): void {
    equipment.attachedToId = target.id;
  }

  /** Layer 4 (TYPE) — Phantom Train's own "becomes a Spirit artifact creature in addition to its other types." A timestamped continuous effect appending to the card's CURRENT type list (`effectiveTypes()`), not a direct mutation of the printed `types` array — a real card's own printed types are never altered by an animate effect, only what layer 4 computes on top of them. */
  animate(card: RealCard, types: string[]): void {
    card.layers.add({ layer: 4, timestamp: nextLayerTimestamp(), apply: (current) => [...new Set([...current, ...types])] });
  }

  /**
   * Real 704.5j (`handleLegendRule`, `GameAction.java` ~line 2006-2065): if a
   * player controls 2+ Legendary permanents sharing a name, they keep one
   * and the rest go to the graveyard — a real state-based action, NOT a
   * `sacrifice` (701.16, a cost/effect a player CHOOSES to pay) even though
   * the end zone change looks the same, so this gets its own return/log
   * shape rather than reusing `sacrifice`. Real Forge lets the player CHOOSE
   * which one to keep; this model has no real player-choice engine anywhere
   * (`chooseTarget` always takes the first pool candidate), so it keeps
   * whichever came first and returns the rest — same simplification, same
   * place it's always made. "Legendary" is tracked as a subtype here (see
   * `harness.ts`'s own note on this), a pragmatic approximation of Forge's
   * real supertype, not a literal supertype lookup.
   */
  checkLegendRule(player: RealPlayer): RealCard[] {
    const byName = new Map<string, RealCard[]>();
    for (const card of player.battlefield) {
      if (!card.subtypes.includes('Legendary')) continue;
      if (!byName.has(card.name)) byName.set(card.name, []);
      byName.get(card.name)!.push(card);
    }
    const removed: RealCard[] = [];
    for (const group of byName.values()) {
      if (group.length < 2) continue;
      for (const card of group.slice(1)) {
        this.move(card, 'Graveyard');
        removed.push(card);
      }
    }
    return removed;
  }

  /**
   * Real 514.2's damage-clearing half ONLY — "all damage marked on
   * permanents is removed" (`GameAction.java`'s own cleanup-step handling,
   * near the state-based-effects pass this file already cites). Game-wide
   * (every real card, not just the active player's), matching the real
   * rule's own scope. Deliberately does NOT also end "until end of turn"
   * continuous effects — `layers.ts`'s own duration-not-tracked
   * simplification already covers that half, unchanged by this method.
   */
  clearAllDamage(): void {
    for (const card of this.cards.values()) {
      card.damageMarked = 0;
      card.deathtouchDamaged = false;
    }
  }

  /** `Card.tap(...)` (forge-game/.../card/Card.java ~line 4662) — real, persistent tapped state. */
  tap(card: RealCard): void {
    card.tapped = true;
  }

  /**
   * `Card.untap()` (forge-game/.../card/Card.java ~line 4711) — real,
   * persistent tapped state, now with the real `STUN` counter
   * replacement (CR 122.1d; `Card.java` ~line 7056-7066: "If this
   * permanent would become untapped, instead remove a stun counter
   * from it" — a static per-object replacement on the `Untap` event,
   * NOT a special case inside `untap()` itself in real Forge, but this
   * engine has no general 614/616 replacement dispatcher — see gap #8
   * in ENGINE_GAPS.md — so this single real chokepoint is where it's
   * modeled, same "narrow hook at the one real mutation site" shape as
   * `dealDamage`'s own Deathtouch/lethal-damage tracking). Checked the
   * real pool: Tonberry and Ice Flan both write lowercase `'stun'`;
   * Omega, Heartless Evolution writes uppercase `'Stun'` — an
   * inconsistency in the cards themselves (`cards/*` out of scope to
   * edit), so both keys are checked here rather than picking one and
   * silently breaking the other two real cards.
   */
  untap(card: RealCard): void {
    const stunKey = (card.counters['stun'] ?? 0) > 0 ? 'stun' : (card.counters['Stun'] ?? 0) > 0 ? 'Stun' : undefined;
    if (stunKey) {
      this.putCounter(card, stunKey, -1);
      return;
    }
    card.tapped = false;
  }

  /**
   * `CardFactory.copyCard(...)`-style copy (forge-game/.../card/CardFactory.java)
   * — makes a NEW object with `source`'s own name/types/subtypes/base P&T/
   * keywords, under `controller`'s control. Always a TOKEN here (Sin,
   * Spira's Punishment's own "create a token copy," e.g.) — this model has
   * no continuous "this permanent becomes a copy of that" layer-1 tracking
   * (real Forge's `CopyEffect`/`CopyPermanentEffect` split), same lighter-
   * continuous-effect simplification `animate`'s own doc comment already
   * accepts. Real counters/attachments/damage on `source` are NOT copied
   * (601.2h's own "copiable values" only — printed characteristics), same
   * as a real copy effect.
   */
  copyPermanent(source: RealCard, controller: RealPlayer): RealCard {
    return this.addCard(controller, 'Battlefield', {
      name: source.name,
      isTokenCard: true,
      types: [...source.types],
      subtypes: [...source.subtypes],
      basePower: source.basePower,
      baseToughness: source.baseToughness,
      keywords: [...source.keywords],
      ptFormula: source.ptFormula,
    });
  }

  /**
   * `Card.addChangedCardKeywords(...)` (forge-game/.../card/Card.java ~line
   * 5017) — grants a keyword. Real Forge tracks this as a duration-scoped,
   * timestamped layer-6 entry (reverted at the real effect's end — "until
   * end of turn," e.g.); this model has no phase/turn-boundary reset step
   * anywhere (see this file's own header), so the grant is a direct,
   * PERMANENT push onto the card's own `keywords` array instead — same
   * documentary-approximation category `move`/`destroy`'s own `optional`
   * field already carries for a different nuance (player choice, there;
   * duration, here). Still a REAL mutation, not just a logged intent: a
   * later `state.destroy`/`state.dealDamage` call genuinely sees the
   * granted Indestructible/Lifelink within the same scenario.
   */
  grantKeyword(card: RealCard, keyword: string): void {
    if (!card.keywords.includes(keyword)) card.keywords.push(keyword);
  }

  /**
   * `DestroyEffect` (forge-game/.../ability/effects/DestroyEffect.java) —
   * real zone change, battlefield->graveyard, via the SAME `move()` a
   * sacrifice/dies uses (a token still ceases to exist rather than reaching
   * the graveyard, per `move`'s own rule). Destroy is its own real action
   * (distinct from sacrifice, rule 701.16) only in WHICH ability caused the
   * move, not in the zone-change mechanics themselves — no separate state to
   * track here beyond that.
   *
   * Real rule 702.12b: an Indestructible permanent is never destroyed by a
   * destroy effect — a REPLACEMENT, not a targeting restriction (the effect
   * still resolves, the destruction itself just doesn't happen). Returns
   * whether it actually was, so callers (harness.ts) can log the prevention
   * as a real, visible fact rather than silently no-op-ing.
   */
  destroy(card: RealCard): boolean {
    if (card.keywords.includes('Indestructible')) return false;
    this.move(card, 'Graveyard');
    return true;
  }

  /**
   * `DigEffect` (forge-game/.../ability/effects/DigEffect.java) — real
   * library manipulation: splices the top `qty` cards off `player.library`,
   * moves up to `take` of the ones matching `matches` to hand, pushes
   * whatever's left back onto the BOTTOM of the library (real order
   * fidelity for "in a random order" isn't tracked — generic library-filler
   * objects are interchangeable here, see this file's own header).
   */
  dig(player: RealPlayer, qty: number, take: number, matches: (c: RealCard) => boolean): RealCard[] {
    const looked = player.library.splice(0, qty);
    const taken: RealCard[] = [];
    const rest: RealCard[] = [];
    for (const card of looked) {
      if (taken.length < take && matches(card)) taken.push(card);
      else rest.push(card);
    }
    for (const card of taken) this.move(card, 'Hand');
    player.library.push(...rest);
    return taken;
  }

  /**
   * `GameEntity.addDamage(...)` (real Forge marks damage on ANY
   * `GameEntity` — player or permanent — and lets a LATER state-based-
   * action pass react to it, rather than resolving the consequence
   * inline). Damage to a PLAYER stays real and immediate here (a life
   * total has no separate "marked, then consequence" step worth splitting
   * apart). Damage to a CREATURE now genuinely marks `card.damageMarked`
   * (120.3) and `card.deathtouchDamaged` (702.2b/704.5h) — this USED TO be
   * a documented no-op (this file's own prior header note: "no state-based
   * actions here... damage to a CREATURE has no observable persistent
   * effect"), fixed alongside `sba.ts`'s `checkStateBasedActions` (704.5g/
   * 704.5h), the thing that actually CONSUMES this now. `isLethallyDamaged`
   * (below) is the shared read both `sba.ts` and `engine.ts`'s
   * `resolveCombatDamage` use — never recomputed differently in two places.
   *
   * `source`, when given, carries out real rule 702.15e — confirmed against
   * `GameAction.java` (~line 2732-2735): `if (sum > 0 &&
   * sourceLKI.hasKeyword(Keyword.LIFELINK)) sourceLKI.getController()
   * .gainLife(sum, sourceLKI, cause);` — whenever a source with Lifelink
   * deals damage, its CONTROLLER gains that much life, for ANY damage
   * (combat or a direct effect like Mega Flare), not something tied to the
   * `dealDamage` Effect kind specifically. Real Forge sums every target a
   * single damage EVENT hit before granting life once; this simplified
   * version only ever deals damage to one target per call, so summing
   * doesn't come up yet — same single-target scope every other action here
   * has. Returns the life gained (0 when no Lifelink source), so callers
   * (harness.ts) can log it as a real, visible fact.
   */
  dealDamage(target: RealPlayer | RealCard, amount: number, source?: RealCard): number {
    if ('life' in target) {
      target.life -= amount;
    } else {
      target.damageMarked = (target.damageMarked ?? 0) + amount;
      if (amount > 0 && source?.keywords.includes('Deathtouch')) target.deathtouchDamaged = true;
    }
    if (source?.keywords.includes('Lifelink')) {
      const controller = this.players.get(source.controllerId);
      if (controller) {
        controller.life += amount;
        return amount;
      }
    }
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Thin interfaces.ts-shaped wrappers over the real state above — these are
// what `harness.ts` hands to `resolveCard()` as `Player`/`Card`. Every
// method does the REAL mutation via `GameState` first, then logs — the log
// format/fields are unchanged from the earlier mock version; only what
// happens underneath changed.

export function wrapCard(state: GameState, real: RealCard): Card {
  return {
    getId: () => real.id,
    getName: () => real.name,
    isToken: () => real.isTokenCard,
    isCreature: () => effectiveTypes(real).includes('Creature'),
    isLand: () => effectiveTypes(real).includes('Land'),
    isEnchantment: () => effectiveTypes(real).includes('Enchantment'),
    isArtifact: () => effectiveTypes(real).includes('Artifact'),
    isTapped: () => real.tapped,
    getCMC: () => real.cmc ?? 0,
    getAttachedTo: () => (real.attachedToId !== undefined ? wrapCard(state, state.cards.get(real.attachedToId)!) : undefined),
    getEquippedBy: () => [...state.cards.values()].filter((c) => c.attachedToId === real.id).map((c) => wrapCard(state, c)),
    hasSubtype: (subtype: string) => real.subtypes.includes(subtype),
    hasKeyword: (keyword: string) => real.keywords.includes(keyword),
    getOwner: () => wrapPlayer(state, state.players.get(real.ownerId)!),
    getController: () => wrapPlayer(state, state.players.get(real.controllerId)!),
    getNetPower: () => effectivePT(state, real)[0],
    getNetToughness: () => effectivePT(state, real)[1],
    getCounters: (counterType: string) => real.counters[counterType] ?? 0,
  } as unknown as Card;
}

export function wrapPlayer(state: GameState, real: RealPlayer): Player {
  const wrapAll = (cards: RealCard[]) => cards.map((c) => wrapCard(state, c));
  return {
    getId: () => real.id,
    getName: () => real.name,
    getLife: () => real.life,
    gainLife: (amount: number) => {
      real.life += amount;
      return true;
    },
    loseLife: (amount: number) => {
      real.life -= amount;
      return amount;
    },
    drawCard: () => wrapAll(state.drawCards(real, 1)),
    drawCards: (n: number) => wrapAll(state.drawCards(real, n)),
    // See interfaces.ts's own `Player.addMana` doc comment — deliberately
    // a no-op against real game state (no ManaPool modeled anywhere), only
    // ever meaningful through harness.ts's logging wrapper.
    addMana: () => {},
    getCreaturesInPlay: () => wrapAll(real.battlefield.filter((c) => effectiveTypes(c).includes('Creature'))),
    getLandsInPlay: () => wrapAll(real.battlefield.filter((c) => effectiveTypes(c).includes('Land'))),
    getCardsIn: (zone: ZoneType) => wrapAll(zoneArray(real, zone) ?? []),
    // RealPlayer has no counters field (poison/energy) — nothing in the
    // current card set tracks player-level counters yet, so this is
    // honestly 0 rather than a fabricated value, same "don't build ahead
    // of need" discipline as everything else here.
    getCounters: () => 0,
  } as unknown as Player;
}

export { zoneArray as internalZoneArray };
