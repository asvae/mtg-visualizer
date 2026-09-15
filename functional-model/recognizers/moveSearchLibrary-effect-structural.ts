// New recognizer (2026-09-15) — structural, sibling of `move-effect-
// structural.ts` (that file covers `kind:'move', target:true`; this one
// covers the UNTARGETED "search your library for a[n] <type> card, reveal
// it, put it into your hand, then shuffle" template instead — a real,
// clean, closed Magic template `cloud-midgar-mercenary`'s own
// `definition.ts` comment already identified, along with the real reason it
// used to be un-mechanizable: "Every real candidate this shape... has a
// confirmed, systemic divergence between the structured `validType` field
// and the actual printed type word" — CLOSED for real this pass, not
// papered over, by extending `move`'s own `subtype` field (previously
// TARGETED-branch-only, `card.ts`'s own doc comment) to be read for the
// UNTARGETED branch too (`card.ts`'s `case 'move'`, `interfaces.ts`'s
// `move` signature, `harness.ts`'s own implementation — all 3 updated the
// same pass as this recognizer).
//
// **The general rule, checked against all 3 real candidates**: prefer
// `effect.subtype`'s own literal word (the MORE PRECISE real restriction,
// when set) over `validType`'s own generic word; build "search your
// library for a[n] <word> card, reveal it, put it into your hand, then
// shuffle"; require it to appear verbatim, exactly once, or decline
// (`kind:'mismatch'`) — same conservative discipline as every other
// structural recognizer here.
//   - **`cloud-midgar-mercenary` (fin/10) — MATCHED, the real motivating
//     case.** `subtype:'Equipment'` (newly added this pass, replacing the
//     former honest-approximation `validType:'artifact'`) builds "search
//     your library for an Equipment card" — verbatim in the real text.
//   - **`sazh-katzroy` — still correctly declines, a DIFFERENT real gap,
//     not closed by this pass**: real text is "a Bird OR BASIC LAND card"
//     — a compound OR-restriction (two type words, not one) this
//     recognizer's own single-word template can't build, AND "basic" is a
//     real MTG SUPERTYPE this engine's Card model has no concept of at all
//     (checked directly: no `isBasic`/supertype field anywhere in
//     `interfaces.ts`/`state.ts`) — a materially different, bigger gap
//     (new supertype-tracking engine surface) than Cloud's own (an
//     already-existing field's read-path extended one branch further), not
//     attempted in this pass.
//   - **`world-map` — still correctly declines, for the SAME reason**: its
//     own FIRST ability ("Search your library for A BASIC land card") hits
//     the identical missing-supertype wall; its SECOND ability ("Search
//     your library for A LAND card," no "basic" restriction) would
//     actually verify cleanly in isolation, but this recognizer's own
//     "every qualifying effect on this face must verify, or the whole face
//     declines" discipline (same as `destroy-effect-structural.ts`/`move-
//     effect-structural.ts`) means the first ability's own decline takes
//     the whole card down with it — a real, accepted, named tradeoff, not
//     an oversight.
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'moveSearchLibrary-effect-structural' as const;

type MoveEffect = Extract<Effect, { kind: 'move' }>;

function isSearchLibraryEffect(e: Effect): e is MoveEffect {
  return e.kind === 'move' && e.from === 'Library' && e.to === 'Hand' && !e.target && e.owner === 'you';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The real printed type-word this effect's own structured data implies —
 * `effect.subtype`'s own literal word (the precise, real restriction) takes
 * priority over `validType`'s own generic word (see module doc comment).
 * `undefined` (never guessed) when neither field gives a confirmed,
 * single-word template. */
function typeWordFor(effect: MoveEffect): string | undefined {
  if (typeof effect.qty !== 'number' || effect.qty !== 1) return undefined; // no real qty>1 template
  if (effect.subtype) return effect.subtype;
  if (effect.validType === 'creature') return 'creature';
  if (effect.validType === 'artifact') return 'artifact';
  if (effect.validType === 'land') return 'land';
  return undefined; // 'any'/undefined validType with no subtype has no confirmed single-word template
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

export function recognizeMoveSearchLibraryEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const effects = allEffects(input).filter(isSearchLibraryEffect);
  if (effects.length === 0) {
    return { matched: false, reason: "no untargeted, owner:'you', from:'Library'-to:'Hand' kind:'move' Effect on this face" };
  }

  const lines = input.oracleText.split('\n');
  const claimedLines = new Set<number>();
  const facts: RecognizedFact[] = [];

  for (const effect of effects) {
    const typeWord = typeWordFor(effect);
    if (!typeWord) {
      return {
        matched: false,
        reason: `a search-library move effect on this face (${JSON.stringify(effect)}) has no confirmed single-word type template (no subtype, and validType is omitted/'any' — see module doc comment)`,
      };
    }
    const phrase = `search your library for ${article(typeWord)} ${escapeRegExp(typeWord)} card`;
    const pattern = new RegExp(`\\b${phrase}\\b`, 'i');
    let claimedLine: number | undefined;
    let matchStart: number | undefined;
    let matchEnd: number | undefined;
    for (let i = 0; i < lines.length; i++) {
      if (claimedLines.has(i)) continue;
      const m = pattern.exec(lines[i]!);
      if (m) {
        claimedLine = i;
        matchStart = m.index;
        matchEnd = m.index + m[0].length;
        break;
      }
    }
    if (claimedLine === undefined || matchStart === undefined || matchEnd === undefined) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected phrase /${pattern.source}/ not found on any real, not-yet-claimed oracle-text line (oracle text: "${input.oracleText}")`,
      };
    }
    claimedLines.add(claimedLine);

    const annotation = { target: 'oracle' as const, line: claimedLine, start: matchStart, end: matchEnd };
    facts.push({
      role: 'source',
      fact: { from: 'Library', to: 'Hand', controller: 'you', types: { has: [typeWord] }, annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: { to: 'Library', controller: 'you', types: { has: [typeWord] }, annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
