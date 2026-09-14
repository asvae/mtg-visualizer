// New recognizer (2026-09-14, mechanization pass — fin/3-10 gap closure) —
// structural, same family as `putCounterSelf-effect-structural.ts`: reads a
// `CardDefinition.alternateCosts` entry (`card.ts`'s `AlternateCost`) straight
// off the card, then requires a built clause to appear verbatim in this
// face's own real oracle text before asserting anything.
//
// **Real, whole-pool check done first** — grepped every real
// `name: 'Flashback'` `alternateCosts` entry across
// `functional-model/cards/*/definition.ts` (14 real occurrences) and read
// each one's own real Scryfall oracle text directly: Auron's Inspiration,
// Dreams of Laguna, Esper Origins // Summon: Esper Maduin, From Father to
// Son, Gysahl Greens, Resentful Revelation, Call the Mountain Chocobo,
// Random Encounter, Memories, Returning, Sorceress's Schemes, Retrieve the
// Esper, Laughing Mad, Nibelheim Aflame, The Final Days. Every single one
// prints Magic's own fixed Flashback reminder text verbatim: "Flashback
// <cost> (You may cast this card from your graveyard for its flashback
// cost[ and any additional costs]. Then exile it.)" — a real, closed,
// official keyword reminder template (CR 702.32), not a guessed-at
// generalization. Laughing Mad's own "and any additional costs" insertion
// (its own real "As an additional cost to cast this spell, discard a card")
// doesn't break the match: this recognizer's own required substring, "cast
// this card from your graveyard for its flashback cost", is a strict PREFIX
// of Laughing Mad's own longer clause, so it still matches verbatim.
// Every one of these 14 real `alternateCosts` entries also sets `from:
// 'graveyard'` and `thenExile: true` — no real pool card uses `from:
// 'exile'` (a real, different, Jump-start-shaped alternate cost) alongside
// `name: 'Flashback'` today; this recognizer declines (scope) rather than
// guess a template for that combination if it ever appears.
//
// **Two facts, mirroring `auron-s-inspiration`'s own real, pre-existing
// hand-authored pair byte-for-byte**: the trigger's own real cast-from-
// graveyard permission (SOURCE — `{event:'cast', from:'Graveyard',
// target:'self'}`) and the real post-resolution exile (SOURCE, zone-shaped —
// `{to:'Exile', controller:'you', subject:'self'}`), each anchored to its OWN
// real clause ("cast this card from your graveyard for its flashback cost"
// / "Then exile it") rather than sharing one span — same "two facts, two
// real sub-clauses" shape `dies-trigger-structural.ts` uses ONE shared span
// for (that file's trigger precondition + consequence are genuinely the same
// clause; this file's two facts are genuinely two different clauses within
// the same reminder-text parenthetical).
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

const RULE = 'flashback-alternateCost-structural' as const;

/** A structural recognizer's own input, widened with this face's own real
 * `alternateCosts` (`card.ts`) — mirrors `StructuralRecognizerInput`'s own
 * `Pick<CardDefinition, ...>` convention (`structural-effects.ts`), but this
 * recognizer never needs `effects`/`triggers`/`abilities` at all, so it keeps
 * its own narrower shape rather than importing that wider one. */
export type FlashbackRecognizerInput = RecognizerInput & Pick<CardDefinition, 'alternateCosts'>;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const CAST_CLAUSE_RE = /\bcast this card from your graveyard for its flashback cost\b/i;
const EXILE_CLAUSE_RE = /\bThen exile it\b/i;

export function recognizeFlashbackAlternateCostStructural(input: FlashbackRecognizerInput): RecognizerResult {
  const flashbackCosts = (input.alternateCosts ?? []).filter((c) => c.name === 'Flashback');
  if (flashbackCosts.length === 0) {
    return { matched: false, reason: 'no alternateCosts entry named "Flashback" on this face' };
  }

  const facts: RecognizedFact[] = [];
  let anyEligible = false;

  for (const alt of flashbackCosts) {
    if (alt.from !== 'graveyard') {
      continue; // structurally out of scope — no real pool card combines name:'Flashback' with from:'exile' to verify a template against; never a 'mismatch'
    }
    anyEligible = true;

    // Defensive corroboration — the printed cost heading itself, confirming
    // this is genuinely the SAME Flashback ability the structured `cost`
    // field claims, not a coincidental match elsewhere on this face.
    // No trailing `\b` — a mana cost always ends in `}` (a non-word
    // character), so a word-boundary assertion right after it never matches
    // (neither side of that position is a word character at all); the
    // literal `}` itself is already a distinct-enough anchor.
    const headingPattern = new RegExp(`\\bFlashback ${escapeRegExp(alt.cost)}`);
    if (!headingPattern.test(input.oracleText)) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected "Flashback ${alt.cost}" heading not found verbatim in oracle text "${input.oracleText}"`,
      };
    }

    const castMatches = [...input.oracleText.matchAll(new RegExp(CAST_CLAUSE_RE.source, CAST_CLAUSE_RE.flags + 'g'))];
    if (castMatches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${CAST_CLAUSE_RE.source}/ matched ${castMatches.length} times (expected exactly 1) in oracle text "${input.oracleText}"`,
      };
    }
    const castMatch = castMatches[0]!;
    const castStart = castMatch.index!;
    const castEnd = castStart + castMatch[0]!.length;
    const castAnnotation = toLineOffset(input.oracleText, castStart, castEnd);
    if (!castAnnotation) {
      return { matched: false, reason: `matched span [${castStart},${castEnd}) did not resolve to a single real oracle-text line` };
    }

    facts.push({
      role: 'source',
      fact: { event: 'cast', from: 'Graveyard', target: 'self', annotations: [castAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });

    if (alt.thenExile) {
      const exileMatches = [...input.oracleText.matchAll(new RegExp(EXILE_CLAUSE_RE.source, EXILE_CLAUSE_RE.flags + 'g'))];
      if (exileMatches.length !== 1) {
        return {
          matched: false,
          kind: 'mismatch',
          reason: `expected clause /${EXILE_CLAUSE_RE.source}/ matched ${exileMatches.length} times (expected exactly 1) in oracle text "${input.oracleText}"`,
        };
      }
      const exileMatch = exileMatches[0]!;
      const exileStart = exileMatch.index!;
      const exileEnd = exileStart + exileMatch[0]!.length;
      const exileAnnotation = toLineOffset(input.oracleText, exileStart, exileEnd);
      if (!exileAnnotation) {
        return { matched: false, reason: `matched span [${exileStart},${exileEnd}) did not resolve to a single real oracle-text line` };
      }
      facts.push({
        role: 'source',
        fact: { to: 'Exile', controller: 'you', subject: 'self', annotations: [exileAnnotation] },
        provenance: { origin: 'parser', rule: RULE },
      });
    }
  }

  if (!anyEligible) {
    return { matched: false, reason: 'every "Flashback" alternateCosts entry on this face was structurally out of scope (from !== "graveyard")' };
  }
  return { matched: true, facts };
}
