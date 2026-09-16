// New recognizer (2026-09-15) — structural, sibling of `pumpSelf-effect-
// structural.ts`/`pumpTarget-effect-structural.ts` (see `pumpSelf`'s own
// module doc comment for the shared "why a fixed-pump recognizer is safe
// here" reasoning). Reads a `kind:'pumpAll', predicate:'attacking-
// creatures'` `Effect` (card.ts, added this same pass alongside
// `Card.isAttacking()`/`GameState.attackers` — ENGINE_GAPS.md, Auron's
// Inspiration/fin-8's own real closure) with literal `power`/`toughness`,
// derives the `event:'pump'` SOURCE fact.
//
// **Real, whole-pool check**: `auron-s-inspiration` (fin/8) is the only
// real card using this predicate as of this recognizer's own authoring
// ("Attacking creatures get +2/+0 until end of turn" — no owner
// qualifier, matching the predicate's own symmetric, both-sides
// semantics). This recognizer will apply to any FUTURE card using the
// identical shape.
//
// **Paired SINK fact added 2026-09-15** (`verify-synergy.mjs`'s own
// "every aggregate read must be explained by a declared want" reverse
// check started hard-failing on this exact card once its own stale
// `trace.json` was regenerated — `pumpAll`'s real `predicate:'attacking-
// creatures'` runtime resolution genuinely reads `ctx.you.
// getCreaturesInPlay()`/`ctx.opponents...` to find the attacking subset,
// same real `read:getCreaturesInPlay` aggregate read `tapAllQuery-effect-
// structural.ts`'s own paired sink already exists to satisfy for a
// different broadcast effect — this recognizer never emitted the matching
// sink half of its own claim). Same "source+sink pair for one real
// broadcast effect" convention that recognizer already establishes: a
// bare presence want, `{to:'Battlefield', types:{has:['Creature']},
// attacking:true}`, no `controller` restriction (matching the source
// fact's own unrestricted-both-sides scope).
//
// **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-bug
// audit, same class as the sibling fixes named elsewhere in this catalog
// — `putCounter-broadcast-structural.ts` et al.): the SINK used to reuse
// the SOURCE's own narrow "get +2/+0" span instead of pointing at
// "Attacking creatures," the actual subject/object phrase its own "an
// attacking creature exists" want is about — fixed to anchor at that
// narrower phrase instead.
//
// **2026-09-16, revised same day** — the SOURCE span was ALSO wrong, in
// the opposite direction: it was over-narrowed to just "get +2/+0," when
// it should cover the FULL clause "Attacking creatures get +2/+0 until end
// of turn" — user-confirmed (same reasoning `putCounterTarget-effect-
// structural.ts`'s own revised split already establishes): the subject
// ("Attacking creatures") is part of the pump action's own description,
// not a separate condition, so SOURCE keeps the whole clause. A real span
// overlap between SOURCE (whole clause) and SINK ("Attacking creatures"
// alone) is expected and correct, not a bug to eliminate.
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'pumpAllAttacking-effect-structural' as const;

type PumpAllEffect = Extract<Effect, { kind: 'pumpAll' }>;

function isAttackingPumpAllEffect(e: Effect): e is PumpAllEffect {
  return e.kind === 'pumpAll' && e.predicate === 'attacking-creatures' && !e.notSelf && !e.subtype;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatSigned(n: number): string {
  return (n >= 0 ? '+' : '') + n;
}

export function recognizePumpAllAttackingEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const all = allEffects(input).map((o) => o.effect).filter((e): e is PumpAllEffect => e.kind === 'pumpAll' && e.predicate === 'attacking-creatures');
  if (all.length === 0) {
    return { matched: false, reason: "no kind:'pumpAll', predicate:'attacking-creatures' Effect on this face" };
  }
  const qualifying = all.filter(isAttackingPumpAllEffect);
  if (qualifying.length !== all.length) {
    return { matched: false, reason: 'a notSelf/subtype-restricted attacking-creatures pumpAll exists on this face — no confirmed real template for that combination yet' };
  }

  const facts: RecognizedFact[] = [];
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);
  for (const effect of qualifying) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    if (typeof effect.power !== 'number' || typeof effect.toughness !== 'number') {
      return {
        matched: false,
        reason: `a pumpAll(attacking-creatures) effect on this face (${JSON.stringify(effect)}) has non-literal (Computed<number>) power/toughness — opaque, can't build a real English template without executing it`,
      };
    }
    const numbers = `${escapeRegExp(formatSigned(effect.power))}\\/${escapeRegExp(formatSigned(effect.toughness))}`;
    const suffix = effect.untilEndOfTurn ? ' until end of turn' : '';
    const pattern = new RegExp(`\\b(Attacking creatures) (get ${numbers})${suffix}\\b`, 'id');
    const globalPattern = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(globalPattern)] as Array<
      RegExpMatchArray & { indices: Array<[number, number] | undefined> }
    >;
    if (matches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
      };
    }
    const m = matches[0]!;
    const [fullStart, fullEnd] = m.indices[0]!; // whole clause, "Attacking creatures get ±P/±T[ until end of turn]"
    const [sinkStart, sinkEnd] = m.indices[1]!; // "Attacking creatures"
    // SOURCE anchors to the FULL clause, not just the "get ±P/±T" amount
    // group — user-confirmed (Auron's Inspiration, 2026-09-16, same
    // reasoning `putCounterTarget-effect-structural.ts`'s own revised split
    // already establishes): "Attacking creatures get +2/+0 until end of
    // turn" is one coherent action description, the subject/object phrase
    // is part of the action itself, not a separate condition. A real span
    // overlap with the SINK ("Attacking creatures," unchanged) is expected.
    const sourceAnnotation = toLineOffset(input.oracleText, fullStart, fullEnd);
    const sinkAnnotation = toLineOffset(input.oracleText, sinkStart, sinkEnd);
    if (!sourceAnnotation || !sinkAnnotation) {
      return { matched: false, reason: `matched span [${sinkStart},${fullEnd}) (or its own inner source/sink split spans) did not resolve to a single real oracle-text line` };
    }
    facts.push({
      role: 'source',
      fact: { event: 'pump', target: { types: { has: ['Creature'] }, attacking: true }, annotations: [sourceAnnotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: { to: 'Battlefield', types: { has: ['Creature'] }, attacking: true, annotations: [sinkAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
