// New recognizer (2026-09-16, fin/26-50 re-triage follow-up) — structural,
// same family as `selectUpTo-effect-structural.ts` (reads a `kind:'program'`
// `Effect` whose own `program` is `combinator.ts`'s `SelectUpTo` node), but a
// genuinely DIFFERENT confirmed shape: a single `ApplyToBound{index:0,
// action:gainControl(...)}` step (no `tap`+`putCounter` pair at all) over a
// `permanentsInPlay` pool narrowed by `excludeSelf` — the exact shape
// `stiltzkin-moogle-merchant`'s own real activated ability (fin/34) was
// migrated onto TODAY (2026-09-16, coordinator-routed pilot-triage
// escalation, see that card's own `definition.ts` header): "{2}, {T}: Target
// opponent gains control of another target permanent you control. If they
// do, you draw a card."
//
// **Deliberately its OWN file, not a widening of `selectUpTo-effect-
// structural.ts`** — that recognizer's own module doc comment documents a
// completely different real `then` shape (`[Each{tap}, ApplyToBound{
// putCounter}]`, TWO steps, over a `creaturesInPlay` pool with no filter at
// all); sharing one file/one `readShape` for two structurally unrelated
// real templates would blur more than it'd share, same reasoning that file's
// own header already gives for staying separate from `destroy`/`drawCard`.
//
// **Real, whole-pool check of `combinator.ts`'s own named motivating group**
// (`gainControl`'s own doc comment: "stolen-uniform, stiltzkin-moogle-
// merchant, zidane-tantalus-thief, unexpected-request") — all 4 are ALREADY
// migrated onto the combinator DSL as of this recognizer's own authoring
// (checked directly, not assumed), but only `stiltzkin-moogle-merchant`
// matches the narrow single-step shape this recognizer knows how to read:
//   - `zidane-tantalus-thief`: also a single-step `SelectUpTo`(1,
//     `opponents.creaturesInPlay()`, `[ApplyToBound(gainControl('you'))]`) —
//     structurally the closest real sibling — but its own real printed
//     clause is "gain control of target creature an opponent controls until
//     end of turn" (a first-person imperative, WITH an explicit "until end
//     of turn" duration and a `creaturesInPlay` pool), a genuinely different
//     English template from Stiltzkin's third-person "Target opponent gains
//     control of another target permanent you control" (no duration at all
//     — a permanent control change). Building one shared clause-template
//     function for both `controller:'you'`/`opponent'` would require
//     GUESSING the `'you'`-controller English template from a single
//     `'opponent'`-controller real example — declined rather than guessed;
//     see `readShape` below for the exact gate (`controller !== 'opponent'`
//     declines).
//   - `stolen-uniform`/`unexpected-request`: both CHAIN two `SelectUpTo`
//     nodes (pick a creature, THEN separately pick an Equipment, THEN
//     `ApplyToBound(gainControl(...))` the equipment onto the picked
//     creature via `equipTo`) — a real, more complex nested shape this
//     recognizer's own `program.then.length !== 1` gate declines outright,
//     not a template-wording issue like Zidane's.
// Extending this recognizer (or writing a sibling) to cover any of these 3
// is real, separate future work once a second real card confirms either
// template — not attempted here, per this catalog's own "grow only when a
// real card forces it" discipline.
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'selectUpToGainControl-effect-structural' as const;

type ProgramEffect = Extract<Effect, { kind: 'program' }>;

function isProgramEffect(e: Effect): e is ProgramEffect {
  return e.kind === 'program';
}

/** Verifies (and, on success, confirms) the exact "target opponent gains
 * control of another target permanent you control" shape this recognizer
 * knows how to read — `false` (never guessed) the moment ANY part falls
 * outside the one real, confirmed template this file's own module doc
 * comment describes. */
function isRecognizedShape(effect: ProgramEffect): boolean {
  const program = effect.program;
  if (program.kind !== 'selectUpTo') return false;
  if (program.max !== 1) return false; // no real max>1 card to verify plural templating against

  const from = program.from;
  // The ONE confirmed real pool: "another target permanent you control" —
  // `permanentsInPlay` (not `creaturesInPlay`, Stiltzkin's own real text says
  // "permanent," not "creature") narrowed by `excludeSelf` ("another"),
  // scoped to `owner:'you'`. A bare `Query` (no `excludeSelf` filter) or a
  // different owner scope has no real card to confirm a different English
  // template against.
  if (from.kind !== 'filter') return false;
  if (from.predicate.field !== 'excludeSelf') return false;
  if (from.input.kind !== 'query') return false;
  if (from.input.source !== 'permanentsInPlay') return false;
  if (from.input.owner !== 'you') return false;

  if (program.then.length !== 1) return false; // chained multi-SelectUpTo shapes (stolen-uniform/unexpected-request) decline here
  const [step] = program.then;
  if (!step || step.kind !== 'applyToBound' || step.name !== program.as || step.index !== 0) return false;
  if (step.action.action !== 'gainControl') return false;
  // `controller:'opponent'` is the ONE confirmed real template ("Target
  // OPPONENT gains control..."); `'you'`-controller cards (Zidane) print a
  // genuinely different English shape — see module doc comment.
  if (step.action.controller !== 'opponent') return false;

  return true;
}

// **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-bug
// audit, same class as the sibling fixes elsewhere in this catalog): both
// facts used to reuse the SAME whole-clause span — the sink only actually
// claims "another permanent you control exists," not the "gains control of"
// action itself. Group 1 ("Target opponent gains control of," the action
// clause) now anchors SOURCE, group 2 ("another target permanent you
// control," the object phrase) anchors SINK.
const CLAUSE_RE = /\b(Target opponent gains control of) (another target permanent you control)\b/i;

/**
 * Reads one face's own structured `Effect[]` directly (oracle text is read
 * ONLY to anchor the derived facts' annotation, never to derive their
 * content — same division every other structural recognizer in this
 * catalog already keeps) and derives the `gainControl` SOURCE fact plus its
 * paired "wants a permanent present" SINK fact from a `kind:'program'`
 * effect matching the one confirmed real shape (see module doc comment).
 *
 * **All-or-nothing per face** — same simplification every sibling structural
 * recognizer already makes.
 */
export function recognizeSelectUpToGainControlEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const programEffects = allEffects(input)
    .map((o) => o.effect)
    .filter(isProgramEffect)
    .filter((e) => e.program.kind === 'selectUpTo');
  if (programEffects.length === 0) {
    return { matched: false, reason: "no kind:'program' Effect whose own program is a SelectUpTo on this face" };
  }

  const recognized = programEffects.filter(isRecognizedShape);
  if (recognized.length === 0) {
    return {
      matched: false,
      reason: "no SelectUpTo program effect on this face matches the confirmed 'target opponent gains control of another target permanent you control' shape (see module doc comment for the real, differently-shaped SelectUpTo/gainControl cards this recognizer deliberately declines)",
    };
  }

  const facts: RecognizedFact[] = [];
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);

  for (const effect of recognized) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    const matches = [...input.oracleText.matchAll(new RegExp(CLAUSE_RE.source, `${CLAUSE_RE.flags}gd`))] as Array<
      RegExpMatchArray & { indices: Array<[number, number] | undefined> }
    >;
    if (matches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${CLAUSE_RE.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
      };
    }
    const m = matches[0]!;
    const [sourceStart, sourceEnd] = m.indices[1]!;
    const [sinkStart, sinkEnd] = m.indices[2]!;
    const sourceAnnotation = toLineOffset(input.oracleText, sourceStart, sourceEnd);
    const sinkAnnotation = toLineOffset(input.oracleText, sinkStart, sinkEnd);
    if (!sourceAnnotation || !sinkAnnotation) {
      return { matched: false, reason: `matched span [${sourceStart},${sinkEnd}) (or its own inner source/sink split spans) did not resolve to a single real oracle-text line` };
    }

    facts.push({
      role: 'source',
      fact: { event: 'gainControl', controller: 'you', recipient: 'opp', targeted: true, annotations: [sourceAnnotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: { to: 'Battlefield', controller: 'you', annotations: [sinkAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
