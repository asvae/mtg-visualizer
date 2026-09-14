// New recognizer (2026-09-14, mechanization pass — fin/3 gap closure) —
// structural, same family as `saga-lore-and-sacrifice-structural.ts` (reads a
// CARD-DEFINITION-LEVEL structured field, not an `Effect[]` container — see
// that file's own module doc comment for the precedent): reads
// `CardDefinition.ptFormula` (`card.ts`), and for the
// `kind: 'addPerEquipmentControlled'` variant specifically, requires a built
// clause to appear verbatim in this face's own real oracle text before
// asserting anything.
//
// **Real, whole-pool check done first** — grepped every real
// `ptFormula:` field across `functional-model/cards/*/definition.ts`: only
// TWO variants exist at all (`card.ts`'s own closed union), each used by
// EXACTLY one real card today — `addPerEquipmentControlled` (Adelbert
// Steiner) and `setToCreaturesControlled` (Snow Villiers, a genuinely
// different real template, "Power is equal to the number of creatures you
// control" — no "gets +N/+N for each" shape at all, out of scope for this
// recognizer). Every OTHER real "gets +N/+N for each <type> you control"-
// SHAPED card in this pool (gigantoad, scorpion-sentinel, xande-dark-mage,
// zell-dincht — each checked directly) has its OWN `definition.ts` comment
// explaining why neither `ptFormula` variant fits it (a different counted
// subtype, a conditional gate, a formula keyed on something other than a
// controlled-permanent count) — real, confirmed evidence this recognizer's
// own narrow `kind:'addPerEquipmentControlled'` gate is the correct scope,
// not an arbitrary one-card carve-out: the STRUCTURED field itself is
// already this specific (a card whose real text doesn't fit gets left as
// free `staticAbilities` text, never forced into this shape, by convention
// established well before this recognizer existed).
//
// Real Adelbert Steiner clause: "Adelbert Steiner gets +1/+1 for each
// Equipment you control." — `power`/`toughness` are plain, already-typed
// numbers (never a `Computed` closure — `card.ts`'s own type has no such
// escape hatch for this variant at all, so there's nothing to decline for
// non-literal amounts the way `putCounterSelf-effect-structural.ts` does).
//
// **Two facts, mirroring this card's own real, pre-existing hand-authored
// pair byte-for-byte, SAME shared annotation span** (same "one real clause
// names both what happens and what it wants present" convention
// `putCounter-broadcast-structural.ts`'s own paired source+sink already
// establishes): the CDA itself (SOURCE — `{event:'pump', target:'self'}`)
// and the real precondition it's keyed on (SINK — `{to:'Battlefield',
// controller:'you', types:{has:['Equipment']}}`).
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

const RULE = 'ptFormula-scalingPump-structural' as const;

export type PtFormulaRecognizerInput = RecognizerInput & Pick<CardDefinition, 'ptFormula'>;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

export function recognizePtFormulaScalingPumpStructural(input: PtFormulaRecognizerInput): RecognizerResult {
  const formula = input.ptFormula;
  if (!formula || formula.kind !== 'addPerEquipmentControlled') {
    return { matched: false, reason: 'no ptFormula.kind:"addPerEquipmentControlled" on this face' };
  }

  const clause = `${escapeRegExp(input.name)} gets ${escapeRegExp(signed(formula.power))}/${escapeRegExp(signed(formula.toughness))} for each Equipment you control`;
  const pattern = new RegExp(`\\b${clause}\\b`, 'i');
  const global = new RegExp(pattern.source, pattern.flags + 'g');
  const matches = [...input.oracleText.matchAll(global)];
  if (matches.length === 0) {
    return {
      matched: false,
      kind: 'mismatch',
      reason: `expected clause /${pattern.source}/ not found (verbatim) in oracle text "${input.oracleText}"`,
    };
  }
  if (matches.length > 1) {
    return {
      matched: false,
      kind: 'mismatch',
      reason: `expected clause /${pattern.source}/ matched ${matches.length} times — ambiguous, declining rather than guessing which`,
    };
  }

  const m = matches[0]!;
  const start = m.index!;
  const end = start + m[0]!.length;
  const annotation = toLineOffset(input.oracleText, start, end);
  if (!annotation) {
    return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
  }

  const facts: RecognizedFact[] = [
    {
      role: 'source',
      fact: { event: 'pump', target: 'self', annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
    {
      role: 'sink',
      fact: { to: 'Battlefield', controller: 'you', types: { has: ['Equipment'] }, annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];
  return { matched: true, facts };
}
