// New recognizer (2026-09-16, engine-lane primitive build) — the
// `kind:'program'` sibling of `grantKeywordTarget-effect-structural.ts`
// (that one only ever reads a plain `kind:'grantKeywordTarget'` `Effect`;
// this one reads a `kind:'grantKeyword'` `EachAction` reached through
// `program-ast-walker.ts`'s general walk — see that file's own header for
// the full "why a program-AST recognizer can't just be a fixed-shape check"
// reasoning, not repeated here).
//
// **Two real, confirmed shapes**, both real pool cards whose `kind:
// 'program'` Effect contains a `'grantKeyword'` `EachAction` at all
// (checked directly — no third real user exists yet):
//   - `venat-heart-of-hydaelyn-hydaelyn-the-mothercrystal` (fin-39, back
//     face) — "Until your next turn, it gains indestructible." — an
//     anaphoric "it" (the SAME creature `putCounterProgram-effect-
//     structural.ts`'s own sibling occurrence already picked), no fresh
//     "target creature" noun phrase, and NO `untilEndOfTurn` on the
//     occurrence (this card's own real duration is "until your next turn,"
//     a genuinely different, NOT-tracked duration — see `card.ts`'s own
//     `grantKeyword` builder doc comment/that card's own `definition.ts`
//     migration comment). Emits ONLY a SOURCE fact — no new SINK, since
//     the sibling `putCounter` occurrence's own sink already covers the one
//     real "wants a legal target creature present" want both consequences
//     share.
//   - `zack-fair` (fin-45) — "Target creature you control gains
//     indestructible until end of turn." — a FRESH "target creature you
//     control" noun phrase (no anaphora at all) and a real, genuinely
//     TRACKED `untilEndOfTurn: true` (514.2 Cleanup expiry, unlike Venat's
//     own untracked duration). This template's own real "wants a target
//     creature you control present" — its OWN sink fact, since (unlike
//     Venat) there's no sibling putCounter occurrence sink to reuse; this
//     card's own real text puts the counter-transfer SECOND, in a wholly
//     separate sentence with its own separate anaphoric "that creature"
//     (see `putCounterProgram-effect-structural.ts`'s own module doc
//     comment for that sentence's own sink).
// The two are told apart purely by `occ.untilEndOfTurn` (`false`/absent =
// Venat's anaphoric-no-duration shape; `true` = Zack Fair's fresh-noun-
// phrase-with-duration shape) — a third real combination (fresh noun
// phrase, no duration; or anaphoric, with duration) has no confirmed
// template and declines.
import type { Constraints } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { extractOccurrences, programEffects, type GrantKeywordOccurrence, type StructuralRecognizerInput } from './program-ast-walker';

export type { StructuralRecognizerInput };

const RULE = 'grantKeywordProgram-effect-structural' as const;

export function recognizeGrantKeywordProgramEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const programs = programEffects(input);
  if (programs.length === 0) {
    return { matched: false, reason: "no kind:'program' Effect on this face" };
  }

  const occurrences: GrantKeywordOccurrence[] = [];
  for (const effect of programs) {
    for (const occ of extractOccurrences(effect.program)) {
      if (occ.kind === 'grantKeyword') occurrences.push(occ);
    }
  }
  if (occurrences.length === 0) {
    return { matched: false, reason: "no recognized grantKeyword EachAction occurrence in this face's own program AST (see program-ast-walker.ts's own readPool/actionOccurrence doc comments for what's in/out of scope)" };
  }
  if (occurrences.length !== 1) {
    return { matched: false, reason: `expected exactly 1 grantKeyword occurrence (Venat/Hydaelyn's or Zack Fair's own confirmed shapes), found ${occurrences.length} — no other confirmed template` };
  }

  const occ = occurrences[0]!;
  if (!occ.targeted) {
    return { matched: false, reason: 'expected a single resolution-time pick (targeted:true) — no confirmed template for a board-wide broadcast grantKeyword' };
  }
  if (occ.pool.owner !== 'you' || occ.pool.types?.has?.length !== 1 || occ.pool.types.has[0] !== 'Creature') {
    return { matched: false, reason: `no confirmed template for pool ${JSON.stringify(occ.pool)}` };
  }

  const target: Constraints = { types: occ.pool.types!, ...(occ.pool.excludeSelf ? { excludeSelf: true } : {}) };
  const keyword = occ.keyword.toLowerCase();

  if (!occ.untilEndOfTurn) {
    // Venat/Hydaelyn's own anaphoric, no-duration shape — a single narrow
    // clause, no separate subject-phrase group to split off (the subject is
    // "it", not a fresh noun phrase).
    const pattern = new RegExp(`\\bUntil your next turn, it gains ${keyword}\\b`, 'i');
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
    return {
      matched: true,
      facts: [
        {
          role: 'source',
          fact: { event: 'grantKeyword', keyword: occ.keyword, controller: 'you', target, targeted: true, annotations: [annotation] },
          provenance: { origin: 'parser', rule: RULE },
        },
      ],
    };
  }

  // Zack Fair's own fresh-noun-phrase, tracked-duration shape — same
  // "narrow verb-group SOURCE, narrow subject-phrase SINK" split
  // `putCounterProgram-effect-structural.ts`'s own sibling recognizer
  // establishes for the identical real card (2 separately-annotated
  // groups, not the whole combined clause for either).
  const pattern = new RegExp(`\\b(target creature you control) (gains ${keyword} until end of turn)\\b`, 'i');
  const global = new RegExp(pattern.source, pattern.flags + 'gd');
  const matches = [...input.oracleText.matchAll(global)] as (RegExpMatchArray & { indices: Array<[number, number]> })[];
  if (matches.length !== 1) {
    return { matched: false, kind: 'mismatch', reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"` };
  }
  const m = matches[0]!;
  const [sinkStart, sinkEnd] = m.indices[1]!;
  const [sourceStart, sourceEnd] = m.indices[2]!;
  const sinkAnnotation = toLineOffset(input.oracleText, sinkStart, sinkEnd);
  const sourceAnnotation = toLineOffset(input.oracleText, sourceStart, sourceEnd);
  if (!sinkAnnotation || !sourceAnnotation) {
    return { matched: false, reason: 'a matched span did not resolve to a single real oracle-text line' };
  }

  return {
    matched: true,
    facts: [
      {
        role: 'source',
        fact: { event: 'grantKeyword', keyword: occ.keyword, controller: 'you', target, targeted: true, untilEndOfTurn: true, annotations: [sourceAnnotation] },
        provenance: { origin: 'parser', rule: RULE },
      },
      {
        role: 'sink',
        fact: { to: 'Battlefield', controller: 'you', ...target, annotations: [sinkAnnotation] },
        provenance: { origin: 'parser', rule: RULE },
      },
    ],
  };
}
