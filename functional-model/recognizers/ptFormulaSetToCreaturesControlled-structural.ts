// New recognizer (2026-09-16, fin/26-50 pass) — card-definition-level
// (reads `CardDefinition.ptFormula` directly, not `effects`), same family
// as `crewCost-structural.ts`/`ptFormula-scalingPump-structural.ts`.
// Covers `ptFormula: { kind: 'setToCreaturesControlled' }` — Forge's own
// real `SetPower$ X` layer-7a CDA (`card.ts`'s own doc comment on this
// variant), Snow Villiers' own real printed "Snow Villiers's power is
// equal to the number of creatures you control."
//
// **Real, whole-pool check**: Snow Villiers is the ONLY real card using
// this `ptFormula` variant (confirmed via `ptFormula-scalingPump-
// structural.ts`'s own module doc comment, which already did this exact
// whole-pool grep while explaining why it's out of THAT recognizer's own
// scope). This recognizer will apply to any future card using the
// identical shape.
//
// **Fixed, non-parametric template** — unlike every other recognizer in
// this catalog, there's no varying number/type/keyword to build a pattern
// FROM here: the whole clause is one fixed real English sentence fragment,
// "power is equal to the number of creatures you control," anchored
// verbatim (case-insensitive, since it could in principle sit mid-
// sentence on a future card even though Snow Villiers' own real printing
// happens to start the sentence with the card's own name).
//
// **Widened 2026-09-16 (static-ability audit) to ALSO cover
// `setToGraveyardPermanentCount`** — Neo Exdeath, Dimension's End's own
// real "Neo Exdeath's power is equal to the number of permanent cards in
// your graveyard" — the SAME real SET-CDA mechanism, just counting the
// controller's own graveyard for a permanent-card type instead of
// battlefield creatures. Kept in this same file/RULE (not a new sibling)
// since it's the identical output shape (`event:'pump', target:'self'`
// SOURCE + a "wants X present" SINK), just a different fixed clause/sink
// target.
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

export type PtFormulaSetToCreaturesControlledRecognizerInput = RecognizerInput & Pick<CardDefinition, 'ptFormula'>;

const RULE = 'ptFormulaSetToCreaturesControlled-structural' as const;

const CLAUSE = /power is equal to the number of creatures you control/i;
const WANT_CLAUSE = /the number of creatures you control/i;
const GRAVEYARD_CLAUSE = /power is equal to the number of permanent cards in your graveyard/i;
const GRAVEYARD_WANT_CLAUSE = /the number of permanent cards in your graveyard/i;
const PERMANENT_CARD_TYPES = ['Creature', 'Artifact', 'Enchantment', 'Land'];

export function recognizePtFormulaSetToCreaturesControlledStructural(input: PtFormulaSetToCreaturesControlledRecognizerInput): RecognizerResult {
  if (input.ptFormula?.kind !== 'setToCreaturesControlled' && input.ptFormula?.kind !== 'setToGraveyardPermanentCount') {
    return { matched: false, reason: 'no ptFormula.kind:"setToCreaturesControlled"/"setToGraveyardPermanentCount" on this face' };
  }
  const isGraveyard = input.ptFormula.kind === 'setToGraveyardPermanentCount';
  const CLAUSE_ACTIVE = isGraveyard ? GRAVEYARD_CLAUSE : CLAUSE;
  const WANT_CLAUSE_ACTIVE = isGraveyard ? GRAVEYARD_WANT_CLAUSE : WANT_CLAUSE;
  const sinkFact = isGraveyard ? { to: 'Graveyard' as const, controller: 'you' as const, types: { hasAny: PERMANENT_CARD_TYPES } } : { to: 'Battlefield' as const, controller: 'you' as const, types: { has: ['Creature'] } };

  const clauseMatches = [...input.oracleText.matchAll(new RegExp(CLAUSE_ACTIVE.source, 'gi'))];
  if (clauseMatches.length !== 1) {
    return {
      matched: false,
      kind: 'mismatch',
      reason: `expected clause /${CLAUSE_ACTIVE.source}/i matched ${clauseMatches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
    };
  }
  const clauseMatch = clauseMatches[0]!;
  const clauseStart = clauseMatch.index!;
  const clauseEnd = clauseStart + clauseMatch[0]!.length;
  const clauseAnnotation = toLineOffset(input.oracleText, clauseStart, clauseEnd);
  if (!clauseAnnotation) {
    return { matched: false, reason: `matched span [${clauseStart},${clauseEnd}) did not resolve to a single real oracle-text line` };
  }

  const wantMatch = WANT_CLAUSE_ACTIVE.exec(clauseMatch[0]!);
  if (!wantMatch) {
    return { matched: false, reason: `internal: "${WANT_CLAUSE_ACTIVE.source}" not found within its own already-matched clause "${clauseMatch[0]}"` };
  }
  const wantStart = clauseStart + wantMatch.index;
  const wantEnd = wantStart + wantMatch[0].length;
  const wantAnnotation = toLineOffset(input.oracleText, wantStart, wantEnd);
  if (!wantAnnotation) {
    return { matched: false, reason: `matched span [${wantStart},${wantEnd}) did not resolve to a single real oracle-text line` };
  }

  return {
    matched: true,
    facts: [
      {
        role: 'source',
        fact: { event: 'pump', target: 'self', annotations: [clauseAnnotation] },
        provenance: { origin: 'parser', rule: RULE },
      },
      {
        role: 'sink',
        fact: { ...sinkFact, annotations: [wantAnnotation] },
        provenance: { origin: 'parser', rule: RULE },
      },
    ],
  };
}
