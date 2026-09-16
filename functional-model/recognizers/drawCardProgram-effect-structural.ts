// New recognizer (2026-09-16, engine-lane primitive build) — the
// `kind:'program'` sibling of `drawCard-effect-structural.ts` (that one only
// ever reads a plain top-level `kind:'drawCard'` `Effect`; this one reads a
// bare `DrawCard` `ProgramNode` reached through `program-ast-walker.ts`'s
// general walk — see `combinator.ts`'s own `DrawCard` doc comment for why
// this needed a wholly separate node kind rather than another `EachAction`,
// and `program-ast-walker.ts`'s own `DrawCardOccurrence` doc comment for
// why it's walked directly rather than through `actionOccurrence`).
//
// **Exactly ONE real, confirmed shape** — `venat-heart-of-hydaelyn-hydaelyn-
// the-mothercrystal` (fin-39, back face)'s own Blessing of Light: "...If
// that creature is legendary, draw a card." — the sole real pool card whose
// `kind:'program'` Effect contains a bare `DrawCard` node at all
// (`program-ast-walker.ts`'s own `'putCounter'`/`'grantKeyword'` occurrence
// support plus `combinator.ts`'s own `DrawCard` node were both built
// specifically for this one card's own real, 3-consequence sentence — see
// `putCounterProgram-effect-structural.ts`'s/`grantKeywordProgram-effect-
// structural.ts`'s own module doc comments for the sibling occurrences on
// the SAME real clause). A categorical `HasSubtypeCondition` guard
// (`{subtype:'Legendary'}`, `program-ast-walker.ts`'s own
// `readSubtypeGuardCondition`) is REQUIRED here — this recognizer declines
// an unguarded (or numerically-guarded) `DrawCard` occurrence outright,
// since no real pool card confirms what English template either shape would
// read like from a program-AST bare draw.
//
// **No SINK for the categorical-guard (Venat) branch** — unlike every
// targeted removal/pump/counter occurrence this catalog builds a "wants a
// legal target present" want for, a conditional DRAW has no real candidate
// pool to want a member of at all (the legendary-or-not status is read off
// an ALREADY-picked creature, not a fresh target choice) — same "no sink
// for this event" treatment `drawCard-effect-structural.ts`'s own emitted
// facts already get.
//
// **`Aggregate{op:'count'}`-amount branch added 2026-09-16** (recognizer-
// lane escalation, `edgar-king-of-figaro`/fin-51's own real "draw a card for
// each artifact you control", migrated onto the combinator DSL the same
// pass — see this card's own `progress.json` for the full escalation
// writeup) — a genuinely different real shape from Venat's own categorical
// (subtype) guard above: the draw's own MAGNITUDE scales with a live
// controlled-permanent count, not a fixed 1-or-0 gated on an already-picked
// creature's type. Mirrors `ptFormula-scalingPump-structural.ts`'s own
// paired source+sink convention (a scaling SOURCE always pairs with a
// "wants X present" SINK off the shared clause) — checked the real pool
// first: `edgar-king-of-figaro` is the sole real `kind:'program'` card whose
// bare `DrawCard` amount is an `Aggregate` rather than a literal `1`
// (`summon-shiva`/`deadly-embrace` have the same closure-based scaling-draw
// SHAPE but haven't been migrated onto the combinator DSL yet — not
// eligible for this recognizer until they are). Scoped narrowly to the one
// real confirmed template: `op:'count'` over a `you`-owned pool with
// exactly one `types.has` word, no `excludeSelf`/`attachedToSelf`
// qualifier, and no enclosing guard (Edgar's own clause has neither) —
// widen only when a second real card confirms a different combination.
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { extractOccurrences, programEffects, readPool, type DrawCardOccurrence, type StructuralRecognizerInput } from './program-ast-walker';

export type { StructuralRecognizerInput };

const RULE = 'drawCardProgram-effect-structural' as const;

export function recognizeDrawCardProgramEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const programs = programEffects(input);
  if (programs.length === 0) {
    return { matched: false, reason: "no kind:'program' Effect on this face" };
  }

  const occurrences: DrawCardOccurrence[] = [];
  for (const effect of programs) {
    for (const occ of extractOccurrences(effect.program)) {
      if (occ.kind === 'drawCard') occurrences.push(occ);
    }
  }
  if (occurrences.length === 0) {
    return { matched: false, reason: "no recognized bare DrawCard ProgramNode occurrence in this face's own program AST" };
  }
  if (occurrences.length !== 1) {
    return { matched: false, reason: `expected exactly 1 drawCard occurrence (Venat/Hydaelyn's own confirmed shape), found ${occurrences.length} — no other confirmed template` };
  }

  const occ = occurrences[0]!;

  if (occ.amount !== 1 && typeof occ.amount === 'object' && occ.amount.kind === 'aggregate' && occ.amount.op === 'count') {
    if (occ.guard) {
      return { matched: false, reason: `Aggregate-count drawCard occurrence has an enclosing guard (${JSON.stringify(occ.guard)}) — no confirmed template combining both` };
    }
    const pool = readPool(occ.amount.input);
    if (!pool || pool.owner !== 'you' || pool.excludeSelf || pool.attachedToSelf || pool.types?.has?.length !== 1) {
      return { matched: false, reason: `no confirmed "draw a card for each <type> you control" template for pool ${JSON.stringify(pool)}` };
    }
    const typeWord = pool.types.has[0]!;
    const pattern = new RegExp(`\\bdraw a card for each (${escapeRegExp(typeWord.toLowerCase())} you control)\\b`, 'i');
    const global = new RegExp(pattern.source, pattern.flags + 'gd');
    const matches = [...input.oracleText.matchAll(global)] as (RegExpMatchArray & { indices: Array<[number, number]> })[];
    if (matches.length !== 1) {
      return { matched: false, kind: 'mismatch', reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"` };
    }
    const m = matches[0]!;
    const [fullStart, fullEnd] = m.indices[0]!;
    const [sinkStart, sinkEnd] = m.indices[1]!;
    const sourceAnnotation = toLineOffset(input.oracleText, fullStart, fullEnd);
    const sinkAnnotation = toLineOffset(input.oracleText, sinkStart, sinkEnd);
    if (!sourceAnnotation || !sinkAnnotation) {
      return { matched: false, reason: 'a matched span did not resolve to a single real oracle-text line' };
    }
    return {
      matched: true,
      facts: [
        {
          role: 'source',
          fact: { event: 'drawCard', controller: 'you', annotations: [sourceAnnotation] },
          provenance: { origin: 'parser', rule: RULE },
        },
        {
          role: 'sink',
          fact: { to: 'Battlefield', controller: 'you', types: pool.types!, annotations: [sinkAnnotation] },
          provenance: { origin: 'parser', rule: RULE },
        },
      ],
    };
  }

  if (occ.amount !== 1) {
    return { matched: false, reason: `drawCard occurrence has a non-1, non-Aggregate-count amount (${JSON.stringify(occ.amount)}) — no confirmed template` };
  }
  if (!occ.guard || !('subtype' in occ.guard)) {
    return { matched: false, reason: `expected a categorical (subtype) guard on this drawCard occurrence — got ${JSON.stringify(occ.guard)}, no confirmed template for an unguarded or numerically-guarded program-AST bare draw` };
  }

  const pattern = new RegExp(`\\bIf that creature is ${occ.guard.subtype.toLowerCase()}, draw a card\\b`, 'i');
  const global = new RegExp(pattern.source, pattern.flags + 'g');
  const matches = [...input.oracleText.matchAll(global)];
  if (matches.length !== 1) {
    return { matched: false, kind: 'mismatch', reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"` };
  }

  const m = matches[0]!;
  const annotation = toLineOffset(input.oracleText, m.index!, m.index! + m[0]!.length);
  if (!annotation) {
    return { matched: false, reason: 'matched span did not resolve to a single real oracle-text line' };
  }

  const facts: RecognizedFact[] = [
    {
      role: 'source',
      fact: { event: 'drawCard', controller: 'you', annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];

  return { matched: true, facts };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
