import type { CardDefinition, EffectContext, Actions } from './card';
import { resolveCard } from './card';
import type { Card, Player, ZoneType } from './interfaces';
import { GameState, wrapPlayer, wrapCard, effectivePT, type RealCard, type RealPlayer } from './state';
import { fireTrigger } from './triggers';
import { PHASES, currentPhase, advancePhase, type Phase, type TurnState } from './turn';
import { TOKENS } from './tokens';
import type { BasicLandName } from './mana';

/**
 * One card's own test scenario — plain data describing a board state to run
 * the card's effects against, not a pre-built mock object. Counts, not
 * actual card lists: a scenario only needs to say "3 creature cards in the
 * graveyard," the harness below manufactures real cards to match (see
 * functional-model/state.ts — these are now REAL, mutable game objects,
 * not disposable static snapshots).
 * Lives at functional-model/cards/<slug>/scenarios.ts, one array per card.
 */
/** One step of a `Scenario.sequence` richer than a bare trigger name — see that field's own doc comment. Exactly one of `trigger`/`ability`/`activate` should be set. */
export interface SequenceStep {
  /** Fires this named trigger (`resolveCard(..., triggerName)`), same as a bare string entry. */
  trigger?: string;
  /** Runs this named entry from `card.abilities` (`resolveCard(..., undefined, abilityName)`). */
  ability?: string;
  /** Runs the card's own `activationCost`-gated `effects` (`resolveCard` with no trigger/ability name) — the single-ability common case `lifecycleBefore`'s own top-level `card.activationCost` branch already covers, just mid-sequence. */
  activate?: boolean;
  /** Which face's `CardDefinition` this step resolves against — omit to keep whatever face the PREVIOUS step (or the scenario's own opening move) used. Set once, right when a transform actually happens (Jill's own "activate" step doesn't need this; the FOLLOWING `chapterI` step does, `face:'back'`). */
  face?: 'front' | 'back';
}

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
  /**
   * Forces the real cast->enters lifecycle for a permanent whose own
   * `card.activationCost` (an Equip cost, e.g.) would otherwise make
   * `lifecycleBefore`/`selfZone` (below) unconditionally treat EVERY
   * scenario for it as "this card's activated ability is what's being
   * tested" — genuinely correct for a card whose only testable behavior
   * IS that ability, but wrong for a Job-select Equipment (or any other
   * permanent) whose real ETB trigger deserves its own real cast/enters
   * trace evidence too (2026-09-12 fix, dragoon-s-lance's own regression:
   * "make it use cast, not just some mythical enter" — see
   * `isActivationCostPermanentBaselineFact`, verify-synergy.mjs, for the
   * structural gap this closes). When set: `lifecycleBefore` emits a real
   * `cast` (not `activate`), `selfZone` starts `self` on the Stack (not
   * already on the Battlefield), `lifecycleAfter` emits a real `enters`,
   * AND the top-level `resolveCard` call that would otherwise run
   * `card.effects` (this permanent's activated-ability effects, gated by
   * its `activationCost` — never a bare cast's own "spell effect", see
   * card.ts's own resolveCard doc comment) is skipped entirely: nothing
   * should fire from `card.effects` until a real `sequence` step's
   * `activate:true` explicitly runs it later, same real payment semantics
   * the card's own printed activation cost requires. Combine with
   * `sequence` (an `onEnter`-named trigger step, then `{activate:true}`)
   * for one continuous real cast -> enters -> ETB trigger -> real
   * activation story. Omit for the common case (a card whose own
   * `activationCost`-gated ability IS the only thing a scenario tests).
   */
  forceCast?: boolean;
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
  /** Real "if it's the first end step/combat phase of the turn" (ENGINE_GAPS.md gap #17) — see card.ts's own `EffectContext.firstPhaseGroupOccurrenceThisTurn` doc comment. Omit (or `false`) for a scenario demonstrating the "not the first occurrence" branch (Y'shtola Rhul's own second end step, e.g. — no additional end step queued). */
  firstPhaseGroupOccurrenceThisTurn?: boolean;
  /**
   * Fires MULTIPLE named triggers in order, one `resolveCard` call each,
   * against ONE shared `GameState` — the "joint-scenario driver" this
   * file's own `runScenario` doc comment already anticipated ("nothing
   * calls it that way yet"). Built for a real Saga's own real 714.3a/b
   * chapter sequence (Summon: Bahamut's own "I, II — Destroy...", "III —
   * Draw...", "IV — Mega Flare...", one scenario per chapter previously,
   * per the user's own request: "we only need one scenario... all
   * triggers will be there") rather than one scenario per chapter — real
   * lore-counter/turn tracking still isn't modeled (this doesn't simulate
   * 3 real turns passing, it just fires each named trigger back-to-back),
   * so a card whose chapter timing genuinely matters (an effect reading
   * `getCounters('lore')`, e.g.) still needs turn-level fidelity this
   * doesn't provide — a documentary shortcut for "all these triggers
   * really do fire in this order over the game," not a real turn
   * simulator. Mutually exclusive with `trigger`/`ability` (ignored if
   * `sequence` is set).
   *
   * A bare string is shorthand for `{ trigger: name }` against the same
   * face `runScenario` already resolved for the whole scenario (Summon:
   * Bahamut's own single-faced case). A step object additionally covers a
   * transforming DFC whose own real arc crosses BOTH faces within one
   * scenario (Jill, Shiva's Dominant // Shiva, Warden of Ice's own "enters,
   * ETB fires, later activates its own transform, then the BACK face's own
   * Saga chapters fire" — `card.effects` on either face for `activate`,
   * `card.backFace`'s own `triggers` once `face:'back'` is set on a later
   * step). `ability`/`activate` reuse the same real cost-paying semantics
   * `lifecycleBefore`'s own top-level ability/activationCost branches use,
   * just mid-sequence instead of as the scenario's own opening move.
   */
  sequence?: (string | SequenceStep)[];
  /**
   * Real 704.5x — a Saga (or any "sacrifice this" self-rule) with no
   * ability of its own text to blame is sacrificed as a rule action, not a
   * card effect (`card.effects`/`triggers` shouldn't own it) — set after a
   * `sequence` reaches its final named chapter (Summon: Bahamut's own
   * "Sacrifice after IV," fired the same real way `sacrifice` already logs
   * for any other card, so a `{zone:'Graveyard', subject:'self'}`/
   * `{event:'dies', target:'self'}` produce fact gets real supporting
   * evidence instead of none).
   */
  sacrificeSelfAfter?: boolean;
  /**
   * Names of triggers (within `sequence`, or the single `trigger`) where an
   * `optional` effect should genuinely decline rather than take whatever
   * `chooseTarget` would deterministically pick — real `EffectContext
   * .declineOptional` (card.ts), set fresh before each named trigger fires.
   * Summon: Bahamut's own reference case: chapter I/II's "destroy up to one
   * target nonland permanent" would otherwise always hit Bahamut itself
   * (self is unavoidably the first candidate in an unrestricted pool — see
   * card.ts's own `EffectContext.declineOptional` doc comment for why), so a
   * scenario demonstrating the common, sane line (don't blow yourself up)
   * needs a real way to say "this one whiffs," not just "no legal target
   * existed."
   */
  declineTriggers?: string[];
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
   * A synthetic probe, same shape as `dealsCombatDamage` above — the
   * controller gains `amount` life from some unspecified real source,
   * independent of anything a card authors (real MTG has plenty of ordinary
   * lifegain a permanent's own text never causes directly — a land, another
   * spell, etc.). Exists so a card with no `kind:'gainLife'` effect of its
   * own but a real CR 614.2 lifegain-doubling REPLACEMENT (The Wind
   * Crystal's own "If you would gain life, you gain twice that much life
   * instead," ENGINE_GAPS.md gap #8b) is still genuinely scenario-testable
   * — same reasoning `dealsCombatDamage` already established for Lifelink.
   * Real trace evidence either way: `harness.ts`'s own `loggingPlayer
   * .gainLife` logs the REAL, post-replacement amount (diffed off actual
   * life before/after, not the nominal request), so a doubling permanent's
   * own trace genuinely shows double the requested amount.
   */
  playerGainsLife?: { amount: number };
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
  /** Artifact graveyard cards specifically — same "real typed candidate to find" convention `libraryArtifactCount` already establishes for the Library zone, added for Delivery Moogle's own real "search your library and/or graveyard for an artifact card" (the graveyard half of a genuine two-zone search — `graveyardCreatureCount` alone can't seed a candidate that `isArtifact()` actually recognizes). NOT included in `graveyardCreatureCount` (the two are independent candidate pools, unlike `libraryArtifactCount`'s "included in libraryCount" convention — a graveyard has no single combined "how many cards" count field to be included IN). */
  graveyardArtifactCount?: number;
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
  /**
   * A specific-NAMED library card, INCLUDED in `libraryCount` (same
   * convention as `libraryArtifactCount`/`libraryLandCount`/
   * `librarySubtypeCount` above) — added for Magitek Infantry's own real
   * "Search your library for a card named Magitek Infantry" (CR 702's
   * genuinely NAME-based tutor, not type/subtype-based — none of the
   * existing typed/subtyped fields above can be individually addressed by
   * exact NAME the way this effect's own `getName() === ...` filter needs).
   * Paired fields since, unlike a fixed type, the name varies per card —
   * same "paired, not a bare count" shape `librarySubtypeCount`/
   * `librarySubtype` already establish for the identical reason.
   */
  libraryNamedCount?: number;
  libraryNamedCard?: string;
  /** Equipment cards on the battlefield specifically, INCLUDED in `artifactsCount` (same convention) — Adelbert Steiner's own live-recalculated `ptFormula` (state.ts's own real layer-7a CDA) needs real Equipment permanents on the controller's battlefield to count. */
  equipmentCount?: number;
  /**
   * One or more SPECIFIC, real, named nontoken creatures seeded onto this
   * player's Battlefield, IN ADDITION to `creaturesCount`/etc above (2026-
   * 09-12, added for Phoenix Down's own real regression: its own mode-1
   * scenario needed a real Skeleton/Spirit/Zombie to exile, but
   * `creatureSubtypes` only ever tags the SAME `GENERIC_FILLER_CREATURE`
   * ("Grizzly Bears," a real, specific, recognizable Scryfall card that is
   * NOT actually any of those subtypes) — a real "not mocked" violation:
   * claiming a real, identifiable card has a subtype it doesn't really
   * have, caught live by the user: "exiles grizzly bear as a zombie (even
   * though it's not a zombie...)"). Unlike `creatureSubtypes` (a synthetic,
   * nameless filler bucket, fine when NO specific card identity matters),
   * this seeds a card with its OWN real name/subtypes/P-T — same "give it
   * a real Scryfall identity" bar `tokens`/`libraryNamedCard` above already
   * hold scenario setup to. Prefer this over `creaturesCount`+
   * `creatureSubtypes` whenever a scenario's own real card text names a
   * SPECIFIC creature TYPE it needs a real example of (a genuine Zombie,
   * not a bear wearing a zombie label) — `creatureSubtypes` stays correct
   * and unchanged for the common case where no single candidate's own real
   * identity matters, only a countable pool of "creatures with subtype X."
   * Deliberately NOT retrofitted pool-wide in this same pass — many other
   * `creatureSubtypes` uses have the exact same underlying simplification,
   * but replacing all of them is a separate, larger task, not a one-card
   * regression fix (see SYNERGY_DESIGN.md's own dated entry).
   */
  creatureCards?: { name: string; subtypes?: string[]; power?: number; toughness?: number }[];
  /**
   * Real, named tokens (`functional-model/tokens.ts`'s own Scryfall-backed
   * registry — an actual Food/Treasure/Hero/Rabbit/Sword/etc, not a bare
   * placeholder count) seeded onto this player's Battlefield, ONE each, IN
   * ADDITION to whatever `creaturesCount`/`artifactsCount`/etc above also
   * specify — independent, not a replacement for them. User: "why not just
   * add actual permanents to the scenario? I don't like the idea of
   * remembering all these mocks... AI would figure — this food/treasure/
   * hero was there from the start" — a scenario's own replay (app/lib/
   * scenarioReplay.ts) can show a REAL card image for one of these, unlike
   * a `-creature-token-0`-style filler which has no Scryfall identity to
   * look an image up by. Same key vocabulary `createToken`'s own `token`
   * field uses elsewhere (`TokenInfo`), reused here for setup instead of a
   * resolved effect. Prefer this over `creaturesCount`/`artifactsCount`
   * going forward for a NEW scenario needing filler permanents — the count
   * fields stay for scenarios that don't care what's actually there (a pool
   * size, not a specific identity) or predate this field.
   */
  tokens?: (keyof typeof TOKENS)[];
  /** A real basic land name seeded onto this player's Battlefield, same "real name, real image" reasoning as `tokens` above — independent of, and in addition to, `landsCount`. */
  basicLands?: BasicLandName[];
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
  scenario: {
    setup: string;
    action: string;
    result: string;
    /**
     * The scenario's own structured input, verbatim — `setup` above is just
     * its rendered prose (`describeSetup`), which a client can read but not
     * parse back into real counts/life. Frontend replay UI (scenario tab's
     * board reconstruction) needs the real `you`/`opponents`/`life` fields
     * to seed initial zones the way `setupPlayer` (above) built them —
     * those never otherwise reach anything downstream of `runScenario`.
     */
    raw: Scenario;
  };
  log: LogEntry[];
  /**
   * A coarser, human-labeled index into `log` — real engine-piloted traces
   * only (engine-trace.ts's own `pilot.beginStep`/`finishEnginePilotTrace`);
   * a flat harness.ts scenario has no equivalent concept, so this stays
   * undefined for one. `from` is where THIS action's own log entries start;
   * an action's end is never stored (nothing here predicts what a step
   * will produce) — a reader derives it as `(actions[i+1]?.from ??
   * log.length) - 1`.
   */
  actions?: { label: string; from: number }[];
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
  if (ps.graveyardArtifactCount) parts.push(`${whose} ${ps.graveyardArtifactCount} artifact(s) in graveyard`);
  const plainLibrary = (ps.libraryCount ?? 0) - (ps.libraryArtifactCount ?? 0) - (ps.libraryLandCount ?? 0) - (ps.librarySubtypeCount ?? 0) - (ps.libraryNamedCount ?? 0);
  if (plainLibrary > 0) parts.push(`${whose} ${plainLibrary} card(s) in library`);
  if (ps.libraryArtifactCount) parts.push(`${whose} ${ps.libraryArtifactCount} artifact(s) in library`);
  if (ps.libraryLandCount) parts.push(`${whose} ${ps.libraryLandCount} land(s) in library`);
  if (ps.librarySubtypeCount) parts.push(`${whose} ${ps.librarySubtypeCount} ${ps.librarySubtype ?? 'subtype'}(s) in library`);
  if (ps.libraryNamedCount) parts.push(`${whose} ${ps.libraryNamedCount} card(s) named "${ps.libraryNamedCard ?? '?'}" in library`);
  if (ps.creatureCards?.length) parts.push(`${whose} a ${ps.creatureCards.map((c) => c.name).join(', ')}`);
  if (ps.tokens?.length) parts.push(`${whose} a ${ps.tokens.map((k) => TOKENS[k]!.name).join(', ')}`);
  if (ps.basicLands?.length) parts.push(`${whose} a ${ps.basicLands.join(', ')}`);
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
  else if (card.activationCost && !scenario.forceCast) parts.push(`activated (${card.activationCost})`);
  else if (/\bLand\b/.test(card.typeLine)) parts.push('played as a land (CR 305 special action)');
  else {
    const castFrom = scenario.castFrom ?? 'hand';
    parts.push(castFrom === 'hand' ? 'cast from hand' : `cast from ${castFrom}`);
  }
  if (scenario.mode !== undefined) parts.push(`mode ${scenario.mode} chosen`);
  if (scenario.xPaid !== undefined) parts.push(`X=${scenario.xPaid}`);
  if (scenario.face === 'back') parts.push('back face');
  if (scenario.dealsCombatDamage) parts.push(`deals ${scenario.dealsCombatDamage.amount} combat damage`);
  if (scenario.playerGainsLife) parts.push(`gains ${scenario.playerGainsLife.amount} life`);
  if (scenario.duplicateLegendaryEnters) parts.push('a duplicate legendary copy enters');
  if (scenario.firstPhaseGroupOccurrenceThisTurn !== undefined) {
    parts.push(scenario.firstPhaseGroupOccurrenceThisTurn ? "it's the first occurrence of this phase this turn" : 'a later occurrence of this phase this turn');
  }
  return parts.join(', ');
}

// ---------------------------------------------------------------------------
// Real board setup from a Scenario's plain-data PlayerState — pushes real
// RealCard objects into a real RealPlayer's real zone arrays (see state.ts).
// Same generic-object conventions the old static mocks used (a "creature"
// is just a card whose `types` includes 'Creature'), just backed by real,
// mutable objects now instead of throwaway snapshots.

/**
 * The plain, untyped hand/library filler (below) used to be a synthetic
 * `${owner}-hand-${i}`/`${owner}-library-${i}` placeholder with no real
 * card identity at all — nothing in this pool ever addresses one of these
 * individually by name (every effect that needs to find ONE SPECIFIC card
 * among many fillers already uses a dedicated typed/subtyped category
 * instead — libraryArtifactCount/libraryLandCount/librarySubtypeCount, all
 * still their own thing, untouched), so giving them a REAL identity is a
 * free upgrade: a card actually drawn now looks like a real card (with real
 * art) instead of a generic "?" placeholder. One fixed land (not a
 * per-index rotation across several) — deliberately, so N of them collapse
 * onto one grouped "×N" display chip (same fungible-merge every other
 * same-named pile already gets) instead of spreading across several
 * ungrouped single-count stacks.
 */
export const GENERIC_FILLER_LAND = 'Forest';

/**
 * Same "give it a real Scryfall identity" upgrade as `GENERIC_FILLER_LAND`
 * above, for the OTHER numeric filler bucket that used to have none at
 * all: `PlayerState.creaturesCount`/`nontokenCreaturesCount`'s own
 * battlefield fillers, previously named a bare, imageless
 * `${owner}-creature-token-${i}`/`${owner}-creature-nontoken-${i}`. A real,
 * plain vanilla 2/2 green Bear with no rules text of its own to
 * accidentally imply — nothing in this pool ever addresses one of these by
 * exact name either (same "no card singles one out individually" reasoning
 * GENERIC_FILLER_LAND's own doc comment gives; every effect that needs to
 * find ONE SPECIFIC filler among many already uses a typed/subtyped
 * category instead, same as there). One fixed creature (not a
 * per-index/per-bucket rotation, and the SAME one for both the token and
 * nontoken loops below) so N of them still collapse onto one grouped "×N"
 * display chip — `isTokenCard` (state.ts), not the name, is what a real
 * effect like Gaius van Baelsar's own `tokenFilter:'nontoken'` actually
 * keys off, so sharing one name across both loops doesn't blur that
 * distinction anywhere real logic reads it. Also reused (2026-09-12) for
 * `graveyardCreatureCount`'s own Graveyard-zone filler, previously a
 * separate synthetic `${n}-gy-creature-${i}` — checked pool-wide first: no
 * scenario ever seeds this bucket alongside a battlefield filler creature
 * for the SAME player in the SAME scenario, so the two buckets sharing one
 * name never blurs an in-scenario distinction, and a reanimation-style
 * effect that moves this card Graveyard->Battlefield now lands as the
 * SAME identity the other battlefield fillers already use instead of a
 * mismatched second name.
 */
export const GENERIC_FILLER_CREATURE = 'Grizzly Bears';

/**
 * Same "give it a real Scryfall identity" upgrade as `GENERIC_FILLER_LAND`/
 * `GENERIC_FILLER_CREATURE` above, for the plain (non-Equipment)
 * `PlayerState.artifactsCount` battlefield filler, previously a bare,
 * imageless `${owner}-artifact-${i}` — caught live (2026-09-12) on
 * Restoration Magic's own Curaga scenario, whose "permanents you control"
 * scope needs a real artifact alongside the real filler creature: the
 * imageless placeholder rendered as a stub "Ar" chip in the replay UI, easy
 * to mistake for a fabricated non-real card name (the exact "real not
 * mocked" violation this pool otherwise guards against) even though the
 * NAME itself was never asserted as a real card anywhere. A real, simple,
 * widely-reprinted mana rock with nothing a scenario ever singles out by
 * name (same "no card addresses one of these individually" reasoning
 * GENERIC_FILLER_LAND/GENERIC_FILLER_CREATURE's own doc comments give) —
 * `equipmentCount`'s own separate bucket (still `${owner}-equipment-${i}`)
 * and the other synthetic buckets below (enchantments, graveyard/library
 * fillers, battlefield `landsCount`) are OUT of scope for this fix; each
 * would need its own real-identity pick if a future scenario surfaces the
 * same "Ar"-style symptom for one of them.
 */
export const GENERIC_FILLER_ARTIFACT = 'Mind Stone';

/** Exported (visibility only, same behavior) so `engine-trace.ts` can build a real engine-piloted trace off the SAME board-setup logic instead of re-deriving it — see that file's own header. */
export function setupPlayer(state: GameState, real: RealPlayer, ps: PlayerState = {}): void {
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
      // A real Scryfall identity, not a synthetic imageless placeholder —
      // see GENERIC_FILLER_CREATURE's own doc comment.
      name: GENERIC_FILLER_CREATURE,
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
      name: GENERIC_FILLER_CREATURE,
      isTokenCard: true,
      types: ['Creature'],
      subtypes: ps.creatureSubtypes,
      basePower: ps.creaturePower,
      baseToughness: ps.creaturePower,
    });
  }
  // Real, specifically-named nontoken creatures (see `PlayerState.
  // creatureCards`'s own doc comment) — a real Scryfall identity with its
  // OWN real subtypes/P-T, not the shared `GENERIC_FILLER_CREATURE` label.
  for (const c of ps.creatureCards ?? []) {
    state.addCard(real, 'Battlefield', {
      name: c.name,
      isTokenCard: false,
      types: ['Creature'],
      subtypes: c.subtypes,
      basePower: c.power ?? 1,
      baseToughness: c.toughness ?? 1,
    });
  }
  // Real named tokens/basic lands (see `PlayerState.tokens`'s own doc
  // comment) — `createToken` is the SAME real path a card's own token-
  // creating effect uses (state.ts), not a parallel conversion.
  for (const key of ps.tokens ?? []) state.createToken(real, TOKENS[key], 1);
  for (const landName of ps.basicLands ?? []) {
    state.addCard(real, 'Battlefield', { name: landName, isTokenCard: false, types: ['Land'], subtypes: [landName] });
  }
  const equipment = ps.equipmentCount ?? 0;
  for (let i = 0; i < equipment; i++) {
    state.addCard(real, 'Battlefield', { name: `${n}-equipment-${i}`, types: ['Artifact'], subtypes: ['Equipment'] });
  }
  const plainArtifacts = Math.max(0, (ps.artifactsCount ?? 0) - equipment);
  for (let i = 0; i < plainArtifacts; i++) {
    // A real Scryfall identity, not a synthetic imageless placeholder — see
    // GENERIC_FILLER_ARTIFACT's own doc comment.
    state.addCard(real, 'Battlefield', { name: GENERIC_FILLER_ARTIFACT, isTokenCard: false, types: ['Artifact'] });
  }
  for (let i = 0; i < (ps.enchantmentsCount ?? 0); i++) {
    state.addCard(real, 'Battlefield', { name: `${n}-enchantment-${i}`, types: ['Enchantment'] });
  }
  for (let i = 0; i < (ps.graveyardCreatureCount ?? 0); i++) {
    // Same real Scryfall identity as the battlefield filler — see
    // GENERIC_FILLER_CREATURE's own doc comment (checked pool-wide: no
    // scenario ever seeds this bucket alongside a battlefield filler
    // creature for the SAME player in the SAME scenario, and reanimation-
    // style effects that move this card Graveyard->Battlefield actually
    // WANT it to land as the same "Grizzly Bears" identity the other
    // battlefield fillers already use, not a mismatched second name).
    state.addCard(real, 'Graveyard', { name: GENERIC_FILLER_CREATURE, isTokenCard: false, types: ['Creature'] });
  }
  for (let i = 0; i < (ps.graveyardArtifactCount ?? 0); i++) {
    state.addCard(real, 'Graveyard', { name: `${n}-gy-artifact-${i}`, types: ['Artifact'] });
  }
  for (let i = 0; i < (ps.landsCount ?? 0); i++) {
    state.addCard(real, 'Battlefield', { name: `${n}-land-${i}`, types: ['Land'] });
  }
  for (let i = 0; i < (ps.handCount ?? 0); i++) {
    // A real basic land, not a synthetic untyped placeholder — see
    // GENERIC_FILLER_LAND's own doc comment.
    state.addCard(real, 'Hand', { name: GENERIC_FILLER_LAND, isTokenCard: false, types: ['Land'], subtypes: [GENERIC_FILLER_LAND] });
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
  const libraryNamed = ps.libraryNamedCount ?? 0;
  for (let i = 0; i < libraryNamed; i++) {
    // No fixed type — a genuine name-based search (Magitek Infantry's own
    // "a card named Magitek Infantry") filters by `getName()` alone, so an
    // untyped card is honest here; a card whose own effect ALSO needs a
    // real type on the found card can layer that on later, same as the
    // typed fields above each grew independently when a real card needed
    // them.
    state.addCard(real, 'Library', { name: ps.libraryNamedCard ?? `${n}-library-named-${i}`, types: [] });
  }
  const libraryPlain = Math.max(0, (ps.libraryCount ?? 0) - libraryArtifacts - libraryLands - librarySubtyped - libraryNamed);
  for (let i = 0; i < libraryPlain; i++) {
    // Real basic land, not a synthetic placeholder — see the `handCount`
    // loop above's own doc comment (same reasoning applies here).
    state.addCard(real, 'Library', { name: GENERIC_FILLER_LAND, isTokenCard: false, types: ['Land'], subtypes: [GENERIC_FILLER_LAND] });
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

/** Exported (visibility only) for `engine-trace.ts` — see `setupPlayer`'s own export note just above. */
export function typesFromTypeLine(typeLine: string): string[] {
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
/** Exported (visibility only) for `engine-trace.ts` — see `setupPlayer`'s own export note above. */
export function subtypesFromTypeLine(typeLine: string): string[] {
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
/** Exported (visibility only) for `engine-trace.ts` — see `setupPlayer`'s own export note above. */
export function loggingCard(state: GameState, real: RealCard, log: LogEntry[]): Card {
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

/** Exported (visibility only) for `engine-trace.ts` — see `setupPlayer`'s own export note above. */
export function loggingPlayer(state: GameState, real: RealPlayer, log: LogEntry[]): Player {
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
      // Real amount actually applied — `real.life` before/after, not the
      // nominal `amount` requested — so The Wind Crystal's own real CR
      // 614.2 lifegain-doubling replacement (`state.gainLife`, ENGINE_GAPS.md
      // gap #8b) shows up as genuine trace evidence rather than being
      // silently invisible behind `base.gainLife`'s unchanged boolean
      // return (real Forge's own `Player.gainLife` is also boolean — "was
      // any life gained," never the amount, so that return value itself
      // can't carry this). `requestedAmount` is only added when it
      // genuinely differs (additive field, `.claude/contracts/state-event-
      // format.md`) — every card with no lifegain-doubler on the
      // battlefield logs the exact same shape as before this pass.
      const before = real.life;
      const ok = base.gainLife(amount);
      const applied = real.life - before;
      log.push(applied !== amount ? { fn: 'gainLife', player: name, amount: applied, requestedAmount: amount } : { fn: 'gainLife', player: name, amount });
      return ok;
    },
    loseLife: (amount: number) => {
      const result = base.loseLife(amount);
      log.push({ fn: 'loseLife', player: name, amount });
      return result;
    },
    drawCard: () => {
      const result = base.drawCard();
      log.push({ fn: 'drawCard', player: name, card: result[0]?.getName() });
      return result.map(toLogging);
    },
    drawCards: (n: number) => {
      const result = base.drawCards(n);
      log.push({ fn: 'drawCards', player: name, n, cards: result.map((c) => c.getName()) });
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
    addMana: (color: string, amount: number) => {
      base.addMana(color, amount);
      log.push({ fn: 'addMana', player: name, color, amount });
    },
  } as unknown as Player;
}

/** Exported (visibility only) for `engine-trace.ts` — see `setupPlayer`'s own export note above. */
export function loggingActions(state: GameState, log: LogEntry[], selfId: number): Actions {
  const cardOf = (c: Card): RealCard => state.cards.get(c.getId() as number)!;
  const playerOf = (p: Player): RealPlayer => state.players.get(p.getId() as number)!;
  return {
    createToken: (controller, token, qty = 1, opts) => {
      const made = state.createToken(playerOf(controller), token, qty, opts);
      const isCreatureToken = token.types.includes('Creature');
      log.push({
        fn: 'createToken',
        controller: controller.getName(),
        token: token.name,
        qty,
        tapped: !!opts?.tapped,
        power: isCreatureToken ? token.basePower : undefined,
        toughness: isCreatureToken ? token.baseToughness : undefined,
      });
      return made.map((c) => loggingCard(state, c, log));
    },
    pump: (target, power, toughness, opts) => {
      const name = 'getName' in target ? target.getName() : String(target);
      const isCard = 'getId' in target && !('getLife' in target);
      if (isCard) state.pump(cardOf(target as Card), power, toughness, opts);
      // `id` — real per-instance identity (2026-09-12, real regression fix:
      // see `putCounter`'s own doc comment below for the full incident).
      // `untilEndOfTurn` (2026-09-14) — same field/convention `grantKeyword`'s
      // own log entry already established (`|| undefined` so an unset one
      // still serializes as a present-but-undefined key rather than a
      // differently-shaped entry).
      log.push({ fn: 'pump', target: name, id: isCard ? (target as Card).getId() : undefined, power, toughness, untilEndOfTurn: opts?.untilEndOfTurn || undefined });
    },
    moveTo: (target, zone) => {
      const real = cardOf(target);
      // Real 111.7/704.5d: a TOKEN leaving the battlefield ceases to exist
      // entirely rather than actually reaching `zone` (`state.move`'s own
      // doc comment) — captured BEFORE the move call, since `state.move`
      // deletes the token from `state.cards` (its own fields stay readable
      // on this still-referenced object afterward, but its `.zone` no
      // longer gets updated to `zone` the way a real move's would). Logging
      // a plain `moveTo` here regardless would claim it really reached
      // `zone` (a bounced Treasure TOKEN "returned to hand" and just sat
      // there) when it actually vanished — confirmed the hard way against
      // Jill's own real ETB bounce.
      const ceasesToExist = real.zone === 'Battlefield' && zone !== 'Battlefield' && real.isTokenCard;
      const controller = state.players.get(real.controllerId)!.name;
      state.move(real, zone);
      if (ceasesToExist) {
        // `zone` — the destination the effect actually TARGETED, kept even
        // though the token never reached it — verify-synergy.mjs still
        // needs it to match a card's own declared "returns to hand"-shaped
        // produce fact (the effect really did try to move it there; 111.7
        // ceasing to exist is a downstream consequence of THIS target being
        // a token, not evidence the effect didn't attempt the move).
        log.push({ fn: 'ceasesToExist', target: target.getName(), id: real.id, zone, controller });
        return;
      }
      // Real controller, not a name-string guess — needed now that a target
      // can be a real, unprefixed card/token name (see `PlayerState.tokens`'s
      // own doc comment): verify-synergy.mjs's own `sideOfName` heuristic
      // only works when a filler's name carries its owner as a string
      // prefix, which a real Scryfall identity never does.
      log.push({ fn: 'moveTo', target: target.getName(), id: real.id, zone, controller });
    },
    // Quiet, same reasoning as mockCreature's predicate methods used to be:
    // WHICH specific object got picked is pure targeting mechanics, not a
    // game-state fact. The real consequence (a card actually moving zones,
    // etc.) still logs via whatever action is called on the chosen target
    // right after this. `predicate` is a real player's own manual pick
    // (`EffectContext.preferTarget`, threaded through by every `card.ts`
    // call site) — not automated/weighed selection (see that field's own
    // doc comment), just an optional override of the old unconditional
    // `pool[0]` default, which stays the fallback when unset or nothing
    // in `pool` matches.
    chooseTarget: (pool, predicate) => (predicate && pool.find(predicate)) || pool[0]!,
    move: (player, from, to, qty, validType, subtype, maxCmc) => {
      const real = playerOf(player);
      const zoneArr = (zone: ZoneType) => (zone === 'Hand' ? real.hand : zone === 'Library' ? real.library : zone === 'Graveyard' ? real.graveyard : zone === 'Battlefield' ? real.battlefield : real.exile);
      // `from: ZoneType | ZoneType[]` (2026-09-15, Delivery Moogle's own
      // real two-zone "library and/or graveyard" search) — normalized to
      // an array here (a bare scalar becomes a one-element array), then
      // every named zone's own real card array is concatenated into ONE
      // combined pool, same "union, not one pick per zone" real CR 701.19
      // behavior `card.ts`'s own `case 'move'` targeted branch already
      // established for this same field.
      const fromZones = Array.isArray(from) ? from : [from];
      const fromArr = fromZones.flatMap(zoneArr);
      // Type-checked via `loggingCard` (not raw `effectiveTypes(c)`) so a
      // land/creature/artifact-typed search logs real `read:*` evidence per
      // candidate — same fix `sacrifice`'s own `matches` already got, for
      // the same reason: this used to bypass the logged Card interface
      // entirely, leaving declarative `move`-effect wants (library searches
      // like `reach-the-horizon`'s own) with zero trace evidence for
      // verify-synergy.mjs to check against.
      const matches = (c: RealCard) => {
        if (subtype) {
          // Real, narrower search (2026-09-15, `move.subtype`'s own doc
          // comment — `Cloud, Midgar Mercenary`'s own tutor-Equipment):
          // reuses `hasSubtype` the SAME way the pre-existing TARGETED
          // branch's own `subtype` filter already does (`card.ts`'s own
          // `case 'move'`, `target:true` path), via the logged `Card`
          // interface so this still emits real `read:hasSubtype` evidence.
          if (!loggingCard(state, c, log).hasSubtype(subtype)) return false;
        }
        // `maxCmc` (2026-09-15, Delivery Moogle's own real "mana value 2
        // or less") — same real `Card.getCMC()` read every other CMC
        // check in this file already uses, via `loggingCard` so this still
        // emits real `read:getCMC` evidence.
        if (maxCmc !== undefined && loggingCard(state, c, log).getCMC() > maxCmc) return false;
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
      log.push({ fn: 'move', player: player.getName(), from, to, qty, validType, subtype, ...(maxCmc !== undefined ? { maxCmc } : {}) });
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
      const discarded = state.discard(playerOf(player), qty);
      log.push({ fn: 'discard', player: player.getName(), qty, cards: discarded.map((c) => c.name) });
    },
    // Real 601.2/701.19 "then shuffle" (`move`'s own `shuffleAfter` field,
    // card.ts, ENGINE_GAPS.md gap #23) — a genuine Fisher-Yates reorder
    // (`state.shuffleLibrary`), not a documentary no-op.
    shuffleLibrary: (player) => {
      state.shuffleLibrary(playerOf(player));
      log.push({ fn: 'shuffleLibrary', player: player.getName() });
    },
    // `state.mill` (ENGINE_GAPS.md gap #19, closed) — a real, dedicated
    // library->graveyard batch move, distinct from `move` above, and the
    // one real chokepoint a genuine CR 614.2 mill-doubling replacement (The
    // Water Crystal's own "mill that many plus four instead") can hook
    // into. `requestedQty` mirrors `gainLife`'s own `requestedAmount`
    // convention immediately below (additive, only present when the real
    // applied qty differs from what was asked for — either a real
    // replacement bump or a real library running out; both are genuine,
    // checkable reasons, not distinguished further here).
    mill: (player, qty) => {
      const real = playerOf(player);
      const milled = state.mill(real, qty);
      log.push(milled.length !== qty ? { fn: 'mill', player: player.getName(), qty: milled.length, requestedQty: qty } : { fn: 'mill', player: player.getName(), qty });
      return milled.map((c) => loggingCard(state, c, log));
    },
    putCounter: (target, counterType, amount) => {
      const real = cardOf(target);
      state.putCounter(real, counterType, amount);
      // Real controller, same reasoning as `moveTo`/`destroy` above — needed
      // now that GENERIC_FILLER_LAND (33bfbaa) gives BOTH players' fungible
      // filler/basic lands the same bare name, so a replay can't otherwise
      // tell which player's same-named permanent this counter landed on.
      //
      // `id` — real, stable per-instance identity (`RealCard.id`), added
      // 2026-09-12 alongside every other per-instance action below: a real
      // regression, caught live on The Crystal's Chosen's own scenario
      // replay ("counters look incorrect" — one Grizzly Bears got 2
      // counters, the other 0, instead of 1 each). Root cause: once
      // GENERIC_FILLER_CREATURE/dynamically-created tokens gave MULTIPLE
      // real, distinct board instances the exact same `name` (this card's
      // own 4 Hero tokens, e.g.), `target.getName()` alone stopped being
      // enough for a consumer (`app/lib/scenarioReplay.ts`'s own
      // `ensureForZone`/`ensureForTap`) to tell WHICH of the same-named
      // instances a given log entry is about — before that name-sharing
      // existed, each filler had its own synthetic unique name
      // (`you-creature-token-0`/`-1`), so name alone happened to be a
      // real disambiguator; it silently stopped being one the moment names
      // stopped being unique, with no producer-side field to fall back on.
      // Additive-only fix (not a breaking shape change — see this file's
      // own state-event-format contract): `id` is a NEW field alongside
      // the existing `target` name string, never a replacement — a
      // consumer that only reads `target` (older code, or a log entry from
      // before this fix) still works exactly as before; `id`, when
      // present, lets a consumer pick the REAL matching instance instead
      // of guessing "first same-named match."
      log.push({ fn: 'putCounter', target: target.getName(), id: real.id, counterType, amount, controller: state.players.get(real.controllerId)!.name });
    },
    // Real Forge `DB$ Effect | RememberObjects$ Targeted | StaticAbilities$
    // ...` (613, Ultima, Origin of Oblivion's own blight counter,
    // ENGINE_GAPS.md's own closure) — installs the grant directly onto the
    // real target, alongside its own counter. Real bookkeeping, not a
    // produce/consume-shaped board Fact — same "no fact vocabulary for this
    // yet, and none needed" treatment `queueExtraPhase`'s own log entry
    // already gets (`scripts/verify-synergy.mjs`'s `IGNORED_FNS`).
    installCounterConditionalGrant: (target, grant) => {
      const real = cardOf(target);
      state.installCounterConditionalGrant(real, grant);
      log.push({
        fn: 'installCounterConditionalGrant',
        target: target.getName(),
        id: real.id,
        counterType: grant.counterType,
        removeLandTypes: !!grant.removeLandTypes,
        removeAllAbilities: !!grant.removeAllAbilities,
        grantManaAbility: grant.grantManaAbility ?? null,
      });
    },
    equip: (equipment, target) => {
      state.equip(cardOf(equipment), cardOf(target));
      log.push({ fn: 'equip', equipment: equipment.getName(), equipmentId: equipment.getId(), target: target.getName(), id: target.getId() });
    },
    animate: (target, types) => {
      state.animate(cardOf(target), types);
      log.push({ fn: 'animate', target: target.getName(), id: target.getId(), types });
    },
    gainControl: (controller, target) => {
      state.gainControl(playerOf(controller), cardOf(target));
      log.push({ fn: 'gainControl', controller: controller.getName(), target: target.getName(), id: target.getId() });
    },
    // No real card-drafting/library-reordering model for surveil (nothing
    // in the current 12 cards checks post-surveil library contents) — kept
    // log-only, same as before, rather than a fabricated mutation.
    surveil: (player, qty) => {
      log.push({ fn: 'surveil', player: player.getName(), qty });
    },
    // Same log-only shape as surveil above — no real stack/object model to
    // remove a countered spell/ability from (see interfaces.ts's own
    // `counter` doc comment).
    counter: (what) => {
      log.push({ fn: 'counter', what });
    },
    destroy: (target) => {
      const real = cardOf(target);
      const controller = state.players.get(real.controllerId)!.name;
      // Real 111.7/704.5d, same reasoning as `moveTo` below — captured
      // BEFORE `state.destroy` (which routes through `state.move` and
      // deletes a token from state entirely) rather than after. A
      // destroyed TOKEN really does briefly hit the graveyard (700.4 — it's
      // a genuine `dies` event) before immediately ceasing to exist as an
      // SBA, so this logs `ceasesToExist` (zone kept as 'Graveyard', real
      // evidence for both a `{zone:'Graveyard'}` produce claim AND a
      // `dies` event claim — see verify-synergy.mjs's own two cases for
      // this fn) instead of a plain `destroy` a replay would otherwise
      // show sitting in the graveyard forever.
      const ceasesToExist = real.zone === 'Battlefield' && real.isTokenCard;
      const destroyed = state.destroy(real);
      if (!destroyed) log.push({ fn: 'destroyPrevented', target: target.getName(), id: real.id, cause: 'Indestructible' });
      else if (ceasesToExist) log.push({ fn: 'ceasesToExist', target: target.getName(), id: real.id, zone: 'Graveyard', controller });
      // Real controller, same reasoning as `moveTo` above.
      else log.push({ fn: 'destroy', target: target.getName(), id: real.id, controller });
    },
    dealDamage: (source, target, amount) => {
      const sourceReal = cardOf(source);
      const targetIsCard = !('getLife' in target);
      const result = !targetIsCard ? state.dealDamage(playerOf(target as Player), amount, sourceReal) : state.dealDamage(cardOf(target as Card), amount, sourceReal);
      const targetId = targetIsCard ? (target as Card).getId() : undefined;
      // Real 614.2 damage-PREVENTION replacement (ENGINE_GAPS.md gap #8,
      // closed) — mirrors `destroy`'s own `destroyPrevented` shape just
      // above (a REPLACED entry, not a `dealDamage` entry ALSO logged —
      // real prevention means the damage event never actually happens, so
      // logging both would misrepresent it as having occurred anyway).
      if (result.prevented) log.push({ fn: 'damagePrevented', source: source.getName(), sourceId: sourceReal.id, target: target.getName(), id: targetId, amount });
      else {
        log.push({ fn: 'dealDamage', source: source.getName(), sourceId: sourceReal.id, target: target.getName(), id: targetId, amount });
        if (result.lifeGained > 0) log.push({ fn: 'gainLife', player: state.players.get(sourceReal.controllerId)!.name, amount: result.lifeGained, cause: 'Lifelink' });
      }
    },
    tap: (target) => {
      const real = cardOf(target);
      // Real controller, same reasoning `moveTo`/`destroy`/`putCounter`
      // already log one — `sideOf` (verify-synergy.mjs) prefers this real
      // field over its own name-prefix guess, which broke the instant
      // `GENERIC_FILLER_CREATURE` gave an opponent's own filler creature a
      // real, unprefixed name to tap (Crystal Fragments' own chapter III
      // "tap all creatures your opponents control" — confirmed the hard way:
      // its `{event:'tap', controller:'opp', ...}` produce fact lost its
      // only real trace evidence once the tapped target's name stopped
      // starting with "opp0-").
      const controller = state.players.get(real.controllerId)!.name;
      state.tap(real);
      log.push({ fn: 'tap', target: target.getName(), id: real.id, controller });
    },
    untap: (target) => {
      state.untap(cardOf(target));
      log.push({ fn: 'untap', target: target.getName(), id: target.getId() });
    },
    grantKeyword: (target, keyword, opts) => {
      state.grantKeyword(cardOf(target), keyword, opts);
      log.push({ fn: 'grantKeyword', target: target.getName(), id: target.getId(), keyword, untilEndOfTurn: opts?.untilEndOfTurn || undefined });
    },
    copyPermanent: (source, controller) => {
      const copy = state.copyPermanent(cardOf(source), playerOf(controller));
      log.push({ fn: 'copyPermanent', source: source.getName(), controller: controller.getName() });
      return loggingCard(state, copy, log);
    },
    dig: (player, qty, take, validType) => {
      // Type-checked via `loggingCard` (not raw `effectiveTypes(c)`) — same
      // fix `move`/`sacrifice`'s own `matches` already got (2026-09-05), for
      // the same reason: this used to bypass the logged Card interface
      // entirely, leaving a declarative `dig`-effect want (Ashe, Princess of
      // Dalmasca's own "reveal an artifact card from among them" library
      // search, e.g.) with zero trace evidence for verify-synergy.mjs to
      // check against — same bug class, just never hit until this card
      // actually declared a want against it.
      const matches = (c: RealCard) => {
        if (!validType || validType === 'any') return true;
        const wrapped = loggingCard(state, c, log);
        return validType === 'artifact' ? wrapped.isArtifact() : true;
      };
      const found = state.dig(playerOf(player), qty, take, matches);
      log.push({ fn: 'dig', player: player.getName(), qty, take, validType, found: found.length });
      // Real per-card evidence — WHICH specific card(s) actually got taken to
      // hand, same "who/what specifically" upgrade drawCard/tapForMana/
      // putCounter already got (the summary entry above only ever said HOW
      // MANY). Reuses `moveTo`'s existing shape/replay case for free —
      // `state.dig` already really moved each of these to Hand.
      for (const c of found) log.push({ fn: 'moveTo', target: c.name, id: c.id, zone: 'Hand', controller: player.getName() });
      return found.map((c) => loggingCard(state, c, log));
    },
    delayUntil: (phase, run) => {
      state.scheduleDelayedTrigger(phase, run);
      log.push({ fn: 'delayUntil', phase });
    },
    // Real "insert one more occurrence of this phase group into the CURRENT
    // turn" (ENGINE_GAPS.md gap #17) — this plain harness path fires a named
    // trigger flat, against a manufactured board, with no real `TurnState`
    // in scope (same documented scope this file's own header already states
    // for turn/stack/mana), so there's nothing to mutate here — logged as a
    // real, honest fact of what the card's own effect did (same "no engine
    // to check legality against, but still a real logged consequence" shape
    // `play` above already uses); `engine-trace.ts`'s own `pilotActions`
    // override is where this genuinely mutates a real `TurnState` (see its
    // own comment there).
    queueExtraPhase: (phaseType) => {
      log.push({ fn: 'queueExtraPhase', phaseType });
    },
    // CR 601/305's own umbrella "play" (ENGINE_GAPS.md gap #16) — The Lunar
    // Whale's own "you may play the top card of your library." This plain
    // harness.ts implementation has no real turn/stack/mana concept to check
    // legality against (same accepted scope this whole file's own header
    // already documents), so it's a direct, unconditional move — real
    // engine-piloted legality/cost enforcement lives in `engine-trace.ts`'s
    // own `pilotActions` override instead, which backs this SAME `Actions.play`
    // slot with the real `canPlayFromLibraryTop`/`playFromLibraryTop`
    // (`engine.ts`) whenever a card's own scenario opts into that pilot path.
    play: (player, target, card) => {
      const real = cardOf(target);
      const controller = state.players.get(real.controllerId)!.name;
      // The umbrella event fact itself (`event:'play'`, `from:'Library'`) —
      // real regardless of which real sub-action (land-drop or cast) follows.
      log.push({ fn: 'play', target: target.getName(), id: real.id, from: 'Library', controller });
      if (!card) return; // no CardDefinition supplied (interfaces.ts's own `play` doc comment) — nothing to dispatch on; the umbrella fact above is all there is to log.
      if (/\bLand\b/.test(card.typeLine)) {
        state.move(real, 'Battlefield');
        log.push({ fn: 'playLand', card: card.name, id: real.id });
        log.push({ fn: 'enters', card: card.name, id: real.id, zone: 'Battlefield' });
        return;
      }
      const to = isInstantOrSorcery(card.typeLine) ? 'Graveyard' : 'Battlefield';
      state.move(real, to);
      log.push({ fn: 'cast', card: card.name, id: real.id, from: 'library', cost: card.manaCost });
      if (to === 'Battlefield') log.push({ fn: 'enters', card: card.name, id: real.id, zone: 'Battlefield' });
      else log.push({ fn: 'move', card: card.name, id: real.id, from: 'stack', to });
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
 *    `alternateCosts` entry with `thenExile: true` (Flashback), OR the
 *    face's own typeLine carries the real `Adventure` subtype (715.3d: an
 *    Adventure spell is exiled instead of put into its owner's graveyard as
 *    it resolves, specifically so it can be cast later as its other half —
 *    zanarkand-ancient-metropolis-lasting-fayth's own doc comment explains
 *    the layout; this rule applies to every Adventure card generically, not
 *    just that one), in which case it's `move` to exile instead, and
 *    critically NEVER graveyard — real rule text, and the exact fact a
 *    "return an instant/sorcery card from your graveyard" effect elsewhere
 *    needs to know didn't happen.
 *  - A Land typeLine (and none of the above) -> `playLand`, NOT `cast` —
 *    real CR 305.1: playing a land is a special action, never a spell, so
 *    it never touches the stack or has a mana cost the way every other
 *    branch here genuinely does. This is the one real, structural signal
 *    (not a synergy-layer label) that lets a trace prove "this land
 *    reached the battlefield via the land-drop action" as opposed to any
 *    OTHER path an effect might take it (a bare `moveTo`, e.g. Elven
 *    Passage's own library-fetch, which never sets up a `playLand`/`cast`
 *    bracket at all for the land it finds) — see synergy.ts's own
 *    `event: 'playLand'` doc comment for the paired Fact-vocab half of
 *    this. Still followed by `enters` below like any other permanent —
 *    playing a land is ALSO a real zone change onto the battlefield, so
 *    both facts are genuinely true for it.
 *  - Anything else (a permanent being cast, its own ETB effects/triggers
 *    running) -> `cast`, then effects, then `enters` the battlefield rather
 *    than moving to a zone.
 */
// `id` (below, alongside the pre-existing `instanceId`) — the tested
// card's own REAL, stable per-object id (`RealCard.id`/`state.addCard`'s
// own `nextObjectId++`, state.ts), additive (2026-09-12, real regression
// fix: see `.claude/contracts/state-event-format.md`'s own dated entry).
// `instanceId` is a scenario-domain dedup concept `app/lib/scenarioReplay.ts`'s
// own `ensureSelf` already uses to tell a genuinely SECOND same-named
// physical object apart from self (a duplicate legendary, e.g.) — but only
// for entries carrying `instanceId` itself (cast/activate/trigger/enters).
// A card whose OWN effect finds/moves/taps ANOTHER real object sharing its
// exact name (Magitek Infantry's own "search for a card named Magitek
// Infantry, put it onto the battlefield tapped") does so via the GENERIC
// `moveTo`/`tap` actions, which only ever carry the real per-instance `id`
// field (never `instanceId`) — and until now, self's own `id` was never
// recorded anywhere in the log at all, so the replay UI's `resolveInstance`
// (keyed on `id`) had no way to know self's real id wasn't a match for the
// second copy's, and silently aliased the second copy's own `moveTo`+`tap`
// onto self's already-existing chip instead of creating a new one for it
// (confirmed the hard way, magitek-infantry: the tutored SECOND copy's own
// `tap` visibly flipped the ORIGINAL, untouched permanent tapped instead).
// Recording `id` here doesn't itself fix that (the replay-side consumer
// still needs its own matching update — `app/lib/scenarioReplay.ts`'s
// `ensureSelf`/`resolveInstance`, out of this file's own domain), but it's
// the necessary engine-side half: without a real `id` on self's own
// entries, no consumer-side fix could ever tell the two apart either.
function lifecycleBefore(card: CardDefinition, scenario: Scenario, instanceId: number, id: number): LogEntry[] {
  // `sequence` (see runScenario's own sequence branch, run AFTER the
  // normal cast->enters lifecycle below) still goes through a REAL cast —
  // a Saga genuinely enters the battlefield before any of its chapters can
  // trigger, same as any other permanent; only `trigger`/`ability` skip
  // straight to "already on the battlefield" for a card being tested
  // mid-game rather than from a fresh cast.
  if (scenario.trigger) return [{ fn: 'trigger', card: card.name, instanceId, id, name: scenario.trigger }];
  if (scenario.ability) {
    const ability = card.abilities?.find((a) => a.name === scenario.ability);
    return [{ fn: 'activate', card: card.name, instanceId, id, cost: ability?.cost ?? '', ability: scenario.ability }];
  }
  // `scenario.forceCast` (see that field's own doc comment) opts a
  // permanent with its own `activationCost` OUT of this branch — a real
  // cast, not an activation, is what's being tested; the activated
  // ability (if any) fires later via a `sequence` step's `activate:true`.
  if (card.activationCost && !scenario.forceCast) return [{ fn: 'activate', card: card.name, instanceId, id, cost: card.activationCost }];
  // CR 305.1 — a real, distinct special action, never a spell cast. See
  // this function's own doc comment above for why this is its own `fn`
  // rather than folding into `cast` below.
  if (/\bLand\b/.test(card.typeLine)) return [{ fn: 'playLand', card: card.name, instanceId, id }];
  const castFrom = scenario.castFrom ?? 'hand';
  // The cost paid to cast THIS way — the card's own printed mana cost for a
  // normal hand-cast, or the matching `alternateCosts` entry's own cost
  // (Flashback's `{4}{B}{B}`, e.g.) whenever castFrom names one. Matches
  // synergy-model's own `node:castFlashback`'s `cost:{4}{B}{B}` flag — cost
  // is part of the cast fact itself, not left off it.
  const cost = castFrom === 'hand' ? card.manaCost : (card.alternateCosts?.find((c) => c.from === castFrom)?.cost ?? card.manaCost);
  return [{ fn: 'cast', card: card.name, instanceId, id, from: castFrom, cost }];
}
function lifecycleAfter(card: CardDefinition, scenario: Scenario, instanceId: number, state: GameState, selfReal: RealCard): LogEntry[] {
  if (scenario.trigger || scenario.ability || (card.activationCost && !scenario.forceCast)) return [];
  if (!isInstantOrSorcery(card.typeLine)) {
    state.move(selfReal, 'Battlefield');
    return [{ fn: 'enters', card: card.name, instanceId, id: selfReal.id, zone: 'Battlefield' }];
  }
  const castFrom = scenario.castFrom ?? 'hand';
  const altCost = card.alternateCosts?.find((c) => c.from === castFrom);
  const to = altCost?.thenExile || /\bAdventure\b/.test(card.typeLine) ? 'Exile' : 'Graveyard';
  state.move(selfReal, to);
  const cardType = /\bSorcery\b/.test(card.typeLine) ? 'Sorcery' : 'Instant';
  return [{ fn: 'move', card: card.name, instanceId, id: selfReal.id, from: 'stack', to, cardType }];
}

/** Runs `card` through one scenario with a real, mutable GameState (see functional-model/state.ts) — returns the resulting fact log, bracketed by the automatic cast/activate/trigger/move/enters lifecycle events (see lifecycleBefore/After above), not just the effects themselves. Real zone mutation means `getCardsIn`/`getCreaturesInPlay`/etc. reflect actual prior actions within this run (Fight On!'s own two `moveTo` calls really do shrink the graveyard pool for the second pick) — this is what makes a future joint-scenario driver (chaining multiple `runScenario`-style resolutions against ONE shared GameState) possible, though nothing calls it that way yet. */
export function runScenario(card: CardDefinition, scenario: Scenario): TraceResult {
  const effectiveCard = scenario.face === 'back' ? (card.backFace ?? card) : card;
  const instanceId = SELF_INSTANCE_ID;

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
  const selfZone: ZoneType = scenario.trigger || scenario.ability || (effectiveCard.activationCost && !scenario.forceCast) ? 'Battlefield' : 'Stack';
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
  // Built only now (not before `selfReal` exists) — `lifecycleBefore`'s own
  // entries need `selfReal.id`'s REAL value (see that function's own doc
  // comment on `id`), which doesn't exist until `state.addCard` above runs.
  // Nothing before this point ever pushes to `log` (`setupPlayer` mutates
  // `state` directly, no logger involved), so `lifecycleBefore`'s entries
  // still land first, same ordering as before this reshuffle.
  const log: LogEntry[] = [...lifecycleBefore(effectiveCard, scenario, instanceId, selfReal.id)];
  const youLogging = loggingPlayer(state, you, log);
  const opponentsLogging = opponents.map((o) => loggingPlayer(state, o, log));
  const self = loggingCard(state, selfReal, log);
  const ctx: EffectContext = {
    self,
    you: youLogging,
    opponents: opponentsLogging,
    castFrom: scenario.castFrom ?? 'hand',
    mode: scenario.mode,
    triggerInput: scenario.triggerInput,
    xPaid: scenario.xPaid,
    declineOptional: scenario.declineTriggers?.includes(scenario.trigger ?? '') ?? false,
    firstPhaseGroupOccurrenceThisTurn: scenario.firstPhaseGroupOccurrenceThisTurn,
  };
  const actions = loggingActions(state, log, selfReal.id);
  // `scenario.forceCast` + `card.activationCost` together mean `card.effects`
  // belongs to the activated ability alone (see `forceCast`'s own doc
  // comment) — a bare cast has no "spell effect" of its own to run here;
  // skip this call entirely rather than let the no-trigger/no-ability
  // fallback (card.ts's own `resolveCard`) mistakenly auto-fire an ability
  // nothing actually activated. A later `sequence` step's `activate:true`
  // runs it for real instead.
  if (!(scenario.forceCast && effectiveCard.activationCost)) {
    // A NAMED TRIGGER (not an ability activation) routes through
    // `triggers.ts`'s own shared `fireTrigger` (ENGINE_GAPS.md gap #13) so a
    // real `triggerDoubling` grant on the board genuinely re-fires it — an
    // ability activation (`scenario.ability`) or a plain cast (neither set)
    // is unaffected, same as before.
    if (scenario.trigger) {
      fireTrigger(state, effectiveCard, ctx, actions, scenario.trigger);
    } else {
      resolveCard(effectiveCard, ctx, actions, undefined, scenario.ability);
    }
  }
  log.push(...lifecycleAfter(effectiveCard, scenario, instanceId, state, selfReal));
  // Combat damage happens while a creature is ALREADY on the battlefield —
  // long after casting/entering, which is exactly what `lifecycleAfter`
  // above just resolved — so this synthetic probe (see `Scenario
  // .dealsCombatDamage`'s own doc comment: not a card ability, a real MTG
  // event happening independent of anything a CardDefinition authors) has
  // to run AFTER it, not before, or a creature scenario would be "dealing
  // damage" while still on the stack. Deliberately BEFORE `sequence`
  // (below), not after (2026-09-12 fix, minwu-white-mage's own real
  // regression): a `sequence` trigger keyed to a preceding real event
  // (Minwu's own anthem, "whenever you gain life," reacting to real
  // Lifelink lifegain from THIS damage) needs its causal real-event
  // evidence to precede the trigger in the trace log, not follow it — the
  // trigger is the CONSEQUENCE, not the cause. Confirmed pool-wide via grep
  // before reordering: minwu-white-mage is the only scenario anywhere that
  // combines `dealsCombatDamage` with `sequence`, so no other scenario's
  // trace depended on the old sequence-before-damage order.
  if (scenario.dealsCombatDamage) {
    const opponent = opponents[0] ?? state.addPlayer('opp0');
    actions.dealDamage(self, wrapPlayer(state, opponent), scenario.dealsCombatDamage.amount);
  }
  // Same "real event, not a card ability" reasoning as `dealsCombatDamage`
  // just above — see `Scenario.playerGainsLife`'s own doc comment.
  // `youLogging` (not the bare `you`), so the REAL post-replacement amount
  // (The Wind Crystal's own lifegain-doubling, e.g.) is what actually gets
  // logged, not the nominal request.
  if (scenario.playerGainsLife) {
    youLogging.gainLife(scenario.playerGainsLife.amount);
  }
  // `sequence` fires AFTER the normal cast->enters lifecycle (and after
  // `dealsCombatDamage` just above, when both are set) — self is genuinely
  // on the battlefield by now, same as `trigger`/`ability` scenarios assume
  // from the start, so the self-battlefield baseline fact (and anything
  // else "enters" backs) still gets real evidence even for a card whose own
  // behavior lives entirely in `sequence`-fired triggers.
  if (scenario.sequence) {
    let stepFace = effectiveCard;
    for (const rawStep of scenario.sequence) {
      const step: SequenceStep = typeof rawStep === 'string' ? { trigger: rawStep } : rawStep;
      if (step.face === 'back') stepFace = card.backFace ?? stepFace;
      else if (step.face === 'front') stepFace = card;
      if (step.trigger) {
        log.push({ fn: 'trigger', card: stepFace.name, instanceId, id: selfReal.id, name: step.trigger });
        ctx.declineOptional = scenario.declineTriggers?.includes(step.trigger) ?? false;
        // Same shared chokepoint as the top-level `scenario.trigger` dispatch above.
        fireTrigger(state, stepFace, ctx, actions, step.trigger);
      } else if (step.ability) {
        const ability = stepFace.abilities?.find((a) => a.name === step.ability);
        log.push({ fn: 'activate', card: stepFace.name, instanceId, id: selfReal.id, cost: ability?.cost ?? '', ability: step.ability });
        resolveCard(stepFace, ctx, actions, undefined, step.ability);
      } else if (step.activate) {
        log.push({ fn: 'activate', card: stepFace.name, instanceId, id: selfReal.id, cost: stepFace.activationCost ?? '' });
        resolveCard(stepFace, ctx, actions, undefined, undefined);
      }
    }
  }
  if (scenario.sacrificeSelfAfter) {
    state.move(selfReal, 'Graveyard');
    log.push({ fn: 'sacrifice', player: you.name, card: effectiveCard.name });
  }
  // Real phase advancement, only when a scenario actually needs to prove a
  // delayed trigger's timing (see `Scenario.advanceToPhase`'s own doc
  // comment) — starts from Main1 (this harness's own implicit baseline
  // phase), not turn.ts's own `startGame()` (Untap/turn 1), so advancing
  // doesn't spuriously fire Untap/Draw's real automatic actions for a
  // scenario that was never "at the start of a turn" to begin with.
  if (scenario.advanceToPhase) {
    const players = [you, ...opponents];
    let turn: TurnState = {
      turnNumber: 1,
      activePlayerIndex: 0,
      phaseIndex: PHASES.indexOf('Main1'),
      extraTurns: [],
      queuedExtraPhases: [],
      phaseGroupEntryCount: {},
    };
    while (currentPhase(turn) !== scenario.advanceToPhase) {
      turn = advancePhase(state, turn, players);
      log.push({ fn: 'phase', phase: currentPhase(turn) });
    }
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
    scenario: { setup: describeSetup(scenario), action: describeAction(effectiveCard, scenario), result: scenario.result ?? scenario.label ?? '(not yet described)', raw: scenario },
    log,
  };
}

export function runScenarios(card: CardDefinition, scenarios: Scenario[]): TraceResult[] {
  return scenarios.map((s) => runScenario(card, s));
}
