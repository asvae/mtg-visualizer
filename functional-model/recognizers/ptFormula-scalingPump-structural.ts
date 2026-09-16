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
// **Two facts, the CDA itself (SOURCE — `{event:'pump', target:'self'}`) and
// the real precondition it's keyed on (SINK — `{to:'Battlefield',
// controller:'you', types:{has:['Equipment']}}`).**
//
// **2026-09-16 SOURCE/SINK span-narrowing fix (real user-reported bug,
// Adelbert Steiner)** — both facts used to reuse the SAME whole-line
// annotation span byte-for-byte. The real oracle text has 2 distinguishable
// sub-phrases (Adelbert Steiner: "Adelbert Steiner gets +1/+1" is the
// SOURCE's own claim; "each Equipment you control" is the SINK's own,
// narrower "wants this present" claim — the connecting "for"/"as long as"
// belongs to neither) — same real "narrow the SINK to its own object
// phrase, leave the SOURCE as its own subject+verb clause" split
// `putCounter-broadcast-structural.ts`'s own confirmed fix already
// establishes (see that file's own module doc comment), applied here to
// every branch in this file rather than inventing a new convention. Each
// branch below builds TWO named capture groups (`source`/`sink`) instead of
// one flat clause; the connecting word(s) between them ("for"/"as long
// as"/", ") are matched but captured by neither group. Whole-pool check
// (7 real users of this recognizer, 2026-09-16): adelbert-steiner,
// xande-dark-mage, zell-dincht (all 3 same "SOURCE clause, then trailing
// 'for each ...' SINK" shape) and gaelicat/magitek-infantry/
// scorpion-sentinel/gigantoad (all 4 `thresholdBonus`, 2 real word-order
// variants — see below) — all 7 confirmed to have the SAME whole-line-reuse
// bug (each card's own `synergy.json` had both facts sharing one identical
// span), all 7 fixed the same way.
//
// **`kind:'thresholdBonus'` branch added 2026-09-15 (fin/16-25 pass,
// ENGINE_GAPS.md's own "Gaelicat's/Magitek Infantry's own threshold-CDA
// gaps" note, now closed)** — a genuinely different real Forge shape (a
// fixed bonus that's either fully on or fully off once a live COUNT
// THRESHOLD is met — `card.ts`'s own `ptFormula` doc comment has the real
// `IsPresent$.../PresentCompare$ GE<min>` citations for both real cards),
// kept in THIS same file/RULE rather than a new sibling recognizer since
// its own output shape (a self `pump` source + a `to:'Battlefield'` sink
// keyed on a controlled-permanent count) is the SAME real claim FAMILY as
// the `addPerEquipmentControlled` branch above, just gated differently.
// Only TWO real English templates confirmed (grepped both real cards'
// printed text directly, no others in the pool use this `ptFormula`
// variant): Gaelicat's own "As long as you control two or more artifacts,
// this creature gets +2/+0" (`condition.min >= 2`, no `excludeSelf`) and
// Magitek Infantry's own "This creature gets +1/+0 as long as you control
// another artifact" (`condition.min === 1`, `excludeSelf: true` — the
// "another" wording IS the exclude-self signal, real Forge `.Other+`).
// Neither template guesses at an unconfirmed `min`/word combination — any
// other combination declines (`scope`) rather than inventing a third
// English phrasing with no real card to check it against.
//
// **`kind:'addPerGraveyardCount'` branch added 2026-09-16 (static-ability
// audit)** — Xande, Dark Mage's own real "gets +1/+1 for each noncreature,
// nonland card in your graveyard" (this recognizer's own module doc used
// to cite xande-dark-mage BY NAME as a confirmed-out-of-scope card; no
// longer true — `card.ts`'s own `ptFormula` union grew this variant). Same
// output shape as every other branch here (self `pump` SOURCE + a "wants X
// present" SINK), sink keyed on `to:'Graveyard'` with a `types:{not:...}`
// constraint (the negated filter this card's own real clause needs) rather
// than `to:'Battlefield'`/`types:{has:...}` the other two branches use.
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

const NUMBER_WORD: Record<number, string> = { 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 7: 'seven' };

export function recognizePtFormulaScalingPumpStructural(input: PtFormulaRecognizerInput): RecognizerResult {
  const formula = input.ptFormula;
  if (!formula) {
    return { matched: false, reason: 'no ptFormula on this face' };
  }

  // Each branch below builds a pattern with TWO named capture groups —
  // `source` (the subject+"gets ±N/±N" clause) and `sink` (the narrower
  // "wants this present" object phrase) — rather than one flat clause. The
  // connecting word(s) between them ("for"/"as long as"/", ") belong to
  // neither group. See module doc comment for the 2026-09-16 fix this is.
  let pattern: string;
  let sinkFact: Omit<RecognizedFact['fact'], 'annotations'>;
  if (formula.kind === 'addPerEquipmentControlled') {
    const source = `${escapeRegExp(input.name)} gets ${escapeRegExp(signed(formula.power))}/${escapeRegExp(signed(formula.toughness))}`;
    pattern = `(?<source>${source}) for (?<sink>each Equipment you control)`;
    sinkFact = { to: 'Battlefield', controller: 'you', types: { has: ['Equipment'] } };
  } else if (formula.kind === 'thresholdBonus') {
    const { power, toughness, condition } = formula;
    const typeWord = condition.type.toLowerCase();
    const source = `this creature gets ${escapeRegExp(signed(power))}/${escapeRegExp(signed(toughness))}`;
    if (condition.excludeSelf && condition.min === 1) {
      pattern = `(?<source>${source}) as long as (?<sink>you control another ${typeWord})`;
    } else if (!condition.excludeSelf && condition.min >= 2 && NUMBER_WORD[condition.min]) {
      pattern = `as long as (?<sink>you control ${NUMBER_WORD[condition.min]} or more ${typeWord}s), (?<source>${source})`;
    } else {
      return { matched: false, reason: `no confirmed English template for thresholdBonus condition ${JSON.stringify(condition)}` };
    }
    sinkFact = {
      to: 'Battlefield',
      controller: 'you',
      types: { has: [condition.type] },
      amount: { min: condition.min },
      ...(condition.excludeSelf ? { excludeSelf: true } : {}),
    };
  } else if (formula.kind === 'addPerGraveyardCount') {
    // Real CR 201.4b self-reference by SHORT name (the part before a
    // comma-separated subtitle) — Xande, Dark Mage's own real text says
    // "Xande gets...", never the full printed "Xande, Dark Mage gets...".
    const shortName = input.name.includes(',') ? input.name.slice(0, input.name.indexOf(',')) : input.name;
    const source = `${escapeRegExp(shortName)} gets ${escapeRegExp(signed(formula.power))}/${escapeRegExp(signed(formula.toughness))}`;
    pattern = `(?<source>${source}) for (?<sink>each noncreature, nonland card in your graveyard)`;
    sinkFact = { to: 'Graveyard', controller: 'you', types: { not: ['Creature', 'Land'] } };
  } else if (formula.kind === 'addPerLandControlled') {
    const shortName = input.name.includes(',') ? input.name.slice(0, input.name.indexOf(',')) : input.name;
    const source = `${escapeRegExp(shortName)} gets ${escapeRegExp(signed(formula.power))}/${escapeRegExp(signed(formula.toughness))}`;
    pattern = `(?<source>${source}) for (?<sink>each land you control)`;
    sinkFact = { to: 'Battlefield', controller: 'you', types: { has: ['Land'] } };
  } else {
    return { matched: false, reason: `no confirmed English template for ptFormula.kind "${(formula as { kind: string }).kind}"` };
  }

  const re = new RegExp(`\\b${pattern}\\b`, 'i');
  const global = new RegExp(re.source, re.flags + 'gd');
  const matches = [...input.oracleText.matchAll(global)] as (RegExpMatchArray & {
    indices: RegExpMatchArray['indices'] & { groups: Record<'source' | 'sink', [number, number]> };
  })[];
  if (matches.length === 0) {
    return {
      matched: false,
      kind: 'mismatch',
      reason: `expected clause /${re.source}/ not found (verbatim) in oracle text "${input.oracleText}"`,
    };
  }
  if (matches.length > 1) {
    return {
      matched: false,
      kind: 'mismatch',
      reason: `expected clause /${re.source}/ matched ${matches.length} times — ambiguous, declining rather than guessing which`,
    };
  }

  const m = matches[0]!;
  const [sourceStart, sourceEnd] = m.indices.groups.source;
  const [sinkStart, sinkEnd] = m.indices.groups.sink;
  const sourceAnnotation = toLineOffset(input.oracleText, sourceStart, sourceEnd);
  const sinkAnnotation = toLineOffset(input.oracleText, sinkStart, sinkEnd);
  if (!sourceAnnotation || !sinkAnnotation) {
    return {
      matched: false,
      reason: `matched span [${sourceStart},${sourceEnd}) (or its own sink span [${sinkStart},${sinkEnd})) did not resolve to a single real oracle-text line`,
    };
  }

  const facts: RecognizedFact[] = [
    {
      role: 'source',
      fact: { event: 'pump', target: 'self', annotations: [sourceAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
    {
      role: 'sink',
      fact: { ...sinkFact, annotations: [sinkAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];
  return { matched: true, facts };
}
