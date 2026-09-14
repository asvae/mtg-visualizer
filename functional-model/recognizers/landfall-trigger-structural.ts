// New recognizer (2026-09-14, mechanization pass — fin/3-10 gap closure) —
// text-based, same family as `lifegain-trigger-structural.ts`/`attacks-
// trigger-structural.ts` (never reads `Effect[]` structure): the printed
// Landfall ability word's own fixed reminder-free template, "Landfall —
// Whenever a land you control enters, <effect>." — the trigger's own firing
// PRECONDITION, a SINK this card carries no other structural field to
// express (a card's own `Trigger.name` is a free-text identifier — e.g.
// `ambrosia-whiteheart`'s own `'onLandfall'` — not a closed vocabulary
// `Trigger.on` value the way `'enter'`/`'upkeep'`/`'endStep'`/`'attacks'`
// already are, so there is no structural field anywhere on `CardDefinition`
// this could be read off instead of the printed clause itself).
//
// **Real, whole-pool verification done BEFORE writing this recognizer's own
// matching regex** (same discipline every recognizer in this catalog already
// uses) — grepped every real card whose own `definition.ts` mentions
// `onLandfall`/`Landfall` (13 files) and read each one's own real Scryfall
// oracle text directly:
//   - **Matched real clean template, byte-for-byte identical across every
//     one** ("Landfall — Whenever a land you control enters, <effect>."):
//     Ambrosia Whiteheart, Sabotender, Chocobo Racetrack, Ride the Shoopuf,
//     Sazh's Chocobo, Tifa Lockhart, Choco, Seeker of Paradise, Gladiolus
//     Amicitia, Rydia, Summoner of Mist, and Black Chocobo (the transformed
//     back face of Sidequest: Raise a Chocobo!, `res/cardsfolder`'s own
//     "Landfall — Whenever a land you control enters, Birds you control get
//     +1/+0 until end of turn."). This is Magic's own official Landfall
//     ability-word reminder-free template (CR 702.49) — a single fixed
//     idiom, not a guessed-at generalization; every one of these 10 real
//     cards prints the EXACT same 5-word ability-word preamble verbatim.
//   - **Confirmed real, NON-matches, correctly declined by construction (no
//     special-casing needed)**: `quistis-trepe`'s and `rinoa-heartilly`'s own
//     `definition.ts` files merely MENTION "Landfall" in a comment (comparing
//     their own different trigger shape against this one) — their real
//     printed oracle text has no "Landfall" string at all, so this
//     recognizer's own required literal clause never matches either, exactly
//     as it shouldn't. `thranduil-sindarin-liege-silvan-rally`'s own file
//     similarly never prints this clause on either real face.
//
// **Tier-3 graduation** (same "authoredFacts becomes redundant once a real
// recognizer covers the identical claim" pattern `ashe-princess-of-dalmasca`'s
// own `onAttack` trigger comment already documents for `attacks-trigger-
// structural`): `ambrosia-whiteheart`'s own `CardDefinition.authoredFacts`
// entry for this exact sink is removed once this recognizer is wired — see
// that card's own `definition.ts` comment.
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

const RULE = 'landfall-trigger-structural' as const;

// The real, fixed CR 702.49 ability-word preamble — no card-specific
// vocabulary needed at all (unlike `dies`/`attacks`, this isn't keyed on the
// card's own self-subject; Landfall's own precondition is never about the
// LANDFALL CARD itself, always "a land you control," worded identically on
// every real card that prints it).
const CLAUSE_RE = /\bLandfall\s*—\s*Whenever a land you control enters\b/i;

export function recognizeLandfallTriggerStructural(input: RecognizerInput): RecognizerResult {
  const match = CLAUSE_RE.exec(input.oracleText);
  if (!match) {
    return { matched: false, reason: 'no "Landfall — Whenever a land you control enters" clause found' };
  }

  const start = match.index;
  const end = start + match[0].length;
  const annotation = toLineOffset(input.oracleText, start, end);
  if (!annotation) {
    return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
  }

  const facts: RecognizedFact[] = [
    {
      role: 'sink',
      fact: { event: 'landfall', controller: 'you', annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];
  return { matched: true, facts };
}
