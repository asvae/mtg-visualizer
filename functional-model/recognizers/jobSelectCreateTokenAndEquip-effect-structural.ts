// New recognizer (2026-09-15, fin/16-25 AI-fact-elimination pass) —
// STRUCTURAL, but (like `putCounter-broadcast-structural.ts`) EXECUTES a
// `kind:'custom'` effect's own closure against `runtime-action-probe.ts`'s
// fake instrumented board (`probeJobSelectCreateTokenAndEquip`, that
// module's own new addition this same pass) rather than reading the closure
// statically — see that probe's own header for the exact real, whole-pool
// motivating case (15 real Equipment cards, all with a BYTE-IDENTICAL
// "Job select" onEnter closure body).
//
// Same conservative "build-then-verify against real oracle text" discipline
// as every other recognizer here: the probe's own classification alone only
// proves the CLOSURE'S real runtime behavior; this recognizer additionally
// requires the literal English clause Forge's own real `K:Job select`
// keyword expands to ("create a 1/1 colorless Hero creature token, then
// attach this to it") to appear verbatim in the face's own real oracle text
// before asserting anything.
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';
import { probeJobSelectCreateTokenAndEquip } from './runtime-action-probe';

export type { StructuralRecognizerInput };

const RULE = 'jobSelectCreateTokenAndEquip-effect-structural' as const;

type CustomEffect = Extract<Effect, { kind: 'custom' }>;

function isCustomEffect(e: Effect): e is CustomEffect {
  return e.kind === 'custom';
}

const EXPECTED_PATTERN = /\bcreate a 1\/1 colorless Hero creature token, then attach this to it\b/i;

export function recognizeJobSelectCreateTokenAndEquipEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const customEffects = allEffects(input).map((o) => o.effect).filter(isCustomEffect);
  if (customEffects.length === 0) {
    return { matched: false, reason: 'no kind:"custom" Effect on this face' };
  }

  const facts: RecognizedFact[] = [];
  let anyClassified = false;
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);

  for (const effect of customEffects) {
    if (typeof effect.run !== 'function') continue;
    const result = probeJobSelectCreateTokenAndEquip(effect.run);
    if (!result.classified) continue; // out of this recognizer's own scope — see module doc comment
    anyClassified = true;
    const triggeredBy = triggeredByOf(effectSource.get(effect));

    const globalPattern = new RegExp(EXPECTED_PATTERN.source, EXPECTED_PATTERN.flags + 'g');
    const matches = [...input.oracleText.matchAll(globalPattern)];
    if (matches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `probe classified an unconditional "create token, then attach" closure but the real clause matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
      };
    }
    const m = matches[0]!;
    const annotation = toLineOffset(input.oracleText, m.index!, m.index! + m[0]!.length);
    if (!annotation) {
      return { matched: false, reason: `matched span [${m.index},${m.index! + m[0]!.length}) did not resolve to a single real oracle-text line` };
    }
    facts.push({
      role: 'source',
      fact: { ...result.fact, annotations: [annotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  if (!anyClassified) {
    return { matched: false, reason: 'no custom effect on this face was classified by the action probe as an unconditional "create token, then attach self to it" shape' };
  }
  return { matched: true, facts };
}
