// New recognizer (2026-09-15, fin/11-15 audit follow-up — Crystal
// Fragments' own remaining front-face SINK fact, same shape repeats across
// every real Equipment in the pool per the coordinator's own standing
// "cover the whole pool where the shape repeats" instruction). Plain-text
// (reads `typeLine` + `oracleText` only, no `effects` at all — CR 301.5c's
// own "equip only a creature you control" rule is inherent to being typed
// Equipment, independent of whatever effect the Equipment's own text grants
// once attached) — same family as `permanent-enters-battlefield-normally.ts`
// (retired) used to be for a different structural-identity-only claim.
//
// **Real, whole-pool check**: 26 real cards are typed `Artifact —
// Equipment` (or `... Book Equipment`) — every one of them needs a creature
// present to equip onto at all (301.5c), independent of what its own
// `Equipped creature ...` clause says. This recognizer only asserts the
// SINK half of that (a want, not an occurrence) — the pool's own EXISTING
// hand-authored facts for this exact claim are already always plain
// `{to:'Battlefield', controller:'you', types:{has:['Creature']}}`,
// annotated at the literal keyword line itself (`Equip {N}`), never at any
// broader clause — matched here.
//
// **Anchor, checked against the real pool's own printed variety (not
// assumed)**: every real Equip cost in this pool is either a bare `Equip
// {N}` (optionally after a flavor-name em dash, e.g. "Gae Bolg — Equip
// {4}" — the flavor name is never part of the annotated span, matching
// every existing hand-authored fact already checked) or a reminder-text
// parenthetical repeating the cost ("(`{4}`: Attach to target creature you
// control. Equip only as a sorcery.)") that does NOT itself start with the
// literal word "Equip" and so never double-matches. `dark-knight-s-
// greatsword`'s own "Equip—Pay 3 life. Activate only once each turn." is
// the one real, confirmed decline (an alternative, non-mana Equip cost,
// CR 702.6e — no `{N}` at all) — correctly declined (`kind:'mismatch'` is
// NOT raised for this one; see below), not silently forced.
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

const RULE = 'equipmentWantsCreature-sink-structural' as const;

const EQUIPMENT_RE = /\bEquipment\b/;
const EQUIP_COST_RE = /\bEquip \{\d+\}/;

export function recognizeEquipmentWantsCreatureSinkStructural(input: RecognizerInput): RecognizerResult {
  if (!EQUIPMENT_RE.test(input.typeLine)) {
    return { matched: false, reason: `typeLine "${input.typeLine}" has no "Equipment" subtype (301.5c)` };
  }

  const globalPattern = new RegExp(EQUIP_COST_RE.source, 'g');
  const matches = [...input.oracleText.matchAll(globalPattern)];
  if (matches.length === 0) {
    // Not a `kind:'mismatch'` — a real, confirmed alternative shape exists
    // (Dark Knight's Greatsword's own non-mana Equip cost, 702.6e) that
    // this recognizer's own narrow `Equip {N}` template genuinely doesn't
    // cover; a plain scope decline, same as any other recognizer's own
    // named, honest gap.
    return { matched: false, reason: `typeLine has "Equipment" but no literal "Equip {N}" cost was found in oracle text "${input.oracleText}"` };
  }
  if (matches.length > 1) {
    return {
      matched: false,
      kind: 'mismatch',
      reason: `expected exactly one literal "Equip {N}" cost, found ${matches.length} in oracle text "${input.oracleText}"`,
    };
  }

  const m = matches[0]!;
  const annotation = toLineOffset(input.oracleText, m.index!, m.index! + m[0]!.length);
  if (!annotation) {
    return { matched: false, reason: `matched span [${m.index},${m.index! + m[0]!.length}) did not resolve to a single real oracle-text line` };
  }

  const facts: RecognizedFact[] = [
    {
      role: 'sink',
      fact: { to: 'Battlefield', controller: 'you', types: { has: ['Creature'] }, annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];
  return { matched: true, facts };
}
