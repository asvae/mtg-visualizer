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
//   - **Matched (2026-09-15, fin/16-25 pass)**: `blitzball-shot`/
//     `haste-magic` — both real cards were previously declined here
//     (correctly, at the time) for two SEPARATE, now-fixed reasons: (1) both
//     effects were missing `untilEndOfTurn: true` entirely, a real bug fixed
//     the same pass (their real oracle text always said "until end of
//     turn"); (2) even after that fix, both have a real COMPOUND clause
//     ("...and gains trample UNTIL END OF TURN") where "until end of turn"
//     isn't immediately adjacent to the pump numbers — the pattern below now
//     tolerates a non-greedy same-sentence gap there (same connector
//     tolerance `grantKeywordAll-effect-structural.ts` already establishes
//     for its own analogous case), so this is no longer a scope decline.
//     `galuf-s-final-act` is still real, unmigrated v1-schema `synergy.json`
//     (unrelated to either fix above) — same tolerance every other
//     recognizer already has for a not-yet-migrated card.
//     `vayne-s-treachery`'s own SECOND (kicked) mode refers back to the
//     FIRST mode's own chosen target via "THAT creature gets -6/-6," not a
//     fresh "target creature" clause — the exact real pronoun-carryover
//     problem `ambrosia-whiteheart`'s own `definition.ts` comment already
//     named for a DIFFERENT card; this recognizer's own "all qualifying
//     effects on this face must verify, or the whole face declines"
//     discipline (same as `destroy-effect-structural.ts`/`move-effect-
//     structural.ts`) correctly declines this card's FIRST (otherwise
//     clean) mode too, rather than partially asserting one fact and
//     silently dropping the other.
//
// **`owner`/`notSelf` extension** (2026-09-16, fin/26-50 follow-up,
// finally porting the same `owner`/`notSelf` template family
// `move-effect-structural.ts`/`grantKeywordTarget-effect-structural.ts`
// already established for their own effect kinds — a real, named follow-up
// this file's own prior doc comment left open, not a silent gap): checked
// every real `owner`/`notSelf`-restricted `kind:'pumpTarget'` effect in the
// pool —
//   - **Matched**: `gladiolus-amicitia` ("another target creature you
//     control gets +2/+2 and gains trample" — `owner:'you', notSelf:true`),
//     `magic-damper` ("Target creature you control gets +1/+1 and gains
//     hexproof until end of turn" — `owner:'you'`, no `notSelf`),
//     `sidequest-play-blitzball-world-champion-celestial-weapon` ("target
//     creature you control gets +2/+0 until end of turn" — `owner:'you'`,
//     no `notSelf`), `summon-primal-garuda` ("Another target creature you
//     control gets +1/+0 and gains flying until end of turn" —
//     `owner:'you', notSelf:true`).
//   - **Still declines (no confirmed template)**: `owner:'opponents'`
//     (`cloud-of-darkness`'s own real card — moot either way, its own
//     `power` is a `Computed<number>` closure, already declined on that
//     ground alone) and `owner` undefined/`'each'` combined with
//     `notSelf:true` (no real pool card uses this combination for
//     `pumpTarget`). `summon-titan`'s own real `notSelf:true` chapter III
//     is likewise moot — Computed `X` power/toughness, same
//     already-declined ground. `rinoa-heartilly`'s own `onAttacks`
//     `pumpTarget` effect is moot the same way — `Computed<number>`
//     power/toughness (`ctx.you.getCreaturesInPlay().length`).
//   - **Also real, matched, not previously named in this comment**:
//     `tifa-s-limit-break`'s own "Somersault" mode ("Target creature gets
//     +2/+2 until end of turn," a plain literal-P/T `pumpTarget` inside a
//     `modal` container — `structural-effects.ts`'s own `collectEffects`
//     already walks `modal.modes[].effects`, so this was always a real
//     match, just missed by this comment's own earlier whole-pool tally).
//     `galuf-s-final-act` is likewise real and MATCHES (not a decline): its
//     own real text is "Until end of turn, target creature gets +1/+0 and
//     gains ..." — a LEADING "Until end of turn," this recognizer's pattern
//     doesn't require at all (its `effect.untilEndOfTurn` field is unset,
//     so no trailing-tail requirement is built either), so the bare "target
//     creature gets +1/+0" clause still matches once, cleanly; the field/
//     Fact-level `untilEndOfTurn` gap this card's own `progress.json` notes
//     is real but separate from whether this recognizer matches at all.
//
// **Annotation convention — REVISED 2026-09-16** (user-reported, Battle
// Menu/fin-9 the motivating real card; same flip already applied the same
// day to `putCounterTarget-effect-structural.ts`/`pumpAllAttacking-effect-
// structural.ts`, see either file's own doc comment for the identical
// reasoning, not repeated per-file): the SOURCE fact now anchors the FULL
// matched clause ("Target creature gets ±P/±T until end of turn" — verb,
// target phrase, amount, and duration all together), since the target is
// part of the pump action's own description, not a separate condition to
// carve out. The paired SINK now anchors only the narrow subject/target
// phrase (`subjectCandidate` above — "target creature," "another target
// creature you control," etc.) — the actual "a creature exists to receive
// this" claim the sink fact makes. A real span overlap between SOURCE
// (whole clause) and SINK (subject phrase alone) is expected and correct,
// not a bug. (Previously or the reverse: SOURCE narrowed to "gets ±P/±T,"
// SINK covered the whole clause — confirmed wrong the same way the two
// sibling recognizers above were.)
import type { Effect } from '../card';
import type { Constraints } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'pumpTarget-effect-structural' as const;

type PumpTargetEffect = Extract<Effect, { kind: 'pumpTarget' }>;

function isPumpTargetEffect(e: Effect): e is PumpTargetEffect {
  if (e.kind !== 'pumpTarget') return false;
  if (e.owner !== undefined && e.owner !== 'you' && e.owner !== 'each') return false; // 'opponents' — no confirmed real template (see module doc comment)
  if (e.owner !== 'you' && e.notSelf) return false; // notSelf only confirmed alongside owner:'you'
  return true;
}

/** The real, closed subject phrase — mirrors `grantKeywordTarget-effect-
 * structural.ts`'s own `subjectCandidate` (see that file and this module's
 * own doc comment for exactly which owner/notSelf combinations are
 * confirmed real cards). `isPumpTargetEffect` above already excludes every
 * combination this can't handle, so this never needs to signal decline
 * itself. */
function subjectCandidate(e: PumpTargetEffect): string {
  if (e.owner === 'you') return e.notSelf ? 'another target creature you control' : 'target creature you control';
  return 'target creature';
}

function buildTarget(e: PumpTargetEffect): Constraints {
  const target: Constraints & { excludeSelf?: boolean } = { types: { has: ['Creature'] } };
  if (e.notSelf) target.excludeSelf = true;
  return target;
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
  const allPumpTarget = allEffects(input).map((o) => o.effect).filter((e): e is PumpTargetEffect => e.kind === 'pumpTarget');
  if (allPumpTarget.length === 0) {
    return { matched: false, reason: "no kind:'pumpTarget' Effect on this face" };
  }
  const qualifying = allPumpTarget.filter(isPumpTargetEffect);
  if (qualifying.length !== allPumpTarget.length) {
    return { matched: false, reason: 'an owner/notSelf-restricted pumpTarget effect exists on this face — no confirmed real template for that combination yet (see module doc comment)' };
  }
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);

  const facts: RecognizedFact[] = [];

  for (const effect of qualifying) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    if (typeof effect.power !== 'number' || typeof effect.toughness !== 'number') {
      return {
        matched: false,
        reason: `a pumpTarget effect on this face (${JSON.stringify(effect)}) has non-literal (Computed<number>) power/toughness — opaque, can't build a real English template without executing it`,
      };
    }

    const numbers = `${escapeRegExp(formatSigned(effect.power, effect.toughness))}\\/${escapeRegExp(formatSigned(effect.toughness, effect.power))}`;
    const subject = subjectCandidate(effect);
    // A real "until end of turn" isn't always immediately adjacent to the
    // P/T numbers — a compound clause can carry an "and gains <keyword>"
    // connector in between (`blitzball-shot`'s own real "Target creature
    // gets +3/+3 AND GAINS TRAMPLE until end of turn," `haste-magic`'s own
    // "...and gains haste until end of turn," `gladiolus-amicitia`'s own
    // "...gets +2/+2 and gains trample until end of turn," `magic-damper`'s
    // own "...gets +1/+1 and gains hexproof until end of turn," `summon-
    // primal-garuda`'s own "...gets +1/+0 and gains flying until end of
    // turn" — 2026-09-15/2026-09-16 fixes, found once each card's own
    // missing `untilEndOfTurn` field was itself fixed in the same pass).
    // Same non-greedy same-sentence-gap tolerance `grantKeywordAll-effect-
    // structural.ts` uses for its own analogous compound-clause case — this
    // recognizer makes no claim about what (if anything) sits in that gap.
    // `battle-menu`'s/`overkill`'s own real clauses (no connector at all)
    // still match fine: the gap simply matches zero characters.
    const tail = effect.untilEndOfTurn ? `[^.\\n]*?\\buntil end of turn\\b` : '';
    const pattern = new RegExp(`\\b(${escapeRegExp(subject)}) (gets ${numbers})${effect.untilEndOfTurn ? `\\b${tail}` : '\\b'}`, 'i');
    // `d` (hasIndices) — real per-group match positions, needed since the
    // optional gap above means "gets ±P/±T"'s own end is no longer a fixed
    // offset back from the full match's end (the old `fullEnd - suffix
    // .length` arithmetic assumed a fixed-length suffix, which is no longer
    // true).
    const globalPattern = new RegExp(pattern.source, pattern.flags + 'gd');
    const matches = [...input.oracleText.matchAll(globalPattern)] as (RegExpMatchArray & { indices: Array<[number, number]> })[];
    if (matches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
      };
    }

    const m = matches[0]!;
    const fullStart = m.index!;
    const fullEnd = fullStart + m[0]!.length;
    const [subjectStart, subjectEnd] = m.indices[1]!; // subject/target-phrase capture group's own real span
    // SOURCE anchors the FULL clause, SINK anchors just the narrow subject
    // phrase — see this module's own "REVISED 2026-09-16" doc comment above.
    const sourceAnnotation = toLineOffset(input.oracleText, fullStart, fullEnd);
    const sinkAnnotation = toLineOffset(input.oracleText, subjectStart, subjectEnd);
    if (!sourceAnnotation || !sinkAnnotation) {
      return { matched: false, reason: `matched span [${fullStart},${fullEnd}) did not resolve to a single real oracle-text line` };
    }

    const target = buildTarget(effect);
    facts.push({
      role: 'source',
      fact: {
        event: 'pump',
        ...(effect.owner === 'you' ? { controller: 'you' as const } : {}),
        target,
        targeted: true,
        // Real bug, fixed 2026-09-16 (engine-lane pass, flagged by a
        // card-results agent via magic-damper's own stale-but-structurally-
        // correct hand-authored fact, which already carried this field):
        // this recognizer's own pattern-match already READS
        // `effect.untilEndOfTurn` to build `tail`/the regex above, but used
        // to never propagate it onto the emitted Fact itself — only ever
        // `true`, never `false` (synergy.ts's own `Fact.untilEndOfTurn` doc
        // comment), same convention `grantKeywordTarget-effect-structural
        // .ts`'s sibling recognizer already gets right on its own SOURCE
        // fact (never the paired SINK — see that file for why).
        ...(effect.untilEndOfTurn ? { untilEndOfTurn: true as const } : {}),
        annotations: [sourceAnnotation],
        ...(triggeredBy ? { triggeredBy } : {}),
      },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: { to: 'Battlefield', ...(effect.owner === 'you' ? { controller: 'you' as const } : {}), ...target, annotations: [sinkAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
