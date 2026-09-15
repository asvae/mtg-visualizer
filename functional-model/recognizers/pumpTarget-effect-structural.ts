// New recognizer (2026-09-15) — structural, sibling of `pumpSelf-effect-
// structural.ts` (see that file's own module doc comment for the shared
// "why a fixed-pump recognizer is safe here specifically" reasoning, not
// repeated). Reads a `kind:'pumpTarget'` `Effect` with literal (non-
// `Computed`) `power`/`toughness` and no `owner`/`notSelf` restriction,
// derives the `event:'pump'` SOURCE fact plus the paired "wants a target
// creature present" SINK fact (same convention `destroy-effect-
// structural.ts`'s own companion-fact pairing already established for a
// different effect kind).
//
// **Real, whole-pool check, literal `power`/`toughness`, no `owner`/
// `notSelf`** (checked all real `kind:'pumpTarget'` occurrences first):
//   - **Matched**: `battle-menu` ("Target creature gets +0/+4 until end of
//     turn" — the one real MIGRATED card this recognizer needs to cover).
//   - **Matched (2026-09-15 follow-up)**: `overkill` ("Target creature gets
//     -0/-9999 until end of turn" — real Magic sign-symmetry templating,
//     see `formatSigned`'s own doc comment: a zero paired with a negative
//     number prints as "-0," not "+0"; `untilEndOfTurn: true` was also a
//     real, pre-existing missing-field bug on this card, fixed the same
//     pass as the rest of this recognizer's own `untilEndOfTurn` fixes).
//   - **Real, deliberate scope narrowing — NOT attempted, named
//     specifically, not a blanket "declines"**:
//     `blitzball-shot`/`galuf-s-final-act`/`haste-magic` are all still
//     v1-schema `synergy.json` (unmigrated — same tolerance every other
//     recognizer already has for a not-yet-migrated card, out of this
//     pipeline's scope regardless of this recognizer's own template) AND
//     each has a real COMPOUND clause ("...and gains trample UNTIL END OF
//     TURN," `blitzball-shot`) where "until end of turn" is not immediately
//     adjacent to the pump numbers — a genuinely different real template
//     this recognizer doesn't attempt (no real MIGRATED card needs it yet).
//     `vayne-s-treachery`'s own SECOND (kicked) mode refers back to the
//     FIRST mode's own chosen target via "THAT creature gets -6/-6," not a
//     fresh "target creature" clause — the exact real pronoun-carryover
//     problem `ambrosia-whiteheart`'s own `definition.ts` comment already
//     named for a DIFFERENT card; this recognizer's own "all qualifying
//     effects on this face must verify, or the whole face declines"
//     discipline (same as `destroy-effect-structural.ts`/`move-effect-
//     structural.ts`) correctly declines this card's FIRST (otherwise
//     clean) mode too, rather than partially asserting one fact and
//     silently dropping the other. `owner`/`notSelf`-restricted cases
//     (`gladiolus-amicitia`, `magic-damper`, `sidequest-play-blitzball...`,
//     `summon-primal-garuda`) are the SAME real template family
//     `move-effect-structural.ts`'s own `owner`/`notSelf` extension already
//     solved for a DIFFERENT effect kind — not ported over to `pumpTarget`
//     in this pass; a real, named follow-up, not a silent gap.
//
// **Annotation convention** — same split `pumpSelf-effect-structural.ts`
// already establishes: the SOURCE fact anchors only "gets ±P/±T" (confirmed
// against `battle-menu`'s own former hand-authored fact, chars 28-38 of its
// own line 2); the paired SINK anchors the WHOLE clause ("Target creature
// gets ±P/±T until end of turn," confirmed against that same card's own
// former hand-authored sink, chars 12-56).
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'pumpTarget-effect-structural' as const;

type PumpTargetEffect = Extract<Effect, { kind: 'pumpTarget' }>;

function isPumpTargetEffect(e: Effect): e is PumpTargetEffect {
  return e.kind === 'pumpTarget' && !e.owner && !e.notSelf;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Real Magic templating (confirmed against `overkill`'s own printed "gets
 * -0/-9999" — Scryfall ground truth, not a guess): a ZERO value takes the
 * SAME sign as its paired power/toughness number when that pair is
 * negative ("-0"), not the default "+0" a zero on its own would get
 * (`battle-menu`'s own confirmed "+0/+4," paired with a POSITIVE 4, keeps
 * the default) — real MTG sign-symmetry within one P/T pair, not a
 * one-off. `pairedWith` is the OTHER number in the same pair; omit only
 * when there is none (never happens in this recognizer's own 2-argument
 * call sites below). */
function formatSigned(n: number, pairedWith: number): string {
  if (n === 0 && pairedWith < 0) return '-0';
  return (n >= 0 ? '+' : '') + n;
}

export function recognizePumpTargetEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const allPumpTarget = allEffects(input).filter((e): e is PumpTargetEffect => e.kind === 'pumpTarget');
  if (allPumpTarget.length === 0) {
    return { matched: false, reason: "no kind:'pumpTarget' Effect on this face" };
  }
  const qualifying = allPumpTarget.filter(isPumpTargetEffect);
  if (qualifying.length !== allPumpTarget.length) {
    return { matched: false, reason: 'an owner/notSelf-restricted pumpTarget effect exists on this face — no confirmed real template for that combination yet (see module doc comment)' };
  }

  const facts: RecognizedFact[] = [];

  for (const effect of qualifying) {
    if (typeof effect.power !== 'number' || typeof effect.toughness !== 'number') {
      return {
        matched: false,
        reason: `a pumpTarget effect on this face (${JSON.stringify(effect)}) has non-literal (Computed<number>) power/toughness — opaque, can't build a real English template without executing it`,
      };
    }

    const numbers = `${escapeRegExp(formatSigned(effect.power, effect.toughness))}\\/${escapeRegExp(formatSigned(effect.toughness, effect.power))}`;
    const suffix = effect.untilEndOfTurn ? ' until end of turn' : '';
    const pattern = new RegExp(`\\b(target creature) (gets ${numbers})${suffix}\\b`, 'i');
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
    const subjectGroup = m[1]!; // "target creature"
    const getsGroup = m[2]!; // "gets ±P/±T"
    const fullStart = m.index!;
    const fullEnd = fullStart + m[0]!.length;
    const getsEnd = fullEnd - suffix.length;
    const getsStart = getsEnd - getsGroup.length;
    const sourceAnnotation = toLineOffset(input.oracleText, getsStart, getsEnd);
    const sinkAnnotation = toLineOffset(input.oracleText, fullStart, fullEnd);
    if (!sourceAnnotation || !sinkAnnotation) {
      return { matched: false, reason: `matched span [${fullStart},${fullEnd}) did not resolve to a single real oracle-text line` };
    }
    void subjectGroup;

    facts.push({
      role: 'source',
      fact: { event: 'pump', target: { types: { has: ['Creature'] } }, targeted: true, annotations: [sourceAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: { to: 'Battlefield', types: { has: ['Creature'] }, annotations: [sinkAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
