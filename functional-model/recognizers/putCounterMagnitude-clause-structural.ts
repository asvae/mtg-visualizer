// New recognizer (2026-09-14, fact-parity pass — Aerith Gainsborough's own
// LAST remaining hand-authored `authoredFact`, kept deliberately tier-3 in
// its own definition.ts comment). Text-based, same family as
// `lifegain-trigger-structural.ts`/`dies-trigger-structural.ts` (never reads
// `Effect[]` structure at all — a pure literal-clause match): "where X is the
// number of <counterType> counters on <self-subject>" — the MAGNITUDE half of
// a trigger whose own effect scales by a count of counters already sitting on
// this permanent.
//
// **Why this is genuinely tier-1, not a re-litigation of the tier-3 verdict
// its own `authoredFact` comment gives** (read in full before writing this
// recognizer, per this task's own instruction) — that comment's reasoning is
// entirely about tier 2 (`runtime-action-probe`'s dependency-TRACING
// approach): proving a specific runtime NUMBER causally flows from
// `ctx.self.getCounters(...)` into a `putCounter` call's own `amount`
// argument needs real numeric-value PROVENANCE tracking this codebase's
// probe family genuinely can't do (JS primitives carry no object identity a
// `WeakMap`-based tracker can hang a path off — see that comment's own full
// writeup). This recognizer never executes or traces anything: it matches
// the literal ENGLISH TEMPLATE Magic's own templating language uses for this
// exact clause shape, the identical "build the expected clause from a real
// structural signal, then require it to appear verbatim" shape
// `lifegain-trigger-structural.ts` already uses to match "Whenever you gain
// life" without ever touching a `Computed<number>` closure at all. The
// tier-2 wall and this tier-1 template are simply orthogonal — one reads
// runtime data flow, the other reads printed prose.
//
// **Real, whole-pool check done first**: grepped every real card's own
// `AuthoredFact` for the exact shape this task named (`role:'sink',
// event:'putCounter', counterType, target:'self'`, tier-3, with its own
// magnitude-dependency reasoning in a comment) across
// `functional-model/cards/*/definition.ts` — **exactly ONE real occurrence**,
// Aerith Gainsborough's own. (`aerith-rescue-mission`'s own `authoredFact`
// entries are a genuinely different shape — a chosen, TAPPED target
// receiving a stun counter via a two-step "tap N, then counter one of those
// N" closure, `target: {types:{has:['Creature']}}`, never `target:'self'`;
// checked and confirmed this does NOT qualify.) Separately grepped every
// real card's own printed oracle text for the broader literal template
// "where X is the number of ... counters on ..." (not gated on having an
// `authoredFact` at all, since a recognizer should cover every REAL clause
// of this shape, not just ones someone already hand-authored a fact for) —
// 8 real cards use a "where X is the number of ..." clause at all (The Final
// Days, Summon: Titan, Cloud of Darkness, The Emperor of Palamecia // The
// Lord Master of Hell, Omega, Heartless Evolution, The Wandering Minstrel,
// Judgment Bolt, plus Aerith herself), but every one of the other 7 counts
// something OTHER than "<counterType> counters on <self>" (creature cards in
// a graveyard, lands controlled, permanent cards in a graveyard,
// noncreature/nonland cards in a graveyard, nonbasic lands controlled, Towns
// controlled, Equipment controlled) — none is even a near-miss for THIS
// narrower template, so this recognizer's own vocabulary is confirmed to not
// collide with any of them. This template genuinely does NOT vary across the
// one real card that needs it today; if a future card needs a materially
// different phrasing for the same underlying "reads its own counters as a
// magnitude" shape, that's a new template to confirm against real text then,
// not something to guess at now.
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

const RULE = 'putCounterMagnitude-clause-structural' as const;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Same self-referential-subject vocabulary `dies-trigger-structural.ts`/
 * `putCounterSelf-effect-structural.ts` already established and vetted — see
 * either file's own doc comment; duplicated here per this catalog's own
 * established per-file convention. */
const PERMANENT_TYPE_WORDS = ['Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle'];

function selfSubjectAlternation(name: string): string {
  const typeAlt = PERMANENT_TYPE_WORDS.map((w) => `this ${w.toLowerCase()}`).join('|');
  const shortName = name.split(',')[0]!.trim();
  const nameAlt = shortName !== name ? `${escapeRegExp(name)}|${escapeRegExp(shortName)}` : escapeRegExp(name);
  return `(?:${typeAlt}|this permanent|${nameAlt})`;
}

/** "where X is the number of <counterType> counters on <self-subject>" — the
 * counterType itself is CAPTURED straight out of the real printed text
 * (group 1, non-greedy up to the next "counter(s)") rather than supplied by
 * a caller, since this is a pure text recognizer with no structural `Effect`
 * to read one off of — same "the clause itself carries every fact this
 * recognizer needs" shape `lifegain-trigger-structural.ts`'s own fixed clause
 * already has, just with one variable slot here instead of zero. */
function buildPattern(subjectAlt: string): RegExp {
  return new RegExp(`\\bwhere X is the number of ([^\\n]+?) counters?\\s+on\\s+${subjectAlt}\\b`, 'i');
}

export function recognizePutCounterMagnitudeClauseStructural(input: RecognizerInput): RecognizerResult {
  const pattern = buildPattern(selfSubjectAlternation(input.name));
  const global = new RegExp(pattern.source, pattern.flags + 'g');
  const matches = [...input.oracleText.matchAll(global)];

  if (matches.length === 0) {
    return { matched: false, reason: `no "where X is the number of <counterType> counters on <self>" clause found in oracle text "${input.oracleText}"` };
  }
  if (matches.length > 1) {
    return {
      matched: false,
      kind: 'mismatch',
      reason: `expected clause /${pattern.source}/ matched ${matches.length} times — ambiguous, declining rather than guessing which`,
    };
  }

  const m = matches[0]!;
  const counterType = m[1]!.trim();
  const start = m.index!;
  const end = start + m[0]!.length;
  const annotation = toLineOffset(input.oracleText, start, end);
  if (!annotation) {
    return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
  }

  const facts: RecognizedFact[] = [
    {
      role: 'sink',
      fact: { event: 'putCounter', counterType, target: 'self', annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];
  return { matched: true, facts };
}
