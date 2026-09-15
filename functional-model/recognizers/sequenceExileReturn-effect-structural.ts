// New recognizer (2026-09-15, fin/11-15 audit follow-up — Crystal Fragments
// // Summon: Alexander's own remaining "exile this, return it transformed"
// facts, same shape Dion, Bahamut's Dominant // Bahamut, Warden of Light
// already carries twice). Structural — reads a `kind:'program'` `Effect`
// whose own `program` is `combinator.ts`'s `Sequence` node, never oracle
// text for STRUCTURE (only for the confirming clause, same discipline every
// other structural recognizer in this family follows).
//
// **Real, whole-pool check — closed vocabulary, checked directly against
// `combinator.ts`'s own header before relying on it (not assumed)**: that
// file's own comment states `Sequence` exists for "the 3 migrated
// exile-then-return-to-battlefield closures" — i.e. `kind:'sequence'` is
// ALREADY a reliable, exhaustive, pool-wide signal for exactly this one CR
// shape, never used for anything else. Grepped directly: exactly 3 real
// `sequence(...)` call sites exist pool-wide — Crystal Fragments' own front
// face (its {5}{W}{W} transform ability) and Dion, Bahamut's Dominant's own
// TWO (its front face's {4}{W}{W},{T} transform ability, and its own back
// face's chapter III). This recognizer covers all 3.
//
// **Two facts per match, sharing one annotation** — same "shared span"
// convention `move-effect-structural.ts`'s own module doc comment already
// establishes for its own from/to pair:
//   - `{to:'Exile', from:'Battlefield', subject:'self'}` (the exile leg).
//   - `{event:'entersBattlefield', to:'Battlefield', from:'Exile',
//     subject:'self', target:'self'}` (the return leg, `target:'self'`
//     normalizes away under `apply-recognizers.mjs`'s own `coreKey`
//     `normalizeSelfSubject` rule, matching `entersBattlefield-self-trigger-
//     structural.ts`'s own established convention for the same field pair).
//
// **Subject alternation, closed vocabulary for this recognizer's own 3 real
// cases**: Crystal Fragments' own oracle text says "Exile this Equipment"
// (never a bare card-type word already covered by `pumpSelf-effect-
// structural.ts`'s own `TYPE_WORDS`, since Equipment is an artifact
// SUBTYPE, not `card.ts`'s own `PERMANENT_TYPE_WORDS` list) — `Equipment`
// added here, locally, rather than widening any shared list (same
// "duplicate a small `selfSubjectAlternation` per recognizer, never
// extract" convention `dies-trigger-structural.ts`/`pumpSelf-effect-
// structural.ts`/`putCounterSelf-effect-structural.ts` already establish).
// Dion's own two occurrences both say "Exile Dion"/"Exile Bahamut" (the
// literal, no-comma card name) — the plain name alternative already covers
// both.
//
// **Confirmed clause boundary**: this recognizer's own pattern stops right
// after "the battlefield" — deliberately NOT anchoring whatever real,
// per-card suffix follows ("transformed under its owner's control,"
// "(front face up)," differs card to card and carries no separate fact this
// recognizer's own claim needs) — same "claim only the semantically
// load-bearing part" discipline `pumpSelf-effect-structural.ts`'s own
// "gets ±P/±T" (never the subject before it) already establishes.
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'sequenceExileReturn-effect-structural' as const;

type ProgramEffect = Extract<Effect, { kind: 'program' }>;

function isExileReturnSequence(e: Effect): e is ProgramEffect {
  if (e.kind !== 'program') return false;
  const program = e.program;
  if (program.kind !== 'sequence') return false;
  return (
    program.steps.length === 2 &&
    program.steps[0]!.action === 'moveSelf' &&
    program.steps[0]!.to === 'Exile' &&
    program.steps[1]!.action === 'moveSelf' &&
    program.steps[1]!.to === 'Battlefield'
  );
}

const TYPE_WORDS = ['Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle', 'Equipment'];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function selfSubjectAlternation(name: string): string {
  const typeAlt = TYPE_WORDS.map((w) => `this ${w.toLowerCase()}`).join('|');
  const shortName = name.split(',')[0]!.trim();
  const nameAlt = shortName !== name ? `${escapeRegExp(name)}|${escapeRegExp(shortName)}` : escapeRegExp(name);
  return `(?:${typeAlt}|this permanent|${nameAlt})`;
}

export function recognizeSequenceExileReturnEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const matches_ = allEffects(input).filter(isExileReturnSequence);
  if (matches_.length === 0) {
    return { matched: false, reason: "no kind:'program' Effect whose own program is a Sequence('Exile','Battlefield')" };
  }

  const facts: RecognizedFact[] = [];
  const subject = selfSubjectAlternation(input.name);
  const pattern = new RegExp(`\\bExile ${subject}, then return it to the battlefield\\b`, 'i');
  const globalPattern = new RegExp(pattern.source, pattern.flags + 'g');

  for (const _effect of matches_) {
    const matches = [...input.oracleText.matchAll(globalPattern)];
    if (matches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
      };
    }
    const m = matches[0]!;
    const annotation = toLineOffset(input.oracleText, m.index!, m.index! + m[0]!.length);
    if (!annotation) {
      return { matched: false, reason: `matched span [${m.index},${m.index! + m[0]!.length}) did not resolve to a single real oracle-text line` };
    }

    facts.push({
      role: 'source',
      fact: { to: 'Exile', from: 'Battlefield', subject: 'self', annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'source',
      fact: { event: 'entersBattlefield', to: 'Battlefield', from: 'Exile', subject: 'self', target: 'self', annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
