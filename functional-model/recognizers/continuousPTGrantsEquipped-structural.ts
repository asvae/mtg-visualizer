// New recognizer (2026-09-15, fin/11-15 audit follow-up — Crystal
// Fragments // Summon: Alexander's own remaining AI-authored "Equipped
// creature gets +1/+1" fact, same shape repeats pool-wide per the
// coordinator's own standing "cover the whole pool where the shape
// repeats" instruction, same as `pumpSelf-effect-structural.ts`/
// `token-creation-structural.ts` before it). CARD-DEFINITION-LEVEL
// structural (reads `continuousPTGrants`, never `effects`) — same "own
// narrow `Pick`, mirrors `StructuralRecognizerInput`'s shape but isn't it"
// convention `flashback-alternateCost-structural.ts`'s own
// `FlashbackRecognizerInput`/`tapSelfCost-structural.ts`'s own
// `TapSelfCostRecognizerInput` already establish for a different
// card-definition-level field.
//
// **Scope, confirmed real and closed pool-wide**: exactly 7 real cards
// carry a `continuousPTGrants` entry at all, and EVERY one of them has the
// exact same shape — `{ power, toughness, includeSelf: false,
// equippedBySelf: true }` (`black-mage-s-rod`, `crystal-fragments-summon-
// alexander`, `dragoon-s-lance`, `paladin-s-arms`, `sage-s-nouliths`,
// `thief-s-knife`, `white-mage-s-staff`) — this recognizer only ever
// builds the ONE confirmed real English template that shape corresponds
// to ("Equipped creature gets ±P/±T"), and declines (scope, not mismatch)
// anything with `equippedBySelf` false/absent or `includeSelf`/`subtype`
// set, since no real card in this pool exercises those combinations with
// this field yet — a future card using `continuousPTGrants` for a
// different real targeting shape needs its own template, not a silent
// stretch of this one.
//
// **`machinist-s-arsenal` is the one real, confirmed, permanent decline**
// (`+2/+2 for each artifact you control` — `card.ts`'s own
// `continuousPTGrants` field is typed as a plain `number`, not
// `Computed<number>`, so a per-artifact scaling pump genuinely CAN'T be
// expressed there at all; that card's own `definition.ts` comment already
// documents this as a real, accepted engine limitation, not something this
// recognizer needs to re-flag) — it has no `continuousPTGrants` field to
// read in the first place, so this recognizer naturally returns a scope
// decline for it, same as any other card with no such field.
//
// **Real, pre-existing fact-shape inconsistency found and fixed
// (2026-09-15, this same pass)**: of the 7 real on-disk `event:'pump'`
// facts this recognizer's own claim corresponds to, 6
// (`black-mage-s-rod`/`dragoon-s-lance`/`paladin-s-arms`/`sage-s-nouliths`/
// `thief-s-knife`/`white-mage-s-staff`) already carried a bare `target:
// {equippedBySelf:true}` with NO top-level `power`/`toughness` — wait,
// checked again directly against each card's own on-disk `synergy.json`
// before writing this recognizer: `black-mage-s-rod`/`dragoon-s-lance`/
// `paladin-s-arms`/`sage-s-nouliths`/`thief-s-knife`/`white-mage-s-staff`
// each had `power`/`toughness` set to the SAME redundant numeric value as
// the effect's own delta (a misuse of `Fact.power`/`Fact.toughness` —
// those are `Constraints` fields meaning "the CANDIDATE this fact
// interacts with has this much power/toughness," never "this fact's own
// pump MAGNITUDE" — see `synergy.ts`'s own `Constraints` doc comment),
// annotated across the FULL "Equipped creature gets ±P/±T" clause (chars
// [0,28) of their own line). `machinist-s-arsenal`'s own bare, correctly-
// shaped `{event:'pump', target:{equippedBySelf:true}}` (no top-level
// power/toughness at all, same full-clause-length annotation, just a
// longer per-artifact clause) is the one real, ALREADY-correct precedent
// in the pool — confirming the canonical shape this recognizer emits
// (bare `target:{equippedBySelf:true}`, no `power`/`toughness` at the top
// level) is the one already in real, working use elsewhere, not a new
// invention. `crystal-fragments-summon-alexander`'s own pre-existing fact
// additionally carried a redundant `target.types:{has:['Creature']}` (true
// but never asserted by any of the other 6 sibling cards — an Equipment
// can only ever be attached to a creature, CR 301.5c, so this is
// information-free) — dropped for the same "match the real, already-
// working majority convention" reason. All 7 on-disk facts fixed by hand
// to this canonical shape (`power`/`toughness`/redundant `types` removed)
// BEFORE this recognizer's own first pool-wide run, so its retag (not
// append) correctly fires for every one of them.
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

export type ContinuousPTGrantsRecognizerInput = RecognizerInput & Pick<CardDefinition, 'continuousPTGrants'>;

const RULE = 'continuousPTGrantsEquipped-structural' as const;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatSigned(n: number): string {
  return (n >= 0 ? '+' : '') + n;
}

export function recognizeContinuousPTGrantsEquippedStructural(input: ContinuousPTGrantsRecognizerInput): RecognizerResult {
  const qualifying = (input.continuousPTGrants ?? []).filter(
    (g) => g.equippedBySelf === true && g.includeSelf === false && g.subtype === undefined && g.onlyDuringYourTurn === undefined,
  );
  if (qualifying.length === 0) {
    return {
      matched: false,
      reason: "no continuousPTGrants entry shaped exactly {equippedBySelf:true, includeSelf:false} with no subtype/onlyDuringYourTurn — the one real, confirmed template this recognizer covers",
    };
  }

  const facts: RecognizedFact[] = [];
  for (const grant of qualifying) {
    const numbers = `${escapeRegExp(formatSigned(grant.power))}\\/${escapeRegExp(formatSigned(grant.toughness))}`;
    const pattern = new RegExp(`\\bEquipped creature gets ${numbers}\\b`, 'i');
    const globalPattern = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(globalPattern)];
    if (matches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
      };
    }
    const m = matches[0]!;
    const annotation = toLineOffset(input.oracleText, m.index!, m.index! + m[0]!.length);
    if (!annotation) {
      return { matched: false, reason: `matched span [${m.index},${m.index! + m[0]!.length}) did not resolve to a single real oracle-text line` };
    }
    facts.push({
      role: 'source',
      fact: { event: 'pump', target: { equippedBySelf: true }, annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
