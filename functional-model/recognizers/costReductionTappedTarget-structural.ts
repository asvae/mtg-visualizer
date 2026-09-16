// New recognizer (2026-09-15, fin/16-25 pass) — CARD-DEFINITION-LEVEL
// structural (reads `costReduction`, never `effects`), same family as
// `continuousPTGrantsEquipped-structural.ts`. Covers the one real,
// pool-wide-checked `CostReduction.condition === 'tappedCreatureTarget'`
// shape (`card.ts`'s own doc comment: Forge's `ValidTarget$ Creature.tapped`
// — Fate of the Sun-Cryst is the ONLY real pool card using this condition;
// the other two real `costReduction` cards, `qiqirn-merchant`/`travel-the-
// overworld`, both use the differently-shaped `perControlled` discount
// instead, out of this recognizer's own scope).
//
// Derives a single SINK fact: "wants a tapped creature present" — this
// spell's own cost is conditionally cheaper when a tapped creature exists to
// target, the same "one real clause names what it wants present" convention
// every other paired-sink recognizer in this catalog already establishes,
// just for a COST condition instead of an effect's own target.
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

export type CostReductionRecognizerInput = RecognizerInput & Pick<CardDefinition, 'costReduction'>;

const RULE = 'costReductionTappedTarget-structural' as const;

// Widened 2026-09-16 (`verify-text-coverage.mjs` flagged "This spell costs
// {2} less to cast if it targets" — the whole cost-condition clause — as
// sitting OUTSIDE this recognizer's own annotation, which used to anchor
// only the trailing "a tapped creature" target phrase). Same "the leading
// context is squarely part of what the Fact claims, not flavor" reasoning
// `dealDamage-effect-structural.ts`'s own subject-prefix widening already
// established, applied here to the cost-condition prefix instead of a
// damage-dealer subject: the sink Fact claims "this spell's cost is
// conditional on a tapped creature being targeted," which the OLD narrower
// span ("a tapped creature" alone) didn't actually anchor — the cost-
// reduction framing is the reason the target matters at all. Confirmed
// (module doc comment above, unchanged) this recognizer's `{2}` amount is
// still the only real value in the pool, but the pattern below keeps it as
// `\{\d+\}` (not hardcoded `2`) rather than over-narrowing further, matching
// this file's own pre-existing "amount plays no role in what the Fact
// claims" restraint elsewhere in the catalog (`dealDamage`'s own doc
// comment gives the identical reasoning for not anchoring on a literal
// amount). Full match (no capture group) is now the annotation.
const PATTERN = /\bthis spell costs \{\d+\} less to cast if it targets a tapped creature\b/i;

export function recognizeCostReductionTappedTargetStructural(input: CostReductionRecognizerInput): RecognizerResult {
  if (input.costReduction?.condition !== 'tappedCreatureTarget') {
    return { matched: false, reason: 'no costReduction.condition === "tappedCreatureTarget" on this card — the one real, confirmed template this recognizer covers' };
  }

  const globalPattern = new RegExp(PATTERN.source, PATTERN.flags + 'g');
  const matches = [...input.oracleText.matchAll(globalPattern)];
  if (matches.length !== 1) {
    return {
      matched: false,
      kind: 'mismatch',
      reason: `expected clause /${PATTERN.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
    };
  }
  const m = matches[0]!;
  const start = m.index!;
  const end = start + m[0]!.length;
  const annotation = toLineOffset(input.oracleText, start, end);
  if (!annotation) {
    return { matched: false, reason: `matched span [${groupStart},${groupEnd}) did not resolve to a single real oracle-text line` };
  }

  return {
    matched: true,
    facts: [
      {
        role: 'sink',
        fact: { to: 'Battlefield', types: { has: ['Creature'] }, tapped: true, annotations: [annotation] },
        provenance: { origin: 'parser', rule: RULE },
      },
    ],
  };
}
