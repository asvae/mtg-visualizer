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
}

/** Layer 4 (TYPE) applied — the card's CURRENT type list, not just its printed one. Use this instead of raw `card.types` anywhere "is this a creature/artifact/etc. right now" matters (an `animate`d permanent really does count). */
export function effectiveTypes(card: RealCard): string[] {
  return card.layers.computeTypes(card.types);
}

/** Layers 7's own P/T calculation (counters folded in as real Forge's own layer 7d does, simplified to +1/+1-style counters only) applied on top of base + timestamp-ordered continuous effects. */
export function effectivePT(card: RealCard): [number, number] {
  const base = card.basePower + (card.counters['+1/+1'] ?? 0);
  const baseT = card.baseToughness + (card.counters['+1/+1'] ?? 0);
  return card.layers.computePT(base, baseT);
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

export class GameState {
  players = new Map<number, RealPlayer>();
  cards = new Map<number, RealCard>();

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
    for (let i = 0; i < qty; i++) {
      made.push(
        this.addCard(controller, 'Battlefield', {
          name: token.name,
          isTokenCard: true,
          types: token.types,
          subtypes: [],
          basePower: token.basePower,
          baseToughness: token.baseToughness,
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

  /** `Card.tap(...)` (forge-game/.../card/Card.java ~line 4662) — real, persistent tapped state. */
  tap(card: RealCard): void {
    card.tapped = true;
  }

  /** `Card.untap()` (forge-game/.../card/Card.java ~line 4711) — real, persistent tapped state. */
  untap(card: RealCard): void {
    card.tapped = false;
  }

  /** `DestroyEffect` (forge-game/.../ability/effects/DestroyEffect.java) — real zone change, battlefield->graveyard, via the SAME `move()` a sacrifice/dies uses (a token still ceases to exist rather than reaching the graveyard, per `move`'s own rule). Destroy is its own real action (distinct from sacrifice, rule 701.16) only in WHICH ability caused the move, not in the zone-change mechanics themselves — no separate state to track here beyond that. */
  destroy(card: RealCard): void {
    this.move(card, 'Graveyard');
  }

  /**
   * `GameEntity.addDamage(...)`/combat damage assignment — simplified: no
   * state-based actions here (see this file's own header — a 0-toughness
   * creature doesn't die), so damage to a CREATURE has no observable
   * persistent effect in this model and is a no-op; damage to a PLAYER is
   * real and persistent (mirrors real Forge's own eventual life-total
   * consequence, minus the intermediate "damage marked, then SBA checks
   * life <= 0" step this model doesn't track separately).
   */
  dealDamage(target: RealPlayer | RealCard, amount: number): void {
    if ('life' in target) target.life -= amount;
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
    hasSubtype: (subtype: string) => real.subtypes.includes(subtype),
    getOwner: () => wrapPlayer(state, state.players.get(real.ownerId)!),
    getController: () => wrapPlayer(state, state.players.get(real.controllerId)!),
    getNetPower: () => effectivePT(real)[0],
    getNetToughness: () => effectivePT(real)[1],
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
