// New recognizer (2026-09-15, fin/16-25 pass) — text-based, sibling of
// `dies-trigger-structural.ts` but for the genuinely DIFFERENT, BROADER
// precondition that recognizer's own module doc comment explicitly declines
// (`al-bhed-salvagers`'s own "this creature or another creature or artifact
// you control dies" case): "Whenever one or more other <type list> you
// control die" — real modern Wizards templating for a multi-death-tolerant
// trigger (fires once even if several qualifying permanents die
// simultaneously, e.g. a board wipe), always paired in this pool with a real
// `Trigger.activationLimit === 1` structural cap ("This ability triggers
// only once each turn").
//
// **Whole-pool check before writing this** (grepped every real `/one or
// more/` occurrence in `data/fin/fin_scryfall.json`): G'raha Tia's "The
// Allagan Eye" is the ONE real card in this pool matching "Whenever one or
// more other <permanent type list> you control die" — not a speculative
// generalization, one real motivating card, same precedent as
// `costReductionTappedTarget-structural.ts`'s own single-card scope. (Fang,
// Fearless l'Cie's "Whenever one or more cards leave your graveyard" is a
// DIFFERENT event entirely — not `dies` — correctly out of this
// recognizer's scope; its own `event:'leaveGraveyard'`-shaped fact, if any,
// is a separate concern.)
//
// **Why a NEW recognizer, not a `dies-trigger-structural` extension**: that
// recognizer's own real job (CR 700.4's "this permanent's own death," a
// `target:'self'` sink) and this one's job (an ANY-OTHER-qualifying-
// permanent death, a `target:{types:{hasAny:[...]}, excludeSelf:true}` sink)
// are different CLAIMS, not different phrasings of the same claim — folding
// them into one file would make that file's own regex do double duty across
// two incompatible target shapes. Kept separate, same reasoning
// `continuousKeywordGrantsEquipped-structural.ts` vs.
// `continuousKeywordGrantsSubtype-structural.ts` already established for an
// analogous "same field, different real target shape" split.
//
// **Closed-vocabulary type-list parsing, not open-ended semantic
// extraction**: the "creatures and/or artifacts" list is parsed against the
// SAME fixed CR permanent-type vocabulary `dies-trigger-structural.ts`
// already hardcodes as `PERMANENT_TYPE_WORDS` (Creature/Artifact/
// Enchantment/Planeswalker/Battle/Land) — not a free-text value this
// recognizer invents meaning for. An unrecognized word anywhere in the list
// declines (mismatch), same conservative-by-construction discipline every
// other list-parsing recognizer in this catalog uses (e.g.
// `continuousKeywordGrantsSubtype-structural.ts`'s own `listPhrase`).
//
// **`activationLimit === 1` is the real structural anchor for `oncePerTurn:
// true`** — not inferred from the "triggers only once each turn" ENGLISH
// alone (that sentence is separately, redundantly required to appear too, as
// a real corroborating check, same double-check discipline
// `flashback-alternateCost-structural.ts` and others already use between a
// structured field and its own printed English).
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import type { StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'diesOtherPermanentsOncePerTurn-trigger-structural' as const;

// Same fixed CR permanent-type vocabulary `dies-trigger-structural.ts` uses.
const TYPE_WORD: Record<string, string> = {
  creature: 'Creature',
  artifact: 'Artifact',
  enchantment: 'Enchantment',
  planeswalker: 'Planeswalker',
  battle: 'Battle',
  land: 'Land',
};

function parseTypeList(listText: string): string[] | null {
  // Splits on ", " and/or " and/or " (real Oxford-list-with-and/or
  // templating, e.g. "creatures and/or artifacts", "creatures, artifacts,
  // and/or enchantments"), singularizes a trailing "s", and looks each word
  // up in the closed vocabulary above.
  const words = listText
    .split(/,\s*(?:and\/or\s+)?|\s+and\/or\s+/i)
    .map((w) => w.trim().toLowerCase())
    .filter(Boolean)
    .map((w) => (w.endsWith('s') ? w.slice(0, -1) : w));
  const out: string[] = [];
  for (const w of words) {
    const mapped = TYPE_WORD[w];
    if (!mapped) return null;
    out.push(mapped);
  }
  return out.length > 0 ? out : null;
}

const CLAUSE_RE = /\bWhenever one or more (other )?([a-z][a-z/, ]*?) you control die\b/i;

export function recognizeDiesOtherPermanentsOncePerTurnTriggerStructural(input: StructuralRecognizerInput): RecognizerResult {
  const hasCappedTrigger = (input.triggers ?? []).some((t) => t.activationLimit === 1);
  if (!hasCappedTrigger) {
    return { matched: false, reason: 'no trigger on this face has activationLimit === 1' };
  }
  if (!/triggers only once each turn/i.test(input.oracleText)) {
    return { matched: false, reason: 'oracle text has no "triggers only once each turn" corroborating clause' };
  }

  const match = CLAUSE_RE.exec(input.oracleText);
  if (!match) {
    return { matched: false, reason: 'no "Whenever one or more (other) <type list> you control die" clause found' };
  }
  const isOther = !!match[1];
  const types = parseTypeList(match[2]!);
  if (!types) {
    return { matched: false, kind: 'mismatch', reason: `type list "${match[2]}" contains a word outside the closed permanent-type vocabulary` };
  }

  const start = match.index;
  let end = start + match[0].length;
  // WIDENED (2026-09-16, fin/20-47 pass) — the real corroborating "This
  // ability triggers only once each turn." sentence (G'raha Tia's own text,
  // the ONE real user of this recognizer, checked directly) now counts as
  // part of this same sink fact's annotation. This recognizer already
  // REQUIRES this exact sentence to appear (checked above, unconditionally,
  // not just when convenient) before matching at all — the whole clause
  // ("Whenever one or more other creatures and/or artifacts you control
  // die, draw a card. This ability triggers only once each turn.") is one
  // real, cohesive rules statement, not two independent ones. Note the
  // ANCHOR clause above only covers up through "...you control die" (the
  // trigger's own precondition; "draw a card" itself is separately covered
  // by `drawCard-effect-structural.ts`'s own source fact) — this trailing
  // sentence sits AFTER that source fact's own span, so it's only ever
  // reachable from here.
  const trailingOncePerTurn = /^,\s*draw a card\.\s*This ability triggers only once each turn\.?/i.exec(input.oracleText.slice(end));
  if (trailingOncePerTurn) end += trailingOncePerTurn[0].length;
  const annotation = toLineOffset(input.oracleText, start, end);
  if (!annotation) {
    return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
  }

  const facts: RecognizedFact[] = [
    {
      role: 'sink',
      fact: {
        event: 'dies',
        controller: 'you',
        target: { types: { hasAny: types }, ...(isOther ? { excludeSelf: true } : {}) },
        oncePerTurn: true,
        annotations: [annotation],
      },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];
  return { matched: true, facts };
}
