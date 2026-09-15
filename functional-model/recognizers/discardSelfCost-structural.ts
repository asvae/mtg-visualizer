// New recognizer (2026-09-15, fin/11-15 audit follow-up — `cloudbound-
// moogle`/fin-11's own remaining AI-authored `{event:'discard',
// target:'self'}` sink). CARD-DEFINITION-LEVEL structural (reads
// `abilities[].cost`, never `effects` — same family as `saga-lore-and-
// sacrifice-structural.ts`/`flashback-alternateCost-structural.ts`, not the
// `effects`-walking family `destroy-effect-structural.ts` etc. use), plus a
// text-anchor verification.
//
// **The real, closed rule**: this whole engine already has a single,
// narrow, well-tested closed-vocabulary check for exactly this shape —
// `engine.ts`'s own `costRequiresDiscardSelf` (`/Discard this card\b/i`),
// used at RUNTIME to decide whether activating a named ability genuinely
// discards its own source card as a cost (Cycling's real CR 702.29a shape).
// This recognizer reuses the identical regex (not a re-derived copy) so the
// FACT layer and the RUNTIME layer can never silently drift apart on what
// "discard this card" means.
//
// **Real, whole-pool check** (2026-09-15, grepped every `abilities[].cost`/
// `activationCost` string across `functional-model/cards/*/definition.ts`
// for `costRequiresDiscardSelf`'s own regex) — 8 real structured matches:
// `capital-city`, `ice-flan`, `balamb-t-rexaur`, `cloudbound-moogle`,
// `malboro`, `airship-crash`, `cid-timeless-artificer`, `hill-gigas` (all
// real Landcycling/Cycling activated abilities, `abilities[].cost`, never
// `activationCost`). `hill-gigas`'s own real "Mountaincycling {2}" USED TO
// be modeled as free `staticAbilities` text only (correctly declined here
// at the time) — migrated onto `cycling.ts`'s own shared `basicLandcycling`
// factory 2026-09-15 (same real, structured `abilities` shape its 4
// siblings already used — that card's own former "no field fits it" claim
// was stale, not a genuine gap), so it's a real match now too.
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { costRequiresDiscardSelf } from '../engine';
import { type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'discardSelfCost-structural' as const;

export function recognizeDiscardSelfCostStructural(input: StructuralRecognizerInput): RecognizerResult {
  const qualifying = (input.abilities ?? []).filter((a) => costRequiresDiscardSelf(a.cost));
  if (qualifying.length === 0) {
    return { matched: false, reason: "no abilities[] entry whose own cost matches costRequiresDiscardSelf's real regex (/Discard this card\\b/i)" };
  }

  const pattern = /\bDiscard this card\b/i;
  const facts: RecognizedFact[] = [];
  for (const ability of qualifying) {
    const m = pattern.exec(input.oracleText);
    if (!m) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `ability "${ability.name}"'s own cost ("${ability.cost}") requires discarding this card, but the literal phrase "Discard this card" was not found in this face's own real oracle text ("${input.oracleText}")`,
      };
    }
    const annotation = toLineOffset(input.oracleText, m.index, m.index + m[0].length);
    if (!annotation) {
      return { matched: false, reason: `matched span [${m.index},${m.index + m[0].length}) did not resolve to a single real oracle-text line` };
    }
    facts.push({
      role: 'sink',
      fact: { event: 'discard', target: 'self', annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
