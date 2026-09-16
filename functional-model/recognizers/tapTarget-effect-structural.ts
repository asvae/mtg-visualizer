// New recognizer (2026-09-15, fin/11-15 audit — Coeurl/fin-12's own AI-
// authored tap-target facts). Structural, sibling of `move-effect-
// structural.ts` (same real "verify a real closed anchor, decline
// everything unconfirmed" discipline, same owner-branch vocabulary reused
// where it transfers).
//
// **Real, whole-pool check FIRST, before trusting anything** — grepped
// every real `kind:'tapTarget'` Effect (28 real occurrences) and read each
// one's own real oracle text directly. This surfaced a REAL, systemic
// false pattern: the large majority (every "Town"/city-cycle land —
// `crossroads-village`, `vector-imperial-capital`, `treno-dark-city`,
// etc. — plus `tonberry`) use `kind:'tapTarget', validType:'land'/
// 'creature', owner:'you'` NOT to model a real "tap target land/creature
// you control" ability at all, but as a WORKAROUND for "this permanent
// enters TAPPED" (no dedicated replacement-effect field exists for that —
// same documented gap `crossroads-village`'s own `definition.ts` comment
// explains): an ETB trigger picks from the "land/creature you control"
// pool via `resolveTargets`, which happens to tap the card itself in a
// scenario where it's the only qualifying candidate, but is NOT a real
// CR-targeted ability and has NO "tap target land"/"tap target creature"
// phrase anywhere in these cards' own real printed text. This recognizer
// is scoped ONLY to the real, printed "tap target <type>" template — it
// correctly, structurally excludes the `owner:'you'` shape entirely (no
// confirmed real template exists for it; every real `owner:'you'` case in
// this pool today is the ETB-tapped-self hack above, never a genuine
// targeted tap), and separately declines any TEXT mismatch via `kind:
// 'mismatch'` for the handful of real cards whose own `validType` is a
// documented under/over-approximation of broader real text (see below).
//
// **Real matches confirmed** (`validType:'creature'`, `owner` omitted or
// `'opponents'`, no unconfirmed `validType` value): `coeurl` ("Tap target
// NONENCHANTMENT creature" — no owner, `excludeEnchantment: true`),
// `summon-shiva`/`ultros-obnoxious-octopus`/`tidus-blitzball-star` (all
// three: "Tap target creature AN OPPONENT CONTROLS," `owner:'opponents'`).
//
// **Real, NAMED remaining declines** (not a blanket "declines"): `ring-of-
// the-lucii`'s own `validType:'creature-or-artifact'` (no owner) builds
// "target creature or artifact," but the real text is "Tap target NONLAND
// PERMANENT" — broader than any compound this recognizer's own template
// vocabulary can build (no generic 'permanent'/'nonland' validType value
// exists on `tapTarget` at all, same class of gap `move-effect-
// structural.ts`'s own `rydia-s-return`/`sorceress-s-schemes` declines
// document for a different Effect kind) — a real, pre-existing
// under-modeling, not something to silently paper over.
// `omega-heartless-evolution`'s own `validType:'creature-or-artifact',
// owner:'opponents'` has the SAME "nonland permanent" broadening problem,
// PLUS "up to one... FOR EACH OPPONENT" (a real multi-instance, optional
// quantifier this recognizer's own template has no confirmed shape for) —
// still declines via `kind:'mismatch'`, suppressed via its own `//
// recognizer-exception:` marker (added alongside the widening below, since
// building a real "artifact or creature" pattern for `creature-or-artifact`
// now means this card's OWN `creature-or-artifact` effect reaches the
// verbatim-match stage instead of stopping at the earlier `undefined`
// scope-decline it used to hit).
// Every real `owner:'you'`-shaped `tapTarget` effect in the pool (the
// ETB-tapped-self hack family) declines via the `owner` gate itself (see
// above) — not individually re-litigated here.
//
// **Widened 2026-09-16 (card-results/fin-51-75 triage backlog item #7)**:
// `validType:'creature-or-artifact'` now has a confirmed real English
// template too — `ice-flan`'s own real "tap target ARTIFACT OR CREATURE an
// opponent controls" (`owner:'opponents'`), a second, NARROWER, confirmed
// disjunction distinct from Ring of the Lucii/Omega's own broader "nonland
// permanent" claim (checked directly against `ice-flan`'s real Scryfall
// oracle text before building this, not guessed from this card's own
// pre-existing hand-authored fact alone). Word order is "artifact or
// creature" (artifact first) — the one real, confirmed order; no other
// real `creature-or-artifact` `tapTarget` card in the pool to cross-check a
// second order against (Omega's own text never uses this phrase at all).
//
// **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-bug
// audit, 4th of 4 confirmed sibling fixes — the other 3: `putCounter-
// broadcast-structural.ts`, `ptFormula-scalingPump-structural.ts`,
// `putCounterTarget-effect-structural.ts`; this file's own instance was
// FLAGGED, not fixed, by that 3rd fix's own module doc comment): the sink
// used to reuse the SOURCE's own whole-clause span byte-for-byte (e.g.
// Coeurl's own sink covered "Tap target nonenchantment creature," the
// whole clause, verb included, when the sink only actually claims "a
// nonenchantment creature exists"). `Tap`/`tap` (the bare verb) is now its
// own capturing group (source), the object phrase ("target <type>[ an
// opponent controls]") a second, separate one (sink) — see
// `recognizeTapTargetEffectStructural`'s own inline comment for the
// mechanics. Checked all 5 real users (coeurl, ice-flan, summon-shiva,
// tidus-blitzball-star, ultros-obnoxious-octopus) directly against their
// own real oracle text before building this — every one has a genuinely
// separable verb from its own object phrase, no bespoke exception needed.
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'tapTarget-effect-structural' as const;

type TapTargetEffect = Extract<Effect, { kind: 'tapTarget' }>;

function isTapTargetEffect(e: Effect): e is TapTargetEffect {
  return e.kind === 'tapTarget';
}

/** The real, closed English "target <type>" object phrase this effect's
 * own structured data implies — `undefined` for anything outside the real,
 * confirmed pool vocabulary (see module doc comment). */
function objectPhrasePattern(effect: TapTargetEffect): string | undefined {
  let typeWord: string;
  if (effect.validType === 'creature') typeWord = effect.excludeEnchantment ? 'nonenchantment creature' : 'creature';
  else if (effect.validType === 'creature-or-artifact') typeWord = 'artifact or creature'; // ice-flan's own confirmed word order — see module doc comment
  else return undefined; // 'land'/'artifact'/'any' have no confirmed real template yet
  if (effect.owner === undefined) return `target ${typeWord}`;
  if (effect.owner === 'opponents') return `target ${typeWord} an opponent controls`;
  return undefined; // 'you'/'each' — no confirmed real template (see module doc comment: every real owner:'you' case is the ETB-tapped-self hack, not a genuine targeted tap)
}

function buildTargetConstraint(effect: TapTargetEffect): { types: { has?: string[]; hasAny?: string[]; not?: string[] } } {
  if (effect.validType === 'creature-or-artifact') return { types: { hasAny: ['Creature', 'Artifact'] } };
  return { types: { has: ['Creature'], ...(effect.excludeEnchantment ? { not: ['Enchantment'] } : {}) } };
}

export function recognizeTapTargetEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const all = allEffects(input).map((o) => o.effect).filter(isTapTargetEffect);
  if (all.length === 0) {
    return { matched: false, reason: "no kind:'tapTarget' Effect on this face" };
  }

  const facts: RecognizedFact[] = [];
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);
  for (const effect of all) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    const phrase = objectPhrasePattern(effect);
    if (!phrase) {
      return {
        matched: false,
        reason: `a tapTarget effect on this face (${JSON.stringify(effect)}) has no confirmed structural->text template (see module doc comment)`,
      };
    }
    // **2026-09-16 SOURCE/SINK span-narrowing fix** (same bug class as
    // `putCounterTarget-effect-structural.ts`'s own confirmed fix, flagged as
    // a real follow-up in that file's own module doc comment — see there for
    // the full precedent): the sink used to reuse the SOURCE's own
    // whole-clause span byte-for-byte (e.g. Coeurl's own sink covered "Tap
    // target nonenchantment creature," the whole clause, verb included, when
    // the sink only actually claims "a nonenchantment creature exists").
    // `Tap` (the bare verb, group 1) is now its own capturing group, and the
    // object phrase (group 2 — "target <type>[ an opponent controls]") is a
    // second, separate one; the `d` (indices) flag lets the main loop anchor
    // the source fact to group 1 and the sink fact to group 2, same "whole
    // action-clause source, narrow object-phrase sink" split
    // `putCounter-broadcast-structural.ts`/`ptFormula-scalingPump-
    // structural.ts`/`putCounterTarget-effect-structural.ts` all already
    // establish (checked against all 5 real users below — every one has a
    // genuinely separable "Tap"/"tap" verb from its own "target ..." object
    // phrase, no bespoke exception needed here).
    const pattern = new RegExp(`\\b(Tap)\\s+(${phrase})\\b`, 'id');
    const m = pattern.exec(input.oracleText) as (RegExpExecArray & { indices: Array<[number, number] | undefined> }) | null;
    if (!m) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected phrase /${pattern.source}/ not found in oracle text "${input.oracleText}"`,
      };
    }
    const [sourceStart, sourceEnd] = m.indices[1]!;
    const [sinkStart, sinkEnd] = m.indices[2]!;
    const sourceAnnotation = toLineOffset(input.oracleText, sourceStart, sourceEnd);
    const sinkAnnotation = toLineOffset(input.oracleText, sinkStart, sinkEnd);
    if (!sourceAnnotation || !sinkAnnotation) {
      return { matched: false, reason: `matched span [${sourceStart},${sinkEnd}) (or its own inner source/sink split spans) did not resolve to a single real oracle-text line` };
    }
    const target = buildTargetConstraint(effect);
    facts.push({
      role: 'source',
      fact: { event: 'tap', target, targeted: true, annotations: [sourceAnnotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: { to: 'Battlefield', ...target, annotations: [sinkAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
