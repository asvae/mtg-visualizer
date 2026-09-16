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
//
// **Bare-heading fallback branch (2026-09-16, recognizer-lane escalation)** —
// Memories Returning (fin/63) is the sole real one of these 14 Flashback
// cards whose checked-in Scryfall oracle text prints a genuinely bare
// "Flashback {7}{U}{U}" with NO reminder-text parenthetical at all
// (independently confirmed via both Forge's `res/cardsfolder/*/
// memories_returning.txt` script and XMage's own Java card source as a real
// printed-card quirk, not a data bug — see this card's own `progress.json`
// for the full citation). When neither `CAST_CLAUSE_RE` nor (if
// `alt.thenExile`) `EXILE_CLAUSE_RE` is found at all (0 matches — a
// genuinely DIFFERENT decline reason from the existing "found 2+, ambiguous"
// mismatch, which still declines exactly as before), this recognizer falls
// back to anchoring BOTH facts on just the bare "Flashback <cost>" heading
// span itself — the only real text this card's own printed line offers —
// matching this card's own pre-existing hand-authored fact pair exactly
// (both facts share the identical heading-only span on disk today).
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

    // The printed cost heading itself — confirms this is genuinely the SAME
    // Flashback ability the structured `cost` field claims, not a
    // coincidental match elsewhere on this face. No trailing `\b` — a mana
    // cost always ends in `}` (a non-word character), so a word-boundary
    // assertion right after it never matches (neither side of that position
    // is a word character at all); the literal `}` itself is already a
    // distinct-enough anchor.
    //
    // WIDENED (2026-09-16, fin/20-47 pass) — this fact's own annotation now
    // starts at this heading (not just the later "cast this card..."
    // sub-clause) so the printed "Flashback <cost>" text itself counts as
    // covered. Whole-pool check: of all 14 real `name:'Flashback'` users
    // (this file's own module comment), only From Father to Son's own
    // heading ("Flashback {4}{W}{W}{W}", 4 mana symbols) is long enough to
    // clear `text-coverage.mjs`'s 20-real-char gap threshold on its own —
    // every other real cost here is short enough that this same, real,
    // previously-uncovered heading text never actually got FLAGGED as a
    // gap; widening still applies uniformly (a strictly wider, still-
    // correct annotation for all 14), it just only changes any card's
    // reported coverage ratio for this one.
    const headingPattern = new RegExp(`\\bFlashback ${escapeRegExp(alt.cost)}`);
    const headingMatch = headingPattern.exec(input.oracleText);
    if (!headingMatch) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected "Flashback ${alt.cost}" heading not found verbatim in oracle text "${input.oracleText}"`,
      };
    }

    const castMatches = [...input.oracleText.matchAll(new RegExp(CAST_CLAUSE_RE.source, CAST_CLAUSE_RE.flags + 'g'))];
    if (castMatches.length > 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${CAST_CLAUSE_RE.source}/ matched ${castMatches.length} times (expected 0 or 1) in oracle text "${input.oracleText}"`,
      };
    }
    // 0 matches — the bare-heading fallback (see module doc comment): this
    // face's own printed text has no reminder-text parenthetical at all, so
    // anchor to just the "Flashback <cost>" heading itself instead of
    // declining outright.
    const castStart = headingMatch.index!;
    const castEnd = castMatches.length === 1 ? castMatches[0]!.index! + castMatches[0]![0]!.length : headingMatch.index! + headingMatch[0]!.length;
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
      if (exileMatches.length > 1) {
        return {
          matched: false,
          kind: 'mismatch',
          reason: `expected clause /${EXILE_CLAUSE_RE.source}/ matched ${exileMatches.length} times (expected 0 or 1) in oracle text "${input.oracleText}"`,
        };
      }
      // Same bare-heading fallback as the cast clause above when 0 matches.
      const exileStart = exileMatches.length === 1 ? exileMatches[0]!.index! : headingMatch.index!;
      const exileEnd = exileMatches.length === 1 ? exileStart + exileMatches[0]![0]!.length : headingMatch.index! + headingMatch[0]!.length;
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
