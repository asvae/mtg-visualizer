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
import {
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
  destroy as realDestroy,
  dealDamage as realDealDamage,
  tap as realTap,
  untap as realUntap,
  dig as realDig,
  grantKeyword as realGrantKeyword,
  copyPermanent as realCopyPermanent,
  delayUntil as realDelayUntil,
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
  destroy: typeof realDestroy;
  dealDamage: typeof realDealDamage;
  tap: typeof realTap;
  untap: typeof realUntap;
  dig: typeof realDig;
  grantKeyword: typeof realGrantKeyword;
  copyPermanent: typeof realCopyPermanent;
  delayUntil: typeof realDelayUntil;
}
const defaultActions: Actions = {
  createToken: realCreateToken,
  pump: realPump,
  moveTo: realMoveTo,
  chooseTarget: realChooseTarget,
  move: realMove,
  sacrifice: realSacrifice,
  discard: realDiscard,
  putCounter: realPutCounter,
  equip: realEquip,
  animate: realAnimate,
  gainControl: realGainControl,
  surveil: realSurveil,
  destroy: realDestroy,
  dealDamage: realDealDamage,
  tap: realTap,
  untap: realUntap,
  dig: realDig,
  grantKeyword: realGrantKeyword,
  copyPermanent: realCopyPermanent,
  delayUntil: realDelayUntil,
};

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
      owner: EffectOwner;
      from: ZoneType;
      to: ZoneType;
      qty: Computed<number>;
      validType?: 'creature' | 'artifact' | 'land' | 'any';
      target?: boolean;
      /** "return ANOTHER permanent you control" (Ambrosia Whiteheart) — excludes `ctx.self` from the candidate pool, same reasoning as `sacrifice`'s own `notSelf`. */
      notSelf?: boolean;
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
      /** Grants a keyword to a SINGLE chosen target (Magic Damper-style "target creature gains X") — same target-picking shape as `pumpTarget`. Mechanically REAL, not just documentary (see state.ts's own `grantKeyword`: it mutates the real card's `keywords`, so a later Lifelink/Indestructible check genuinely reflects it) — but DURATION isn't tracked (the grant is permanent within a scenario), same caveat `state.grantKeyword`'s own doc comment explains in full. */
      kind: 'grantKeywordTarget';
      keyword: Keyword;
      validType?: 'creature' | 'any';
      owner?: EffectOwner;
      /** See `pumpTarget`'s own `notSelf` doc comment above — same "another target creature" exclusion. */
      notSelf?: boolean;
    }
  | {
      /** Grants a keyword to every creature matching `predicate` (Ardyn's own "Demons you control have menace," a real static grant to a GROUP) — same `predicate`/`notSelf`/`subtype` shape `pumpAll`/`putCounterAll` already use. Same duration caveat as `grantKeywordTarget` above. */
      kind: 'grantKeywordAll';
      predicate: 'creatures-you-control';
      keyword: Keyword;
      notSelf?: boolean;
      subtype?: string;
    }
  | {
      /** `self` gains a keyword with no target/board-wide choice (Zack Fair's own "gains indestructible") — third shape mirroring `pumpSelf`. Same duration caveat as `grantKeywordTarget` above. */
      kind: 'grantKeywordSelf';
      keyword: Keyword;
    }
  | {
      /** `TapEffect`/`TapAllEffect` (forge-game/.../ability/effects/) — a CHOSEN target tapped (Coeurl's own activated ability), as opposed to a board-wide tap-all this batch doesn't need yet. */
      kind: 'tapTarget';
      validType: 'creature' | 'artifact' | 'land' | 'creature-or-artifact' | 'any';
      excludeEnchantment?: boolean;
      /** See `dealDamageTarget`'s own doc comment above — same owner-restriction mechanism, for a card whose real text actually is restricted (Coeurl's own real text is NOT — see that doc comment). */
      owner?: EffectOwner;
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
}

/**
 * A controlled vocabulary of real Forge `K:` keyword names — see
 * `CardDefinition.keywords`'s own doc comment for which of these actually
 * change resolution behavior (today: only `Lifelink`/`Indestructible`) vs.
 * are recognized-but-inert structured facts. Deliberately not exhaustive of
 * every real MTG keyword — extend as a real card needs one not listed here.
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
  | 'Convoke';

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
  readonly abilities?: { name: string; cost: string; effects: Effect[] }[];
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
   * MECHANICALLY ENFORCED everywhere real MTG would enforce it — only
   * `Lifelink` (`state.dealDamage`) and `Indestructible` (`state.destroy`)
   * actually change resolution behavior today, since this model has no real
   * combat/attack-block step for the rest (Flying/Trample/Deathtouch/
   * Menace/First Strike/Double Strike are fundamentally about blocking
   * legality and damage-assignment order, neither of which exist here) —
   * still real, structured facts (not text) even when inert, which is
   * strictly better for synergy detection than the old undifferentiated
   * `staticAbilities: string[]` blob these used to live in.
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
   * Continuous rules text that ISN'T a recognized `keywords` entry or
   * `ptFormula` (Kain's own "Jump — during your turn, NICKNAME has flying,"
   * a granted static buff, a conditional CDA) — plain description, NEVER
   * executed by `resolveCard()` or read by it. A static rule is a continuous
   * fact about the game state, not a resolvable step; putting it in
   * `effects` would misrepresent it as something that "happens" once. Still
   * surfaced in `synergyTags()` as a `static:...` tag so it isn't invisible
   * to a synergy search.
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
export function resolveCard(card: CardDefinition, ctx: EffectContext, actions: Actions = defaultActions, triggerName?: string, abilityName?: string): void {
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

function applyEffect(effect: Effect, ctx: EffectContext, actions: Actions): void {
  switch (effect.kind) {
    case 'createToken':
      actions.createToken(ctx.you, effect.token, resolve(effect.amount, ctx), { tapped: effect.tapped });
      return;
    case 'gainLife':
      ctx.you.gainLife(resolve(effect.amount, ctx));
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
      for (const player of playersFor(effect.owner, ctx)) {
        if (effect.target) {
          // Real MTG rule (601.2c): ALL targets are chosen together, once,
          // when the spell is cast — BEFORE it resolves. The effect is then
          // applied to each of them at resolution. Two separate loops on
          // purpose, not one choose-then-act-immediately loop: excluding an
          // already-CHOSEN target from the next pick is a targeting
          // restriction ("can't target the same object twice"), not a
          // side effect of it having already been moved — those are
          // different reasons that happen to look identical for this card
          // (nothing here can invalidate a target between casting and
          // resolving), but would diverge for a card where something else
          // could remove a target in between.
          const pool = player
            .getCardsIn(effect.from)
            .filter((c) => matchesValidType(c, effect.validType))
            .filter((c) => !effect.notSelf || c.getId() !== ctx.self.getId());
          const targets: Card[] = [];
          for (let i = 0; i < qty; i++) {
            const remaining = pool.filter((c) => !targets.includes(c));
            if (remaining.length === 0) break;
            targets.push(actions.chooseTarget(remaining));
          }
          for (const target of targets) actions.moveTo(target, effect.to);
        } else {
          actions.move(player, effect.from, effect.to, qty, effect.validType);
        }
      }
      return;
    }
    case 'putCounter':
      actions.putCounter(ctx.self, effect.counterType, resolve(effect.amount, ctx));
      return;
    case 'putCounterTarget': {
      const pool = battlefieldPool(playersFor(effect.owner ?? 'each', ctx), effect.validType);
      const qty = resolve(effect.qty ?? 1, ctx);
      const chosen: Card[] = [];
      for (let i = 0; i < qty; i++) {
        const remaining = pool.filter((c) => !chosen.includes(c));
        if (remaining.length === 0) break;
        chosen.push(actions.chooseTarget(remaining));
      }
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
      const targets: Card[] = [];
      for (let i = 0; i < qty; i++) {
        const remaining = pool.filter((c) => !targets.includes(c));
        if (remaining.length === 0) break;
        targets.push(actions.chooseTarget(remaining));
      }
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
      const target = actions.chooseTarget(pool);
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
        const target = actions.chooseTarget(creaturePool);
        if (target) actions.dealDamage(ctx.self, target, amount);
      } else if (players[0]) {
        actions.dealDamage(ctx.self, players[0], amount);
      }
      return;
    }
    case 'fightTarget': {
      const pool = playersFor(effect.owner ?? 'each', ctx).flatMap((p) => p.getCreaturesInPlay());
      const target = actions.chooseTarget(pool);
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
    case 'pumpTarget': {
      const pool = playersFor(effect.owner ?? 'each', ctx)
        .flatMap((p) => p.getCreaturesInPlay())
        .filter((c) => !effect.notSelf || c.getId() !== ctx.self.getId());
      const target = actions.chooseTarget(pool);
      if (target) actions.pump(target, resolve(effect.power, ctx), resolve(effect.toughness, ctx));
      return;
    }
    case 'pumpSelf':
      actions.pump(ctx.self, resolve(effect.power, ctx), resolve(effect.toughness, ctx));
      return;
    case 'grantKeywordTarget': {
      const pool = playersFor(effect.owner ?? 'each', ctx)
        .flatMap((p) => p.getCreaturesInPlay())
        .filter((c) => !effect.notSelf || c.getId() !== ctx.self.getId());
      const target = actions.chooseTarget(pool);
      if (target) actions.grantKeyword(target, effect.keyword);
      return;
    }
    case 'grantKeywordAll': {
      for (const creature of ctx.you.getCreaturesInPlay()) {
        if (effect.notSelf && creature.getId() === ctx.self.getId()) continue;
        if (effect.subtype && !creature.hasSubtype(effect.subtype)) continue;
        actions.grantKeyword(creature, effect.keyword);
      }
      return;
    }
    case 'grantKeywordSelf':
      actions.grantKeyword(ctx.self, effect.keyword);
      return;
    case 'tapTarget': {
      const pool = battlefieldPool(playersFor(effect.owner ?? 'each', ctx), effect.validType).filter((c) => !effect.excludeEnchantment || !c.isEnchantment());
      const target = actions.chooseTarget(pool);
      if (target) actions.tap(target);
      return;
    }
    case 'untapTarget': {
      const pool = battlefieldPool(playersFor(effect.owner ?? 'each', ctx), effect.validType).filter((c) => !effect.notSelf || c.getId() !== ctx.self.getId());
      const target = actions.chooseTarget(pool);
      if (target) actions.untap(target);
      return;
    }
    case 'dig': {
      actions.dig(ctx.you, resolve(effect.qty, ctx), resolve(effect.take, ctx), effect.validType);
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
      case 'dig':
        tags.push(`dig:${effect.validType ?? 'any'}`);
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
