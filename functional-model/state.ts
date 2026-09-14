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
   * Real, structural mana-producing ability/abilities this permanent has ON
   * ITS OWN (ENGINE_GAPS.md gap #5, closed 2026-09-14 for the ordinary
   * cases — see `mana.ts`'s own header) — see `card.ts`'s own
   * `CardDefinition.manaAbilities`/`ManaAbility` doc comments for the real
   * Forge citation (`AbilityManaPart.java`) and full field-by-field scope.
   * Copied verbatim from the resolving `CardDefinition` at the moment this
   * permanent enters the battlefield (`resolveTop`/`playLand`, `engine.ts`)
   * — NOT live-derived from a stored `CardDefinition` reference (`RealCard`
   * has none), same "copy at resolve time" convention `ptFormula`/
   * `continuousKeywordGrants` already establish. A card seeded directly
   * onto the battlefield (never cast through the engine) has no value
   * here, same documented convention `enteredThisTurn`/`resolvedPermanents`
   * already established for ETB-derived bookkeeping. `ManaAbility` here is
   * `state.ts`'s own duck-typed re-declaration (below), same
   * "state.ts never imports card.ts" convention `TriggerDoublingGrant`
   * already establishes just below this interface.
   */
  manaAbilities?: ManaAbility[];
  /** Real, query-time continuous keyword grant(s) (613, ENGINE_GAPS.md gap #14) — see `card.ts`'s own `CardDefinition.continuousKeywordGrants` doc comment for the two real Forge shapes (Dion's turn-conditional Dragonfire Dive, Ardyn's unconditional Demons grant). Copied from the resolving `CardDefinition` at `addCard` time, same convention `ptFormula`/`manaAbilities` already establish — `RealCard` never holds a live reference back to its own `CardDefinition`. Consumed by `effectiveKeywords` below, not read directly anywhere else. */
  continuousKeywordGrants?: { keywords: string[]; includeSelf: boolean; subtype?: string; onlyDuringYourTurn?: boolean; equippedBySelf?: boolean }[];
  /** Real, query-time continuous P/T grant(s) (613.3, layer 7c, ENGINE_GAPS.md gap #14's own follow-up, closed 2026-09-12) — see `card.ts`'s own `CardDefinition.continuousPTGrants` doc comment for the real Forge citation and the 5 real fixed-delta cards it covers (Dragoon's Lance/Paladin's Arms/Crystal Fragments/White Mage's Staff/Sage's Nouliths). Same copy-at-resolve-time convention as `continuousKeywordGrants` right above. Consumed by `effectivePT` below, not read directly anywhere else. */
  continuousPTGrants?: { power: number; toughness: number; includeSelf: boolean; subtype?: string; onlyDuringYourTurn?: boolean; equippedBySelf?: boolean }[];
  /** Real, query-time continuous creature-TYPE grant(s) (613.3, layer 4, ENGINE_GAPS.md gap #14's own follow-up, closed 2026-09-12) — see `card.ts`'s own `CardDefinition.continuousTypeGrants` doc comment for the real Forge citation and the 6 real cards it covers (Dragoon's Lance/Machinist's Arsenal/Paladin's Arms/White Mage's Staff/Sage's Nouliths/Astrologian's Planisphere — a creature-subtype broadcast, e.g. 'Knight', not a card-type change). Same copy-at-resolve-time convention as `continuousKeywordGrants` above. Consumed by `effectiveSubtypes` below, not read directly anywhere else. */
  continuousTypeGrants?: { types: string[]; includeSelf: boolean; subtype?: string; onlyDuringYourTurn?: boolean; equippedBySelf?: boolean }[];
  /**
   * Real, query-time activated-ability lock(s) this permanent BROADCASTS
   * onto OTHER (or its own) permanents (613/602.1, ENGINE_GAPS.md gap #18,
   * closed 2026-09-12) — see `card.ts`'s own `CardDefinition.
   * activatedAbilityLock` doc comment for the real Forge citation (Stuck in
   * Summoner's Sanctum's own `S:Mode$ CantBeActivated | ValidCard$
   * Permanent.EnchantedBy` static ability) and scope. Same
   * duck-typed-not-imported `ContinuousGrantTargeting` shape
   * `continuousKeywordGrants`/`continuousPTGrants`/`continuousTypeGrants`
   * above already establish (no extra payload — presence in this array
   * already means "locked"). Copied from the resolving `CardDefinition` at
   * `addCard` time, same convention as its siblings. Consumed by
   * `isActivationLocked` below, not read directly anywhere else.
   */
  activatedAbilityLock?: { includeSelf: boolean; subtype?: string; onlyDuringYourTurn?: boolean; equippedBySelf?: boolean }[];
  /**
   * Real CR 601.2f cost-reduction this permanent BROADCASTS onto OTHER
   * spells its controller casts (ENGINE_GAPS.md gap #7's second real
   * example, The Wind Crystal's own "White spells you cast cost {1} less
   * to cast") — see `card.ts`'s own `CardDefinition.spellCostReductionGrants`/
   * `SpellCostReductionGrant` doc comments for the real Forge citation and
   * scope. Copied from the resolving `CardDefinition` at `resolveTop` time,
   * same convention `continuousKeywordGrants` right above already
   * establishes — `RealCard` never holds a live `CardDefinition` reference.
   * Consumed by `activeSpellCostDiscount` below, not read directly anywhere
   * else.
   */
  spellCostReductionGrants?: { amount: number; colors: string[] }[];
  /**
   * Real CR 614.2 mill-event replacement this permanent BROADCASTS onto
   * every OPPONENT's own mill event (ENGINE_GAPS.md gap #19, closed) — see
   * `card.ts`'s own `CardDefinition.millModifierGrants`/`MillModifierGrant`
   * doc comments for the real Forge citation and scope. Copied from the
   * resolving `CardDefinition` at `resolveTop` time, same convention
   * `spellCostReductionGrants` right above already establishes — `RealCard`
   * never holds a live `CardDefinition` reference. Consumed by
   * `activeMillModifier` below, not read directly anywhere else.
   */
  millModifierGrants?: { amount: number }[];
  /**
   * Real "Panharmonicon effect" static grant (ENGINE_GAPS.md gap #13,
   * closed 2026-09-12) — see `card.ts`'s own `CardDefinition.triggerDoubling`/
   * `TriggerDoublingGrant` doc comment for the real Forge citation and the 3
   * real FIN cards needing this (Cloud, Midgar Mercenary; The Masamune;
   * Traveling Chocobo), each with a genuinely different gate. Copied from
   * the resolving `CardDefinition` at `resolveTop`/`addCard` time, same
   * convention `continuousKeywordGrants`/`spellCostReductionGrants` above
   * already establish — `RealCard` never holds a live `CardDefinition`
   * reference. Consumed by `shouldDoubleTrigger` below, not read directly
   * anywhere else.
   */
  triggerDoubling?: TriggerDoublingGrant[];
  /**
   * Real 508.1's own per-permanent "attacked this turn" flag (ENGINE_GAPS.md
   * gap #16, ../mtg-forge's own `CardDamageHistory.attackedThisTurn`/
   * `hasAttackedThisTurn(GameEntity)`, forge-game/.../card/CardDamageHistory.java
   * lines 26-27/88-90 — set via `setCreatureAttackedThisCombat`, ~line 54-59,
   * itself called from `CombatUtil.java` ~line 386 the moment an attacker is
   * declared; cleared each turn by `CardDamageHistory.newTurn()`, ~line
   * 282-283). The Lunar Whale's own real "As long as The Lunar Whale attacked
   * this turn, you may play the top card of your library" is the real FIN
   * card that needs this. Set by `engine.ts`'s `declareAttackers` for every
   * real declared attacker; cleared game-wide by `clearAttackedThisTurn`
   * below, called from `turn.ts`'s Cleanup branch alongside `clearAllDamage`/
   * `clearUntilEndOfTurnKeywordGrants` — a plain boolean, not a turn-number
   * comparison like `GameEngine.enteredThisTurn` (that field needs to compare
   * against a LATER turn number to answer "still this turn?"; this field is
   * simply reset to false every Cleanup, same shape `damageMarked`/
   * `deathtouchDamaged` already use for the same "cleared at Cleanup, boolean
   * in the meantime" reason). Absent/`undefined` means "hasn't attacked this
   * turn," same "absent means the non-set case" convention every other
   * optional turn-scoped `RealCard` field here already uses.
   */
  attackedThisTurn?: boolean;
  /**
   * Real, LIVE counter-presence-conditioned continuous effect(s) (613) —
   * see `card.ts`'s own `CounterConditionalGrant` doc comment for the full
   * real Forge citation (Ultima, Origin of Oblivion's own real shipped
   * script) and design. Genuinely different from `continuousKeywordGrants`/
   * `continuousPTGrants`/`continuousTypeGrants`/`activatedAbilityLock`
   * above: those are copied from a permanent's OWN `CardDefinition` at
   * resolve time and broadcast FROM it onto qualifying recipients; this is
   * installed directly onto an ARBITRARY other object (`GameState
   * .installCounterConditionalGrant`, below) at the moment some OTHER
   * effect (`putCounterTarget`) puts a counter on it, and stays keyed
   * purely on `card`'s OWN counter count from then on — no relationship to
   * whatever installed it. Consumed by `hasCounterConditionalLandTypeLoss`/
   * `hasCounterConditionalAbilityLoss`/`effectiveSubtypes`/
   * `effectiveKeywords` below, and by `mana.ts`'s own
   * `sourceColors`/`sourceAmount`/`payableManaAbility` (duck-typed against
   * this same shape, not imported — see that file's own header for why
   * it never imports a VALUE from this one).
   */
  counterConditionalGrants?: CounterConditionalGrant[];
}

/**
 * Real, LIVE counter-presence-conditioned continuous effect shape —
 * mirrors `card.ts`'s own `CounterConditionalGrant` structurally (same
 * duck-typed-not-imported convention `ManaAbility`/`TriggerDoublingGrant`
 * below already establish). See that interface's own doc comment for the
 * full real Forge citation and design.
 */
export interface CounterConditionalGrant {
  counterType: string;
  removeLandTypes?: boolean;
  removeAllAbilities?: boolean;
  grantManaAbility?: ManaAbility;
}

/**
 * Real, structural mana-producing ability shape (ENGINE_GAPS.md gap #5) —
 * mirrors `card.ts`'s own `ManaAbility` structurally, field-for-field (same
 * duck-typed-not-imported convention `TriggerDoublingGrant` just below
 * already establishes — `state.ts` deliberately never imports from
 * `card.ts`, see this file's own header). See that interface's own doc
 * comment for the full real Forge citation (`AbilityManaPart.java`) and
 * per-field scope; `mana.ts`'s `sourceColors`/`payableManaAbility`/
 * `canAfford`/`payMana` are the real readers.
 */
export interface ManaAbility {
  cost?: string;
  colors: ManaColor[];
  amount?: number;
  variableAmount?: { kind: 'countSubtypeControlled'; subtype: string } | { kind: 'selfPower' };
  restriction?: string;
  activationCondition?: string;
}

/**
 * Real "Panharmonicon effect" static grant shape (ENGINE_GAPS.md gap #13) —
 * mirrors `card.ts`'s own `TriggerDoublingGrant` structurally (same
 * duck-typed-not-imported convention `continuousKeywordGrants`'s own inline
 * shape already establishes above — `state.ts` deliberately never imports
 * from `card.ts`, see this file's own header). Three real gates, one per
 * real FIN card needing this (checked against the pool, ENGINE_GAPS.md gap
 * #13's own writeup):
 *  - `'selfAndAttachedEquipment'` (Cloud, Midgar Mercenary — "As long as
 *    this is equipped, if a triggered ability of this or an Equipment
 *    attached to it triggers, that ability triggers an additional time"):
 *    applies to the GRANTING permanent itself, or anything ATTACHED to it,
 *    but ONLY while it's genuinely equipped by something — no `causedBy`
 *    restriction, this doubles ANY triggered ability.
 *  - `'equippedSelf'` (The Masamune — "Equipped creature has 'If a creature
 *    dying causes a triggered ability of this creature or an emblem you own
 *    to trigger, that ability triggers an additional time.'"): the grant
 *    lives on the EQUIPMENT, but applies to whatever creature IT is
 *    currently equipped to (real `equippedBySelf` shape,
 *    `qualifiesForContinuousGrant` above), gated to `causedBy: 'dying'`. The
 *    "...or an emblem you own" half is real printed text but genuinely
 *    unmodelable — no emblem mechanism exists anywhere in this engine — so
 *    it can never actually match; not silently dropped, just never
 *    reachable.
 *  - `'anyPermanentYouControl'` (Traveling Chocobo — "If a land or Bird you
 *    control entering the battlefield causes a triggered ability of a
 *    permanent you control to trigger, that ability triggers an additional
 *    time."): applies to ANY permanent the SAME controller owns (not just
 *    self), gated to `causedBy: 'entersBattlefield'` with `entersMatch`
 *    further restricting WHICH entering permanent counts (a land, or a
 *    subtype like `'Bird'` — an OR list, any one match qualifies).
 */
export interface TriggerDoublingGrant {
  scope: 'selfAndAttachedEquipment' | 'equippedSelf' | 'anyPermanentYouControl';
  /** Restricts which real CAUSE of the trigger firing actually gets doubled — omit for "any cause" (Cloud's own shape has no restriction at all). */
  causedBy?: 'dying' | 'entersBattlefield';
  /** Only consulted when `causedBy === 'entersBattlefield'` — an OR list, any one match qualifies (Traveling Chocobo's own "a land OR Bird," `[{isLand:true},{subtype:'Bird'}]`). */
  entersMatch?: { isLand?: boolean; subtype?: string }[];
}

/**
 * What caused a named trigger to fire, when a real doubling gate's own
 * `causedBy` cares (Masamune/Traveling Chocobo) — omit for a trigger whose
 * only possibly-active doubling gate doesn't filter on cause at all
 * (Cloud's own shape). Not a general "why did this trigger" taxonomy —
 * scoped exactly to the real causes a real FIN card needs; extend only once
 * a new real card needs another.
 *
 * `'tapLandForMana'` (added 2026-09-14, ENGINE_GAPS.md gap #5's own Ultima,
 * Origin of Oblivion closure) is genuinely different from the other two —
 * it's never consulted by `triggerDoublingGrantApplies`/`shouldDoubleTrigger`
 * below (no real `triggerDoubling` grant's own `causedBy` recognizes it, so
 * it safely never matches one by construction), only by `engine.ts`'s own
 * NEW `fireOnTapLandForManaTriggers` — passed through `fireTrigger` purely
 * for shape uniformity (every real trigger-firing call site threads a
 * `TriggerCause` the same way), not because doubling logic reads it.
 */
export type TriggerCause = { kind: 'dying' } | { kind: 'entersBattlefield'; entered: RealCard } | { kind: 'tapLandForMana'; colors: ManaColor[] };

function triggerCauseMatches(entered: RealCard, filters: { isLand?: boolean; subtype?: string }[]): boolean {
  return filters.some((f) => (f.isLand === undefined || entered.types.includes('Land') === f.isLand) && (f.subtype === undefined || entered.subtypes.includes(f.subtype)));
}

/** One `triggerDoubling` entry's own real qualification check — `source` is the permanent carrying the grant, `firing` is the RealCard whose named trigger is actually resolving, `cause` (if any) is what caused it. */
function triggerDoublingGrantApplies(state: GameState, source: RealCard, grant: TriggerDoublingGrant, firing: RealCard, cause?: TriggerCause): boolean {
  if (grant.causedBy === 'dying' && cause?.kind !== 'dying') return false;
  if (grant.causedBy === 'entersBattlefield') {
    if (cause?.kind !== 'entersBattlefield') return false;
    if (!grant.entersMatch || !triggerCauseMatches(cause.entered, grant.entersMatch)) return false;
  }
  switch (grant.scope) {
    case 'selfAndAttachedEquipment': {
      const isSelfOrAttached = firing.id === source.id || firing.attachedToId === source.id;
      if (!isSelfOrAttached) return false;
      // "As long as this is equipped" — real 301.5c-adjacent precondition,
      // checked fresh every call (some real object currently has `attachedToId`
      // pointing at `source`), not baked in at grant-authoring time.
      return [...state.cards.values()].some((c) => c.attachedToId === source.id);
    }
    case 'equippedSelf':
      return source.attachedToId === firing.id;
    case 'anyPermanentYouControl':
      return firing.controllerId === source.controllerId;
    default:
      return false;
  }
}

/**
 * Real, query-time check (613-adjacent "Panharmonicon effect," ENGINE_GAPS.md
 * gap #13, closed 2026-09-12) — is there any real, currently-qualifying
 * `triggerDoubling` grant anywhere on the battlefield that covers THIS
 * specific trigger firing (`firing`, the RealCard whose named trigger is
 * resolving; `cause`, if the firing has one worth checking against a gate's
 * own `causedBy`)? Same "recalculated on read, never a fixed/timestamped
 * delta" treatment `effectiveKeywords`/`qualifiesForContinuousGrant` already
 * establish for a continuous grant — consulted by `triggers.ts`'s own shared
 * `fireTrigger`, the one real chokepoint every trigger-firing call site in
 * this codebase now funnels a NAMED trigger's resolution through instead of
 * calling `resolveCard` directly.
 */
export function shouldDoubleTrigger(state: GameState, firing: RealCard, cause?: TriggerCause): boolean {
  for (const source of state.cards.values()) {
    if (source.zone !== 'Battlefield' || !source.triggerDoubling) continue;
    for (const grant of source.triggerDoubling) {
      if (triggerDoublingGrantApplies(state, source, grant, firing, cause)) return true;
    }
  }
  return false;
}

/** GameState-wide, real turn state kept in sync by `engine.ts`'s own `advance()` (set to the real active player's id after every phase change) — `undefined` only ever means "no real turn ever started" (a plain `harness.ts` scenario, which has no turn/phase concept at all). `effectiveKeywords`'s own `onlyDuringYourTurn` check treats that `undefined` case as "yes, it's this permanent's controller's turn" — matching `Scenario`'s own documented baseline ("Main Phase with priority," i.e. already assumed to be YOUR turn unless a scenario says otherwise) rather than leaving a turn-conditional grant silently, permanently off in every non-engine-piloted scenario. */
export function isActiveOrDefault(state: GameState, controllerId: number): boolean {
  return state.activePlayerId === undefined || state.activePlayerId === controllerId;
}

/**
 * Real, LIVE keyword set (613, ENGINE_GAPS.md gap #14) — a permanent's own
 * printed `keywords` UNION every real `continuousKeywordGrants` entry any
 * OTHER (or the same) permanent on the battlefield currently grants it,
 * re-evaluated fresh on every call (never cached/baked in) so a turn-
 * conditional grant genuinely turns on/off as `state.activePlayerId`
 * changes — same "recalculated on read" treatment `effectivePT` already
 * gives a layer-7a CDA. This is THE read path for "does this card have
 * keyword K right now" — `wrapCard`'s own `hasKeyword` and every other
 * real keyword-sensitive check in this engine (combat/summoning-sickness,
 * Deathtouch/Lifelink damage) route through this, not a raw
 * `card.keywords.includes(...)` read, so a granted keyword is functionally
 * real (a Demon token really attacks unaffected by summoning sickness
 * under Ardyn's granted Haste), not just a label. `equippedBySelf`
 * (Dragoon's Lance's own "During your turn, equipped creature has
 * flying") is the same live-recheck treatment applied to Equipment's own
 * `attachedToId` link instead of a subtype/controller match — the grant
 * really follows the Equipment if re-equipped, real-time.
 */
/**
 * Shared recipient-resolution logic for EVERY continuous, query-time grant
 * this engine models (613, ENGINE_GAPS.md gap #14 and its own follow-up
 * generalization to P/T and creature-type grants, closed 2026-09-12) —
 * `effectiveKeywords`/`effectivePT`/`effectiveSubtypes` below all call this
 * SAME function rather than each re-implementing the identical
 * `includeSelf`/`subtype`/`onlyDuringYourTurn`/`equippedBySelf` resolution
 * three times. `source` is the permanent doing the granting, `grant` is one
 * entry off its own `continuous*Grants` array, `card` is the candidate
 * recipient being checked. Payload-agnostic on purpose (doesn't know or
 * care whether `grant` carries `keywords`/`power`+`toughness`/`types` —
 * only cares whether `card` qualifies to receive WHATEVER it carries), so
 * one shared implementation serves all three payload shapes at once —
 * `card.ts`'s own `ContinuousGrantTargeting` is the type this mirrors.
 */
function qualifiesForContinuousGrant(
  state: GameState,
  source: RealCard,
  grant: { includeSelf: boolean; subtype?: string; onlyDuringYourTurn?: boolean; equippedBySelf?: boolean },
  card: RealCard,
): boolean {
  if (grant.onlyDuringYourTurn && !isActiveOrDefault(state, source.controllerId)) return false;
  const isSelf = grant.includeSelf && source.id === card.id;
  const isMatchingOther = grant.subtype !== undefined && card.controllerId === source.controllerId && card.subtypes.includes(grant.subtype);
  const isEquipped = grant.equippedBySelf === true && source.attachedToId === card.id;
  return isSelf || isMatchingOther || isEquipped;
}

/**
 * Every `card.counterConditionalGrants` entry currently ACTIVE — i.e. `card`
 * genuinely still carries >=1 counter of that entry's own `counterType`
 * right now. Needs no `GameState` sweep at all (unlike `qualifiesForContinuousGrant`'s
 * own siblings above): the rule was already installed directly onto `card`
 * itself (`GameState.installCounterConditionalGrant`), so all this reads is
 * `card`'s own two fields. The one real, shared chokepoint
 * `hasCounterConditionalLandTypeLoss`/`hasCounterConditionalAbilityLoss`/
 * `effectiveSubtypes`/`effectiveKeywords` below all consult.
 */
function activeCounterConditionalGrants(card: RealCard): CounterConditionalGrant[] {
  return (card.counterConditionalGrants ?? []).filter((g) => (card.counters[g.counterType] ?? 0) > 0);
}

/** Real Forge `RemoveLandTypes$ True` (613, layer 4) — see `card.ts`'s own `CounterConditionalGrant.removeLandTypes` doc comment. Consumed by `effectiveSubtypes` below. */
export function hasCounterConditionalLandTypeLoss(card: RealCard): boolean {
  return activeCounterConditionalGrants(card).some((g) => g.removeLandTypes);
}

/**
 * Real Forge `RemoveAllAbilities$ True` (613, layer 6) — see `card.ts`'s own
 * `CounterConditionalGrant.removeAllAbilities` doc comment for the real,
 * NAMED, only-partial enforcement scope (mana abilities + this permanent's
 * own printed keywords + rejecting activation of any OTHER activated
 * ability — NOT triggered abilities). Consumed by `effectiveKeywords` below
 * and `engine.ts`'s `canActivateAbility`; `mana.ts`'s own
 * `sourceColors`/`sourceAmount`/`payableManaAbility` duck-type the same
 * check locally instead of importing this function (that file's own header
 * — `mana.ts` never imports a VALUE from `state.ts`).
 */
export function hasCounterConditionalAbilityLoss(card: RealCard): boolean {
  return activeCounterConditionalGrants(card).some((g) => g.removeAllAbilities);
}

export function effectiveKeywords(state: GameState, card: RealCard): string[] {
  // Real Forge `RemoveAllAbilities$ True` (613, layer 6) — a genuine keyword
  // IS one of the "abilities" this strips (Forge's own `K:` lines), same as
  // any other. Checked FIRST/unconditionally: no real FIN land in this pool
  // has a printed keyword to lose, but a future one might, and this is the
  // one real chokepoint that would need to know either way.
  if (hasCounterConditionalAbilityLoss(card)) return [];
  const set = new Set(card.keywords);
  for (const source of state.cards.values()) {
    if (source.zone !== 'Battlefield' || !source.continuousKeywordGrants) continue;
    for (const grant of source.continuousKeywordGrants) {
      if (qualifiesForContinuousGrant(state, source, grant, card)) for (const kw of grant.keywords) set.add(kw);
    }
  }
  return [...set];
}

/**
 * Real, LIVE creature-TYPE set (613, layer 4, ENGINE_GAPS.md gap #14's own
 * follow-up, closed 2026-09-12) — a permanent's own printed `subtypes`
 * UNION every real `continuousTypeGrants` entry any OTHER (or the same)
 * permanent on the battlefield currently grants it, re-evaluated fresh on
 * every call, same "recalculated on read" treatment `effectiveKeywords`
 * already gives its own sibling grant family (this is genuinely the SAME
 * mechanism — `qualifiesForContinuousGrant` — with a different payload).
 * This is THE read path for "does this card have creature type T right
 * now" — `wrapCard`'s own `hasSubtype` routes through this, not a raw
 * `card.subtypes.includes(...)` read, so a granted type is functionally
 * real (a card matching "Knight" via a granted type genuinely satisfies a
 * `hasSubtype('Knight')` check), not just a label. Named `effectiveSubtypes`
 * (not `effectiveTypes`, already taken above) — every real FIN card needing
 * this grants a CREATURE TYPE (`RealCard.subtypes`), never a card
 * supertype/type (`RealCard.types`, `effectiveTypes`'s own domain).
 */
export function effectiveSubtypes(state: GameState, card: RealCard): string[] {
  // Real Forge `RemoveLandTypes$ True` (613, layer 4, Ultima, Origin of
  // Oblivion's own real static ability) — checked FIRST and wins
  // unconditionally over any UNION below: a land losing all its land types
  // loses whatever any OTHER permanent might also be granting it, same as
  // real Forge's own layer-4 removal applying on top of any prior
  // type-adding effect (no FIN card broadcasts a type grant onto an
  // arbitrary land today, so this ordering is unexercised in practice, but
  // correct either way).
  if (hasCounterConditionalLandTypeLoss(card)) return [];
  const set = new Set(card.subtypes);
  for (const source of state.cards.values()) {
    if (source.zone !== 'Battlefield' || !source.continuousTypeGrants) continue;
    for (const grant of source.continuousTypeGrants) {
      if (qualifiesForContinuousGrant(state, source, grant, card)) for (const t of grant.types) set.add(t);
    }
  }
  return [...set];
}

/**
 * Real, LIVE activated-ability lock check (613/602.1, ENGINE_GAPS.md gap
 * #18, closed 2026-09-12) — is there any real, currently-qualifying
 * `activatedAbilityLock` entry anywhere on the battlefield that covers
 * `card` (the permanent whose OWN activated ability a caller wants to
 * activate)? Same shared `qualifiesForContinuousGrant` recipient resolution
 * `effectiveKeywords`/`effectivePT`/`effectiveSubtypes` above already use
 * (this is genuinely the SAME mechanism, again with a different — here,
 * absent — payload: presence alone means "locked"), so a lock genuinely
 * follows an Aura's own live `attachedToId` (`equippedBySelf`) the same way
 * a keyword grant would, and turns off the instant the locking permanent
 * leaves the battlefield or the Aura is no longer attached — never a fixed,
 * one-time-computed delta. `engine.ts`'s `canActivateAbility` is the one
 * real consumer, mirroring Forge's own `AbilityActivated.checkRestrictions`
 * (`!StaticAbilityCantBeCast.cantBeActivatedAbility(...)`, checked BEFORE
 * any cost-affordability check — this function is called the same way).
 */
export function isActivationLocked(state: GameState, card: RealCard): boolean {
  for (const source of state.cards.values()) {
    if (source.zone !== 'Battlefield' || !source.activatedAbilityLock) continue;
    for (const grant of source.activatedAbilityLock) {
      if (qualifiesForContinuousGrant(state, source, grant, card)) return true;
    }
  }
  return false;
}

/**
 * Real CR 601.2f cost-reduction total a `caster` currently benefits from
 * when casting a spell of `cardColors` (ENGINE_GAPS.md gap #7's second real
 * example, The Wind Crystal's own "White spells you cast cost {1} less to
 * cast") — sums every `spellCostReductionGrants` entry on the CASTER'S OWN
 * battlefield permanents (real Forge: `Activator$ You` — the discount is
 * scoped to the GRANTING permanent's OWN controller casting, not any
 * player) whose `colors` intersect `cardColors` at all. `engine.ts`'s
 * `effectiveCastCost` is the one real call site — see that function's own
 * doc comment for how this combines with a card's own `costReduction`.
 */
export function activeSpellCostDiscount(caster: RealPlayer, cardColors: string[]): number {
  let total = 0;
  for (const permanent of caster.battlefield) {
    for (const grant of permanent.spellCostReductionGrants ?? []) {
      if (grant.colors.some((c) => cardColors.includes(c))) total += grant.amount;
    }
  }
  return total;
}

/**
 * Real CR 614.2 mill-event replacement total `millingPlayer` currently
 * suffers (ENGINE_GAPS.md gap #19, closed) — The Water Crystal's own real
 * "If an opponent would mill one or more cards, they mill that many cards
 * plus four instead." Sums every `millModifierGrants` entry on every OTHER
 * player's own battlefield permanents (real Forge: `ValidPlayer$
 * Player.Opponent` — the OPPOSITE scoping from `activeSpellCostDiscount`
 * above, which is `Activator$ You`-scoped to the GRANT's own controller;
 * this replacement instead targets an OPPONENT of the grant's controller,
 * i.e. every player OTHER than the grant's own controller — in this
 * engine's 2-player-only scope, `turn.ts`'s own documented exclusion,
 * "every other player" and "an opponent of the grant's controller" are the
 * same set, so a plain `!== millingPlayer.id` check is exact, not an
 * approximation). `GameState.mill` (below) is the one real call site.
 */
export function activeMillModifier(state: GameState, millingPlayer: RealPlayer): number {
  let total = 0;
  for (const source of state.cards.values()) {
    if (source.zone !== 'Battlefield' || source.controllerId === millingPlayer.id || !source.millModifierGrants) continue;
    for (const grant of source.millModifierGrants) total += grant.amount;
  }
  return total;
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
  // Real layer 7c: a FIXED-delta continuous P/T grant broadcast from
  // another (or the same) permanent — same real, query-time mechanism
  // `effectiveKeywords`/`effectiveSubtypes` use for their own sibling grant
  // families (ENGINE_GAPS.md gap #14's own follow-up, closed 2026-09-12),
  // applied here rather than via `layers.ts`'s per-object `LayerSet` since
  // the grant lives on the SOURCE permanent (an Equipment) and must
  // genuinely track a live `attachedToId`/turn-conditional check, not a
  // fixed timestamped delta on `card` itself. Summed BEFORE counters (7d),
  // matching real 613.3's own 7c-before-7d sublayer order.
  for (const source of state.cards.values()) {
    if (source.zone !== 'Battlefield' || !source.continuousPTGrants) continue;
    for (const grant of source.continuousPTGrants) {
      if (qualifiesForContinuousGrant(state, source, grant, card)) {
        base += grant.power;
        baseT += grant.toughness;
      }
    }
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
  /** Real 104.3c/120.3 signal, set by `drawCards` below the instant a draw is ATTEMPTED for more cards than remain in the library — distinct from merely "library is empty" (a player who's simply never been asked to draw more than they have shouldn't lose). Consumed by `sba.ts`'s own `checkStateBasedActions` (704.5a). */
  attemptedDrawFromEmpty?: boolean;
  /** Real 104.3a/704.5a — set once by `sba.ts`'s `checkStateBasedActions` (0-or-less life, or `attemptedDrawFromEmpty` above) and never cleared; `engine.ts`'s own `advance` refuses to run any further once ANY player has this set (a real, deliberate stop — the game is over, not something to keep silently simulating). */
  hasLost?: boolean;
  /**
   * Real 305.1's own per-turn land-drop counter — `Player.landsPlayedThisTurn`
   * (`Player.java` ~line 101/2225/2231). Consumed by `engine.ts`'s
   * `canPlayLand` (rejects once this reaches the default max of 1 — no FIN
   * card raises the max yet; Zell Dincht's own "You may play an additional
   * land on each of your turns" is real but freeform `staticAbilities` text,
   * not a structured field this counter can read yet — a real, flagged,
   * not-yet-closed gap, same "blocked on cards/* boundary" shape as
   * ENGINE_GAPS.md's damage-shield gap #8). Reset to 0 at the OWNING
   * player's own Cleanup (`turn.ts`'s `runPhaseEntryAction`, mirroring
   * `Player.onCleanupPhase`'s own `resetLandsPlayedThisTurn()` call,
   * `Player.java` ~line 2473) — undefined/0 for a player who hasn't played
   * a land yet this game, same "absent means zero" convention
   * `attemptedDrawFromEmpty` above already uses.
   */
  landsPlayedThisTurn?: number;
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
  /** Pending real 514.2 "until end of turn" keyword grants — see `grantKeyword`'s own `opts.untilEndOfTurn` doc comment and `clearUntilEndOfTurnKeywordGrants` (drains this at every real Cleanup entry). By `cardId` (not a direct `RealCard` reference) so a card that's since changed zones is still a safe, cheap `Map` lookup rather than a stale object reference. */
  untilEndOfTurnKeywordGrants: { cardId: number; keyword: string }[] = [];
  /** Pending real 514.2 "until end of turn" pumps — see `pump`'s own `opts.untilEndOfTurn` doc comment and `clearUntilEndOfTurnPumps` (drains this at every real Cleanup entry). By `{cardId, timestamp}` (the SAME timestamp `pump` gave the underlying `LayerSet` entry) rather than a direct `RealCard`/`LayerEffect` reference, same "safe, cheap lookup, not a stale object reference" reasoning `untilEndOfTurnKeywordGrants` already uses; `powerDelta`/`toughnessDelta` are carried too (unlike the keyword-grant list, which only needs the keyword NAME to remove/log) since a pump's own removal is otherwise unreadable after the fact — nothing else records what a specific timestamped `LayerEffect` closure actually applied, and `engine-trace.ts`'s own synthetic Cleanup log entry (mirroring its existing `untilEndOfTurnGrants` removal entry) needs real numbers to report. */
  untilEndOfTurnPumps: { cardId: number; timestamp: number; powerDelta: number; toughnessDelta: number }[] = [];
  /** See `isActiveOrDefault`'s own doc comment (just below `RealCard`, above) — kept in sync by `engine.ts`'s `advance()`; defaults to the FIRST player added (the scenario's own conventional 'you') the moment they're added, so an unadvanced/plain scenario already reads as "your turn" without needing a real turn simulation to say so explicitly. */
  activePlayerId?: number;
  /**
   * Real per-player "already flipped a coin this turn" tracking (ENGINE_GAPS.md
   * gap #15) — real Forge tracks this as a live `Count$YouFlipThisTurn` SVar
   * (`res/cardsfolder/e/edgar_king_of_figaro.txt`'s own real script:
   * `CheckSVar$ Count$YouFlipThisTurn | SVarCompare$ EQ0`); this model only
   * needs the boolean "has this player flipped at least once this turn"
   * question (`flipCoin` below), not the exact running count, so a bare
   * per-player `Set` is enough. Reset game-wide at every real Cleanup
   * (`turn.ts`'s `runPhaseEntryAction`, alongside `clearAllDamage`/
   * `clearUntilEndOfTurnKeywordGrants` — same "once per real turn boundary,
   * every player" scope), via `resetFlippedCoinThisTurn` below.
   */
  flippedCoinThisTurn = new Set<number>();

  /** Schedules `run` to fire the next time the game enters `phase` (see `DelayedTrigger` above) — real 603.7 duration only, not a repeating/every-turn trigger: fires once, then this entry is gone (drained by `turn.ts`'s `advancePhase`). */
  scheduleDelayedTrigger(phase: Phase, run: () => void): void {
    this.delayedTriggers.push({ phase, run });
  }

  addPlayer(name: string): RealPlayer {
    const player: RealPlayer = { id: nextObjectId++, name, life: 20, hand: [], library: [], graveyard: [], battlefield: [], exile: [] };
    this.players.set(player.id, player);
    if (this.activePlayerId === undefined) this.activePlayerId = player.id;
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
      manaAbilities: opts.manaAbilities,
      continuousKeywordGrants: opts.continuousKeywordGrants,
      continuousPTGrants: opts.continuousPTGrants,
      continuousTypeGrants: opts.continuousTypeGrants,
      activatedAbilityLock: opts.activatedAbilityLock,
      triggerDoubling: opts.triggerDoubling,
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

  /**
   * `Player.shuffle(SpellAbility)` (Player.java ~line 1606) — a real,
   * genuine in-place Fisher-Yates randomization of `player.library`, not a
   * documentary no-op: real Forge requires this any time a hidden zone is
   * searched (601.2/701.19), and CR 601.2's own "then shuffle" text is what
   * Cycling's own real `TypeCycling` search (`move`'s new `shuffleAfter`
   * field, card.ts) needs to actually demonstrate for real (a caller/test
   * can observe the library's own card order genuinely changed, not just
   * trust a comment).
   */
  shuffleLibrary(player: RealPlayer): void {
    const lib = player.library;
    for (let i = lib.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lib[i], lib[j]] = [lib[j]!, lib[i]!];
    }
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

  /** `Player.drawCard`/`drawCards` (forge-game/.../player/Player.java ~line 1113/1117) — real top-of-library -> hand move, in library order. Real 104.3c: attempting to draw more cards than remain (checked BEFORE drawing whatever's actually left, not after — the ATTEMPT is what matters, same as a real empty-library draw) sets `player.attemptedDrawFromEmpty`, consumed by `sba.ts`'s own `checkStateBasedActions` (704.5a). */
  drawCards(player: RealPlayer, n: number): RealCard[] {
    if (n > player.library.length) player.attemptedDrawFromEmpty = true;
    const drawn: RealCard[] = [];
    for (let i = 0; i < n && player.library.length > 0; i++) {
      const card = player.library[0]!;
      this.move(card, 'Hand');
      drawn.push(card);
    }
    return drawn;
  }

  /**
   * `Player.mill(int, ZoneType, SpellAbility, Map)` (forge-game/.../player/
   * Player.java ~line 1539, ENGINE_GAPS.md gap #19, closed) — real,
   * per-card top-of-library -> graveyard moves (mirrors real Forge's own
   * per-card `moveTo` loop inside `mill`, not a bulk zone-swap), capped at
   * however many actually remain in the library (real Forge:
   * `Iterables.limit(milledView, n)`). Real, checked directly against
   * `MillEffect.resolve` (forge-game/.../ability/effects/MillEffect.java):
   * `numCards <= 0` never even calls `Player.mill` at all (an ability
   * milling 0 cards, e.g. an empty-handed Water Crystal activation, is a
   * real no-event — no replacement runs, nothing moves), so this method
   * mirrors that same early return rather than running a real replacement
   * check on a request that was never a real mill event to begin with.
   *
   * Deliberately sets NO deck-out flag the way `drawCards` above sets
   * `attemptedDrawFromEmpty` — checked directly, not assumed: real Forge's
   * own `Player.mill` (above) has no equivalent check anywhere in its body;
   * CR 104.3c's "draw more than remain -> lose the game" is a rule about
   * DRAWING specifically, with no milling analogue anywhere in the
   * Comprehensive Rules. Milling more cards than remain in the library is
   * simply a smaller real mill (every remaining card moves, nothing else
   * happens) — nothing to flag.
   *
   * Real CR 614.2 replacement, BEFORE the move (`Player.mill`'s own
   * `ReplacementHandler.run(ReplacementType.Mill, ...)` call, same "check a
   * replacement before applying the raw event" shape `gainLife`/
   * `dealDamage` already establish above): The Water Crystal's own real
   * script (`res/cardsfolder/t/the_water_crystal.txt`): `R:Event$ Mill |
   * ActiveZones$ Battlefield | ValidPlayer$ Player.Opponent | ReplaceWith$
   * MillPlus4 | ...` + `SVar:MillPlus4:DB$ ReplaceEffect | VarName$ Number |
   * VarValue$ X` + `SVar:X:ReplaceCount$Number/Plus.4` — summed via
   * `activeMillModifier` (above), which see for the real `ValidPlayer$
   * Player.Opponent` scoping (relative to the GRANT's own controller, never
   * to `player` itself).
   */
  mill(player: RealPlayer, qty: number): RealCard[] {
    if (qty <= 0) return [];
    const real = Math.max(0, qty + activeMillModifier(this, player));
    const milled: RealCard[] = [];
    for (let i = 0; i < real && player.library.length > 0; i++) {
      const card = player.library[0]!;
      this.move(card, 'Graveyard');
      milled.push(card);
    }
    return milled;
  }

  /** `Card.addCounterInternal` (forge-game/.../card/Card.java ~line 1745) — real, persistent per-card counter count. */
  putCounter(card: RealCard, counterType: string, amount: number): void {
    card.counters[counterType] = (card.counters[counterType] ?? 0) + amount;
  }

  /**
   * Real Forge `DB$ Effect | RememberObjects$ Targeted | StaticAbilities$
   * ...` (613) — installs `grant` directly onto `card`, independent of
   * whatever effect/permanent created it (see `card.ts`'s own
   * `CounterConditionalGrant` doc comment for the full design/citation).
   * No explicit removal is ever needed: `move()`'s existing 400.7
   * zone-change reset already wipes `card.counters` (and therefore
   * neutralizes every reader below, which all gate on the SAME counter
   * being > 0) the instant `card` changes zones — same "the counter's own
   * removal already does the work" reasoning the FINALITY counter's own
   * die-redirect above relies on.
   */
  installCounterConditionalGrant(card: RealCard, grant: CounterConditionalGrant): void {
    card.counterConditionalGrants = [...(card.counterConditionalGrants ?? []), grant];
  }

  /**
   * Layer 7 (P/T) — real Forge layered pump machinery (see layers.ts's own
   * header for the real `StaticAbilityLayer` citation). Each call adds ONE
   * timestamped continuous effect rather than mutating a stored delta — two
   * pumps on the same card both persist and apply in creation order
   * (`LayerSet.computePT`), not last-write-wins.
   *
   * `opts.untilEndOfTurn: true` additionally registers the SAME timestamp in
   * `untilEndOfTurnPumps` (real 514.2 — Cleanup ends "until end of turn"
   * effects), closing the real gap `grantKeyword`'s own
   * `opts.untilEndOfTurn` already closed for a keyword grant: a real "gets
   * +N/+N until end of turn" pump (Ambrosia Whiteheart's own Landfall,
   * Battle Menu's own Ability mode) used to be a PERMANENT `layers.add`
   * entry with no expiry at all, even though the card's own printed text
   * says otherwise — a real, live correctness bug in any multi-turn
   * engine-piloted playthrough, not just a missing feature (confirmed:
   * neither card's own prior scenario ever spanned a Cleanup to notice).
   * Opt-in only, same convention `grantKeyword` already established: every
   * pre-existing `pump`/`pumpSelf`/`pumpTarget`/`pumpAll` call keeps its
   * prior permanent-within-scenario behavior unless the `Effect` explicitly
   * sets `untilEndOfTurn: true`.
   */
  pump(card: RealCard, powerDelta: number, toughnessDelta: number, opts?: { untilEndOfTurn?: boolean }): void {
    const timestamp = nextLayerTimestamp();
    card.layers.add({ layer: 7, timestamp, apply: (p, t) => [p + powerDelta, t + toughnessDelta] });
    if (opts?.untilEndOfTurn) this.untilEndOfTurnPumps.push({ cardId: card.id, timestamp, powerDelta, toughnessDelta });
  }

  /**
   * Real 514.2's "until end of turn" half for a `pump` grant — ends every
   * pump registered via `pump`'s own `opts.untilEndOfTurn: true`, game-wide
   * (any player's permanent), removing the SPECIFIC layer entry via
   * `LayerSet.remove(timestamp)` (a real mutation of the card's own
   * continuous-effect list, not a filter applied at read time — same
   * "disappears from every consumer at once" reasoning
   * `clearUntilEndOfTurnKeywordGrants` already documents for a keyword). A
   * card no longer on the battlefield (already moved zones, which itself
   * already wipes `card.layers` via the existing 400.7 reset in `move()`) is
   * silently skipped — its own layer entry is already gone either way.
   */
  clearUntilEndOfTurnPumps(): void {
    for (const { cardId, timestamp } of this.untilEndOfTurnPumps) {
      const card = this.cards.get(cardId);
      card?.layers.remove(timestamp);
    }
    this.untilEndOfTurnPumps = [];
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

  /**
   * Real 508.1 "attacked this turn" reset — `CardDamageHistory.newTurn()`'s
   * own `attackedThisTurn.clear()` (forge-game/.../card/CardDamageHistory.java
   * ~line 282-283), called here at every real Cleanup entry (`turn.ts`'s
   * `runPhaseEntryAction`, alongside `clearAllDamage`/
   * `clearUntilEndOfTurnKeywordGrants`'s own exact same "real, game-wide,
   * once per Cleanup" shape) rather than at the start of the next turn —
   * functionally identical in this engine's own fixed phase list, since
   * Cleanup is always the last phase before the next turn's Untap. See
   * `RealCard.attackedThisTurn`'s own doc comment for the real Forge
   * citation and why this is a plain boolean reset, not a turn-number
   * comparison.
   */
  clearAttackedThisTurn(): void {
    for (const card of this.cards.values()) card.attackedThisTurn = false;
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
   *
   * Also checks the real `'CantUntap'` granted keyword (`card.ts`'s own
   * doc comment — Sleep Magic's real "Enchanted creature doesn't untap
   * during its controller's untap step," CR 614.2, `Layer$ CantHappen`)
   * FIRST, before the stun check — genuinely different in kind, not just
   * checked first for convenience: stun is a per-object COUNTER that gets
   * consumed the moment it would've blocked an untap (so the permanent
   * untaps again once every counter is gone); `CantUntap` is an
   * unconditional, always-on lockdown for as long as its granting source
   * (an attached Aura, here) remains attached — nothing is consumed, the
   * event simply never happens, every single time, for as long as the
   * grant applies. No FIN card in this pool combines both on one
   * permanent at once (checked), so there's no real ordering ambiguity to
   * resolve between them today — `CantUntap` returning early first simply
   * means a (hypothetical) permanent with both would neither untap NOR
   * lose its stun counter, an honest simplification given real Forge's
   * own APNAP-ordered multiple-replacement-effect choice isn't modeled
   * here at all (same "no general 614/616 dispatcher" gap as above).
   */
  untap(card: RealCard): void {
    if (effectiveKeywords(this, card).includes('CantUntap')) return;
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
   * end of turn," e.g.); this model's default (`opts.untilEndOfTurn`
   * omitted/false) is still a direct, PERMANENT push onto the card's own
   * `keywords` array — same documentary-approximation category
   * `move`/`destroy`'s own `optional` field already carries for a
   * different nuance (player choice, there; duration, here), unchanged for
   * every existing pool card using this shape. Still a REAL mutation, not
   * just a logged intent: a later `state.destroy`/`state.dealDamage` call
   * genuinely sees the granted Indestructible/Lifelink within the same
   * scenario.
   *
   * `opts.untilEndOfTurn: true` additionally registers the grant in
   * `untilEndOfTurnKeywordGrants` (real 514.2 — Cleanup ends "until end of
   * turn" effects), closing the real phase/turn-boundary reset gap this
   * doc comment used to say didn't exist anywhere — see
   * `clearUntilEndOfTurnKeywordGrants`, called once per real Cleanup entry
   * (`turn.ts`'s `runPhaseEntryAction`, alongside `clearAllDamage`'s own
   * exact same "real, game-wide, once per Cleanup" shape). Opt-in only:
   * every pre-existing `grantKeyword`/`grantKeywordAll`/`grantKeywordTarget`/
   * `grantKeywordSelf` call across the pool keeps its prior permanent-
   * within-scenario behavior unless its own `Effect` explicitly sets
   * `untilEndOfTurn: true`.
   */
  grantKeyword(card: RealCard, keyword: string, opts?: { untilEndOfTurn?: boolean }): void {
    if (!card.keywords.includes(keyword)) card.keywords.push(keyword);
    if (opts?.untilEndOfTurn) this.untilEndOfTurnKeywordGrants.push({ cardId: card.id, keyword });
  }

  /**
   * Real 514.2's "until end of turn" half (the damage-clearing half is
   * `clearAllDamage`, called alongside this at the same real Cleanup
   * entry) — ends every keyword grant registered via `grantKeyword`'s own
   * `opts.untilEndOfTurn: true`, game-wide (any player's permanent, not
   * just the active player's — matching `clearAllDamage`'s own scope, and
   * real 514.2's own "all... effects... end" wording, not "the active
   * player's own"). Removes the keyword from the card's `keywords` array
   * directly (a real mutation, same as the grant itself) rather than
   * leaving it in place and filtering at read time — so it disappears
   * from every consumer at once (`hasKeyword`, `effectiveKeywords`, a raw
   * `card.keywords.includes(...)` read), no separate "temporary keywords"
   * array for callers to remember to also check. A card no longer on the
   * battlefield (already moved to graveyard/exile since the grant) is
   * silently skipped — CR 514.2 only ever mattered while it still had the
   * keyword to lose.
   */
  clearUntilEndOfTurnKeywordGrants(): void {
    for (const { cardId, keyword } of this.untilEndOfTurnKeywordGrants) {
      const card = this.cards.get(cardId);
      if (!card) continue;
      const i = card.keywords.indexOf(keyword);
      if (i !== -1) card.keywords.splice(i, 1);
    }
    this.untilEndOfTurnKeywordGrants = [];
  }

  /** Real per-turn reset for `flippedCoinThisTurn` above (ENGINE_GAPS.md gap #15) — called game-wide at every real Cleanup (`turn.ts`'s `runPhaseEntryAction`, alongside `clearAllDamage`/`clearUntilEndOfTurnKeywordGrants`), same "once per real turn boundary" scope those two already use — matches real Forge's own `Count$YouFlipThisTurn` SVar implicitly resetting every turn (`edgar_king_of_figaro.txt`'s own `SVarCompare$ EQ0` check). */
  resetFlippedCoinThisTurn(): void {
    this.flippedCoinThisTurn.clear();
  }

  /**
   * Real per-turn "how many times has this NAMED trigger fired" tracking
   * (`card.ts`'s own `Trigger.activationLimit` doc comment for the full real
   * Forge citation — `Trigger.java`'s `checkActivationLimit`/
   * `getActivationsThisTurn`, backed by `Card.numberTurnActivations`, reset
   * game-wide by `Game.onCleanupPhase` -> `Card.resetActivationsPerTurn`).
   * Keyed by `${cardId}:${triggerName}` rather than just `cardId` — Forge's
   * own `ActivationLimit` is scoped per NAMED trigger (`Trigger.java`'s own
   * `getOverridingAbility()`-keyed `ActivationTable`), not per card as a
   * whole, so a card with two independently-capped triggers (none in this
   * pool today, but nothing here should assume otherwise) would track them
   * separately. Consulted/incremented by `triggers.ts`'s own shared
   * `fireTrigger` chokepoint, never mutated directly by a card's own effect.
   */
  triggerActivationsThisTurn = new Map<string, number>();

  /** How many times `triggerName` has already fired on `cardId` this turn — see `triggerActivationsThisTurn`'s own doc comment. 0 for a trigger that hasn't fired yet this turn (the common case). */
  triggerActivationsSoFar(cardId: number, triggerName: string): number {
    return this.triggerActivationsThisTurn.get(`${cardId}:${triggerName}`) ?? 0;
  }

  /** Records one more real firing of `cardId`'s `triggerName` this turn — called by `triggers.ts`'s `fireTrigger` immediately before a firing it's allowing through (never for one it gates). */
  recordTriggerActivation(cardId: number, triggerName: string): void {
    const key = `${cardId}:${triggerName}`;
    this.triggerActivationsThisTurn.set(key, (this.triggerActivationsThisTurn.get(key) ?? 0) + 1);
  }

  /** Real per-turn reset for `triggerActivationsThisTurn` above — called game-wide at every real Cleanup (`turn.ts`'s `runPhaseEntryAction`, alongside `resetFlippedCoinThisTurn`/`clearAllDamage`/`clearUntilEndOfTurnKeywordGrants`), same scope as those (real Forge citation: `Game.onCleanupPhase` sweeps `getCardsInGame()` — every card in the game, not just the active player's). */
  resetTriggerActivationsThisTurn(): void {
    this.triggerActivationsThisTurn.clear();
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
   * has. Returns whether life was gained AND (a real, separate axis) whether
   * this call's damage was PREVENTED outright — see `prevented`'s own doc
   * comment below — so callers (harness.ts) can log either as a real,
   * visible fact.
   *
   * `opts.combat` (ENGINE_GAPS.md gap #8, closed for a narrow real subset) —
   * whether THIS damage instance is combat damage (510), the one real axis
   * distinguishing Diamond Weapon's own combat-only shield from Crystal
   * Fragments/Summon: Alexander's own all-damage shield (see the two
   * `Keyword` checks below). Real Forge citations, both real per-object
   * `ReplacementEffect`s (`Event$ DamageDone | Prevent$ True`, general
   * machinery this engine deliberately doesn't have — `ReplacementEffect
   * .java`/`ReplacementHandler.java`, forge-game/.../replacement/ — checked
   * at this ONE real chokepoint instead, same "narrow hook, not a general
   * dispatcher" shape the STUN/FINALITY counter replacements above already
   * establish):
   *  - Diamond Weapon (`res/cardsfolder/d/diamond_weapon.txt`): `R:Event$
   *    DamageDone | Prevent$ True | IsCombat$ True | ValidTarget$
   *    Card.Self` — combat damage ONLY, to itself only. Modeled as a real
   *    `'CombatDamagePrevention'` keyword on its own `keywords` (same
   *    "approximated via the same grant/`hasKeyword` machinery as a real
   *    keyword grant" treatment `'Unblockable'` already establishes — see
   *    that entry's own doc comment, card.ts), checked here gated on
   *    `opts.combat`.
   *  - Crystal Fragments/Summon: Alexander (`res/cardsfolder/c/
   *    crystal_fragments_summon_alexander.txt`): `SVar:RPrevent:Event$
   *    DamageDone | Prevent$ True | ActiveZones$ Command | ValidTarget$
   *    Creature.YouCtrl` — ALL damage (no `IsCombat$` field), to every
   *    creature its controller controls, for the rest of that turn (a real,
   *    turn-scoped effect — `ActiveZones$ Command` is Forge's own "lives in
   *    the Command zone until the turn ends" shape). Modeled as a real
   *    `'DamagePrevention'` keyword GRANTED (`kind:'grantKeywordAll'`,
   *    `untilEndOfTurn: true`) by each of that Saga's own chapter I/II
   *    effects (`cards/crystal-fragments-summon-alexander/definition.ts`) —
   *    reuses the EXISTING real 514.2 until-end-of-turn keyword-grant
   *    machinery (`grantKeyword`/`clearUntilEndOfTurnKeywordGrants` above),
   *    not a new expiry mechanism.
   * Both checked via `effectiveKeywords` (not a raw `target.keywords.includes`
   * read) so a GRANTED shield (Crystal Fragments' own) is just as real as a
   * printed one (Diamond Weapon's own) — same reasoning the Deathtouch/
   * Lifelink checks below already apply.
   */
  dealDamage(target: RealPlayer | RealCard, amount: number, source?: RealCard, opts?: { combat?: boolean }): { lifeGained: number; prevented: boolean } {
    if ('life' in target) {
      target.life -= amount;
    } else {
      const targetKeywords = effectiveKeywords(this, target);
      if (targetKeywords.includes('DamagePrevention') || (opts?.combat && targetKeywords.includes('CombatDamagePrevention'))) {
        return { lifeGained: 0, prevented: true };
      }
      target.damageMarked = (target.damageMarked ?? 0) + amount;
      // `effectiveKeywords`, not a raw `source?.keywords.includes(...)` read
      // (2026-09-12, ENGINE_GAPS.md gap #14) — a GRANTED Deathtouch/Lifelink
      // (Ardyn, the Usurper's own "Demons you control have menace,
      // lifelink, and haste") needs to function for real in combat, not
      // just render as a label; `card.keywords` alone only ever has a
      // permanent's own PRINTED keywords.
      if (amount > 0 && source && effectiveKeywords(this, source).includes('Deathtouch')) target.deathtouchDamaged = true;
    }
    if (source && effectiveKeywords(this, source).includes('Lifelink')) {
      const controller = this.players.get(source.controllerId);
      if (controller) return { lifeGained: this.gainLife(controller, amount), prevented: false };
    }
    return { lifeGained: 0, prevented: false };
  }

  /**
   * The ONE real chokepoint every life-total INCREASE in this engine now
   * routes through (`wrapPlayer.gainLife` below, AND `dealDamage`'s own
   * Lifelink branch above — Lifelink's lifegain is a real `GainLife` event
   * exactly like any other, CR 614.2 doesn't care what caused it) — same
   * "narrow hook at the one real mutation site, not a general dispatcher"
   * shape gap #8's damage shields (`dealDamage`, above) and the STUN/
   * FINALITY counter replacements already establish, closing ENGINE_GAPS.md
   * gap #8b. Real Forge citation: The Wind Crystal's own real script
   * (`res/cardsfolder/t/the_wind_crystal.txt`): `R:Event$ GainLife |
   * ActiveZones$ Battlefield | ValidPlayer$ You | ReplaceWith$ GainDouble ...
   * SVar:X:ReplaceCount$LifeGained/Twice` — a real per-player CR 614.2
   * self-replacement doubling the amount, general `ReplacementEffect`/
   * `ReplacementHandler` machinery (forge-game/.../replacement/) this engine
   * doesn't have, checked here instead. Modeled as a real `'LifegainDouble'`
   * keyword (same `'Unblockable'`-style "approximated via `hasKeyword`
   * machinery" treatment `dealDamage`'s own two shield keywords use above)
   * on any of `player`'s own Battlefield permanents — checked via
   * `effectiveKeywords` per permanent (not just `card.keywords` — a GRANTED
   * copy would count too, though no real FIN card grants this one).
   * Returns the REAL amount actually applied (doubled or not) so a caller
   * can log the true, post-replacement number, not the nominal request.
   */
  gainLife(player: RealPlayer, amount: number): number {
    const doubled = amount > 0 && player.battlefield.some((c) => effectiveKeywords(this, c).includes('LifegainDouble'));
    const applied = doubled ? amount * 2 : amount;
    player.life += applied;
    return applied;
  }

  /**
   * Real, minimal coin-flip RESOLUTION primitive (ENGINE_GAPS.md gap #15) —
   * closing the first of two gaps that section documented (no coin-flip
   * OUTCOME mechanism of any kind previously existed; `event:'coinFlip'`,
   * synergy.ts, only ever modeled the FLIP happening, never its result).
   * Same "no AI/player-decision process — every round's choices are
   * supplied by the caller" convention `priority.ts`'s own header already
   * establishes for a different real decision (a priority pass) — `won` is
   * a real, caller-supplied outcome (this engine has no randomization
   * anywhere, and isn't the place to add dice-rolling infrastructure just
   * for this), NOT computed/randomized here. Real Forge citation for the
   * flip ITSELF: `FlipCoinEffect.java` (forge-game/.../ability/effects/),
   * whose own real per-player result is either genuinely random
   * (`MyRandom.getRandom().nextBoolean()`) or, when a static ability forces
   * one, taken from `StaticAbilityFlipCoinMod.fixedResult(flipper)` instead
   * — this method mirrors exactly that second, fixed-result path (the ONE
   * this engine can model without inventing randomization) via the SAME
   * `'TwoHeadedCoin'` keyword-machinery approximation (`'Unblockable'`-style,
   * see `gainLife`'s own doc comment just above) `dealDamage`'s shields use.
   *
   * Real Forge citation for the "first flip each turn" scoping: Edgar, King
   * of Figaro's own real script (`res/cardsfolder/e/edgar_king_of_figaro.txt`):
   * `S:Mode$ FlipCoinMod | ValidPlayer$ You | CheckSVar$ Count$YouFlipThisTurn
   * | SVarCompare$ EQ0 | Result$ True` — forces a WIN (`Result$ True`) only
   * when `Count$YouFlipThisTurn` reads 0, i.e. this is genuinely the first
   * flip this turn; a later flip the same turn is unaffected, real Forge's
   * own counter having already advanced past 0. `flippedCoinThisTurn`
   * (above) mirrors that same boolean question (has this player flipped at
   * least once this turn already), reset every real Cleanup
   * (`resetFlippedCoinThisTurn`, called from `turn.ts`).
   */
  flipCoin(player: RealPlayer, won: boolean): boolean {
    const isFirstThisTurn = !this.flippedCoinThisTurn.has(player.id);
    this.flippedCoinThisTurn.add(player.id);
    const hasTwoHeadedCoin = player.battlefield.some((c) => effectiveKeywords(this, c).includes('TwoHeadedCoin'));
    return isFirstThisTurn && hasTwoHeadedCoin ? true : won;
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
    // `effectiveSubtypes`, not a raw `real.subtypes.includes(...)` read
    // (2026-09-12, ENGINE_GAPS.md gap #14's own P/T-/type-grant follow-up)
    // — includes any real, live `continuousTypeGrants` this permanent
    // currently qualifies for (e.g. Dragoon's Lance's own equipped-creature
    // "is a Knight" grant), not just this card's own printed subtypes.
    hasSubtype: (subtype: string) => effectiveSubtypes(state, real).includes(subtype),
    // `effectiveKeywords`, not a raw `real.keywords.includes(...)` read
    // (2026-09-12, ENGINE_GAPS.md gap #14) — includes any real, live
    // `continuousKeywordGrants` this permanent currently qualifies for
    // (Dion's own Dragonfire Dive, Ardyn's own Demons grant), not just
    // this card's own printed keywords.
    hasKeyword: (keyword: string) => effectiveKeywords(state, real).includes(keyword),
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
      // `state.gainLife` (ENGINE_GAPS.md gap #8b, closed) — the real
      // chokepoint that applies The Wind Crystal's own CR 614.2 lifegain-
      // doubling replacement, not a bare `real.life += amount` anymore. The
      // boolean return is unchanged (real Forge's own `Player.gainLife` is
      // also `boolean` — "was any life gained," not the amount); a caller
      // wanting the real post-replacement number reads `state.gainLife`
      // directly, or diffs `getLife()` before/after (harness.ts's own
      // `loggingPlayer.gainLife` does the latter, so the trace shows the
      // REAL doubled amount, not the nominal request).
      state.gainLife(real, amount);
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
