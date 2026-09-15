// New recognizer (2026-09-15) — structural, same family as
// `putCounterSelf-effect-structural.ts`: reads a `kind:'pumpSelf'` `Effect`
// (a literal, non-`Computed` `power`/`toughness` pump of THIS permanent)
// straight off `CardDefinition`, then requires a built clause to appear
// verbatim in this face's own real oracle text before asserting anything.
// The real motivating case (`ambrosia-whiteheart`'s own Landfall pump) is
// the SAME "fixed pump" shape this whole catalog's other recognizers'
// module doc comments already flagged as "materially bigger, riskier lift"
// than a single-verb template (`destroy`/`drawCard`) — solved here for the
// one real, closed subject-alternation shape this pool's own literal-value
// `pumpSelf` population actually needs (see below), not for every
// conceivable English pump template.
//
// **Real, whole-pool check, literal (non-`Computed`) `power`/`toughness`
// only** (8 real `kind:'pumpSelf'` occurrences; `gran-pulse-ochu`/`tifa-
// lockhart`/`shantotto-tactician-magician` all use a `Computed<number>`
// function for `power` — the same opaque-closure wall every other
// structural recognizer already declines under, checked and confirmed, not
// attempted here):
//   - `ambrosia-whiteheart` ("Ambrosia Whiteheart gets +1/+0" — full name),
//     `choco-seeker-of-paradise` ("Choco gets +1/+0" — short name before the
//     first comma), `loporrit-scout`/`woodland-weavemaster` ("this creature
//     gets +1/+1"), `jumbo-cactuar` ("it gets +9999/+0" — a bare PRONOUN, a
//     real, confirmed subject form neither `dies-trigger-structural.ts` nor
//     `putCounterSelf-effect-structural.ts` needed before; safe here
//     specifically because the immediately-following EXACT numeric suffix
//     this recognizer already requires makes a generic pronoun a
//     low-false-positive-risk anchor, unlike a bare pronoun with no such
//     anchor).
//   - **Real, pre-existing `untilEndOfTurn` bug, fixed alongside this
//     recognizer (2026-09-15, same real gap `ambrosia-whiteheart`'s own
//     identical field was already fixed for 2026-09-14)**: `choco-seeker-
//     of-paradise`/`jumbo-cactuar`/`loporrit-scout`/`woodland-weavemaster`
//     all had their own printed "...gets +N/+N UNTIL END OF TURN" with NO
//     `untilEndOfTurn: true` on the structured `Effect` at all — a real,
//     latent PERMANENT-pump bug (`state.ts`'s own `pump`/
//     `clearUntilEndOfTurnPumps`), not something this recognizer should
//     paper over by ignoring the "until end of turn" suffix; fixed directly
//     in each card's own `definition.ts` (each with its own dated comment),
//     not worked around here.
//
// **Annotation convention, confirmed against BOTH real pre-existing
// hand-authored facts this recognizer supersedes** (`ambrosia-whiteheart`'s
// own former source fact, chars 67-77 of its own line 2 — "gets +1/+0",
// NOT the subject name) — the derived annotation covers ONLY the "gets
// ±P/±T" suffix, never the subject text before it.
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'pumpSelf-effect-structural' as const;

type PumpSelfEffect = Extract<Effect, { kind: 'pumpSelf' }>;

function isPumpSelfEffect(e: Effect): e is PumpSelfEffect {
  return e.kind === 'pumpSelf';
}

// Real, confirmed subject alternation for THIS recognizer only (see module
// doc comment for why `it` is safe here specifically — not shared with
// `dies-trigger-structural.ts`'s own stricter, no-bare-pronoun list, since
// that recognizer's own anchor, "dies," has no numeric suffix to make a
// pronoun low-risk the same way).
const TYPE_WORDS = ['Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle'];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatSigned(n: number): string {
  return (n >= 0 ? '+' : '') + n;
}

function selfSubjectAlternation(name: string): string {
  const typeAlt = TYPE_WORDS.map((w) => `this ${w.toLowerCase()}`).join('|');
  const shortName = name.split(',')[0]!.trim();
  const nameAlt = shortName !== name ? `${escapeRegExp(name)}|${escapeRegExp(shortName)}` : escapeRegExp(name);
  return `(?:${typeAlt}|this permanent|it|${nameAlt})`;
}

export function recognizePumpSelfEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const pumpEffects = allEffects(input).filter(isPumpSelfEffect);
  if (pumpEffects.length === 0) {
    return { matched: false, reason: "no kind:'pumpSelf' Effect on this face" };
  }

  const facts: RecognizedFact[] = [];

  for (const effect of pumpEffects) {
    if (typeof effect.power !== 'number' || typeof effect.toughness !== 'number') {
      return {
        matched: false,
        reason: `a pumpSelf effect on this face (${JSON.stringify(effect)}) has non-literal (Computed<number>) power/toughness — opaque, can't build a real English template without executing it`,
      };
    }

    const subject = selfSubjectAlternation(input.name);
    const numbers = `${escapeRegExp(formatSigned(effect.power))}\\/${escapeRegExp(formatSigned(effect.toughness))}`;
    const suffix = effect.untilEndOfTurn ? ' until end of turn' : '';
    const pattern = new RegExp(`\\b${subject} (gets ${numbers})${suffix}\\b`, 'i');
    const globalPattern = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(globalPattern)];
    if (matches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
      };
    }

    const m = matches[0]!;
    const group = m[1]!; // "gets ±P/±T" — the ONLY part this recognizer annotates
    const fullStart = m.index!;
    const fullEnd = fullStart + m[0]!.length;
    // `group` is always a SUFFIX of the full match (subject text always
    // precedes it, nothing follows it inside the match) — compute its own
    // offset arithmetically rather than needing the `d` regex flag.
    const groupEnd = fullEnd - suffix.length;
    const groupStart = groupEnd - group.length;
    const annotation = toLineOffset(input.oracleText, groupStart, groupEnd);
    if (!annotation) {
      return { matched: false, reason: `matched span [${groupStart},${groupEnd}) did not resolve to a single real oracle-text line` };
    }

    facts.push({
      role: 'source',
      fact: { event: 'pump', target: 'self', annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
