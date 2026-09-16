// New recognizer (2026-09-15, fin/11-15 audit follow-up — Summon:
// Alexander's own remaining chapter III fact, "Tap all creatures your
// opponents control"). Structural — reads a `kind:'program'` `Effect` whose
// own `program` is `combinator.ts`'s `Each` node with a bare (unfiltered)
// `Query` input and `action:'tap'`, never oracle text for STRUCTURE.
//
// **Real, whole-pool check**: exactly ONE real card uses this shape
// (`opponents.creaturesInPlay().each(tap())`) — `crystal-fragments-summon-
// alexander`'s own chapter III. Narrowly scoped on purpose (same "don't
// stretch a template beyond its one confirmed real use" discipline every
// other recognizer in this catalog follows) — a future card using `Each` +
// `tap` over a DIFFERENT `Query.owner`/a `Filter`-narrowed input needs its
// own confirmed template, not a silent generalization of this one.
//
// Produces a SOURCE fact (the tap occurrence itself) and a paired SINK fact
// (creatures need to be present on the queried side for this to matter at
// all) — same "source+sink pair for one real broadcast effect" convention
// `pumpAllAttacking-effect-structural.ts` already establishes for a
// different `Each`-shaped broadcast.
//
// **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-bug
// audit, same class as the sibling fixes elsewhere in this catalog): the
// sink used to reuse the SOURCE's own whole-clause span byte-for-byte
// (Crystal Fragments, Summon: Alexander's own sink covered the ENTIRE "Tap
// all creatures your opponents control," when the sink only actually
// claims "a creature an opponent controls exists"). `Tap` is now its own
// capturing group (source), "all creatures your opponents control" a
// second, separate one (sink) — same split `tapTarget-effect-
// structural.ts`'s/`tapAll-effect-structural.ts`'s own confirmed fixes
// already establish for other `tap`-shaped recognizers.
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'tapAllQuery-effect-structural' as const;

type ProgramEffect = Extract<Effect, { kind: 'program' }>;

function isTapAllQuery(e: Effect): e is ProgramEffect {
  if (e.kind !== 'program') return false;
  const program = e.program;
  if (program.kind !== 'each') return false;
  if (program.action.action !== 'tap') return false;
  return program.input.kind === 'query';
}

function ownerOf(e: ProgramEffect): 'you' | 'opponents' | 'any' {
  const program = e.program;
  if (program.kind !== 'each' || program.input.kind !== 'query') {
    throw new Error('unreachable — isTapAllQuery already guarantees this shape');
  }
  return program.input.owner;
}

export function recognizeTapAllQueryEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const matches_ = allEffects(input).map((o) => o.effect).filter(isTapAllQuery);
  if (matches_.length === 0) {
    return { matched: false, reason: "no kind:'program' Effect whose own program is Each({kind:'query'}, tap()) — the one real confirmed template this recognizer covers" };
  }

  const facts: RecognizedFact[] = [];
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);
  for (const effect of matches_) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    const owner = ownerOf(effect);
    if (owner !== 'opponents') {
      return {
        matched: false,
        reason: `Each({kind:'query',owner:'${owner}'}, tap()) — this recognizer only has a confirmed real English template for owner:'opponents' ("Tap all creatures your opponents control")`,
      };
    }
    const pattern = /\b(Tap) (all creatures your opponents control)\b/i;
    const globalPattern = new RegExp(pattern.source, pattern.flags + 'gd');
    const matches = [...input.oracleText.matchAll(globalPattern)] as Array<RegExpMatchArray & { indices: Array<[number, number] | undefined> }>;
    if (matches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
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
      fact: { event: 'tap', controller: 'opp', target: { types: { has: ['Creature'] } }, targeted: false, annotations: [sourceAnnotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: { to: 'Battlefield', controller: 'opp', types: { has: ['Creature'] }, annotations: [sinkAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
