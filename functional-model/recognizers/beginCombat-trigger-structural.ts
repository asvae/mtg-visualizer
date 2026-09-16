// New recognizer (2026-09-16, weapons-vendor/fin-40's own remaining coverage
// gap) — plain TEXT recognizer, same family as `attacks-trigger-structural
// .ts`/`dies-trigger-structural.ts` (never reads `Effect[]`/`Trigger[]`
// structure — `card.ts`'s own closed `Trigger.on` vocabulary, `'enter' |
// 'upkeep' | 'endStep' | 'tapLandForMana' | 'attacks'`, has no
// `'beginCombat'` member at all, so every real card modeling this trigger
// stays a bare-NAMED `name: 'onBeginCombat'` trigger with no structural field
// this recognizer could key on instead — same situation `entersBattlefield-
// self-trigger-structural.ts`'s own module doc comment already describes for
// the bare-named `onOtherCreatureEnters`-style triggers it deliberately
// declines: "would need a real new recognizer (reading the trigger's own
// oracle-text condition clause, not `on`)." This is that recognizer, for the
// "beginning of combat" shape specifically).
//
// **Real, whole-pool check done BEFORE writing this recognizer's own
// matching regex** (same discipline every recognizer in this catalog already
// uses) — grepped every real `"beginning of combat"` occurrence across
// `data/fin/fin_scryfall.json` (9 real occurrences, front faces AND card
// faces both checked) and read each one's own real Scryfall oracle text
// directly. All 9 use the IDENTICAL literal English clause, no variant
// phrasing at all ("on EACH turn"/"on your OPPONENT's turn" do not occur
// anywhere in this pool): "At the beginning of combat on your turn,"
//   - `weapons-vendor` (fin/40, this recognizer's own motivating card),
//     `ardyn-the-usurper` (preceded by its own ability word, "Starscourge — "
//     — this recognizer's regex is not anchored to line-start, so a leading
//     ability word never blocks the match), `jenova-ancient-calamity`,
//     `beatrix-loyal-general`, `rosa-resolute-white-mage`, `sidequest-play-
//     blitzball-world-champion-celestial-weapon` (front face), `venat-heart-
//     of-hydaelyn-hydaelyn-the-mothercrystal` (BACK face only — "Blessing of
//     Light — At the beginning of combat..."), `serah-farron-crystallized-
//     serah` (front face), `the-wandering-minstrel` (preceded by its own
//     ability word, "The Minstrel's Ballad — ").
//   - All 9 real cards also carry a `name: 'onBeginCombat'` trigger in their
//     own `definition.ts` — confirmed directly (grepped `functional-model/
//     cards/*/definition.ts`), not assumed; this recognizer does not itself
//     require/read that field (a bare-TEXT recognizer, per this file's own
//     header), but it is worth recording that the real, printed English
//     clause and this project's own already-modeled trigger name agree on
//     every real occurrence, with zero pool-wide false-positive risk today.
//
// **Fact shape**: a bare SINK, `{event:'beginCombat', controller:'you'}` —
// "this card's own ability cares about the controller's combat phase
// beginning" (the trigger's own firing PRECONDITION, same
// `attacks-trigger-structural.ts`-established convention of co-locating a
// named trigger's own condition text as a sink rather than leaving it
// unrepresented). `controller: 'you'` (not `target: 'self'`) — unlike
// "attacks"/"dies," which are things THIS PERMANENT does, "beginning of
// combat on your turn" is a turn-structure event scoped to the controlling
// PLAYER, not a self-reference to this specific card at all (real Forge
// citation: `TriggerType.Phase | Phase$ Begin_Combat | ValidPlayer$ You` —
// no `ValidCard$ Card.Self` clause exists for this trigger type the way
// `TriggerAttacks`/`TriggerDies` both carry one). No real card in this pool
// has a "beginning of combat" trigger scoped to an opponent's turn or "each
// turn," so `controller` is unconditionally `'you'` here — a genuinely
// different value would need a real card to confirm before this recognizer
// grows a second template.
//
// **Real, forward-looking synergy value, not just coverage busywork** — two
// real cards in this pool already grant "an additional combat phase"
// (Balthier and Fran: "if it's the first combat phase of the turn, ... after
// this phase, there is an additional combat phase"; Genji Glove: same real
// clause) — a genuine PRODUCER of extra `beginCombat` occurrences for
// whichever creature they're attached to/crewed. Neither of those two cards'
// own facts are added by this pass (out of THIS recognizer's own scope —
// they'd need their own producer-side fact, a separate task), but the
// `event:'beginCombat'` vocabulary this recognizer introduces is real,
// confirmed-real-world-meaningful vocabulary for a future pass to eventually
// pair against, not an invented one-off tag with zero real synergy story.
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

const RULE = 'beginCombat-trigger-structural' as const;

const BEGIN_COMBAT_CLAUSE = /\bAt the beginning of combat on your turn,/;

export function recognizeBeginCombatTriggerStructural(input: RecognizerInput): RecognizerResult {
  const match = BEGIN_COMBAT_CLAUSE.exec(input.oracleText);
  if (!match) {
    return { matched: false, reason: 'no "At the beginning of combat on your turn," clause found (the one real, closed template this pool confirms — see module doc comment)' };
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
      fact: { event: 'beginCombat', controller: 'you', annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];
  return { matched: true, facts };
}
