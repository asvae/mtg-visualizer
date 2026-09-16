// New recognizer (2026-09-16, recognizer-lane triage) — CARD-DEFINITION-
// LEVEL (reads `activationCost`/`abilities[].cost` TEXT, never `effects`),
// same family as `tapSelfCost-structural.ts`/`discardSelfCost-structural
// .ts`/`sacrificeSelfCost-structural.ts` — mirrors that last one's own
// "Sacrifice <named self>/this <type>" shape for the literal "Exile this
// <type>" self-exile-as-COST template instead.
//
// **Real, whole-pool check done first** (grepped every `activationCost`/
// `abilities[].cost` string across `functional-model/cards/*/definition.ts`
// for a literal "Exile this") — **3 real matches, all the identical "Exile
// this artifact" wording, no proper-own-name form found anywhere in this
// pool (unlike `sacrificeSelfCost-structural.ts`'s own real Zack Fair/
// Lunatic Pandora/Qiqirn Merchant own-name cases)**: `ether` ("{T}, Exile
// this artifact: Add {U}. ..."), `elixir` ("{5}, {T}, Exile this artifact:
// Shuffle all nonland cards..."), `phoenix-down` ("{1}{W}, {T}, Exile this
// artifact: Choose one — ..."). `ether`'s own pre-existing hand-authored
// fact already carries this exact shape, unprovenanced — real, confirmed
// pool-wide reach, not a one-off.
//
// **No engine.ts runtime helper to reuse here** (unlike `tapSelfCost-
// structural.ts`/`discardSelfCost-structural.ts`, both of which reuse a
// real `costRequires*` helper `engine.ts`'s own `unsupportedCostComponent`
// already checks at RUNTIME) — "Exile this <type>" is NOT itself a payable
// cost component anywhere in `unsupportedCostComponent`'s own real closed
// list (`{T}`/mana/"Pay N life"/"Discard this card"/a real modeled
// Sacrifice — checked that function directly, not assumed), so it falls
// through to the same generic rejection self-Sacrifice gets — a real,
// pre-existing, NOT-fixed-here engine gap (same class `sacrificeSelfCost-
// structural.ts`'s own module doc comment already documents for self-
// Sacrifice, not repeated in full here). This recognizer only ever asserts
// the real FACT-level claim ("this ability's own cost exiles its own
// source"), same restraint every sibling in this family already keeps —
// never touches `canActivateAbility`/`activateAbility`'s own real
// payability logic.
//
// `{event:'exile', subject:'self', target:'self'}` — matches `ether`'s/
// `phoenix-down`'s own pre-existing hand-authored facts exactly (both
// already carry this shape, unprovenanced before this pass).
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

export type ExileSelfCostRecognizerInput = RecognizerInput & Pick<CardDefinition, 'activationCost' | 'abilities'>;

const RULE = 'exileSelfCost-structural' as const;

const PERMANENT_TYPE_WORDS = ['Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle', 'Land'];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Same per-file copy `sacrificeSelfCost-structural.ts` already carries
 * (see that file's own module doc comment on why this is a per-file
 * duplicate, not a shared import, and why `Land` is included even though
 * no real card here needs it yet). */
function selfSubjectAlternation(name: string): string {
  const typeAlt = PERMANENT_TYPE_WORDS.map((w) => `this ${w.toLowerCase()}`).join('|');
  const shortName = name.split(',')[0]!.trim();
  const nameAlt = shortName !== name ? `${escapeRegExp(name)}|${escapeRegExp(shortName)}` : escapeRegExp(name);
  return `(?:${typeAlt}|this permanent|${nameAlt})`;
}

export function recognizeExileSelfCostStructural(input: ExileSelfCostRecognizerInput): RecognizerResult {
  const subject = selfSubjectAlternation(input.name);
  const costPattern = new RegExp(`\\bExile ${subject}\\b`, 'i');

  const qualifying: string[] = [];
  if (input.activationCost && costPattern.test(input.activationCost)) qualifying.push(input.activationCost);
  for (const ability of input.abilities ?? []) {
    if (costPattern.test(ability.cost)) qualifying.push(ability.cost);
  }
  if (qualifying.length === 0) {
    return { matched: false, reason: `no activationCost/abilities[].cost matching "Exile ${subject}"` };
  }

  const oraclePattern = new RegExp(`\\bExile ${subject}\\b`, 'i');
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
        reason: `a qualifying cost ("${cost}") exiles this permanent as part of its own cost, but no real, not-yet-claimed "Exile ${subject}" clause was found in this face's own oracle text ("${input.oracleText}")`,
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
      fact: { event: 'exile', subject: 'self', target: 'self', annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
