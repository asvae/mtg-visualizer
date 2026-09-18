// Sink-only synergy matching — prototype core (2026-09-17).
//
// Today's model (`synergy.ts`): a recognizer-authored `source` Fact is
// paired with a recognizer-authored `sink` Fact per card, matched via
// shared attribute constraints in `factsInteract`/`findInteractionsForCard`.
// That needs one recognizer FILE per producer-mechanic SHAPE (~85 files
// under `functional-model/recognizers/` as of this writing) — a real,
// checked-in, per-shape translation from a `CardDefinition`'s own `Effect`/
// `Trigger` data into an authored `Fact`, verified against a `trace.json`
// after the fact.
//
// This file is the alternative being prototyped: stop authoring a `source`
// Fact at all. A `SinkQuery` (`sink-query.ts`) stays a small, curated,
// hand-authored query — but whether a CANDIDATE card satisfies it is
// answered by walking that candidate's own `CardDefinition.effects`/
// `triggers` (including `kind:'program'`'s combinator AST, via
// `recognizers/program-ast-walker.ts`) directly, at match time, with no
// separate authored Fact standing in for "what this card produces." No new
// persisted data is needed on the producer/source side at all.
//
// **Scope, deliberately narrow, same "closed vocabulary, grow on demand"
// discipline every recognizer under `recognizers/` already follows**: this
// prototype maps a real but partial subset of `Effect.kind` values
// (`gainLife`, `drawCard`, `createToken`, `destroy`, `dealDamage`,
// `dealDamageTarget`, `dealDamageAnyTarget`, `putCounter`,
// `putCounterTarget`, `putCounterAll`, `pumpSelf`, `pumpTarget`, `pumpAll`,
// `grantKeywordTarget`, `grantKeywordAll`, `grantKeywordSelf`, `sacrifice`,
// `move`, `modal` (recurses into each mode), `program` (via
// `extractOccurrences`)) into the exact same `Fact`-shaped occurrence
// vocabulary `synergy.ts`'s own hand-authored facts already use, PLUS the
// same two structural, oracle-text-free baseline derivations `synergy.ts`
// itself already performs directly off `CardDefinition` (`isNormalPermanent`/
// `isNormalInstantOrSorcery` — see their own doc comments in `synergy.ts` for
// the full real-Forge-cited reasoning; re-derived locally here, not
// imported, since this file must not modify or add a runtime dependency
// FROM `synergy.ts` — see this file's own "Why not just import
// `factsInteract`" note below). Every OTHER `Effect.kind` (`mill`, `surveil`,
// `counter`, `discard`, `loseLife`, `addMana`, `dig`, `playFromLibraryTop`,
// `fightTarget`, `tapTarget`, `tapAll`, `untapTarget`, `animate`, `custom`,
// `endTurn`) declines silently (no occurrence built) — same as an
// unrecognized shape declining in any one `recognizers/*.ts` file today.
// None of this prototype's own sanity-check cards need one of these for a
// real positive match (checked directly against each card's own
// `definition.ts`); widen this the same way any recognizer widens, the next
// time a real card's own sanity check needs it — never speculatively.
//
// **2026-09-17: `deriveOccurrences` also consults a SECOND, independent
// occurrence family — `sink-model/predicates/*.ts`'s own hand-written
// "sink-derivation predicates"** (`sagaChapterCompletionOccurrences`,
// `crewTapOccurrences`, imported below), for real mechanisms whose gameplay
// consequence is emergent from GENERIC ENGINE AUTOMATION rather than
// anything visible in `CardDefinition.effects`/`triggers`/`program` nodes at
// all (Saga chapter-completion sacrifice, `saga.ts`; Crew's real
// creature-tap cost path, `engine.ts`) — see
// `functional-model/sink-derivation-status.ts`'s own header, and each
// predicate module's own header, for the full "why this needed its own
// family" writeup. Each predicate is a direct function, never a guessed
// true/false — contributes zero occurrences for a card it doesn't apply to
// or can't structurally determine.
//
// **Why not just import `factsInteract` from `synergy.ts` and feed it a
// synthetic Fact?** That was considered and rejected: `factsInteract` takes
// TWO `PoolCard`s (a producer AND a wanter, each already carrying real
// `Fact[]` arrays) and is keyed on `mineRole` to decide which side is which
// — retrofitting a "no real producer Fact, only a `CardDefinition`" caller
// through that same function would need constructing a fake `PoolCard` per
// derived occurrence anyway, and would still leave this file with a runtime
// import from `synergy.ts` (a real, deliberate risk this project's own
// "additive code alongside the existing pipeline" instruction says to
// avoid rather than risk destabilizing the production FIN pipeline). The
// small matching primitives duplicated below (`effectiveZone`/
// `effectiveController`/`sidesCompatible`/`constraintsOf`/
// `hasAnyConstraint`/`satisfiesType`) are each a few lines, mirror
// `synergy.ts`'s own PRIVATE (non-exported) helpers of the same name
// byte-for-byte in logic, and are cited as such below — this file DOES
// import `synergy.ts`'s public exports (`Fact`, `Constraints`,
// `TypeConstraint`, `Side`, `Subject`, `StaticAttrs`, `satisfiesConstraints`,
// `resolveSubject`, `staticAttrsFor`) rather than re-deriving those too.
//
// **A real, confirmed disagreement with today's production matcher this
// prototype's own sanity check surfaced — see this file's own test file and
// the task's final report for the full writeup**: `factsInteract`'s
// event-vs-event branch only ever consults a SINK fact's own top-level
// `Constraints` (`types`/`cmc`/`power`/`toughness`/`name`) when they're
// nested inside a `target: {...}` object — a sink like Loporrit Scout's own
// real `{event:'entersBattlefield', types:{has:['Creature']}, ...}` (no
// `target` key at all) has its `types` constraint silently ignored by
// `factsInteract`'s own final `return true` fallback, so ANY
// `entersBattlefield` producer matches it today regardless of type — real,
// confirmed via a live pool check: Baron, Airship Kingdom (a plain `Land —
// Town`, `entersBattlefield` fact with `subject:'self'`, no `to`/`from`)
// genuinely shows up as a real, current match for this Creature-only sink
// in `scripts/find-synergies.mjs`'s own output. This prototype's own
// matcher (`occurrenceSatisfiesSink` below) does NOT reproduce that bug — it
// checks the sink's own top-level `Constraints` unconditionally, whether or
// not `target` is set — a deliberate, documented improvement, not an
// oversight; see the task's own final report for why this is judged a real
// production bug rather than an intentional simplification.
import type { CardDefinition, Effect, Trigger } from '../card';
import type { ProgramNode } from '../combinator';
import { extractOccurrences } from '../recognizers/program-ast-walker';
import type { Constraints, Side, StaticAttrs, Subject, TypeConstraint } from '../synergy';
import { satisfiesConstraints, staticAttrsFor } from '../synergy';
import type { SinkQuery } from './sink-query';
// Engine-automation-derived occurrence sources (2026-09-17) — mechanisms
// whose real gameplay consequence isn't visible via CardDefinition
// effect/trigger/program walking at all (see
// `functional-model/sink-derivation-status.ts`'s own header for the full
// "why this needed its own predicate family" writeup, and each predicate
// module's own header for its specific reasoning). Each is a direct
// function answering one specific question for `card`, never a guessed
// true/false — contributes 0 occurrences whenever it doesn't apply or can't
// tell (see `deriveOccurrences` below).
import { sagaChapterCompletionOccurrences } from './predicates/saga';
import { crewTapOccurrences } from './predicates/crew';
// Lifelink automatic lifegain (2026-09-18, added for Felidar Savior, FDN
// #12) — see `predicates/lifelink.ts`'s own header for the full reasoning;
// same "direct function, contributes 0 occurrences when it doesn't apply"
// shape as `sagaChapterCompletionOccurrences`/`crewTapOccurrences` above.
import { lifelinkProductionOccurrences } from './predicates/lifelink';
// **2026-09-18: gated by live status.** `deriveOccurrences` below only
// includes a sink-derivation predicate's own occurrences when
// `isSinkDerivationMechanismUsable` reports its mechanism's LIVE status
// (`sink-derivation-status.ts`, the same data `GET /api/sink-derivations`
// serves) is `blue` (verified) or `green` (human-confirmed) — `gray` (not
// built) and `purple` (built but not corpus-verified) must be treated as if
// the predicate doesn't exist at all for real matching, so a THIRD
// mechanism (Stun counters, Finality counters, or anything else) can never
// silently contribute to real matches before its own corpus is actually
// passing. This gate is NEVER applied to a predicate's own corpus/
// verification test (`saga.test.ts`, `crew.test.ts`, future
// `<mechanism>.test.ts`s) — those import `sagaChapterCompletionOccurrences`/
// `crewTapOccurrences` etc. directly from their own module, never through
// `deriveOccurrences`/`matchSink`, so a not-yet-blue predicate can still be
// developed and driven to blue in the first place. See
// `sink-derivation-status.ts`'s own "Real-matching usability gate" section
// for the gate's implementation (including why it's cached) and
// `match-sink.test.ts`'s own gate test(s) for a live before/after proof.
import { isSinkDerivationMechanismUsable } from '../sink-derivation-status';

// ---------------------------------------------------------------------------
// Producer occurrences — the structural stand-in for an authored `source`
// Fact, derived directly from a `CardDefinition`, never persisted.

/**
 * One real "occurrence" a candidate `CardDefinition` structurally
 * guarantees — same shape `Fact` uses (so the matching logic below can stay
 * a near-verbatim mirror of `synergy.ts`'s own `factsInteract`), minus the
 * fields that only make sense for an AUTHORED fact (`role`/`annotations`/
 * `provenance`/`triggeredBy`), plus two matcher-only fields:
 * - `via` — which effect/trigger/baseline-rule produced this occurrence,
 *   for debuggability (the task's own "ideally which effect/trigger
 *   satisfied it" ask) — always present, always human-readable.
 * - `resolvedAttrs` — pre-resolved `StaticAttrs` for a produced object that
 *   ISN'T the candidate card itself (a created token) — sidesteps
 *   `synergy.ts`'s own `subject: {token: string}` + token-registry
 *   indirection entirely, since a `kind:'createToken'` `Effect` already
 *   carries the real, resolved `TokenInfo` inline (`effect.token`) with no
 *   registry lookup needed.
 */
export interface ProducerOccurrence extends Constraints {
  via: string;
  event?: string;
  zone?: string;
  to?: string;
  from?: string;
  controller?: Side;
  subject?: Subject;
  target?: 'self' | Constraints;
  recipient?: Side;
  targeted?: boolean;
  counterType?: string;
  type?: string;
  keyword?: string;
  color?: string;
  colors?: TypeConstraint;
  tapped?: boolean;
  resolvedAttrs?: StaticAttrs;
  /**
   * True iff this occurrence came from a `sink-model/predicates/*.ts`
   * sink-derivation predicate (Saga chapter completion / Crew tap
   * activation / Lifelink automatic lifegain) rather than a direct walk of
   * `CardDefinition`'s own `effects`/`triggers`/`program` AST (`walkEffects`/
   * `walkProgramEffect`/the baseline `collectForFace` rules). Set by
   * `deriveOccurrences` at its 3 predicate call sites below — never by a
   * predicate module itself, so this stays a single, centralized marker
   * rather than something each new predicate has to remember to set.
   *
   * **Why this distinction is load-bearing, not just debuggability**: a
   * predicate infers a category from GENERIC ENGINE AUTOMATION the card's
   * own definition never actually states as an effect (Lifelink's lifegain
   * is a `state.ts`-level side effect of dealing damage, never a `gainLife`
   * `Effect` node) — real for the REVERSE/consumer direction (another
   * card's own want correctly sees this card as a producer), but too
   * indirect to justify the producing card SELF-displaying that category on
   * its own page (`card-interactions.ts`'s self-ownership gate is the one
   * real consumer of this field — see that file's own header for the
   * Healer's Hawk/Felidar Savior worked example this was added for,
   * 2026-09-18).
   */
  predicateDerived?: boolean;
}

/**
 * Real CR 601/305 (mirrors `synergy.ts`'s own private `isNormalPermanent`
 * byte-for-byte — see that function's own doc comment for the full
 * real-Forge-cited reasoning: a Land is PLAYED, never CAST, so it's
 * deliberately excluded here too): a real, non-token permanent (Creature/
 * Artifact/Enchantment/Planeswalker/Battle) is unconditionally cast from
 * hand and enters the battlefield when it resolves — derived directly from
 * the printed type line, not something that needs an `Effect` at all.
 */
function isNormalPermanent(card: { typeLine: string }): boolean {
  const primaryTypes = card.typeLine.split('—')[0]!.trim();
  return ['Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle'].some((w) => primaryTypes.includes(w));
}

/** Mirrors `synergy.ts`'s own private `isNormalInstantOrSorcery` — a normal,
 * non-Adventure Instant/Sorcery always resolves to its owner's graveyard
 * (CR 608.2m). */
function isNormalInstantOrSorcery(card: { typeLine: string }): boolean {
  const primaryType = card.typeLine.split('—')[0]!.trim();
  if (!/^(Instant|Sorcery)\b/.test(primaryType)) return false;
  const subtypes = card.typeLine.split('—')[1];
  if (subtypes?.includes('Adventure')) return false;
  return true;
}

/**
 * Real, general structural signal (2026-09-17, added for this prototype,
 * with NO equivalent in `synergy.ts` today): ANY `Trigger.on === 'enter'`
 * is a genuine engine-executed guarantee (`engine.ts`'s `resolveTop` fires
 * exactly this the instant the card resolves onto the battlefield —
 * `card.ts`'s own `Trigger.on` doc comment) that this face itself enters
 * the battlefield — including a LAND, which `isNormalPermanent` above
 * deliberately excludes (a Land is never CAST, a genuinely separate claim
 * from "enters the battlefield," which every permanent type does). Without
 * this, a Land with a real "enters tapped"-shaped `on:'enter'` trigger
 * (Baron, Airship Kingdom, e.g. — see this file's own header) would have NO
 * structurally-derivable `entersBattlefield` occurrence at all, even though
 * its own hand-authored `synergy.json` fact says it plainly does.
 */
function hasOnEnterTrigger(face: { triggers?: Trigger[] }): boolean {
  return !!face.triggers?.some((t) => t.on === 'enter');
}

/** Real per-effect-kind mapping — the structural core of this prototype.
 * `via` always starts with the caller-supplied prefix so a debug consumer
 * can tell which face/trigger/mode/program path produced a given
 * occurrence. */
function walkEffects(effects: Effect[] | undefined, via: string, out: ProducerOccurrence[]): void {
  for (const effect of effects ?? []) {
    switch (effect.kind) {
      case 'gainLife':
        out.push({ event: 'lifegain', controller: 'you', via: `${via}:gainLife` });
        break;
      case 'drawCard':
        out.push({ event: 'drawCard', controller: 'you', via: `${via}:drawCard` });
        break;
      case 'createToken': {
        const t = effect.token;
        out.push({
          event: 'entersBattlefield',
          to: 'Battlefield',
          controller: 'you',
          resolvedAttrs: { name: t.name, types: t.types, cmc: 0, power: t.basePower, toughness: t.baseToughness },
          via: `${via}:createToken(${t.name})`,
        });
        break;
      }
      case 'destroy': {
        const types = typeConstraintForValidType(effect.validType, { nonLand: effect.nonLand });
        out.push({ event: 'destroy', ...(types ? { target: { types } } : {}), targeted: true, via: `${via}:destroy` });
        break;
      }
      case 'dealDamage':
        out.push({ event: 'damage', controller: 'you', ...(effect.target === 'opponents' ? { recipient: 'opp' as const } : {}), targeted: false, via: `${via}:dealDamage` });
        break;
      case 'dealDamageTarget':
        out.push({ event: 'damage', controller: 'you', target: { types: { has: ['Creature'] } }, via: `${via}:dealDamageTarget` });
        break;
      case 'dealDamageAnyTarget':
        out.push({ event: 'damage', controller: 'you', via: `${via}:dealDamageAnyTarget` });
        break;
      case 'putCounter':
        out.push({ event: 'putCounter', counterType: effect.counterType, target: 'self', via: `${via}:putCounter` });
        break;
      case 'putCounterTarget': {
        const types = typeConstraintForValidType(effect.validType);
        out.push({ event: 'putCounter', counterType: effect.counterType, ...(types ? { target: { types } } : {}), via: `${via}:putCounterTarget` });
        break;
      }
      case 'putCounterAll':
        out.push({ event: 'putCounter', counterType: effect.counterType, target: { types: { has: ['Creature', ...(effect.subtype ? [effect.subtype] : [])] } }, via: `${via}:putCounterAll` });
        break;
      case 'pumpSelf':
        out.push({ event: 'pump', target: 'self', via: `${via}:pumpSelf` });
        break;
      case 'pumpTarget':
        out.push({ event: 'pump', target: { types: { has: ['Creature'] } }, via: `${via}:pumpTarget` });
        break;
      case 'pumpAll':
        out.push({ event: 'pump', target: { types: { has: ['Creature', ...(effect.subtype ? [effect.subtype] : [])] } }, via: `${via}:pumpAll` });
        break;
      case 'grantKeywordTarget':
        out.push({ event: 'grantKeyword', keyword: effect.keyword, ...(effect.validType === 'creature' ? { target: { types: { has: ['Creature'] } } } : {}), targeted: true, via: `${via}:grantKeywordTarget` });
        break;
      case 'grantKeywordAll':
        out.push({ event: 'grantKeyword', keyword: effect.keyword, target: { types: { has: ['Creature', ...(effect.subtype ? [effect.subtype] : [])] } }, via: `${via}:grantKeywordAll` });
        break;
      case 'grantKeywordSelf':
        out.push({ event: 'grantKeyword', keyword: effect.keyword, target: 'self', via: `${via}:grantKeywordSelf` });
        break;
      case 'sacrifice': {
        const types =
          effect.validType === 'creature'
            ? { has: ['Creature'] }
            : effect.validType === 'artifact'
              ? { has: ['Artifact'] }
              : effect.validType === 'enchantment'
                ? { has: ['Enchantment'] }
                : effect.validType === 'creature-or-artifact'
                  ? { hasAny: ['Creature', 'Artifact'] }
                  : undefined;
        // Real 701.16 — deliberately NOT folded into the destroy-implies-
        // graveyard-arrival cross rule below (`synergy.ts`'s own
        // `factsInteract` doesn't do that for `sacrifice` either, only
        // `destroy` — checked directly). A sacrifice always genuinely
        // dies (no indestructible/regeneration escape the way `destroy`
        // has), so this IS a real, guaranteed zone occurrence — modeled
        // directly as one below instead of an event-only fact, which is
        // MORE precise than production's own `sacrifice`-event-only
        // convention (a deliberate, documented improvement, same class as
        // this file's header note on the entersBattlefield type-check fix).
        out.push({ to: 'Graveyard', from: 'Battlefield', ...(types ? { types } : {}), via: `${via}:sacrifice` });
        break;
      }
      case 'move': {
        if (typeof effect.to === 'function') break; // Computed<ZoneType> — no literal destination to read structurally
        const types = effect.validType ? typeConstraintForValidType(effect.validType) : undefined;
        out.push({
          to: effect.to,
          ...(effect.owner === 'opponents' ? { controller: 'opp' as const } : effect.owner === 'you' ? { controller: 'you' as const } : {}),
          ...(types ? { types } : {}),
          via: `${via}:move->${effect.to}`,
        });
        // Real "bounce a permanent" producer signal (2026-09-18, `catalog/
        // etb.ts`'s producer half — see that file's own header for the full
        // "blink/bounce value" archetype writeup) — a card is only ever a
        // genuine PERMANENT while it's actually ON the battlefield (CR 110.1),
        // so a `move` whose own `from` includes `'Battlefield'` and whose own
        // `to` is `'Hand'` is, unconditionally, "this effect returns a
        // permanent to its owner's hand" — the real Bigfin Bouncer (FDN)
        // shape (`from:'Battlefield', to:'Hand', validType:'creature'`), NOT
        // conflated with a `from:'Graveyard'`-shaped recursion effect
        // (Vampire Soulcaller/Inspiration from Beyond, FDN) — a card sitting
        // in a graveyard is never a "permanent" (CR 110.1 again), so that
        // shape correctly does NOT produce this occurrence. Deliberately
        // scoped to bounce-to-hand only, NOT blink (exile-then-return) — no
        // real card in this pool models "exile, then return to the
        // battlefield" as a single structural shape at all (checked directly:
        // every real `to:'Exile'` move in this pool is a one-way removal
        // effect, never paired with a same-effect return) — a real, separate,
        // documented future gap, not guessed at here.
        const fromZones = Array.isArray(effect.from) ? effect.from : [effect.from];
        if (effect.to === 'Hand' && fromZones.includes('Battlefield')) {
          out.push({ event: 'bounce', controller: 'you', via: `${via}:move:bounce-to-hand` });
        }
        break;
      }
      case 'modal':
        for (const mode of effect.modes) walkEffects(mode.effects, `${via}:modal`, out);
        break;
      case 'program':
        walkProgramEffect(effect.program, via, out);
        break;
      default:
        // Every other real `Effect.kind` (`mill`, `surveil`, `counter`,
        // `discard`, `loseLife`, `addMana`, `dig`, `playFromLibraryTop`,
        // `fightTarget`, `tapTarget`, `tapAll`, `untapTarget`, `animate`,
        // `custom`, `endTurn`) is real, closed-vocabulary scope this
        // prototype does not yet cover — declines silently (no occurrence
        // built), same "closed vocabulary, grow on demand" convention every
        // `recognizers/*.ts` file already follows. See this file's own
        // header for why none of this pass's sanity-check cards need one of
        // these for a real positive match.
        break;
    }
  }
}

/** `validType`/`nonLand` -> `TypeConstraint`, reused across `destroy`/
 * `putCounterTarget`/`move` — mirrors the exact same mapping convention
 * `recognizers/destroy-effect-structural.ts`'s own (non-exported)
 * `buildTargetConstraint` already establishes (re-derived here, not
 * imported, since importing a recognizer's own internals would cross this
 * prototype's own "additive, doesn't touch existing recognizers" boundary). */
function typeConstraintForValidType(validType: string | undefined, opts?: { nonLand?: boolean }): TypeConstraint | undefined {
  switch (validType) {
    case 'creature':
      return { has: ['Creature'] };
    case 'land':
      return { has: ['Land'] };
    case 'artifact':
      return { has: ['Artifact'] };
    case 'creature-or-artifact':
      return { hasAny: ['Creature', 'Artifact'] };
    case 'permanent':
    case 'any':
      return opts?.nonLand ? { not: ['Land'] } : undefined;
    default:
      return undefined;
  }
}

/** Walks a `kind:'program'` effect's own combinator AST via
 * `recognizers/program-ast-walker.ts`'s `extractOccurrences` — the SAME
 * structural, no-execution walk that module already provides for the
 * existing `*Program-effect-structural.ts` recognizer family, just
 * consumed directly here instead of through a per-action recognizer file. */
function walkProgramEffect(program: ProgramNode, via: string, out: ProducerOccurrence[]): void {
  for (const occ of extractOccurrences(program)) {
    switch (occ.kind) {
      case 'destroy':
        out.push({ event: 'destroy', ...(occ.pool.types ? { target: { types: occ.pool.types } } : {}), targeted: occ.targeted, via: `${via}:program:destroy` });
        break;
      case 'dealDamage':
        out.push({ event: 'damage', ...controllerForPool(occ.pool.owner), ...(occ.pool.types ? { target: { types: occ.pool.types } } : {}), via: `${via}:program:dealDamage` });
        break;
      case 'putCounter':
        out.push({ event: 'putCounter', counterType: occ.counterType, ...controllerForPool(occ.pool.owner), ...(occ.pool.types ? { target: { types: occ.pool.types } } : {}), via: `${via}:program:putCounter` });
        break;
      case 'grantKeyword':
        out.push({ event: 'grantKeyword', keyword: occ.keyword, ...controllerForPool(occ.pool.owner), ...(occ.pool.types ? { target: { types: occ.pool.types } } : {}), via: `${via}:program:grantKeyword` });
        break;
      case 'pump':
        out.push({ event: 'pump', ...controllerForPool(occ.pool.owner), ...(occ.pool.types ? { target: { types: occ.pool.types } } : {}), via: `${via}:program:pump` });
        break;
      case 'drawCard':
        out.push({ event: 'drawCard', controller: 'you', via: `${via}:program:drawCard` });
        break;
      case 'equip':
        // Not mapped — no sanity-check card needs it; a real, named,
        // documented gap (see this task's own final report).
        break;
      default: {
        const _exhaustive: never = occ;
        void _exhaustive;
      }
    }
  }
}

/** Same asymmetric `controller` convention `recognizers/putCounter-
 * broadcast-structural.ts`/`pumpTarget-effect-structural.ts` already use for
 * a broadcast effect's own emitted fact: set only for `'you'`/`'opponents'`
 * pools (mapped to `'you'`/`'opp'`), omitted for `'any'` (no real card in
 * this pool's own sanity check needs that case, same "don't guess a
 * convention with nothing real to confirm it against" discipline this
 * whole file follows). */
function controllerForPool(owner: 'you' | 'opponents' | 'any'): { controller: Side } | Record<string, never> {
  if (owner === 'you') return { controller: 'you' };
  if (owner === 'opponents') return { controller: 'opp' };
  return {};
}

function collectForFace(face: CardDefinition, faceLabel: 'front' | 'back', out: ProducerOccurrence[]): void {
  if (isNormalPermanent(face)) {
    out.push({ event: 'entersBattlefield', to: 'Battlefield', controller: 'you', subject: 'self', target: 'self', via: `${faceLabel}:baseline:normal-permanent` });
  } else if (hasOnEnterTrigger(face)) {
    // See `hasOnEnterTrigger`'s own doc comment — the Land-specific
    // fallback `isNormalPermanent` deliberately doesn't cover.
    out.push({ event: 'entersBattlefield', to: 'Battlefield', controller: 'you', subject: 'self', target: 'self', via: `${faceLabel}:baseline:on-enter-trigger` });
  }
  // **SUPERSEDED, 2026-09-18, later still — the dedicated `event:'etb'`
  // occurrence this block used to push here is GONE, not just unused.** The
  // real user-corrected design (`catalog/etb.ts`'s own header) is a genuine
  // two-role "blink/bounce value" archetype, same shape as `lifegain`: a
  // card OWNS the "ETB" category via a structural CONSUMER check straight
  // off `CardDefinition.triggers[].on` (`SinkCatalogEntry.consumerTriggerOn`,
  // `matchesConsumerTriggerOn` below) — no occurrence needed for that side
  // at all, since "has a real `on:'enter'` trigger" is a bare field read,
  // not something a candidate PRODUCES for some other card to consume. The
  // PRODUCER side (does this card cause the bounce/blink) is instead a real,
  // new `event:'bounce'` occurrence in the `move`-effect case above. Kept
  // here as a historical note rather than silently deleted, since this exact
  // spot is where the old (wrong) design used to live.
  if (isNormalInstantOrSorcery(face)) {
    out.push({ to: 'Graveyard', controller: 'you', subject: 'self', via: `${faceLabel}:baseline:normal-instant-sorcery` });
  }
  walkEffects(face.effects, `${faceLabel}:effects`, out);
  for (const trig of face.triggers ?? []) walkEffects(trig.effects, `${faceLabel}:trigger:${trig.name}`, out);
  for (const ab of face.abilities ?? []) walkEffects(ab.effects, `${faceLabel}:ability:${ab.name}`, out);
}

/** Every real occurrence a candidate `CardDefinition` structurally
 * guarantees, front face plus (if present) back face — the full stand-in
 * for what an authored `source` Fact array would have been for this card.
 *
 * `root` is passed through to the live-status gate below
 * (`isSinkDerivationMechanismUsable`) — defaults to `process.cwd()` (real
 * production behavior); the only reason a caller would ever override it is
 * a test simulating a mechanism whose live status isn't blue/green yet
 * (see `match-sink.test.ts`'s own gate test(s)). */
export function deriveOccurrences(card: CardDefinition, root: string = process.cwd()): ProducerOccurrence[] {
  const out: ProducerOccurrence[] = [];
  collectForFace(card, 'front', out);
  if (card.backFace) collectForFace(card.backFace, 'back', out);
  // Engine-automation-derived occurrences (sink-derivation predicates) —
  // see the imports above's own doc comment. Each predicate independently
  // decides applicability for `card`; a non-Saga/non-Vehicle card (the
  // overwhelming majority of the pool) gets an empty array back from both,
  // same "declines silently, no occurrence built" convention every
  // unrecognized `Effect.kind` above already follows. GATED: a mechanism
  // whose live status isn't blue/green contributes nothing here, same
  // silent-decline convention — never an error, never a guess.
  // Marked `predicateDerived: true` here (not inside each predicate module
  // itself) — see `ProducerOccurrence.predicateDerived`'s own doc comment
  // for why this needs to be a single, centralized marker rather than
  // something each new predicate has to remember to set independently.
  if (isSinkDerivationMechanismUsable('saga', root)) out.push(...sagaChapterCompletionOccurrences(card).map(markPredicateDerived));
  if (isSinkDerivationMechanismUsable('crew', root)) out.push(...crewTapOccurrences(card).map(markPredicateDerived));
  if (isSinkDerivationMechanismUsable('lifelink', root)) out.push(...lifelinkProductionOccurrences(card).map(markPredicateDerived));
  return out;
}

function markPredicateDerived(occ: ProducerOccurrence): ProducerOccurrence {
  return { ...occ, predicateDerived: true };
}

// ---------------------------------------------------------------------------
// Matching — a near-verbatim mirror of `synergy.ts`'s own (private)
// `factsInteract`, generalized to take a structural `ProducerOccurrence`
// instead of an authored producer `Fact`. See this file's own header for
// exactly which small helpers are duplicated vs. imported, and the one
// deliberate, documented correctness improvement (top-level sink
// `Constraints` are always checked, not only when nested in `target`).

function isZoneShaped(f: { zone?: string; to?: string; from?: string }): boolean {
  return f.zone !== undefined || f.to !== undefined || f.from !== undefined;
}

function effectiveZone(f: { zone?: string; to?: string }): string | undefined {
  return f.zone ?? f.to;
}

function effectiveController(f: { controller?: Side; subject?: Subject; target?: 'self' | Constraints }): Side | undefined {
  if (f.controller) return f.controller;
  return f.subject === 'self' || f.target === 'self' ? 'you' : undefined;
}

function sidesCompatible(a: Side | undefined, b: Side | undefined): boolean {
  return !a || !b || a === b;
}

function constraintsOf(f: Constraints): Constraints {
  const { types, cmc, power, toughness, name } = f;
  return { types, cmc, power, toughness, name };
}

function hasAnyConstraint(c: Constraints): boolean {
  return !!(c.types || c.cmc || c.power || c.toughness || c.name);
}

function satisfiesType(types: string[], c: TypeConstraint | undefined): boolean {
  if (!c) return true;
  if (c.has && !c.has.every((t) => types.includes(t))) return false;
  if (c.hasAny && !c.hasAny.some((t) => types.includes(t))) return false;
  if (c.not && c.not.some((t) => types.includes(t))) return false;
  return true;
}

function isGraveyardArrivalWant(w: SinkQuery): boolean {
  if (isZoneShaped(w) && effectiveZone(w) === 'Graveyard') return true;
  if (w.event === 'dies') return true;
  return false;
}

/** Mirrors `synergy.ts`'s own private `destroyGuaranteedTypes` — only a
 * `target.types.has` is a real GUARANTEE about what a destroy (or,
 * generalized here, any occurrence with a `target` filter) actually
 * affects; `hasAny`/`not`/absent guarantees nothing SPECIFIC.
 *
 * **Widened 2026-09-18** (found building the sink catalog's own
 * `graveyard-fodder` corpus, `sink-model/catalog/graveyard-fodder.test.ts`):
 * a `target` filter is the right shape when an effect CHOOSES among a wider
 * pool (`destroy`/`putCounterTarget`/... — "target creature," could have
 * been a different one), but `sacrifice`/`move`'s own `walkEffects` cases
 * instead put their guarantee directly on the occurrence's own top-level
 * `Constraints` (`ProducerOccurrence extends Constraints`) — there IS no
 * wider pool to have chosen among (a sacrifice/move effect's own victim set
 * is exactly what `effect.validType` says, full stop, CR 701.16 — no
 * indestructible/regeneration escape the way `destroy` has). Falls back to
 * `p.types?.has` when there's no `target`-shaped guarantee, so a zone-shaped
 * occurrence with a bare top-level `types` constraint (previously silently
 * un-consultable by ANY matching branch — confirmed dead code before this
 * fix, since the zone-shaped branch in `occurrenceSatisfiesSink` only ever
 * called `resolveOccurrenceSubject` and never read `p.types` at all) now
 * counts as a real guarantee too, via `satisfiesViaSubjectOrGuarantee`
 * below. */
function guaranteedTypes(p: ProducerOccurrence): string[] {
  const t = p.target;
  if (t && typeof t === 'object' && t.types?.has) return t.types.has;
  return p.types?.has ?? [];
}

/** Mirrors `synergy.ts`'s own private `satisfiesDestroyImpliesDies` — CR
 * 700.4: a `destroy` that actually resolves against a real target
 * necessarily moves it from the battlefield to a graveyard. Deliberately
 * narrower than full constraint-vs-constraint implication (only `types` is
 * checked; a want with any other constraint declines) — same scope
 * `synergy.ts`'s own version documents.
 *
 * **Known, documented gap vs. production**: a `w.event === 'dies' &&
 * w.target === 'self'` want (real production shape: "wants ITSELF to have
 * died," e.g. Aerith Gainsborough's own `dies` sink) needs the SINK's OWN
 * owning `CardDefinition` to resolve "is the sink's own card a legal victim
 * of this destroy" — a `SinkQuery` has no such reference (deliberately, per
 * `sink-query.ts`'s own header: a curated query, not tied to one card).
 * None of this prototype's chosen sanity-check sinks use this shape, so it
 * declines (`false`) rather than silently guessing; a caller that needs it
 * can pass the sink's own owning `CardDefinition` in a future extension.
 */
function satisfiesDestroyImpliesDies(p: ProducerOccurrence, w: SinkQuery): boolean {
  if (w.event === 'dies' && w.target === 'self') return false; // documented gap — see doc comment above
  const wantConstraints: Constraints = w.target && typeof w.target === 'object' ? w.target : constraintsOf(w);
  if (wantConstraints.cmc || wantConstraints.power || wantConstraints.toughness || wantConstraints.name || wantConstraints.amount) return false;
  if (!wantConstraints.types) return true;
  return satisfiesType(guaranteedTypes(p), wantConstraints.types);
}

function resolveOccurrenceSubject(p: ProducerOccurrence, candidate: CardDefinition): StaticAttrs | undefined {
  if (p.resolvedAttrs) return p.resolvedAttrs;
  if (p.subject === 'self') return staticAttrsFor(candidate);
  return undefined;
}

/** Does producer occurrence `p` (structurally derived from `candidate`)
 * satisfy sink query `w`? Near-verbatim mirror of `synergy.ts`'s own
 * `factsInteract` — see this file's own header for the one deliberate
 * divergence (top-level sink `Constraints` are always checked). */
function occurrenceSatisfiesSink(p: ProducerOccurrence, w: SinkQuery, candidate: CardDefinition): boolean {
  if (p.event === 'destroy' && isGraveyardArrivalWant(w)) {
    if (!sidesCompatible(effectiveController(p), effectiveController(w))) return false;
    return satisfiesDestroyImpliesDies(p, w);
  }

  if (isZoneShaped(p) !== isZoneShaped(w)) return false;
  if (!sidesCompatible(effectiveController(p), effectiveController(w))) return false;

  if (isZoneShaped(p) && isZoneShaped(w)) {
    if (effectiveZone(p) === undefined || effectiveZone(p) !== effectiveZone(w)) return false;
    const wantConstraints = constraintsOf(w);
    if (!hasAnyConstraint(wantConstraints)) return true;
    // 2026-09-18 widening — see `guaranteedTypes`'s own doc comment: this
    // used to be a bespoke `!!attrs && satisfiesConstraints(...)` check
    // (subject-only, no fallback), silently failing every zone-shaped
    // occurrence with no resolvable subject even when the occurrence's own
    // `types` constraint genuinely guaranteed a match (`sacrifice`/`move`).
    // Reuses the SAME subject-or-guarantee fallback chain the event-vs-event
    // branch below already established, applied uniformly to the zone-shaped
    // branch too.
    return satisfiesViaSubjectOrGuarantee(p, candidate, wantConstraints);
  }

  // event-vs-event
  if (p.event !== w.event) return false;
  if (p.counterType && w.counterType && p.counterType !== w.counterType) return false;
  if (p.keyword && w.keyword && p.keyword !== w.keyword) return false;
  if (p.tapped !== undefined && w.tapped !== undefined && p.tapped !== w.tapped) return false;

  if (w.target === 'self') {
    // "Does THIS occurrence's own filter admit the wanting card" — needs the
    // sink's own owning card, which a `SinkQuery` deliberately doesn't carry
    // (see `satisfiesDestroyImpliesDies`'s own doc comment for the same
    // gap). None of this prototype's sanity-check sinks use `target:'self'`;
    // declines rather than guessing.
    return false;
  }
  if (w.target && typeof w.target === 'object') {
    return satisfiesViaSubjectOrGuarantee(p, candidate, w.target);
  }

  // **Deliberate divergence from production, documented in this file's own
  // header**: production's `factsInteract` returns `true` unconditionally
  // here (a sink's own top-level `Constraints`, with no `target` wrapper,
  // are never actually checked). This matcher instead still requires them
  // to hold — same `satisfiesViaSubjectOrGuarantee` fallback chain as the
  // `target`-object branch immediately above.
  const wantConstraints = constraintsOf(w);
  if (!hasAnyConstraint(wantConstraints)) return true;
  return satisfiesViaSubjectOrGuarantee(p, candidate, wantConstraints);
}

/**
 * Shared fallback chain for "does this occurrence satisfy this wanted
 * `Constraints`," used by both the `target`-object branch and the bare-hook
 * branch above:
 * 1. A single CONCRETE subject this occurrence resolves to (self, or a
 *    created token) — the common case, checked with the real
 *    `satisfiesConstraints`.
 * 2. No concrete subject (the occurrence's own victim/recipient VARIES per
 *    resolution — a `dealDamageTarget`, or a program-derived broadcast whose
 *    own pool is itself a `target`-shaped filter, never a fixed object) —
 *    falls back to whatever this occurrence's own `target` filter
 *    GUARANTEES (conservative, `has`-only — same rule
 *    `satisfiesDestroyImpliesDies` already uses), declining outright for
 *    any non-`types` want constraint (cmc/power/toughness/name) a bare
 *    guarantee can't honestly back.
 * Real, general reuse — not duplicated ad hoc — of the exact same
 * "resolve-a-concrete-subject-or-fall-back-to-a-conservative-guarantee"
 * shape `satisfiesDestroyImpliesDies` already established for the
 * destroy-implies-dies cross-shape rule, now applied uniformly to same-shape
 * event matching too (found necessary by this prototype's own sanity check
 * — see sink F in `match-sink.test.ts`: a program-AST-derived broadcast
 * `putCounter` occurrence has no single resolvable subject at all, only its
 * own `target` filter, and needs this exact fallback to match a want
 * naming the identical filter).
 */
function satisfiesViaSubjectOrGuarantee(p: ProducerOccurrence, candidate: CardDefinition, wantConstraints: Constraints): boolean {
  const attrs = resolveOccurrenceSubject(p, candidate);
  if (attrs) return satisfiesConstraints(attrs, wantConstraints);
  if (wantConstraints.cmc || wantConstraints.power || wantConstraints.toughness || wantConstraints.name || wantConstraints.amount) return false;
  if (!wantConstraints.types) return true;
  return satisfiesType(guaranteedTypes(p), wantConstraints.types);
}

// ---------------------------------------------------------------------------
// Public API

export interface SinkMatchResult {
  matched: boolean;
  /** Which derived occurrence (effect/trigger/baseline path) satisfied the
   * sink — `ProducerOccurrence.via` — present iff `matched`. */
  via?: string;
  /** `ProducerOccurrence.predicateDerived` of whichever occurrence satisfied
   * the sink — present iff `matched`. `true` means the match came from a
   * `sink-model/predicates/*.ts` sink-derivation predicate (Saga/Crew/
   * Lifelink) rather than a direct effect/trigger walk — see that field's
   * own doc comment for why `card-interactions.ts`'s self-ownership gate
   * specifically needs to tell the two apart. */
  predicateDerived?: boolean;
}

/** Does `candidate` (read directly off its own `CardDefinition` — no
 * authored `source` Fact involved) satisfy `sink`? `root` — see
 * `deriveOccurrences`'s own doc comment — defaults to `process.cwd()`. */
export function matchSink(sink: SinkQuery, candidate: CardDefinition, root: string = process.cwd()): SinkMatchResult {
  for (const occ of deriveOccurrences(candidate, root)) {
    if (occurrenceSatisfiesSink(occ, sink, candidate)) return { matched: true, via: occ.via, predicateDerived: occ.predicateDerived };
  }
  return { matched: false };
}

/** Count of OTHER cards in `pool` that satisfy `sink` — the aggregate this
 * task's own "for a given sink, count of other CardDefinitions that satisfy
 * it" ask names. `pool` should already exclude `sink`'s own owning card if
 * self-matches aren't wanted (this function itself takes no stance — same
 * "self-interactions are a real, kept case, never silently dropped"
 * decision `SYNERGY_DESIGN.md`'s own matcher section already made for the
 * existing pipeline). */
export function countMatchesForSink(sink: SinkQuery, pool: CardDefinition[]): number {
  return pool.filter((c) => matchSink(sink, c).matched).length;
}

/** The reverse direction: for a given candidate, how many of `sinks` does
 * its OWN structurally-derived occurrences satisfy — the task's own
 * "reverse count" ask, using the exact same `matchSink` primitive from the
 * other side. */
export function countSinksSatisfiedByCard(candidate: CardDefinition, sinks: SinkQuery[]): number {
  return sinks.filter((sink) => matchSink(sink, candidate).matched).length;
}

/**
 * Real, structural CONSUMER-side signal (2026-09-18) for a catalog entry's
 * own `SinkCatalogEntry.consumerTriggerNames` (`catalog/entry.ts`) — does
 * `candidate` (front OR back face) carry a named trigger whose own
 * `Trigger.name` is one of `names`? A pure field comparison against
 * `CardDefinition.triggers[].name`/`CardDefinition.backFace.triggers[].name`
 * — NEVER oracle/printed text (a sink must never touch oracle text, per
 * explicit user ruling 2026-09-18). `names` undefined or empty means the
 * catalog entry declares no consumer-side signal at all — never matches.
 * Deliberately a standalone function (not folded into `matchSink`, which
 * stays scoped to `SinkQuery`-vs-`ProducerOccurrence` producer matching) so
 * `match-sink.ts` itself never has to import the `catalog/` module —
 * `card-interactions.ts` is the one real caller that already knows about
 * both `SINK_CATALOG` and this function.
 */
export function matchesConsumerTriggerNames(names: string[] | undefined, candidate: CardDefinition): boolean {
  if (!names || names.length === 0) return false;
  const nameSet = new Set(names);
  if (candidate.triggers?.some((t) => nameSet.has(t.name))) return true;
  return candidate.backFace?.triggers?.some((t) => nameSet.has(t.name)) ?? false;
}

/**
 * Real, structural CONSUMER-side signal (2026-09-18, added for `etb`'s own
 * "blink/bounce value" redesign) for a catalog entry's own
 * `SinkCatalogEntry.consumerTriggerOn` (`catalog/entry.ts`) — does
 * `candidate` (front OR back face) carry a trigger whose own `Trigger.on`
 * is one of `onValues`? Same shape as `matchesConsumerTriggerNames` just
 * above, checking `Trigger.on` (the engine's own real, CLOSED
 * trigger-precondition enum — `card.ts`'s `Trigger.on` union) instead of
 * `Trigger.name` (a free-text label) — genuinely SAFER than
 * `matchesConsumerTriggerNames`, since there's no free-text-collision risk
 * at all: `on:'enter'` means exactly one real, auto-fired thing, always.
 * `onValues` undefined or empty means the catalog entry declares no
 * consumer-side signal at all — never matches.
 */
export function matchesConsumerTriggerOn(onValues: Array<Trigger['on']> | undefined, candidate: CardDefinition): boolean {
  if (!onValues || onValues.length === 0) return false;
  const onSet = new Set(onValues);
  if (candidate.triggers?.some((t) => onSet.has(t.on))) return true;
  return candidate.backFace?.triggers?.some((t) => onSet.has(t.on)) ?? false;
}

/**
 * Real, structural CONSUMER-side signal (2026-09-18, added for the shared
 * "Battlefield presence" catalog pair, `catalog/battlefield-presence-cats
 * .ts`/`catalog/battlefield-presence-creatures.ts`) for a genuine "cares
 * about the board-state COUNT of a filtered set of permanents you control"
 * mechanic — see `SinkCatalogEntry.consumerBattlefieldPresence`'s own doc
 * comment (`catalog/entry.ts`) for the full "Affinity for Cats" (Claws Out,
 * FDN #6) worked example. Checks `CardDefinition.costReduction
 * .perControlled` (front OR back face — same face-plurality convention
 * `matchesConsumerTriggerNames`/`matchesConsumerTriggerOn` already
 * establish) and every real `pumpAll`/`putCounterAll` effect reachable from
 * that face's own `effects`, named `triggers[].effects`/`abilities[]
 * .effects`, or a nested `modal` mode's own `effects` — the SAME set of
 * effect locations `walkEffects`/`collectForFace` above already walk for
 * the producer side, just read directly rather than turned into a
 * `ProducerOccurrence` (this is a "what does this card WANT" check, not a
 * "what does this card structurally guarantee" one, so it deliberately
 * doesn't go through `deriveOccurrences`/`matchSink` at all — same
 * standalone-function shape `matchesConsumerTriggerNames` already
 * established for the identical reason). Does NOT walk a `kind:'program'`
 * AST or `grantKeywordAll`/`putCounterTarget` — no real FDN card needs
 * either for this mechanic today; same "closed vocabulary, grow on demand"
 * discipline every other check in this file already follows.
 *
 * `filter` undefined means the catalog entry declares no
 * battlefield-presence consumer signal at all — never matches. `filter
 * .subtype` undefined (but `filter` itself present, e.g. `{}`) means "no
 * subtype filter" — matched only against an equally subtype-less
 * `pumpAll`/`putCounterAll` (exact `===` comparison both ways), never a
 * vacuous "any subtype counts."
 */
export function matchesBattlefieldPresenceConsumer(filter: { subtype?: string } | undefined, candidate: CardDefinition): boolean {
  if (!filter) return false;
  if (faceCaresAboutBattlefieldPresence(candidate, filter.subtype)) return true;
  return candidate.backFace ? faceCaresAboutBattlefieldPresence(candidate.backFace, filter.subtype) : false;
}

function faceCaresAboutBattlefieldPresence(face: CardDefinition, subtype: string | undefined): boolean {
  if (face.costReduction?.perControlled && face.costReduction.perControlled.subtype === subtype) return true;
  if (effectsCareAboutBattlefieldPresence(face.effects, subtype)) return true;
  for (const trig of face.triggers ?? []) if (effectsCareAboutBattlefieldPresence(trig.effects, subtype)) return true;
  for (const ab of face.abilities ?? []) if (effectsCareAboutBattlefieldPresence(ab.effects, subtype)) return true;
  return false;
}

function effectsCareAboutBattlefieldPresence(effects: Effect[] | undefined, subtype: string | undefined): boolean {
  for (const effect of effects ?? []) {
    if ((effect.kind === 'pumpAll' || effect.kind === 'putCounterAll') && effect.predicate === 'creatures-you-control' && effect.subtype === subtype) {
      return true;
    }
    if (effect.kind === 'modal' && effect.modes.some((m) => effectsCareAboutBattlefieldPresence(m.effects, subtype))) {
      return true;
    }
  }
  return false;
}
