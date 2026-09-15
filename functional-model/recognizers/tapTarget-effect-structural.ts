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
// quantifier this recognizer's own template has no confirmed shape for).
// Every real `owner:'you'`-shaped `tapTarget` effect in the pool (the
// ETB-tapped-self hack family) declines via the `owner` gate itself (see
// above) — not individually re-litigated here.
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, type StructuralRecognizerInput } from './structural-effects';

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
  if (effect.validType !== 'creature') return undefined; // 'land'/'artifact'/'creature-or-artifact'/'any' have no confirmed real template yet
  const typeWord = effect.excludeEnchantment ? 'nonenchantment creature' : 'creature';
  if (effect.owner === undefined) return `target ${typeWord}`;
  if (effect.owner === 'opponents') return `target ${typeWord} an opponent controls`;
  return undefined; // 'you'/'each' — no confirmed real template (see module doc comment: every real owner:'you' case is the ETB-tapped-self hack, not a genuine targeted tap)
}

export function recognizeTapTargetEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const all = allEffects(input).filter(isTapTargetEffect);
  if (all.length === 0) {
    return { matched: false, reason: "no kind:'tapTarget' Effect on this face" };
  }

  const facts: RecognizedFact[] = [];
  for (const effect of all) {
    const phrase = objectPhrasePattern(effect);
    if (!phrase) {
      return {
        matched: false,
        reason: `a tapTarget effect on this face (${JSON.stringify(effect)}) has no confirmed structural->text template (see module doc comment)`,
      };
    }
    // `Tap ` (the verb) is part of the anchored span, not just the object
    // phrase — matches `coeurl`'s own pre-existing hand-authored span
    // ("Tap target nonenchantment creature," chars 13-47, not just chars
    // 17-47), same "include the verb" convention `move-effect-structural
    // .ts`/`destroy-effect-structural.ts` both already establish for their
    // own object-phrase anchors.
    const pattern = new RegExp(`\\bTap ${phrase}\\b`, 'i');
    const m = pattern.exec(input.oracleText);
    if (!m) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected phrase /${pattern.source}/ not found in oracle text "${input.oracleText}"`,
      };
    }
    const annotation = toLineOffset(input.oracleText, m.index, m.index + m[0].length);
    if (!annotation) {
      return { matched: false, reason: `matched span [${m.index},${m.index + m[0].length}) did not resolve to a single real oracle-text line` };
    }
    const target = { types: { has: ['Creature'], ...(effect.excludeEnchantment ? { not: ['Enchantment'] } : {}) } };
    facts.push({
      role: 'source',
      fact: { event: 'tap', target, targeted: true, annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: { to: 'Battlefield', ...target, annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
