// New recognizer (2026-09-15, fin/16-25 pass) — structural, sibling of
// `moveSearchLibrary-effect-structural.ts` (that file covers the
// TO:'HAND' "search your library for a[n] <type> card" template; this one
// covers a genuinely different real template, TO:'BATTLEFIELD', keyed on
// the searched card's own NAME rather than its type — Magitek Infantry's
// own real "{2}{W}: Search your library for a card named Magitek Infantry,
// put it onto the battlefield tapped, then shuffle.").
//
// **Real, whole-pool check**: `card.ts`'s new `move.name:'self'` field
// (closed this same pass, real Forge `ChangeType$ Card.named<Name>`
// citation on that field's own doc comment) — grepped every real `name:`
// on a `move` effect across `functional-model/cards/*/definition.ts`:
// Magitek Infantry is the ONE real card using it. Same "one real card, one
// real recognizer, no speculative generalization" scope every other
// narrowly-motivated recognizer in this catalog already keeps (e.g.
// `costReductionTappedTarget-structural.ts`).
//
// **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-bug
// audit): the sink used to reuse the SAME whole-clause span as SOURCE
// (including the "put it onto the battlefield tapped" tail, which
// describes the move-to-battlefield ACT, not the library precondition
// the sink actually claims) -- narrowed to just "a card named <Name>"
// (the object phrase). SOURCE keeps the WHOLE clause unchanged.
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'moveSearchLibraryNamedSelf-effect-structural' as const;

type MoveEffect = Extract<Effect, { kind: 'move' }>;

function isCandidateEffect(e: Effect): e is MoveEffect {
  return (
    e.kind === 'move' &&
    !e.target &&
    e.owner === 'you' &&
    e.from === 'Library' &&
    e.to === 'Battlefield' &&
    e.name === 'self' &&
    e.tapped === true &&
    e.qty === 1
  );
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function recognizeMoveSearchLibraryNamedSelfEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const candidates = allEffects(input).map((o) => o.effect).filter(isCandidateEffect);
  if (candidates.length === 0) {
    return { matched: false, reason: "no kind:'move' Effect on this face shaped {from:'Library', to:'Battlefield', target:undefined, owner:'you', name:'self', tapped:true, qty:1}" };
  }
  if (candidates.length > 1) {
    return { matched: false, reason: 'more than one qualifying named-self library search on this face — no confirmed real template for that' };
  }
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const triggeredBy = triggeredByOf(effectSourceMap(input).get(candidates[0]!));

  // Group 1 the object phrase ("a card named <Name>," the thing this
  // search's own SINK claims must be present in the library) — narrows
  // the paired SINK's own annotation; SOURCE keeps the WHOLE matched
  // clause unchanged (2026-09-16 SOURCE/SINK span-narrowing fix, same
  // class as `moveSearchLibrary-effect-structural.ts`'s own identical fix
  // — see this file's own module doc comment).
  const pattern = new RegExp(`\\bSearch your library for (a card named ${escapeRegExp(input.name)}), put it onto the battlefield tapped\\b`, 'id');
  const matches = [...input.oracleText.matchAll(new RegExp(pattern.source, pattern.flags + 'g'))] as Array<RegExpMatchArray & { indices: Array<[number, number] | undefined> }>;
  if (matches.length !== 1) {
    return { matched: false, kind: 'mismatch', reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"` };
  }

  const m = matches[0]!;
  const annotation = toLineOffset(input.oracleText, m.index!, m.index! + m[0]!.length);
  const [objectStart, objectEnd] = m.indices[1]!;
  const objectAnnotation = toLineOffset(input.oracleText, objectStart, objectEnd);
  if (!annotation || !objectAnnotation) {
    return { matched: false, reason: 'matched span did not resolve to a single real oracle-text line' };
  }

  const facts: RecognizedFact[] = [
    {
      role: 'source',
      fact: { from: 'Library', to: 'Battlefield', controller: 'you', subject: 'self', name: { eq: input.name }, tapped: true, annotations: [annotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    },
    {
      role: 'sink',
      fact: { to: 'Library', controller: 'you', name: { eq: input.name }, annotations: [objectAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];
  return { matched: true, facts };
}
