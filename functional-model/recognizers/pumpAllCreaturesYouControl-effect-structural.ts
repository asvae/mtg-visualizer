// New recognizer (2026-09-16, fin/26-50 pass) — structural, `pumpAll`'s own
// direct sibling of `grantKeywordAll-effect-structural.ts` (same file's own
// module doc comment covers the identical real "board-wide broadcast
// EFFECT, not a still-on-battlefield continuous static grant" distinction;
// `continuousPTGrantsEquipped-structural.ts` is that other, card-
// definition-level family). Reads `kind:'pumpAll', predicate:'creatures-
// you-control'` `Effect`s with LITERAL `power`/`toughness` (a `Computed`
// function is opaque — declines, same restraint `pumpAllAttacking-effect-
// structural.ts`'s own module doc comment already documents for the
// identical field on a different predicate).
//
// **Same group-then-verify architecture as `grantKeywordAll-effect-
// structural.ts`** — effects sharing `(subtype, notSelf, untilEndOfTurn)`
// are one real group (a repeating Saga's own identical chapters, e.g.
// Summon: Esper Ramuh's own "II, III —" one shared real sentence);
// magnitude (`power`/`toughness`) is this group's own distinguishing
// dimension (mirroring how `grantKeywordAll`'s own group is distinguished
// by KEYWORD) — every effect in one group is required to share the exact
// same magnitude (a repeating chapter always does, checked); more than one
// distinct magnitude sharing a group has no confirmed real template and
// declines rather than guessing which.
//
// **Real, whole-pool check (12 real `kind:'pumpAll', predicate:'creatures-
// you-control'` occurrences across 9 real cards) done first**:
//   - `summon-choco-mog` (`notSelf:true`, no subtype, all 4 chapters share
//     one group): "Other creatures you control get +1/+0 until end of
//     turn."
//   - `summon-knights-of-round` chapter V (`notSelf:true`, no subtype):
//     "Other creatures you control get +2/+2 until end of turn." (a second,
//     separate `putCounterAll` effect follows in the same sentence — out of
//     this recognizer's own scope, see `putCounterAll-effect-structural.ts`).
//   - `esper-origins-summon-esper-maduin` chapter III (`notSelf:true`, no
//     subtype): "Other creatures you control get +2/+2 AND GAIN TRAMPLE
//     until end of turn" — a real combined pump+keyword sentence; this
//     recognizer tolerates (but asserts nothing about) an optional
//     same-sentence gap between the numbers and "until end of turn" for
//     exactly this reason, mirroring `grantKeywordAll-effect-structural.ts`'s
//     own tolerance of an equivalent gap in the other direction.
//   - `circle-of-power` (`subtype:'Wizard'`, no `notSelf`): "Wizards you
//     control get +1/+0 AND GAIN LIFELINK until end of turn." — same gap
//     tolerance.
//   - `summon-esper-ramuh` chapters II+III (`subtype:'Wizard'`, no
//     `notSelf`, ONE shared group): "Wizards you control get +1/+0 until
//     end of turn."
//   - `sidequest-raise-a-chocobo-black-chocobo`'s own back face (Black
//     Chocobo)'s `onLandfall` (`subtype:'Bird'`, no `notSelf`): "Birds you
//     control get +1/+0 until end of turn."
//   - `rydia-s-return` (no subtype/notSelf, one modal effect): "Creatures
//     you control get +3/+3 until end of turn."
//   - `warren-elder` (no subtype/notSelf): real Forge card (tmp/mtg-forge/
//     .../w/warren_elder.txt), no oracle text checked into this pool's own
//     `data/fin/` corpus — same "cross-set reference card, recognizer
//     correctly finds no oracle text and is never exercised against it"
//     class `addMana-effect-structural.ts`'s own module doc comment already
//     documents for Elvish Archdruid.
//   - `craterhoof-behemoth`/`tyvar-the-pummeler`/`the-wandering-minstrel`:
//     all 3 have `Computed` (function) `power`/`toughness` — out of this
//     recognizer's own scope (see above); `craterhoof-behemoth` is ALSO a
//     cross-set reference card with no oracle text checked in.
//
// **`untilEndOfTurn: true` required on every group** — `card.ts`'s own
// `pumpAll` doc comment says an omitted `untilEndOfTurn` defaults to a
// PERMANENT-within-scenario pump; every real card in this pool's own
// `kind:'pumpAll', predicate:'creatures-you-control'` set has REAL "until
// end of turn" printed text (6 real omission bugs across 5 cards — summon-
// choco-mog, sidequest-raise-a-chocobo-black-chocobo, summon-esper-ramuh
// (both chapters), rydia-s-return, warren-elder — were found and fixed
// directly in their own `definition.ts` files in this same pass, same class
// of bug `grantKeywordAll-effect-structural.ts`'s own module doc comment
// already documents fixing for `circle-of-power`/`summon-fat-chocobo`), so
// a group with no `untilEndOfTurn:true` declines outright rather than
// guessing at a permanent-pump template with zero real confirmed cases.
import type { Effect } from '../card';
import type { Constraints } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'pumpAllCreaturesYouControl-effect-structural' as const;

type PumpAllEffect = Extract<Effect, { kind: 'pumpAll' }>;

function isCreaturesYouControlPumpAllEffect(e: Effect): e is PumpAllEffect {
  return e.kind === 'pumpAll' && e.predicate === 'creatures-you-control';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatSigned(n: number): string {
  return (n >= 0 ? '+' : '') + n;
}

interface Group {
  subtype?: string;
  notSelf?: boolean;
  untilEndOfTurn?: boolean;
  effects: PumpAllEffect[];
}

function groupKeyOf(e: PumpAllEffect): string {
  return JSON.stringify([e.subtype, e.notSelf, e.untilEndOfTurn]);
}

/** Same subject-candidate shape `grantKeywordAll-effect-structural.ts`'s own
 * `subjectCandidates` establishes for the identical (subtype, notSelf) axis
 * — `'creatures-you-control'`-only here (this recognizer never sees the
 * `'permanents-you-control'`/`'attacking-creatures'` predicates), and no
 * real card combines subtype+notSelf for THIS predicate+event either
 * (checked pool-wide above) — declines that combination the same way. No
 * "Those creatures" anaphoric candidate here (that's a `grantKeyword`-only
 * real wording found on Dion, Bahamut's Dominant's own back face; no real
 * `pumpAll` clause in this pool uses it). */
function subjectCandidates(g: Group): string[] | undefined {
  if (g.subtype && g.notSelf) return undefined;
  if (g.subtype) return [`${escapeRegExp(g.subtype)}s you control`];
  if (g.notSelf) return ['Other creatures you control'];
  return ['Creatures you control'];
}

function buildTarget(g: Group): Constraints {
  const types = { has: g.subtype ? ['Creature', g.subtype] : ['Creature'] };
  const target: Constraints = { types };
  if (g.notSelf) (target as Constraints & { excludeSelf?: boolean }).excludeSelf = true;
  return target;
}

export function recognizePumpAllCreaturesYouControlEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const allPumpAll = allEffects(input).map((o) => o.effect).filter((e): e is PumpAllEffect => e.kind === 'pumpAll' && e.predicate === 'creatures-you-control');
  if (allPumpAll.length === 0) {
    return { matched: false, reason: "no kind:'pumpAll', predicate:'creatures-you-control' Effect on this face" };
  }

  const literalEffects = allPumpAll.filter(isCreaturesYouControlPumpAllEffect).filter((e) => typeof e.power === 'number' && typeof e.toughness === 'number');
  if (literalEffects.length === 0) {
    return { matched: false, reason: 'every pumpAll(creatures-you-control) effect on this face has non-literal (Computed<number>) power/toughness — opaque, no template to build' };
  }

  const groups = new Map<string, Group>();
  for (const e of literalEffects) {
    const key = groupKeyOf(e);
    const g = groups.get(key);
    if (g) g.effects.push(e);
    else groups.set(key, { subtype: e.subtype, notSelf: e.notSelf, untilEndOfTurn: e.untilEndOfTurn, effects: [e] });
  }

  const facts: RecognizedFact[] = [];
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass;
  // SOURCE-only, per the same-day sink/triggeredBy architecture correction
  // — see `Fact.triggeredBy`'s own doc comment, synergy.ts) — per
  // magnitude-representative effect (`magnitudes[0]`), same "first-wins"
  // precedent `grantKeywordAll-effect-structural.ts`'s own sibling
  // recognizer already establishes for its own per-keyword dedup. The
  // paired SINK below never carries `triggeredBy` at all — it's the
  // structural "want," not a caused effect.
  const effectSource = effectSourceMap(input);

  for (const group of groups.values()) {
    if (!group.untilEndOfTurn) {
      return { matched: false, reason: 'a pumpAll(creatures-you-control) group on this face has no untilEndOfTurn:true — no confirmed permanent-pump English template' };
    }
    const magnitudes = [...new Map(group.effects.map((e) => [`${e.power}/${e.toughness}`, e])).values()];
    if (magnitudes.length > 1) {
      return { matched: false, reason: `${magnitudes.length} distinct power/toughness magnitudes share one pumpAll group — no confirmed real English template for that` };
    }
    const effect = magnitudes[0]!;
    const numbers = `${escapeRegExp(formatSigned(effect.power as number))}\\/${escapeRegExp(formatSigned(effect.toughness as number))}`;

    const subjects = subjectCandidates(group);
    if (!subjects) {
      return { matched: false, reason: 'subtype + notSelf combined — no confirmed real English template for this combination' };
    }

    let clauseMatch: RegExpMatchArray | undefined;
    let matchedSubject: string | undefined;
    for (const subject of subjects) {
      // Same non-greedy same-sentence gap discipline `grantKeywordAll-
      // effect-structural.ts`'s own pattern comment documents, applied in
      // the opposite direction: tolerates an optional "and gain <keyword>"
      // connector between the numbers and "until end of turn" (esper-
      // origins-summon-esper-maduin/circle-of-power's own combined
      // pump+keyword sentences), while still requiring the numbers
      // themselves to sit directly after "get" with nothing in between.
      const pattern = new RegExp(`\\b${subject}\\b get (${numbers})[^.\\n]*?\\buntil end of turn\\b`, 'i');
      const global = new RegExp(pattern.source, pattern.flags + 'g');
      const matches = [...input.oracleText.matchAll(global)];
      if (matches.length > 1) {
        return { matched: false, kind: 'mismatch', reason: `expected clause /${pattern.source}/ matched ${matches.length} times — ambiguous` };
      }
      if (matches.length === 1) {
        if (clauseMatch) {
          return { matched: false, kind: 'mismatch', reason: '2 different subject candidates both matched — ambiguous, declining rather than guessing which' };
        }
        clauseMatch = matches[0];
        matchedSubject = subject;
      }
    }
    if (!clauseMatch) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `no candidate "<subject> get ${formatSigned(effect.power as number)}/${formatSigned(effect.toughness as number)} ... until end of turn" clause found in oracle text "${input.oracleText}"`,
      };
    }
    void matchedSubject;

    // Narrow the SOURCE annotation to the numbers group itself (the "get
    // ±P/±T" span) — same convention `pumpAllAttacking-effect-structural.ts`'s
    // own module doc comment establishes for the identical `event:'pump'`
    // Fact shape, not the whole subject-to-"until end of turn" clause.
    const numbersGroup = clauseMatch[1]!;
    const clauseStart = clauseMatch.index!;
    const numbersStart = clauseStart + clauseMatch[0]!.indexOf(numbersGroup, matchedSubject!.length);
    const numbersEnd = numbersStart + numbersGroup.length;
    const annotation = toLineOffset(input.oracleText, numbersStart, numbersEnd);
    if (!annotation) {
      return { matched: false, reason: `matched span [${numbersStart},${numbersEnd}) did not resolve to a single real oracle-text line` };
    }

    // WIDENED (2026-09-16, fin/20-47 pass) — the SINK's own annotation now
    // spans the WHOLE matched clause (subject through "until end of turn"),
    // not the same narrow numbers-only span the SOURCE fact uses. Same
    // "SINK gets the whole clause, SOURCE gets the bare magnitude/word"
    // convention `grantKeywordAll-effect-structural.ts`'s own sibling sink
    // already established (and `grantKeywordTarget-effect-structural.ts`'s
    // own sink was just widened to match, same pass) — closes a real,
    // systemic `verify-text-coverage.mjs` gap this recognizer's 5 real
    // affected users (summon-choco-mog, summon-knights-of-round, summon-
    // esper-ramuh, rydia-s-return, sidequest-raise-a-chocobo-black-chocobo's
    // back face) all shared: the "<subject> get" prefix was never covered
    // by anything.
    const clauseEnd = clauseStart + clauseMatch[0]!.length;
    const clauseAnnotation = toLineOffset(input.oracleText, clauseStart, clauseEnd);
    if (!clauseAnnotation) {
      return { matched: false, reason: `matched span [${clauseStart},${clauseEnd}) did not resolve to a single real oracle-text line` };
    }

    const target = buildTarget(group);
    const sourceTriggeredBy = triggeredByOf(effectSource.get(effect));
    facts.push({
      role: 'source',
      fact: { event: 'pump', controller: 'you', target, targeted: false, untilEndOfTurn: true, annotations: [annotation], ...(sourceTriggeredBy ? { triggeredBy: sourceTriggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: { to: 'Battlefield', controller: 'you', types: target.types!, ...(group.notSelf ? { excludeSelf: true } : {}), annotations: [clauseAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
