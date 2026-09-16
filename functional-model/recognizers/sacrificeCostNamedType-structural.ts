// New recognizer (2026-09-16, fin/26-50 pass) — card-definition-level
// (reads `activationCost` TEXT directly, never `effects`; same family as
// `tapSelfCost-structural.ts`/`discardSelfCost-structural.ts`), covering an
// activated ability whose own COST names a SINGLE, SPECIFIC, non-self,
// non-"another" type to sacrifice ("Sacrifice a/an <Type>" — the sacrifice
// itself is part of the cost text, e.g. Sidequest: Catch a Fish // Cooking
// Campsite's own back face's own doc comment: "Modeled as a real SOURCE
// fact... the same shape The Gold Saucer's own 'Sacrifice two artifacts:
// Draw a card' cost already established" — except that one's own fact
// still uses the OLD pre-migration `sourceText`/`highlight` schema, out of
// this recognizer's own scope; see below).
//
// **Real, whole-pool check (14 real cards with both `Sacrifice` and an
// `activationCost` somewhere in their own definition) done first** — the
// leading article after "Sacrifice" is the real, closed discriminator
// between 4 genuinely different real English shapes, checked individually:
//   - **"Sacrifice a/an <Type>" (THIS recognizer's own scope, 2 real
//     matches)**: Sidequest: Catch a Fish // Cooking Campsite's own back
//     face ("Sacrifice an artifact") and Quina, Qu Gourmet ("Sacrifice a
//     Frog") — a real, singular, specific-type, non-self sacrifice
//     entirely inside the cost.
//   - **"Sacrifice <named self>"/"Sacrifice this <type>"** (Blazing Bomb,
//     Instant Ramen, Elven Passage, Zack Fair): a SELF-sacrifice cost — a
//     completely different real claim (`target:'self'`, no `types`
//     constraint at all) with no confirmed template needed here; `\b(a|
//     an)\b`'s own word-boundary anchoring already naturally excludes every
//     one of these (neither "this" nor a card's own proper NAME matches
//     `\b(a|an)\b`), so this recognizer simply never matches them — not a
//     special-cased exclusion, a structural non-match.
//   - **"Sacrifice another <Type[ or Type]>"** (Ahriman, Phantom Train,
//     Sidequest: Hunt the Mark // Yiazmat, Ultimate Mark): "another" is ONE
//     English word (never "an"+"other" as two tokens), so `\b(a|an)\b`
//     never matches inside it either — same natural non-match, not a
//     special case. These 3 real cards' own existing hand-authored facts
//     already carry `targeted:true`/`excludeSelf:true`/(sometimes)
//     `hasAny` for a 2-type choice — a genuinely different real shape from
//     this recognizer's own plain `has:[Type]`, out of scope here.
//   - **"Sacrifice two <Type>s"** (The Gold Saucer): a plural-count cost —
//     "two" doesn't match `\b(a|an)\b` either, same natural non-match. That
//     card's own existing fact also still uses the pre-migration
//     `sourceText`/`highlight` schema (never `annotations`/`target`) —
//     untouched either way, both by construction (no match) and by charter
//     (this recognizer only ever asserts the current schema).
//
// **Type-word vocabulary, deliberately closed and small**: a captured word
// already capitalized in the real printed text (a creature type, e.g.
// "Frog") is used AS-IS (Magic's own real templating always capitalizes a
// creature type even mid-sentence); a captured LOWERCASE word is a card
// supertype/type keyword, mapped through a small fixed dictionary (the same
// closed CR-vocabulary discipline `diesOtherPermanentsOncePerTurn-trigger-
// structural.ts`'s own module doc comment establishes) — an unrecognized
// lowercase word declines rather than guessing a capitalization.
//
// **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-bug
// audit, same class as the sibling fixes elsewhere in this catalog): both
// facts used to reuse the SAME whole-clause span ("Sacrifice a/an <Type>")
// — the sink only actually claims "a permanent of this type exists," not
// the sacrifice action itself. `Sacrifice` (the bare verb) is now its own
// capturing group (source), "a/an <Type>" a second, separate one (sink).
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

export type SacrificeCostNamedTypeRecognizerInput = RecognizerInput & Pick<CardDefinition, 'activationCost'>;

const RULE = 'sacrificeCostNamedType-structural' as const;

const LOWERCASE_TYPE_WORD: Partial<Record<string, string>> = {
  artifact: 'Artifact',
  creature: 'Creature',
  enchantment: 'Enchantment',
  land: 'Land',
  planeswalker: 'Planeswalker',
  battle: 'Battle',
};

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function recognizeSacrificeCostNamedTypeStructural(input: SacrificeCostNamedTypeRecognizerInput): RecognizerResult {
  if (!input.activationCost) {
    return { matched: false, reason: 'no activationCost on this face' };
  }
  const costMatch = /\bSacrifice (?:a|an) ([A-Za-z]+)\b/.exec(input.activationCost);
  if (!costMatch) {
    return { matched: false, reason: 'activationCost has no "Sacrifice a/an <Type>" clause' };
  }
  const rawWord = costMatch[1]!;
  const typeWord = /^[A-Z]/.test(rawWord) ? rawWord : LOWERCASE_TYPE_WORD[rawWord.toLowerCase()];
  if (!typeWord) {
    return { matched: false, reason: `captured type word "${rawWord}" is lowercase and not in this recognizer's own closed vocabulary — no confirmed capitalization` };
  }

  const pattern = new RegExp(`\\b(Sacrifice) ((?:a|an) ${escapeRegExp(rawWord)})\\b`, 'd');
  const matches = [...input.oracleText.matchAll(new RegExp(pattern.source, pattern.flags + 'g'))] as Array<
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
  // **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-bug
  // audit, same class as the sibling fixes elsewhere in this catalog):
  // used to reuse the SAME whole-clause span ("Sacrifice a/an <Type>") for
  // both roles — group 1 ("Sacrifice," the bare verb) now anchors SOURCE,
  // group 2 ("a/an <Type>," the object phrase) anchors SINK.
  const [sourceStart, sourceEnd] = m.indices[1]!;
  const [sinkStart, sinkEnd] = m.indices[2]!;
  const sourceAnnotation = toLineOffset(input.oracleText, sourceStart, sourceEnd);
  const sinkAnnotation = toLineOffset(input.oracleText, sinkStart, sinkEnd);
  if (!sourceAnnotation || !sinkAnnotation) {
    return { matched: false, reason: `matched span [${sourceStart},${sinkEnd}) (or its own inner source/sink split spans) did not resolve to a single real oracle-text line` };
  }

  return {
    matched: true,
    facts: [
      {
        role: 'source',
        fact: { event: 'sacrifice', controller: 'you', target: { types: { has: [typeWord] } }, annotations: [sourceAnnotation] },
        provenance: { origin: 'parser', rule: RULE },
      },
      // Paired "wants this present" SINK — same real convention `destroy-
      // effect-structural.ts`'s own tier-2 sink already establishes: a cost
      // that names a specific type to sacrifice genuinely implies a real
      // "wants a permanent of this type present" want (Sidequest: Catch a
      // Fish // Cooking Campsite's own back face's pre-existing hand-
      // authored sink fact already asserts exactly this).
      {
        role: 'sink',
        fact: { to: 'Battlefield', controller: 'you', types: { has: [typeWord] }, annotations: [sinkAnnotation] },
        provenance: { origin: 'parser', rule: RULE },
      },
    ],
  };
}
