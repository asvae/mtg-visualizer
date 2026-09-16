// New recognizer (2026-09-15) — structural, same family as
// `destroy-effect-structural.ts`/`putCounterSelf-effect-structural.ts`: reads
// a `kind:'program'` `Effect` whose own `program` is `combinator.ts`'s
// `SelectUpTo` node, in the ONE specific real shape a "tap up to N target
// creatures, then put a counter on one of them" ability produces — `then`
// containing exactly an `{kind:'each', input:{kind:'bound',...}, action:tap}`
// step followed by an `ApplyToBound{index:0, action:putCounter}` step — and
// derives the SOURCE `putCounter` fact plus the paired "wants creatures
// present to tap" SINK fact, the exact shape `aerith-rescue-mission`'s own
// hand-authored data used to carry (see that card's own `definition.ts`
// header for the full migration story: this is the recognizer that closes
// the gap `combinator.ts`'s new `SelectUpTo`/`BoundSet`/`ApplyToBound` vocab
// was built to make possible).
//
// **Real, whole-pool check**: `aerith-rescue-mission` (fin/5) is the only
// real `kind:'program'` effect anywhere in the pool whose own `program.kind`
// is `'selectUpTo'` as of this recognizer's own authoring (grepped
// `functional-model/cards/*/definition.ts` for `kind: 'program'` — every
// other real user, `aerith-gainsborough`'s own onDies broadcast, is a
// top-level `Branch`, not a `SelectUpTo`, so this recognizer correctly
// declines it with "no kind:'program' Effect whose own program is a
// SelectUpTo"). This recognizer will apply to any FUTURE card that migrates
// the identical real shape onto this same vocabulary, same as every other
// structural recognizer in this catalog.
//
// **Deliberate scope narrowing, real reasons, not guessed**:
// - `from` must resolve to `{kind:'query', source:'creaturesInPlay',
//   owner:'any'}` — the ONLY confirmed real English template ("Tap up to N
//   target creatures," no ownership qualifier at all). A `you`/`opponents`-
//   scoped `SelectUpTo` would need "creatures you control"/"creatures an
//   opponent controls" phrasing this recognizer has no real card to verify
//   against yet — declines (`kind:'scope'`) rather than guess.
// - `from` must be a bare `Query`, never a `Filter` — no real card combines
//   this shape with a subtype/exclude-self narrowing yet; would need a real
//   card to confirm the resulting English ("Tap up to three target Wizards,"
//   e.g.) before this recognizer could safely build it.
// - `then` must be EXACTLY `[Each{input:bound(as), action:tap()},
//   ApplyToBound{name:as, index:0, action:putCounter(...)}]`, in that order —
//   the one real confirmed shape. A different action ordering, a `putCounter`
//   `Each` instead of `tap`, or an `index` other than 0 all decline
//   (`kind:'scope'`) — no real card to verify a different real English
//   template against.
// - The `ApplyToBound`'s own `putCounter` `amount` must be a literal `1` —
//   same "no real qty>1 template confirmed" discipline every other
//   recognizer in this catalog already applies (`destroy`'s own `qty`,
//   `drawCard`'s own `amount`).
// - `max` must be a literal number with a known plural template (1-4; this
//   catalog's own `NUMBER_WORDS`-style vocabulary, extended here only as far
//   as a real card needs — `aerith-rescue-mission`'s own `max:3` is the only
//   real value to verify against).
//
// **2026-09-16 widening**: the `each(bound, tap())` step itself now ALSO
// derives its own `{event:'tap', ...}` SOURCE fact (same shape
// `tapTarget-effect-structural.ts` already establishes for its own simpler,
// non-select `kind:'tapTarget'` effects), additive alongside the pre-existing
// putCounter SOURCE + "wants creatures present" SINK. Re-checked the whole
// pool of real `selectUpTo(` users (13 real cards as of this widening:
// aerith-rescue-mission, beatrix-loyal-general, coliseum-behemoth,
// gilgamesh-master-at-arms, stiltzkin-moogle-merchant, stolen-uniform,
// slash-of-light, unexpected-request, venat-heart-of-hydaelyn-hydaelyn-the-
// mothercrystal, weapons-vendor, zidane-tantalus-thief, you-re-not-alone,
// zack-fair) for any OTHER real `each(bound, tap())`/`tap()`-shaped `then`
// step — `aerith-rescue-mission` is the only one; every other real user's
// own `then` array uses `applyToBound`/`gainControl`/`equipTo`/`untap`/
// `grantKeyword`/`pumpEach`/`dealDamageEach`/`destroyEach`/`drawCard`/
// `branch`, never a bare `each(bound, tap())` step, so `readShape`'s own
// exact-shape gate (see above) still correctly declines all 12 of them —
// this widening only ever fires for the one real card that already passed
// the pre-existing gate. See the new fact's own inline comment (right above
// its `facts.push` call) for the span-choice reasoning.
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'selectUpTo-effect-structural' as const;

type ProgramEffect = Extract<Effect, { kind: 'program' }>;

function isProgramEffect(e: Effect): e is ProgramEffect {
  return e.kind === 'program';
}

const NUMBER_WORDS: Record<number, string> = { 1: 'one', 2: 'two', 3: 'three', 4: 'four' };

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Verifies (and, on success, returns) the exact "tap up to N target
 * creatures... put a counter on one of them" shape this recognizer knows how
 * to read — `undefined` (never guessed) the moment ANY part falls outside
 * the real, confirmed template this file's own module doc comment lists. */
function readShape(effect: ProgramEffect): { max: number; counterType: string } | undefined {
  const program = effect.program;
  if (program.kind !== 'selectUpTo') return undefined;
  if (program.from.kind !== 'query' || program.from.source !== 'creaturesInPlay' || program.from.owner !== 'any') return undefined;
  if (!(program.max in NUMBER_WORDS)) return undefined;

  const [tapStep, applyStep] = program.then;
  if (program.then.length !== 2 || !tapStep || !applyStep) return undefined;
  if (tapStep.kind !== 'each' || tapStep.input.kind !== 'bound' || tapStep.input.name !== program.as || tapStep.action.action !== 'tap') return undefined;
  if (applyStep.kind !== 'applyToBound' || applyStep.name !== program.as || applyStep.index !== 0) return undefined;
  if (applyStep.action.action !== 'putCounter') return undefined;
  if (applyStep.action.amount.kind !== 'literal' || applyStep.action.amount.value !== 1) return undefined;

  return { max: program.max, counterType: applyStep.action.counterType };
}

/**
 * Reads one face's own structured `Effect[]` directly (oracle text is read
 * ONLY to anchor each derived fact's annotation, never to derive its
 * content — same division every other structural recognizer in this
 * catalog already keeps) and derives the `putCounter` SOURCE fact plus its
 * paired "wants creatures present" SINK fact from every `kind:'program'`
 * effect whose own `program` matches the one confirmed real `SelectUpTo`
 * shape (see module doc comment).
 *
 * **All-or-nothing per face** — same simplification every sibling structural
 * recognizer already makes: a qualifying-but-unverifiable effect declines
 * the WHOLE face rather than partially claiming the ones that did verify.
 */
export function recognizeSelectUpToEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const programEffects = allEffects(input).map((o) => o.effect).filter(isProgramEffect).filter((e) => e.program.kind === 'selectUpTo');
  if (programEffects.length === 0) {
    return { matched: false, reason: "no kind:'program' Effect whose own program is a SelectUpTo on this face" };
  }

  const facts: RecognizedFact[] = [];
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);

  for (const effect of programEffects) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    const shape = readShape(effect);
    if (!shape) {
      return {
        matched: false,
        reason: `a SelectUpTo program effect on this face (${JSON.stringify(effect.program)}) has no confirmed structural->text template`,
      };
    }
    const maxWord = NUMBER_WORDS[shape.max]!;
    const creatureWord = shape.max === 1 ? 'creature' : 'creatures';

    const tapPattern = new RegExp(`\\bTap (up to ${maxWord} target ${creatureWord})\\b`, 'id');
    const tapMatches = [...input.oracleText.matchAll(new RegExp(tapPattern.source, tapPattern.flags + 'g'))] as Array<
      RegExpMatchArray & { indices: Array<[number, number] | undefined> }
    >;
    if (tapMatches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${tapPattern.source}/ matched ${tapMatches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
      };
    }
    const [tapStart, tapEnd] = tapMatches[0]!.indices[0]!; // full clause, "Tap up to N target creatures"
    const [objectStart, objectEnd] = tapMatches[0]!.indices[1]!; // narrow object-phrase, "up to N target creatures"
    const tapAnnotation = toLineOffset(input.oracleText, tapStart, tapEnd);
    const tapObjectAnnotation = toLineOffset(input.oracleText, objectStart, objectEnd);
    if (!tapAnnotation || !tapObjectAnnotation) {
      return { matched: false, reason: `matched span [${tapStart},${tapEnd}) (or its own inner object-phrase span) did not resolve to a single real oracle-text line` };
    }

    const counterPattern = new RegExp(`\\bPut a ${escapeRegExp(shape.counterType)} counter on one of them\\b`, 'i');
    const counterMatches = [...input.oracleText.matchAll(new RegExp(counterPattern.source, counterPattern.flags + 'g'))];
    if (counterMatches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${counterPattern.source}/ matched ${counterMatches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
      };
    }
    const counterStart = counterMatches[0]!.index!;
    const counterEnd = counterStart + counterMatches[0]![0]!.length;
    const counterAnnotation = toLineOffset(input.oracleText, counterStart, counterEnd);
    if (!counterAnnotation) {
      return { matched: false, reason: `matched span [${counterStart},${counterEnd}) did not resolve to a single real oracle-text line` };
    }

    // **2026-09-16 widening (user-confirmed gap)**: the `each(bound, tap())`
    // step itself used to produce NO fact at all — only the paired
    // `putCounter` SOURCE + "wants creatures present" SINK were derived, even
    // though the effect's own FIRST real action is "Tap up to three target
    // creatures," a genuine producible board event exactly like
    // `tapTarget-effect-structural.ts`'s own simpler (non-select) `kind:
    // 'tapTarget'` effects already model (`{event:'tap', target, targeted:
    // true, annotations:[...]}` — same fact shape, copied verbatim from that
    // file, not invented). Additive only — coexists with the putCounter
    // SOURCE/sink pair below, never replaces either.
    //
    // Span choice (revised 2026-09-17, real user-reported bug): the tap
    // SOURCE fact anchors to the WHOLE clause ("Tap up to three target
    // creatures"), while the SINK anchors to just the narrower object-phrase
    // ("up to three target creatures," excluding the "Tap" verb) — the SAME
    // split `putCounterTarget-effect-structural.ts`/`pumpAllAttacking-
    // effect-structural.ts` already establish: the target is part of the
    // action's own description (so SOURCE keeps it), but the SINK only ever
    // claims "creatures exist to be this action's target," never the verb
    // itself, so it shouldn't include "Tap." This file used to have the SINK
    // reuse the SOURCE's own whole-clause span (including "Tap") — the same
    // reuse bug the pool-wide audit fixed elsewhere, just not caught here
    // since this fact shape predates that sweep.
    facts.push({
      role: 'source',
      fact: {
        event: 'tap',
        target: { types: { has: ['Creature'] } },
        targeted: true,
        annotations: [tapAnnotation],
        ...(triggeredBy ? { triggeredBy } : {}),
      },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'source',
      fact: {
        event: 'putCounter',
        counterType: shape.counterType,
        target: { types: { has: ['Creature'] } },
        targeted: true,
        annotations: [counterAnnotation],
        ...(triggeredBy ? { triggeredBy } : {}),
      },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: {
        to: 'Battlefield',
        types: { has: ['Creature'] },
        annotations: [tapObjectAnnotation],
      },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
