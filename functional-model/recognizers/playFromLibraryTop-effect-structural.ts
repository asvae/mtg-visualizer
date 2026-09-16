// New recognizer (2026-09-16, card-results/fin-51-75 triage backlog item
// #5). Structural — reads a face's own `kind:'playFromLibraryTop'`
// `Effect[]` directly. `card.ts`'s own `playFromLibraryTop` Effect kind has
// NO fields at all (CR 601/305's own umbrella "play" — see `card.ts`'s own
// doc comment above that Effect variant), so there is nothing to derive a
// template FROM beyond "this Effect kind exists on this face at all" — the
// one real, fixed literal clause below.
//
// **Real, whole-pool check — exactly 1 real occurrence** (`the-lunar-
// whale`, ENGINE_GAPS.md gap #16, already closed): "As long as The Lunar
// Whale attacked this turn, you may play the top card of your library."
// This card's own PRE-EXISTING hand-authored `synergy.json` already
// carries the exact Fact shape this recognizer produces
// (`{event:'play', from:'Library', controller:'you'}`, same annotation
// span) — see that card's own `definition.ts` module doc comment ("now
// backed by real trace evidence... the former `isLunarWhalePlayFromLibrary
// Fact` exemption is removed"). This recognizer's job is purely to give
// that already-correct, already-verified fact real provenance, same
// "purely a missing recognizer for existing real machinery" framing this
// backlog item was raised under — no new engine capability, no new Fact
// convention, nothing to design.
//
// `traveling-chocobo` (fin/158, per that same module doc comment) carries
// the identical real clause ("You may play lands and cast Bird spells from
// the top of your library") but is not migrated onto `kind:
// 'playFromLibraryTop'` as of this writing (its own narrower "lands and
// Bird spells only" scope needs a real gate on WHETHER to invoke the
// effect, not just a different Effect shape) — out of this recognizer's
// own scope; it'll pick this card up automatically once/if that migration
// happens, no changes needed here.
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'playFromLibraryTop-effect-structural' as const;

function isPlayFromLibraryTopEffect(e: Effect): e is Extract<Effect, { kind: 'playFromLibraryTop' }> {
  return e.kind === 'playFromLibraryTop';
}

const CLAUSE = /\byou may play the top card of your library\b/i;

export function recognizePlayFromLibraryTopEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const effects = allEffects(input).map((o) => o.effect).filter(isPlayFromLibraryTopEffect);
  if (effects.length === 0) {
    return { matched: false, reason: "no kind:'playFromLibraryTop' Effect on this face" };
  }

  const global = new RegExp(CLAUSE.source, CLAUSE.flags + 'g');
  const matches = [...input.oracleText.matchAll(global)];
  if (matches.length !== effects.length) {
    return {
      matched: false,
      kind: 'mismatch',
      reason: `expected clause /${CLAUSE.source}/ to match exactly ${effects.length} time(s) (once per playFromLibraryTop effect) but matched ${matches.length} time(s) in oracle text "${input.oracleText}"`,
    };
  }

  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // DELIBERATELY NOT set here, even though this recognizer's own real
  // motivating card (`the-lunar-whale`) stores its `playFromLibraryTop`
  // effect inside a `triggers: [{name:'playFromLibraryTop', ...}]` container
  // — that card's own `definition.ts` module doc comment is explicit this is
  // NOT a real CR 603 triggered ability at all (a continuous granted
  // PERMISSION, modeled via the `Trigger` container purely as an engine-
  // plumbing convenience, "reusing the same mechanism... for a real
  // triggered ability it can't auto-fire [some other way]"). Setting
  // `triggeredBy` here would assert a genuine condition->effect CAUSE that
  // doesn't exist for this card — `effectSourceMap`/`triggeredByOf` have no
  // way to distinguish a real `Trigger` from this one documented workaround,
  // so this recognizer stays deliberately silent rather than let the
  // generic helper produce a misleading value.
  const facts: RecognizedFact[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const start = m.index!;
    const end = start + m[0]!.length;
    const annotation = toLineOffset(input.oracleText, start, end);
    if (!annotation) {
      return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
    }
    facts.push({
      role: 'source',
      fact: { event: 'play', from: 'Library', controller: 'you', annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
