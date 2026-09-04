// A lightweight TypeScript mirror of the slice of Card-Forge's own real
// engine API (github.com/Card-Forge/forge, GPL-3.0 — a checkout lives at
// ../mtg-forge relative to this repo) that functional-model/cards/*.ts's
// hand-authored `CardDefinition`s call against. The point is
// traceability: every interface member below cites the real Java file (and
// roughly which line, at the time this was written) it mirrors, so a reader
// can go check "is this really what Forge calls it" instead of trusting an
// invented API. This is NOT a port of Forge's engine — no method here has a
// body (`declare function`/interface members only, real ambient TS syntax,
// no implementation to maintain) — it exists purely so card definitions read
// as code written against Forge's real shape rather than a shorthand DSL,
// per the user's own framing: "copy it somehow from forge, to not reinvent
// the wheel."
//
// Deliberately partial. A handful of Java signatures are trimmed of
// arguments that have no meaningful value outside a running Forge game (a
// `SpellAbility`/`Card` "who/what caused this" argument, mostly) — noted
// inline on each member. And a dozen-ish `declare function` helpers below
// the interfaces cover actions card definitions need that don't
// correspond to one single Player/Card method call in the real engine (most
// real Forge actions are dispatched through much heavier machinery —
// `Game.getAction()`, replacement effects, static-ability layers, etc. —
// that would defeat the "lightweight, readable" point of this module if
// mirrored 1:1). Those are marked "convenience wrapper," not a real Forge
// method, in their own doc comment — never presented as something copied
// verbatim when it wasn't.

/**
 * Mirrors forge-game/src/main/java/forge/game/GameEntity.java (~line 51 for
 * the class itself; `getId`/`getName` ~line 63-68). The common base every
 * targetable game object (a `Card`, a `Player`) shares.
 */
export interface GameEntity {
  getId(): number;
  getName(): string;
  /** GameEntity.java ~line 322 — `public final int getCounters(final CounterType counterName)`, shared by every game object (a Player's own poison counters included, not just a Card's +1/+1s). */
  getCounters(counterType: string): number;
}

/**
 * Mirrors forge-game/src/main/java/forge/game/zone/ZoneType.java's enum
 * (~line 13) — trimmed to the zones a BLB-scale card's own ability text
 * actually names (Sideboard/SchemeDeck/PlanarDeck/... are real values on the
 * enum but never printed on a Magic card).
 */
export type ZoneType = 'Hand' | 'Library' | 'Graveyard' | 'Battlefield' | 'Exile' | 'Stack' | 'Command';

/**
 * Mirrors forge-game/src/main/java/forge/game/card/Card.java. Real Card.java
 * is enormous (thousands of members) — only the handful this translator's
 * generated code actually reads.
 */
export interface Card extends GameEntity {
  /** Card.java ~line 1050 — a real permanent vs. a token copy of one. */
  isToken(): boolean;
  /** Card.java ~line 3696. */
  getOwner(): Player;
  /** Card.java ~line 3710. */
  getController(): Player;
  /** Card.java ~line 4468 — power including all continuous/counter effects. */
  getNetPower(): number;
  /** Card.java ~line 4535 — toughness including all continuous/counter effects. */
  getNetToughness(): number;
  /**
   * Convenience collapsing two real hops — `Card.getType()` (Card.java
   * ~line 4037, returns a `CardTypeView`) then
   * `CardTypeView.hasSubtype(String)` (forge-core/.../card/CardTypeView.java
   * ~line 25) — into one call, so a "you control a Bat" existence check
   * reads as one predicate instead of a two-step lookup.
   */
  hasSubtype(subtype: string): boolean;
  /** Real Forge `K:` keyword check (`Card.hasKeyword(String)`, Card.java ~line 4991) — same controlled vocabulary card.ts's own `Keyword` type uses; `state.ts`'s own `RealCard.keywords` already tracks this for Lifelink/Indestructible internally, this just exposes the read (Airship Crash's own "destroy target creature with flying," e.g.). */
  hasKeyword(keyword: string): boolean;
  /**
   * Convenience collapsing `Card.getType()` then
   * `CardTypeView.isCreature()` (forge-core/.../card/CardTypeView.java
   * ~line 38) into one call — same reasoning as `hasSubtype` above.
   */
  isCreature(): boolean;
  /**
   * Convenience collapsing `Card.getType()` then `CardTypeView.isLand()`
   * (forge-core/.../card/CardTypeView.java ~line 41) into one call — same
   * reasoning as `isCreature` above.
   */
  isLand(): boolean;
  /**
   * Convenience collapsing `Card.getType()` then `CardTypeView.isEnchantment()`
   * (forge-core/.../card/CardTypeView.java ~line 48) into one call — same
   * reasoning as `isCreature`/`isLand` above.
   */
  isEnchantment(): boolean;
  /**
   * Convenience collapsing `Card.getType()` then `CardTypeView.isArtifact()`
   * (forge-core/.../card/CardTypeView.java ~line 42) into one call — same
   * reasoning as `isCreature`/`isLand`/`isEnchantment` above.
   */
  isArtifact(): boolean;
  /** Card.java ~line 4641 — `public final boolean isTapped()`. */
  isTapped(): boolean;
  /** Card.java ~line 7227 — `public int getCMC()`, real mana value. */
  getCMC(): number;
  /** Card.java ~line 3907 — `public final Card getAttachedTo()`: for an Equipment/Aura, what it's currently attached to (undefined when unattached). */
  getAttachedTo(): Card | undefined;
  /** Card.java ~line 3850 — `public final CardCollectionView getEquippedBy()`: for a creature, every Equipment currently attached to it (Barret Wallace's own "damage equal to equipped creatures you control," e.g.). */
  getEquippedBy(): Card[];
}

/**
 * Mirrors forge-game/src/main/java/forge/game/player/Player.java. Real
 * Player.java is thousands of lines; only the members this translator's
 * generated code calls are represented.
 */
export interface Player extends GameEntity {
  /** Player.java ~line 435. */
  getLife(): number;
  /**
   * Player.java ~line 439 — real signature is
   * `gainLife(int lifeGain, Card source, SpellAbility sa)`; `sa` (which
   * ability caused this) has no meaningful representative value in
   * generated, non-running code, so it's dropped and `source` is optional.
   */
  gainLife(amount: number, source?: Card): boolean;
  /**
   * Player.java ~line 494 — real signature is
   * `loseLife(int toLose, boolean damage, boolean manaBurn, SpellAbility cause)`;
   * all three trailing arguments describe HOW life was lost (combat damage
   * vs. a cost payment vs. a plain effect), which this translator's source
   * data (a plain `DB$ LoseLife` effect) never distinguishes, so they're
   * dropped rather than guessed at.
   */
  loseLife(amount: number): number;
  /** Player.java ~line 1113 — draws exactly one card. */
  drawCard(): Card[];
  /** Player.java ~line 1117. */
  drawCards(n: number): Card[];
  /** Player.java ~line 2408. */
  getCreaturesInPlay(): Card[];
  /** Player.java ~line 2430. */
  getLandsInPlay(): Card[];
  /** Player.java's own `getCardsIn(ZoneType)` overload family. */
  getCardsIn(zone: ZoneType): Card[];
}

/**
 * Mirrors forge-game/src/main/java/forge/game/card/token/TokenInfo.java's
 * own field list (~line 38-45; constructor from a real `Card` ~line 44).
 * Real TokenInfo also carries `imageName`/`intrinsicKeywords`/`color` — not
 * reproduced here since functional-model/tokens.ts (built from this app's
 * own Scryfall-backed token registry, not invented) doesn't have reliable
 * data for those beyond what a card's own ability text already states
 * inline (e.g. a granted keyword shows up as a `grantKeyword` call, not as
 * hidden token metadata).
 */
export interface TokenInfo {
  name: string;
  manaCost: string;
  types: string[];
  basePower: number;
  baseToughness: number;
  /** Real Forge `K:` lines a token itself carries (Prompto Argentum's own Bird token with a granted evasion keyword, e.g.) — same controlled vocabulary card.ts's own `Keyword` type uses, not reproduced here to avoid a circular import; typed as `string[]` and narrowed by the caller. Omit for a vanilla token (most of them). */
  keywords?: string[];
}

// ---------------------------------------------------------------------------
// Convenience helpers — NOT 1:1 Forge methods (each says so in its own doc
// comment). Real Forge dispatches every one of these through much heavier
// machinery (Game.getAction(), replacement effects, static-ability layers,
// CardFactory, ...) that would defeat this module's own "lightweight,
// readable" purpose if mirrored in full. `declare function foo(...): T;` is
// valid ambient TypeScript with no implementation required — there is
// nothing here to keep in sync with a real function body, only a typed
// surface for functional-model/cards/*.ts to call against.

/**
 * Convenience wrapper over the shape of
 * forge.game.card.CardFactory.makeToken(Player, TokenInfo, ...) — creates
 * `qty` copies of `token` under `controller`'s control.
 */
export declare function createToken(controller: Player, token: TokenInfo, qty?: number, opts?: { tapped?: boolean }): Card[];

/** Convenience wrapper over Forge's own destroy-effect machinery (`DestroyEffect`). */
export declare function destroy(target: Card): void;

/**
 * Convenience wrapper over `Game.getAction().sacrifice(Card, ...)`, extended
 * to a CHOSEN batch — Forge's own `SacrificeEffect` loops "each affected
 * player chooses `qty` of their own permanents matching `SacValid$`" one
 * player at a time; this collapses that into one call for `controller`
 * alone (Gaius van Baelsar's "each player sacrifices..." calls this once per
 * player — see cards/gaius-van-baelsar/definition.ts). No signature user yet at
 * the time this changed from a single-target form, so widened rather than
 * duplicated under a second name.
 */
export declare function sacrifice(controller: Player, qty: number, validType?: string, notSelf?: boolean, tokenFilter?: 'token' | 'nontoken'): Card[];

/** Convenience wrapper over `GameEntity.addDamage(...)`/combat damage assignment. */
export declare function dealDamage(source: Card, target: Card | Player, amount: number): void;

/** Convenience wrapper over `Card.addCounter(CounterType, int, ...)`. */
export declare function putCounter(target: Card, counterType: string, amount: number): void;

/** Convenience wrapper over `Card.tap()`. */
export declare function tap(target: Card): void;

/** Convenience wrapper over `Card.untap()`. */
export declare function untap(target: Card): void;

/**
 * Convenience wrapper over `Card.addChangedCardKeywords(...)` (Card.java
 * ~line 5017) — real Forge tracks a granted keyword as a duration-scoped,
 * timestamped layer-6 entry, reverted at the real effect's end ("until end
 * of turn," e.g.). This model has no phase/turn-boundary reset step
 * anywhere (see state.ts's own header), so this applies the grant as a
 * direct, PERMANENT mutation instead — see state.ts's own `grantKeyword`
 * doc comment for the full reasoning.
 */
export declare function grantKeyword(target: Card, keyword: string): void;

/** Convenience wrapper over `Player.mill(int)` — moves `qty` cards library-&gt;graveyard, returns them. */
export declare function mill(player: Player, qty: number): Card[];

/** Convenience wrapper over Forge's own Scry effect (look at the top `qty` cards, reorder top/bottom). */
export declare function scry(player: Player, qty: number): void;

/** Convenience wrapper over Forge's own Surveil effect (look at the top `qty`, put any number into the graveyard). */
export declare function surveil(player: Player, qty: number): void;

// dig's declaration lives further down (Forge's own DigEffect).

/** Convenience wrapper over `Player.discard(...)`. */
export declare function discard(player: Player, qty: number): void;

/** Convenience wrapper over `Game.getAction().exile(Card, ...)`. */
export declare function exile(target: Card): void;

/** Convenience wrapper over `Game.getAction().moveTo(ZoneType, Card, ...)` (a real, central Forge method). */
export declare function moveTo(target: Card, zone: ZoneType): void;

/**
 * Convenience wrapper over the same `Game.getAction().moveTo(ZoneType, Card, ...)`
 * as `moveTo` above, applied `qty` times over cards of `player`'s own `from`
 * zone matching `validType` — an UNCHOSEN batch (Malboro's own Dig-with-
 * ChangeNum$All: "exiles the top three cards of their library," no player
 * decision involved), as opposed to `moveTo` + `chooseTarget` together for
 * an effect that genuinely lets a player pick which cards (Fight On!'s
 * "return up to two TARGET creature cards"). Real Forge has no single batch
 * method either way — same "no equivalent-weight method to mirror, this is
 * a readability shim" reasoning as `controls`/`chooseTarget` below.
 */
export declare function move(player: Player, from: ZoneType, to: ZoneType, qty: number, validType?: string): Card[];

/** Convenience wrapper over `Card.setController(...)`/a control-change effect. */
export declare function gainControl(controller: Player, target: Card): void;

/**
 * Convenience wrapper over `Card.attachToEntity(GameEntity, SpellAbility)`
 * (Card.java ~line 3930) — attaches an Equipment/Aura to `target`.
 */
export declare function equip(equipment: Card, target: Card): void;

/**
 * Convenience wrapper over Forge's own `AnimateEffect`
 * (forge-game/.../ability/effects/AnimateEffect.java) — a real Forge class,
 * not a single method, doing far more (P/T overrides, keyword grants,
 * duration tracking) than this shim reproduces; here it just adds `types`
 * to `target`'s current type line (Phantom Train's own "becomes a Spirit
 * artifact creature in addition to its other types").
 */
export declare function animate(target: Card, types: string[]): void;

/**
 * Convenience wrapper standing in for Forge's own temporary-pump machinery
 * (a continuous "until end of turn" effect object in real Forge, not a
 * single method call) — applies `+powerDelta/+toughnessDelta` to `target`.
 * `target` accepts a `Player` too because Forge's own `DB$ Pump`/`PumpAll`
 * effect is also how a keyword grant with no P/T component (Dawn's Truce's
 * own "you ... gain hexproof") gets applied to a PLAYER, not just a
 * creature — the same effect class either way in Forge, just a 0/0 delta
 * with a `KW$` field when nothing's actually being pumped stat-wise.
 */
export declare function pump(target: Card | Player, powerDelta: number, toughnessDelta: number): void;

/** Convenience wrapper over `CardFactory.copyCard(Card, Player, ...)`. */
export declare function copyPermanent(source: Card, controller: Player): Card;

/** Convenience wrapper over "you may play the revealed/chosen card" effects. */
export declare function play(player: Player, target: Card): void;

/**
 * Convenience wrapper over a "does at least one card matching this
 * predicate exist in `player`'s battlefield zone" check — real Forge
 * expresses this as `CardLists.filter(player.getCardsIn(ZoneType.Battlefield), CardPredicates...)`,
 * not a single Player/Card method; this is a readability shim over that
 * pattern, not a literal Forge call.
 */
export declare function controls(player: Player, predicate: (c: Card) => boolean): boolean;

/**
 * Picks one object from `pool` (optionally narrowed by `predicate`) —
 * stands in for Forge's real target-selection/player-choice machinery
 * (`TargetChoices`, `PlayerController.choose*`), which has no single
 * equivalent-weight method to mirror here. Every `target`/`chosen` local in
 * generated code comes from this.
 */
export declare function chooseTarget(pool: Card[], predicate?: (c: Card) => boolean): Card;

/**
 * Convenience wrapper over `Game.getPhaseHandler().isPlayerTurn(Player)` —
 * used for Forge's own `Condition$ PlayerTurn` field (K:Flying's own
 * "during your turn" restriction, e.g.).
 */
export declare function isYourTurn(player: Player): boolean;

/**
 * Convenience wrapper over Forge's own `DigEffect`
 * (forge-game/.../ability/effects/DigEffect.java) — looks at the top `qty`
 * library cards, takes up to `take` matching `validType`, puts the rest on
 * the bottom (real order fidelity for "rest in a random order" isn't
 * tracked here — generic library-filler objects are interchangeable in this
 * model, so the exact shuffled order has no observable consequence).
 */
export declare function dig(player: Player, qty: number, take: number, validType?: string): Card[];

/**
 * Forge's own `PlayerCountOpponents$HighestValid`/`$HighestLifeTotal`/etc.
 * SVar convention (see app/lib/forgeTranslate.ts's own `parseSvarCompare`) —
 * "the highest value of `metric` across every player in `players`." Always
 * phrased this way (never "an arbitrary opponent's count") because Forge's
 * engine is multiplayer-general even though a BLB draft table is 1v1 — with
 * exactly one opponent, `highest([opp], m)` and `m(opp)` are the same
 * number, so this stays correct without special-casing table size.
 */
export declare function highest(players: Player[], metric: (p: Player) => number): number;
