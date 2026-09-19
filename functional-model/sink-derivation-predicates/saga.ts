// Sink-derivation predicate #1: Saga chapter-completion automation (714.4).
//
// A direct function, not a data-driven declarative `Fact`-like object (per
// this task's own explicit constraint) — answers one specific question:
// "does THIS card's own Saga chapter-completion automation produce a real
// dies/zoneChange occurrence (the Saga being swept to the graveyard, 714.4)?"
// Verified against a real corpus in `saga.test.ts`, wired into
// `match-sink.ts`'s own occurrence derivation below via
// `sagaChapterCompletionOccurrences`.
//
// ## Why this needs a predicate at all (not just another `Effect`-walking case)
//
// `saga.ts`'s own `advanceSaga` (the real, executing 714.2b/c/714.4
// automation) makes its "does 714.4's sacrifice actually fire" decision off
// something NO `Effect`/`Trigger` node anywhere in a card's own
// `definition.ts` states directly: whether the Saga's OWN lore counters are
// still present, post-resolution, at the moment its final chapter's own
// effects finish resolving (`state.move()`'s real 400.7 zone-change reset
// wipes them the instant ANY effect moves the permanent to a different zone
// and back — see `saga.ts`'s own header for the full reasoning). Confirmed
// against the real pool while sanity-checking `match-sink.ts`
// (`.claude/agent-memory/engine/notes.md`'s 2026-09-17 "sink-only synergy
// matching prototype" entry): Summon: Bahamut's real graveyard-transition on
// its own final chapter has NO corresponding `Effect` node at all — a pure
// `CardDefinition`-effect-walking matcher genuinely cannot derive it, no
// matter how much `Effect`/`program`-AST vocabulary it's taught.
//
// ## The real, structural signal this predicate checks
//
// `saga.ts`'s own rule, restated structurally: 714.4's sacrifice is SKIPPED
// exactly when the final chapter's own effects resolve a genuine
// self-referential zone move (Jill, Shiva's Dominant // Shiva, Warden of Ice;
// Dion, Bahamut's Dominant // Bahamut, Warden of Light — both use
// `combinator.ts`'s `sequence('Exile', 'Battlefield')`, "exile this
// permanent, then return it to the battlefield," their own real
// "transforms back instead" chapter). Absent that signal, 714.4 fires
// unmodified (Summon: Bahamut's plain chapterIV; Jecht, Reluctant Guardian
// // Braska's Final Aeon's own chapterIII, which sacrifices two OPPONENT
// creatures but never touches its own zone — see `saga.test.ts` for both
// real corpus cases, including why Jecht specifically proves this predicate
// isn't just keying off "is this a transforming DFC").
//
// `Sequence` (`combinator.ts`) is the ONLY real `ProgramNode` kind with a
// `moveSelf` action anywhere in this codebase's vocabulary today — so a
// `kind:'program'` effect whose AST is a non-empty `Sequence` is a real,
// guaranteed self-zone-change signal; every other real effect kind
// (`destroy`/`dealDamage`/`discard`/`drawCard`/`sacrifice`/`putCounter`/etc,
// none of which can ever move THIS permanent itself) is not. An opaque
// `kind:'custom'` closure is NEVER assumed to be free of a self-move just
// because none of a card's OTHER chapters happen to use `custom` for one —
// escalates to `'unknown'` instead, per this task's own explicit "never
// guessed" constraint.
//
// ## Real, live pool cases this conservative rule escalates on — found
// during this predicate's own real-corpus verification, named here rather
// than silently papered over (this task's own explicit instruction)
//
// A full grep of every real Saga in the pool (`chapterI` across
// `functional-model/cards/<slug>/definition.ts`, ~20 cards) turned up MORE
// transforming-DFC-into-a-Saga cards than `ENGINE_DESIGN.md`'s own "Saga
// lore-counter automation (714)" section currently names (that section says
// "3 of them transforming" — Jill/Dion/Jecht — written when the pool had
// exactly those 3; Crystal Fragments // Summon: Alexander, Esper Origins //
// Summon: Esper Maduin, and Joshua, Phoenix's Dominant // Phoenix, Warden of
// Fire were all added to the pool later and share the identical
// front/back-Saga shape — a real, likely-stale doc count, flagged here for a
// future pass to correct, not fixed by this task since editing
// `ENGINE_DESIGN.md`'s own historical build narrative is out of this task's
// scope). Two REAL consequences of checking all 6, not just the 3 this
// predicate's own corpus (`saga.test.ts`) directly exercises:
//
// 1. **A real false-`'unknown'` on a card that genuinely IS `'no-death'`**:
//    Joshua, Phoenix's Dominant // Phoenix, Warden of Fire's own chapterIII
//    performs the exact same "exile, then return to the battlefield (front
//    face up)" self-transform Jill/Dion do — but expressed as a
//    `kind:'custom'` closure (`run: (ctx, actions) => {
//    actions.moveTo(ctx.self, 'Exile'); actions.moveTo(ctx.self,
//    'Battlefield'); }`), NOT `combinator.ts`'s `sequence(...)` AST. This
//    predicate correctly declines to guess based on the closure's own
//    runtime behavior (that would mean sniffing a JS function body, exactly
//    the kind of fragile, undeclared inference this project's own "no magic
//    strings in abilities" convention rejects) — it reports `'unknown'` for
//    this real card, even though a human reading its own `definition.ts`
//    comment can confirm it really is `'no-death'`. The real fix (migrating
//    this one card's own `custom` closure to the same `sequence()` AST
//    Jill/Dion/Crystal-Fragments/Esper-Maduin already use) is a `cards/*`
//    edit, out of this task's own explicit read-only scope.
// 2. **Real, conservative false-`'unknown'`s on 3 PLAIN, non-transforming
//    Sagas** whose own final chapter's `kind:'custom'` effect is a genuine
//    INERT no-op placeholder for an entirely unrelated, unmodeled ability —
//    never a self-move — confirmed by reading each: Summon: Brynhildr
//    (chapterIII, "Gestalt Mode" delayed-haste-grant placeholder), Summon:
//    GF Cerberus (chapterIII, "Triple" spell-copy placeholder), Summon: GF
//    Ifrit (chapterIV, "Add {R}" mana-production placeholder) — all three
//    are real Sagas with NO `backFace` at all, so their true real-world
//    verdict should be `'produces-death'`. This predicate has no safe way to
//    distinguish "an inert `run: () => {}` no-op" from "a `custom` closure
//    that also happens to move `self`" without reading the closure's own
//    source, so it reports `'unknown'` for both alike — a real, named
//    over-conservatism, not a bug, but real coverage this pass doesn't close
//    (a possible future refinement: a narrow, EXPLICIT, declarative
//    `Effect.custom.movesSelf?: boolean` field authored per-card, mirroring
//    this project's existing "declarative first" doctrine, rather than
//    inferring anything from a closure's own body).
// 3. **A real, live CROSS-MECHANISM interaction this predicate's
//    `'produces-death'` verdict does not (and, scoped to this task, cannot
//    yet) account for**: Esper Origins // Summon: Esper Maduin's own front
//    face places a real `finality` counter on itself (`actions.putCounter
//    (ctx.self, 'finality', 1)`) at the moment it transforms — but ONLY when
//    cast via Flashback (`ctx.castFrom === 'graveyard'`). `state.ts`'s own
//    finality-counter replacement (`GameState.move`, the SEPARATE,
//    explicitly out-of-scope-for-this-task `finality-counters` mechanism)
//    redirects ANY later Battlefield->Graveyard move — including the very
//    714.4 sacrifice `sagaChapterCompletionOccurrences` models as `to:
//    'Graveyard'` — to Battlefield->Exile instead. For a real Flashback-cast
//    copy of this specific card, the TRUE eventual destination is Exile, not
//    Graveyard, once its own Saga chapters complete — this predicate always
//    emits `to:'Graveyard'` regardless, matching how `saga.ts` itself is
//    genuinely layered (`advanceSaga` calls `state.sacrifice`, which always
//    calls `state.move` — the finality redirect lives ENTIRELY inside
//    `state.move`, decoupled from `saga.ts`'s own knowledge, by design) —
//    but flagged here as real, live shape-variety a single Saga-only
//    predicate cannot responsibly resolve on its own; closing it for real
//    would need the (currently gray, out-of-scope) `finality-counters`
//    predicate to exist first, and the two to be composed.
import type { CardDefinition, Effect } from '../card';
import { isSaga } from '../saga';
import type { ProgramNode } from '../combinator';
import type { ProducerOccurrence } from '../matcher-model/match-query';

const CHAPTER_NAMES = ['chapterI', 'chapterII', 'chapterIII', 'chapterIV', 'chapterV'] as const;

export type SagaChapterCompletionVerdict = 'produces-death' | 'no-death' | 'unknown';

export interface SagaChapterCompletionResult {
  /** `false` when neither face of `card` is a Saga at all (`isSaga`,
   * `saga.ts`) — this predicate has nothing to say about a non-Saga card. */
  applicable: boolean;
  verdict: SagaChapterCompletionVerdict;
  /** Human-readable justification — which face/chapter/effect decided the
   * verdict, for debuggability (same "always present, always
   * human-readable" convention `ProducerOccurrence.via` already
   * establishes). */
  via: string;
}

function sagaFaceOf(card: CardDefinition): { face: CardDefinition; label: 'front' | 'back' } | undefined {
  if (isSaga(card)) return { face: card, label: 'front' };
  if (card.backFace && isSaga(card.backFace)) return { face: card.backFace, label: 'back' };
  return undefined;
}

/** 714.3a/b's own "greatest chapter number" — mirrors `saga.ts`'s own
 * private `maxChapterOf` byte-for-byte (that function isn't exported; this
 * predicate needs the SAME real signal, so it's re-derived here rather than
 * reaching into `saga.ts`'s internals). */
function finalChapterName(face: CardDefinition): string | undefined {
  let found: string | undefined;
  for (const name of CHAPTER_NAMES) {
    if (face.triggers?.some((t) => t.name === name)) found = name;
  }
  return found;
}

type SelfMoveSignal = 'present' | 'absent' | 'unknown';

/** Does this `ProgramNode` structurally guarantee a self-referential zone
 * move? Only `Sequence` (`combinator.ts`'s own `sequence(...)` builder) can,
 * today — see this module's own header. A `Branch` could in principle nest
 * one in either arm, so both are walked rather than assumed empty; every
 * other real node kind (`each`/`selectUpTo`/`applyToBound`/`drawCard`) never
 * represents one at all in this codebase's real vocabulary. */
function selfMoveInProgram(node: ProgramNode): SelfMoveSignal {
  if (node.kind === 'sequence') return node.steps.length > 0 ? 'present' : 'absent';
  if (node.kind === 'branch') {
    const results = [...node.then, ...(node.else ?? [])].map(selfMoveInProgram);
    if (results.some((r) => r === 'present')) return 'present';
    if (results.some((r) => r === 'unknown')) return 'unknown';
    return 'absent';
  }
  return 'absent';
}

/** Walks one chapter trigger's own `effects` (including a nested `modal`'s
 * own modes) for a self-move signal — `'unknown'` wins over `'absent'`
 * (never silently drop a real "can't tell" case just because a LATER effect
 * in the same list happens to be structurally clear). */
function selfMoveInEffects(effects: Effect[] | undefined): SelfMoveSignal {
  let sawUnknown = false;
  for (const effect of effects ?? []) {
    switch (effect.kind) {
      case 'program': {
        const signal = selfMoveInProgram(effect.program);
        if (signal === 'present') return 'present';
        if (signal === 'unknown') sawUnknown = true;
        break;
      }
      case 'custom':
        // Opaque — could do anything, including moving `self`. Never
        // assumed absent; see this module's own header.
        sawUnknown = true;
        break;
      case 'modal':
        for (const mode of effect.modes) {
          const signal = selfMoveInEffects(mode.effects);
          if (signal === 'present') return 'present';
          if (signal === 'unknown') sawUnknown = true;
        }
        break;
      default:
        // destroy/dealDamage/discard/drawCard/sacrifice/putCounter/etc.
        // targeting something else entirely — no self-move signal.
        break;
    }
  }
  return sawUnknown ? 'unknown' : 'absent';
}

/**
 * Does `card`'s own Saga chapter-completion automation (714.4, `saga.ts`'s
 * `advanceSaga`) produce a real dies/zoneChange occurrence? See this
 * module's own header for the full reasoning; `saga.test.ts` for the real
 * corpus this was verified against.
 */
export function sagaChapterCompletionResult(card: CardDefinition): SagaChapterCompletionResult {
  const found = sagaFaceOf(card);
  if (!found) return { applicable: false, verdict: 'unknown', via: 'neither face is a Saga (isSaga)' };
  const { face, label } = found;
  const chapterName = finalChapterName(face);
  if (!chapterName) {
    return { applicable: true, verdict: 'unknown', via: `${label} face is a Saga but declares no recognized chapterI-V trigger — nothing to check 714.4 against` };
  }
  const trigger = face.triggers!.find((t) => t.name === chapterName)!;
  const signal = selfMoveInEffects(trigger.effects);
  if (signal === 'unknown') {
    return {
      applicable: true,
      verdict: 'unknown',
      via: `${label} face's ${chapterName} contains an opaque effect (kind:'custom', or an unrecognized program node) this predicate cannot see through — never guessed`,
    };
  }
  if (signal === 'present') {
    return {
      applicable: true,
      verdict: 'no-death',
      via: `${label} face's ${chapterName} resolves a self-referential zone move (kind:'program', a non-empty Sequence) — the resulting zone change resets its lore counters before 714.4 checks them, so advanceSaga's own real check skips the sacrifice`,
    };
  }
  return {
    applicable: true,
    verdict: 'produces-death',
    via: `${label} face's ${chapterName} has no self-zone-change effect — 714.4's completion sacrifice fires unmodified once lore counters reach max (advanceSaga's own real check finds them still present)`,
  };
}

/**
 * The `ProducerOccurrence` this predicate contributes to `match-sink.ts`'s
 * own derivation — a real `dies`/zone-transition occurrence (Battlefield ->
 * Graveyard, 701.16 sacrifice — unconditional, same merged `event`+`to`/
 * `from` shape SYNERGY_DESIGN.md's "Fact unification" section already
 * establishes for this exact real-world occurrence on Summon: Bahamut's own
 * hand-authored fact) precisely when `sagaChapterCompletionResult` verdicts
 * `'produces-death'`. Empty for every other verdict (`'no-death'`,
 * `'unknown'`, not applicable) — this predicate never asserts an occurrence
 * it isn't sure of.
 */
export function sagaChapterCompletionOccurrences(card: CardDefinition): ProducerOccurrence[] {
  const result = sagaChapterCompletionResult(card);
  if (result.verdict !== 'produces-death') return [];
  return [
    {
      event: 'dies',
      to: 'Graveyard',
      from: 'Battlefield',
      controller: 'you',
      subject: 'self',
      target: 'self',
      via: `saga-chapter-completion:${result.via}`,
    },
  ];
}
