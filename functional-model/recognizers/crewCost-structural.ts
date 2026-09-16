// New recognizer (2026-09-15, fin/16-25 pass) — card-definition-level, same
// family as `ptFormula-scalingPump-structural.ts`/`continuousPTGrantsEquipped
// -structural.ts` (reads a top-level `CardDefinition` field directly, not an
// `Effect[]` container): `CardDefinition.crewCost` (real CR 702.121b — real
// Forge `SVar:CrewNum:` + `Crew` keyword ability, `card.ts`'s own doc
// comment). Two facts, mirroring every real pool card's own pre-existing
// hand-authored pair byte-for-byte: the crew activation itself (SOURCE —
// `{event:'crew', target:'self'}`) and the real precondition it's keyed on
// (SINK — `{to:'Battlefield', controller:'you', types:{has:['Creature']}}`,
// per SYNERGY_DESIGN.md's own "a card's own cost is itself a real want other
// cards' own creature-producing effects can satisfy" framing).
//
// **Real, whole-pool check done first** — grepped every real `crewCost:` field
// across `functional-model/cards/*/definition.ts` (8 real occurrences):
// `cargo-ship`, `magitek-armor`, `the-prima-vista`, `adventurer-s-airship`,
// `balamb-garden-seed-academy-balamb-garden-airborne` (back face) all print
// the FULL real reminder-text template ("Crew N (Tap any number of
// creatures you control with total power N or more: This Vehicle becomes an
// artifact creature until end of turn.)"); `the-lunar-whale`, `the-regalia`,
// `sidequest-card-collection-magicked-card` (back face) print a BARE "Crew
// N" line with no reminder text at all — a real, confirmed, DIFFERENT
// Scryfall printing shape, not a typo — both templates are tried, in that
// order (full reminder first, since a bare "Crew N" pattern would ALSO
// match inside the full-reminder text's own leading "Crew N (" — trying the
// more specific one first and only falling back to the bare one avoids ever
// mis-annotating a shorter span when the fuller clause is actually present).
//
// **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-bug
// audit, same class as `putCounter-broadcast-structural.ts`/`ptFormula-
// scalingPump-structural.ts`/`putCounterTarget-effect-structural.ts`/
// `tapTarget-effect-structural.ts`): on the 5 real FULL-reminder-template
// cards, the sink used to reuse the SOURCE's own whole-clause span
// byte-for-byte (e.g. Cargo Ship's own sink covered the ENTIRE "Crew 1
// (Tap any number of creatures you control with total power 1 or more:
// This Vehicle becomes an artifact creature until end of turn.)" clause,
// when the sink only actually claims "a creature you control exists").
// `fullPattern` now has 2 capturing groups — group 1 the bare "Crew N"
// action clause (source), group 2 the narrower "creatures you control"
// object phrase (sink) — read out via the `d` (indices) flag. The 3 real
// BARE "Crew N" cards (no reminder text at all) have no separable object
// phrase to split off (the words "creatures you control" never appear
// anywhere near a bare "Crew N" line) — `barePattern` stays a single,
// unsplit span for both roles, unchanged, same "no clean split point,
// leave whole" allowance `putCounterTarget-effect-structural.ts`'s own
// `'any'`-typed Clash of the Eikons case already establishes.
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

const RULE = 'crewCost-structural' as const;

export type CrewCostRecognizerInput = RecognizerInput & Pick<CardDefinition, 'crewCost'>;

export function recognizeCrewCostStructural(input: CrewCostRecognizerInput): RecognizerResult {
  const crewCost = input.crewCost;
  if (crewCost === undefined) {
    return { matched: false, reason: 'no crewCost on this face' };
  }

  const fullPattern = new RegExp(`\\b(Crew ${crewCost})\\s+\\(Tap any number of (creatures you control) with total power ${crewCost} or more: This Vehicle becomes an artifact creature until end of turn\\.\\)`, 'id');
  const barePattern = new RegExp(`^(Crew ${crewCost})$`, 'imd');

  let matches = [...input.oracleText.matchAll(new RegExp(fullPattern.source, fullPattern.flags + 'g'))] as Array<
    RegExpMatchArray & { indices: Array<[number, number] | undefined> }
  >;
  if (matches.length === 0) {
    matches = [...input.oracleText.matchAll(new RegExp(barePattern.source, barePattern.flags + 'g'))] as Array<
      RegExpMatchArray & { indices: Array<[number, number] | undefined> }
    >;
  }
  if (matches.length !== 1) {
    return {
      matched: false,
      kind: 'mismatch',
      reason: `expected clause /${fullPattern.source}/ or /${barePattern.source}/ matched ${matches.length} times combined (want exactly 1) in oracle text "${input.oracleText}"`,
    };
  }

  const m = matches[0]!;
  // Group 1 (the bare "Crew N" clause) always exists on both templates;
  // group 2 (the "creatures you control" object phrase) only exists on the
  // full-reminder template — falls back to group 1's own span (unsplit)
  // when absent, same convention `putCounterTarget-effect-structural.ts`'s
  // own `hasSplitGroups` fallback already establishes.
  const [sourceStart, sourceEnd] = m.indices[1]!;
  const [sinkStart, sinkEnd] = m.indices[2] ?? m.indices[1]!;
  const sourceAnnotation = toLineOffset(input.oracleText, sourceStart, sourceEnd);
  const sinkAnnotation = toLineOffset(input.oracleText, sinkStart, sinkEnd);
  if (!sourceAnnotation || !sinkAnnotation) {
    return { matched: false, reason: `matched span [${sourceStart},${sinkEnd}) (or its own inner source/sink split spans) did not resolve to a single real oracle-text line` };
  }

  const facts: RecognizedFact[] = [
    {
      role: 'source',
      fact: { event: 'crew', target: 'self', annotations: [sourceAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
    {
      role: 'sink',
      fact: { to: 'Battlefield', controller: 'you', types: { has: ['Creature'] }, annotations: [sinkAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];
  return { matched: true, facts };
}
