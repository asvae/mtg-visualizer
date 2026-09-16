// New recognizer (2026-09-16, recognizer-lane triage) — CARD-DEFINITION-
// LEVEL (reads `activationCost`/`abilities[].cost` TEXT, never `effects`;
// same family as `tapSelfCost-structural.ts`/`discardSelfCost-structural
// .ts`), covering the "Sacrifice <named self>"/"Sacrifice this <type>"
// self-sacrifice-as-COST shape `sacrificeCostNamedType-structural.ts`'s own
// module doc comment already names by example and deliberately declines
// (that recognizer's own `\b(a|an)\b` word-boundary anchor naturally
// excludes this shape — a proper name or "this" never matches "a"/"an").
//
// **Real, whole-pool check done first** (grepped every `activationCost`/
// `abilities[].cost` string across `functional-model/cards/*/definition.ts`
// for a literal "Sacrifice" NOT followed by "a/an"/"another"/a number — the
// 3 other real shapes `sacrificeCostNamedType-structural.ts`'s own module
// doc comment already covers/declines) — **6 real matches, not just the 3
// this task was originally scoped around**:
//   - `blazing-bomb` (`activationCost`, cost text reads "Sacrifice Blazing
//     Bomb" — own printed name — while the real ORACLE text says "Sacrifice
//     this creature"; both forms are real, just for two different strings,
//     see below), `instant-ramen` (`activationCost`, "Sacrifice this
//     artifact", cost text matches oracle text verbatim), `zack-fair`
//     (`activationCost`, "Sacrifice Zack Fair", own name, matches oracle
//     text verbatim) — the 3 cards this task named directly.
//   - `lunatic-pandora` (`abilities[].cost`, "Sacrifice Lunatic Pandora,"
//     own name, matches oracle text verbatim), `qiqirn-merchant`
//     (`abilities[].cost`, cost text reads "Sacrifice Qiqirn Merchant" —
//     own name — while the real oracle text says "Sacrifice this
//     creature," same real cost-text/oracle-text divergence Blazing Bomb's
//     own pair has), `world-map` (`abilities[].cost` TWICE, both "Sacrifice
//     this artifact" — the identical real clause repeated across 2
//     genuinely separate activated abilities, same "each ability claims its
//     own left-to-right unclaimed occurrence" tolerance `dealDamageTarget-
//     effect-structural.ts`'s own Thunder Magic case already establishes)
//     — 3 more real cards this task's own framing didn't name, found by
//     checking the whole pool before generalizing, per this catalog's own
//     standing discipline.
//   - `elven-passage` ALSO real-matches ("Sacrifice this land") but its own
//     `synergy.json` is still v1-schema (`sourceText`/no `annotations`, no
//     `event` field anywhere) — `apply-recognizers.mjs`'s own `isV2Shaped`
//     gate already skips any such card automatically; not special-cased
//     here, per this task's own explicit "leave alone" instruction.
//
// **Real, general rule**: the sacrifice is part of the ACTIVATION COST
// (paid before the ability resolves, CR 601.2h), not a resolution-time
// effect — same "the sacrifice never actually removes it from the
// battlefield through this engine's own activated-ability pipeline" caveat
// `engine.ts`'s own `unsupportedCostComponent` doc comment already
// documents by name for Zack Fair/Blazing Bomb specifically (a genuinely
// SEPARATE, pre-existing, deliberately-unfixed runtime gap — this
// recognizer only ever asserts the real FACT-level claim "this ability's
// own cost sacrifices its own source," never touches
// `canActivateAbility`/`activateAbility`'s own real payability logic).
// `{event:'sacrifice', subject:'self', target:'self'}` — matches
// `zack-fair`'s/`qiqirn-merchant`'s own pre-existing hand-authored facts
// exactly (both already carry this shape, unprovenanced before this pass).
//
// **Cost-text detection uses `selfSubjectAlternation` against the COST
// STRING itself** (own printed name, or "this <permanent type>" — same
// closed vocabulary `dies-trigger-structural.ts`'s own original establishes,
// reused/copied per-file per this catalog's own "small closed per-file
// duplicate, no shared module" convention, confirmed intentional by
// `BUCKET_TO_SINK`'s own precedent elsewhere in this catalog) rather than a
// negative "not a/an/another/a number" exclusion — deliberately explicit,
// not just "whatever sacrificeCostNamedType-structural.ts doesn't match."
// The FACT's own annotation is anchored separately, against the REAL
// oracle text (never the cost string, which can legitimately use the own-
// name form even when the real printed text uses "this <type>" instead, or
// vice versa — Blazing Bomb's/Qiqirn Merchant's own real cost-text/oracle-
// text divergence, confirmed above) — same split every other card-
// definition-level recognizer in this catalog already keeps between "what
// licenses building a pattern" (the structured field) and "what the pattern
// is verified against" (the real printed text).
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

export type SacrificeSelfCostRecognizerInput = RecognizerInput & Pick<CardDefinition, 'activationCost' | 'abilities'>;

const RULE = 'sacrificeSelfCost-structural' as const;

const PERMANENT_TYPE_WORDS = ['Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle', 'Land'];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Copied verbatim from `dies-trigger-structural.ts`'s own original (see
 * this file's own module doc comment on why this is a per-file duplicate,
 * not a shared import) — with `Land` added to `PERMANENT_TYPE_WORDS` above
 * (not present in the original copy, needed for `elven-passage`'s own real
 * "Sacrifice this land" even though that card itself is out of scope here —
 * kept anyway since it costs nothing and keeps this copy's own vocabulary
 * honestly complete rather than narrower than it needs to be). */
function selfSubjectAlternation(name: string): string {
  const typeAlt = PERMANENT_TYPE_WORDS.map((w) => `this ${w.toLowerCase()}`).join('|');
  const shortName = name.split(',')[0]!.trim();
  const nameAlt = shortName !== name ? `${escapeRegExp(name)}|${escapeRegExp(shortName)}` : escapeRegExp(name);
  return `(?:${typeAlt}|this permanent|${nameAlt})`;
}

export function recognizeSacrificeSelfCostStructural(input: SacrificeSelfCostRecognizerInput): RecognizerResult {
  const subject = selfSubjectAlternation(input.name);
  const costPattern = new RegExp(`\\bSacrifice ${subject}\\b`, 'i');

  const qualifying: string[] = [];
  if (input.activationCost && costPattern.test(input.activationCost)) qualifying.push(input.activationCost);
  for (const ability of input.abilities ?? []) {
    if (costPattern.test(ability.cost)) qualifying.push(ability.cost);
  }
  if (qualifying.length === 0) {
    return { matched: false, reason: `no activationCost/abilities[].cost matching "Sacrifice ${subject}"` };
  }

  const oraclePattern = new RegExp(`\\bSacrifice ${subject}\\b`, 'i');
  const global = new RegExp(oraclePattern.source, oraclePattern.flags + 'g');
  const matches = [...input.oracleText.matchAll(global)];
  const claimed = new Set<number>();
  const facts: RecognizedFact[] = [];

  for (const cost of qualifying) {
    const unclaimed = matches.find((m) => !claimed.has(m.index!));
    if (!unclaimed) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `a qualifying cost ("${cost}") sacrifices this permanent as part of its own cost, but no real, not-yet-claimed "Sacrifice ${subject}" clause was found in this face's own oracle text ("${input.oracleText}")`,
      };
    }
    claimed.add(unclaimed.index!);
    const start = unclaimed.index!;
    const end = start + unclaimed[0]!.length;
    const annotation = toLineOffset(input.oracleText, start, end);
    if (!annotation) {
      return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
    }
    facts.push({
      role: 'source',
      fact: { event: 'sacrifice', subject: 'self', target: 'self', annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
