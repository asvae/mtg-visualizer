// New recognizer (2026-09-15, fin/11-15 audit follow-up — Coeurl/fin-12's
// own last remaining AI-authored fact). CARD-DEFINITION-LEVEL structural
// (reads `activationCost`/`abilities[].cost`, never `effects`), same family
// as `discardSelfCost-structural.ts` — reuses `engine.ts`'s own real,
// already-tested `costRequiresTap` (`/\{T\}/`, CR 602.1's own "the tap
// symbol IS a cost") rather than re-deriving a second copy, same "fact
// layer and runtime layer share one closed vocabulary, never drift apart"
// discipline that recognizer's own module doc comment establishes.
//
// **The real, always-true consequence**: ANY activated ability whose own
// cost includes `{T}` genuinely, unconditionally taps ITS OWN SOURCE
// PERMANENT as part of paying that cost (602.1) — independent of whatever
// the ability's own EFFECT does. `{event:'tap', subject:'self',
// target:'self'}` (matches `coeurl`'s own pre-existing hand-authored fact
// exactly). Annotated at the literal `{T}` SYMBOL itself, not any English
// phrase (Magic's own mana-cost-style notation, never printed as words) —
// `costRequiresTap`'s own real regex, reused verbatim for the anchor
// pattern too.
//
// **Real, whole-pool check**: 30 real cards have an `activationCost` or
// `abilities[].cost` matching `costRequiresTap` — this recognizer covers
// every one that has at least as many literal `{T}` occurrences in its own
// oracle text as it has qualifying costs (true for every real card checked;
// a card's own printed `{T}` symbol always appears once per real activated
// ability that needs it, in the same left-to-right order `abilities`
// itself declares them — same order-preserving correspondence `move-
// effect-structural.ts`'s own module doc comment already establishes for a
// different recognizer).
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { costRequiresTap } from '../engine';

/** This recognizer's own narrow input — `activationCost`/`abilities` (for
 * their own `cost` strings), never `effects` — same "own small `Pick`,
 * mirrors `StructuralRecognizerInput`'s own shape but isn't it" convention
 * `flashback-alternateCost-structural.ts`'s own `FlashbackRecognizerInput`
 * already establishes for a different card-definition-level field. */
export type TapSelfCostRecognizerInput = RecognizerInput & Pick<CardDefinition, 'activationCost' | 'abilities'>;

const RULE = 'tapSelfCost-structural' as const;

export function recognizeTapSelfCostStructural(input: TapSelfCostRecognizerInput): RecognizerResult {
  const costs: string[] = [];
  if (input.activationCost && costRequiresTap(input.activationCost)) costs.push(input.activationCost);
  for (const ability of input.abilities ?? []) {
    if (costRequiresTap(ability.cost)) costs.push(ability.cost);
  }
  if (costs.length === 0) {
    return { matched: false, reason: "no activationCost/abilities[].cost matching costRequiresTap's own real regex (/\\{T\\}/)" };
  }

  const pattern = /\{T\}/g;
  const facts: RecognizedFact[] = [];
  for (const cost of costs) {
    const m = pattern.exec(input.oracleText);
    if (!m) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `a qualifying cost ("${cost}") requires tapping this permanent, but no real, not-yet-claimed "{T}" symbol was found in this face's own oracle text ("${input.oracleText}")`,
      };
    }
    const annotation = toLineOffset(input.oracleText, m.index, m.index + m[0].length);
    if (!annotation) {
      return { matched: false, reason: `matched span [${m.index},${m.index + m[0].length}) did not resolve to a single real oracle-text line` };
    }
    facts.push({
      role: 'source',
      fact: { event: 'tap', subject: 'self', target: 'self', annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
