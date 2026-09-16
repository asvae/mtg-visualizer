// New recognizer (2026-09-15, fin/26-50 pass) — card-definition-level, same
// family as `ptFormula-scalingPump-structural.ts`/`crewCost-structural.ts`
// (reads a top-level `CardDefinition` field directly, not an `Effect[]`
// container): `CardDefinition.manaAbilities` (real Forge `AB$ Mana` — see
// `card.ts`'s own `ManaAbility` doc comment for the full field-by-field
// citation). Sibling of `addMana-effect-structural.ts` (that one covers a
// declarative `kind:'addMana'` EFFECT — a card that produces mana as part
// of some OTHER ability's resolution; this one covers the far more common
// real shape, a card's own STANDALONE mana ability, `manaAbilities`).
//
// **Real, whole-pool check done first** — grepped every real
// `manaAbilities:` entry across `functional-model/cards/*/definition.ts`
// (37 real cards, ~40 entries): every real `colors` array in this pool is
// length 1, 2, or exactly the full 5-color WUBRG set — no 3- or 4-color
// entry exists anywhere, so no Oxford-list ("Add {X}, {Y}, or {Z}")
// template is needed or guessed at. Only 2 real entries ever set `amount`
// to anything other than 1 (Ring of the Lucii's own colorless `{T}: Add
// {C}{C}.`; Overgrown Zealot's own 5-color `amount:2` ALSO carries a real
// `restriction`, so it's excluded by the gate below anyway, not a second
// real amount-2 template this recognizer needs).
//
// **Scope gate**: only entries with `cost`/`variableAmount`/`restriction`/
// `activationCondition` all UNSET qualify — a card whose own mana ability
// carries any of those (Capital City's/Starting Town's own SECOND ability,
// a non-bare-`{T}` cost; Elvish Archdruid's/Woodland Weavemaster's own
// `variableAmount`; Cargo Ship's/Freya Crescent's/The Emperor of
// Palamecia's own `restriction`; Willowrush Verge's own
// `activationCondition`) has no confirmed simple template here — declines
// (scope), not a stretch. `card.ts`'s own doc comment on each of those
// fields already documents them as real, deliberately out-of-scope
// complexity for a first pass at this shape.
//
// **Three real English templates, in order of `colors.length`**:
//   - `colors.length === 1`: `"Add {X}"` (repeated `amount` times — Ring of
//     the Lucii's own `{C}{C}`).
//   - `colors.length === 2`, `amount === 1`: `"Add {X} or {Y}"` (Treno,
//     Dark City/Vector, Imperial Capital/etc. — a real CHOICE, `Fact.colors
//     .hasAny`, never `.has`, same convention this catalog's own
//     `synergy.ts` doc comment on `Fact.colors` already establishes).
//   - `colors.length === 5` (the full WUBRG set), `amount === 1`:
//     `"Add one mana of any color"` (Blitzball/Crossroads Village/Overgrown
//     Zealot(if unrestricted)/Woodland Weavemaster(if unrestricted) — real
//     Magic templating for a genuine 5-color choice, NOT a literal "{W} or
//     {U} or {B} or {R} or {G}" spelled-out list).
// Any other `colors.length`/`amount` combination (a 2-color choice with
// `amount!==1`, e.g.) has no confirmed real template — declines rather
// than guessing.
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

export type ManaAbilitiesRecognizerInput = RecognizerInput & Pick<CardDefinition, 'manaAbilities'>;

const RULE = 'manaAbilitiesSimple-structural' as const;

const WUBRG = ['W', 'U', 'B', 'R', 'G'];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isFullWubrg(colors: string[]): boolean {
  return colors.length === 5 && WUBRG.every((c) => colors.includes(c));
}

export function recognizeManaAbilitiesSimpleStructural(input: ManaAbilitiesRecognizerInput): RecognizerResult {
  const candidates = (input.manaAbilities ?? []).filter(
    (a) => a.cost === undefined && a.variableAmount === undefined && a.restriction === undefined && a.activationCondition === undefined,
  );
  if (candidates.length === 0) {
    return { matched: false, reason: 'no manaAbilities entry on this face shaped {cost:undefined, variableAmount:undefined, restriction:undefined, activationCondition:undefined}' };
  }

  const claimed = new Set<number>();
  const facts: RecognizedFact[] = [];
  for (const ability of candidates) {
    const amount = ability.amount ?? 1;
    let clause: string;
    let factColors: { has: string[] } | { hasAny: string[] };
    if (isFullWubrg(ability.colors) && amount === 1) {
      clause = 'Add one mana of any color';
      factColors = { hasAny: WUBRG };
    } else if (ability.colors.length === 1) {
      clause = `Add ${`{${escapeRegExp(ability.colors[0]!)}}`.repeat(amount)}`;
      factColors = { has: [ability.colors[0]!] };
    } else if (ability.colors.length === 2 && amount === 1) {
      clause = `Add {${escapeRegExp(ability.colors[0]!)}} or {${escapeRegExp(ability.colors[1]!)}}`;
      factColors = { hasAny: [ability.colors[0]!, ability.colors[1]!] };
    } else {
      return { matched: false, reason: `no confirmed English template for manaAbilities entry {colors:${JSON.stringify(ability.colors)}, amount:${amount}}` };
    }

    // No trailing `\b` — every real `clause` here ends in a non-word char
    // (`}` from a mana symbol, or "color" for the WUBRG template, which DOES
    // end in a word char but is always followed by "." so `\b` would work
    // there too; the `}` case never has a following word char, so a
    // universal trailing `\b` can never match — same bug class fixed this
    // session in `continuousKeywordGrantsEquipped-structural.ts`). Leading
    // `\b` alone is enough to anchor "Add" as a real word start.
    const pattern = new RegExp(`\\b${clause}`, 'i');
    const globalPattern = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(globalPattern)].filter((m) => !claimed.has(m.index!));
    if (matches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ matched ${matches.length} unclaimed times (want exactly 1) in oracle text "${input.oracleText}"`,
      };
    }
    const m = matches[0]!;
    claimed.add(m.index!);
    const annotation = toLineOffset(input.oracleText, m.index!, m.index! + m[0]!.length);
    if (!annotation) {
      return { matched: false, reason: `matched span [${m.index},${m.index! + m[0]!.length}) did not resolve to a single real oracle-text line` };
    }
    facts.push({
      role: 'source',
      fact: { event: 'addMana', controller: 'you', colors: factColors, annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
