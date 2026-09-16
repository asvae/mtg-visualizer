// New recognizer (2026-09-16, engine-lane primitive build) — the
// `kind:'program'` sibling of `putCounterTarget-effect-structural.ts` (that
// one only ever reads a plain `kind:'putCounterTarget'` `Effect`; this one
// reads a `kind:'putCounter'` `EachAction` reached through
// `program-ast-walker.ts`'s general walk — see that file's own header for
// the full "why a program-AST recognizer can't just be a fixed-shape check"
// reasoning, not repeated here).
//
// **Two real, confirmed shapes**, both real pool cards whose `kind:
// 'program'` Effect contains a `'putCounter'` `EachAction` at all (checked
// directly — no third real user exists yet):
//   - `venat-heart-of-hydaelyn-hydaelyn-the-mothercrystal` (fin-39, back
//     face) — Blessing of Light: "...put a +1/+1 counter on another target
//     creature you control..." — a single resolution-time pick
//     (`selectUpTo(you.creaturesInPlay().filter('excludeSelf'), 1,
//     'target', [applyToBound('target', 0, putCounter('+1/+1', 1)), ...])`),
//     literal counterType/amount, `pool.excludeSelf` covering the real
//     "another" qualifier (see `PoolDescriptor.excludeSelf`'s own doc
//     comment). **SOURCE annotation = the WHOLE clause, SINK annotation =
//     just the trailing target noun phrase** — the OPPOSITE split
//     `dealDamageTarget-effect-structural.ts`'s own "narrow verb group
//     source, whole-clause sink" convention uses, but a real, confirmed,
//     different shape here (this card's own pre-existing hand-authored
//     facts, before this recognizer existed, already used this exact split
//     — matched verbatim, not invented): SOURCE = "put a +1/+1 counter on
//     another target creature you control" (the whole real clause); SINK =
//     "another target creature you control" (just the target phrase, since
//     that's the actual "wants a legal target present" claim).
//     `grantKeywordProgram-effect-structural.ts`'s own sibling recognizer
//     does NOT emit a second sink for the identical want — the real text's
//     own anaphoric "it" (Blessing of Light's SECOND sentence) never
//     re-introduces a fresh "target creature" noun phrase, so this ONE sink
//     already covers both real consequences landing on the same chosen
//     creature.
//   - `zack-fair` (fin-45) — "Put Zack Fair's counters on that creature" —
//     a genuinely different real mechanism: a live COUNTER-TRANSFER
//     magnitude (`amount: selfCounters(counterType)`, not a literal),
//     anaphoric "that creature" (no fresh noun phrase — the sibling
//     `grantKeywordProgram-effect-structural.ts` occurrence on this SAME
//     card owns the one real "wants a target creature you control present"
//     sink instead, same reasoning Venat's own anaphoric grantKeyword
//     clause already established, just the OTHER recognizer owning it this
//     time since here it's the FIRST sentence, not putCounter's own, that
//     introduces the fresh noun phrase). Emits a SECOND, genuinely
//     DIFFERENT sink instead: `{event:'putCounter', counterType, target:
//     'self'}` — "wants this card to actually HAVE counters of this type"
//     (the real transfer magnitude precondition — a card with 0 counters
//     still legally resolves this ability, CR 121.2, but the transfer is
//     only meaningful with a nonzero source), matching this card's own
//     pre-existing hand-authored sink shape exactly.
import type { Constraints } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { extractOccurrences, programEffects, type PutCounterOccurrence, type StructuralRecognizerInput } from './program-ast-walker';

export type { StructuralRecognizerInput };

const RULE = 'putCounterProgram-effect-structural' as const;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function recognizePutCounterProgramEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const programs = programEffects(input);
  if (programs.length === 0) {
    return { matched: false, reason: "no kind:'program' Effect on this face" };
  }

  const occurrences: PutCounterOccurrence[] = [];
  for (const effect of programs) {
    for (const occ of extractOccurrences(effect.program)) {
      if (occ.kind === 'putCounter') occurrences.push(occ);
    }
  }
  if (occurrences.length === 0) {
    return { matched: false, reason: "no recognized putCounter EachAction occurrence in this face's own program AST (see program-ast-walker.ts's own readPool/actionOccurrence doc comments for what's in/out of scope)" };
  }
  if (occurrences.length !== 1) {
    return { matched: false, reason: `expected exactly 1 putCounter occurrence (Venat/Hydaelyn's own confirmed shape), found ${occurrences.length} — no other confirmed template` };
  }

  const occ = occurrences[0]!;
  if (!occ.targeted) {
    return { matched: false, reason: 'expected a single resolution-time pick (targeted:true) — no confirmed template for a board-wide broadcast putCounter' };
  }
  if (occ.pool.owner !== 'you' || occ.pool.types?.has?.length !== 1 || occ.pool.types.has[0] !== 'Creature') {
    return { matched: false, reason: `no confirmed "target creature you control" template for pool ${JSON.stringify(occ.pool)}` };
  }

  // Zack Fair's own real counter-TRANSFER shape — `amount` reads `ctx.self`'s
  // own live counter count of the SAME type being placed, no literal at all.
  if (occ.amount.kind === 'selfCounters') {
    if (occ.amount.counterType !== occ.counterType) {
      return { matched: false, reason: `selfCounters amount reads a different counterType (${occ.amount.counterType}) than the one being placed (${occ.counterType}) — no confirmed template for a cross-type transfer` };
    }
    const pattern = new RegExp(`\\bPut ${escapeRegExp(input.name)}'s counters on that creature\\b`, 'i');
    const global = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(global)];
    if (matches.length !== 1) {
      return { matched: false, kind: 'mismatch', reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"` };
    }
    const m = matches[0]!;
    const sourceAnnotation = toLineOffset(input.oracleText, m.index!, m.index! + m[0]!.length);
    if (!sourceAnnotation) {
      return { matched: false, reason: 'matched span did not resolve to a single real oracle-text line' };
    }
    // The magnitude-precondition sink — "wants this card to actually HAVE
    // counters of this type" — anchored to just the possessive "<name>'s
    // counters" sub-phrase, not the whole clause (same real, pre-existing
    // hand-authored annotation this recognizer reproduces).
    const magnitudePattern = new RegExp(`\\b${escapeRegExp(input.name)}'s counters\\b`, 'i');
    const magnitudeMatch = magnitudePattern.exec(input.oracleText);
    if (!magnitudeMatch) {
      return { matched: false, reason: `expected sub-phrase /${magnitudePattern.source}/ not found inside the already-matched clause — recognizer bug` };
    }
    const sinkAnnotation = toLineOffset(input.oracleText, magnitudeMatch.index, magnitudeMatch.index + magnitudeMatch[0].length);
    if (!sinkAnnotation) {
      return { matched: false, reason: 'magnitude sub-phrase span did not resolve to a single real oracle-text line' };
    }
    return {
      matched: true,
      facts: [
        {
          role: 'source',
          fact: { event: 'putCounter', counterType: occ.counterType, controller: 'you', target: { types: occ.pool.types! }, targeted: true, annotations: [sourceAnnotation] },
          provenance: { origin: 'parser', rule: RULE },
        },
        {
          role: 'sink',
          fact: { event: 'putCounter', counterType: occ.counterType, target: 'self', annotations: [sinkAnnotation] },
          provenance: { origin: 'parser', rule: RULE },
        },
      ],
    };
  }

  if (occ.amount.kind !== 'literal' || occ.amount.value !== 1) {
    return { matched: false, reason: `putCounter occurrence has a non-literal or non-1 amount (${JSON.stringify(occ.amount)}) — no confirmed template` };
  }

  const another = occ.pool.excludeSelf ? 'another ' : '';
  const pattern = new RegExp(`\\b(put a ${escapeRegExp(occ.counterType)} counter on (${another}target creature you control))\\b`, 'i');
  const global = new RegExp(pattern.source, pattern.flags + 'gd');
  const matches = [...input.oracleText.matchAll(global)] as (RegExpMatchArray & { indices: Array<[number, number]> })[];
  if (matches.length !== 1) {
    return { matched: false, kind: 'mismatch', reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"` };
  }

  const m = matches[0]!;
  const [fullStart, fullEnd] = m.indices[1]!;
  const [sinkStart, sinkEnd] = m.indices[2]!;
  const sourceAnnotation = toLineOffset(input.oracleText, fullStart, fullEnd);
  const sinkAnnotation = toLineOffset(input.oracleText, sinkStart, sinkEnd);
  if (!sourceAnnotation || !sinkAnnotation) {
    return { matched: false, reason: 'a matched span did not resolve to a single real oracle-text line' };
  }

  const target: Constraints = { types: occ.pool.types!, ...(occ.pool.excludeSelf ? { excludeSelf: true } : {}) };

  const facts: RecognizedFact[] = [
    {
      role: 'source',
      fact: { event: 'putCounter', counterType: occ.counterType, controller: 'you', target, targeted: true, annotations: [sourceAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
    {
      role: 'sink',
      fact: { to: 'Battlefield', controller: 'you', ...target, annotations: [sinkAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];

  return { matched: true, facts };
}
