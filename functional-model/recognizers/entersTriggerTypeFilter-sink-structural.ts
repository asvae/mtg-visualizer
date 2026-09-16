// New recognizer (2026-09-16, recognizer-lane escalation — card-results-lane
// triage) — structural, same family as `saga-lore-and-sacrifice-
// structural.ts` (reads a CARD-DEFINITION-LEVEL structured field,
// `triggers`, keyed on its own `Trigger.name` string, never `effects`):
// derives a paired "wants an X to enter the battlefield" SINK fact from a
// named `on(Other)?<Type>Enters`-shaped trigger — the type word IS the
// trigger's own name, no oracle-text type-word parsing needed for the fact
// itself (only to confirm the clause exists verbatim, same discipline every
// other recognizer here uses).
//
// **Real, whole-pool check done first** — grepped every real
// `name: 'on...Enters'` trigger across `functional-model/cards/*/
// definition.ts` matching an `Artifact`/`Creature`/`Elf` type word (the only
// 3 confirmed real words — grow only when a 4th real card needs a
// different one): 5 real occurrences, `rook-turret`/`golbez-crystal-
// collector`/`tidus-blitzball-star` (`onArtifactEnters`, no "Other") and
// `loporrit-scout` (`onOtherCreatureEnters`)/`woodland-weavemaster`
// (`onOtherElfEnters`). `excludeSelf` on the emitted fact is derived
// STRUCTURALLY from the trigger name's own "Other" marker (matching every
// one of these 5 real cards' own pre-existing/needed fact shape exactly —
// `loporrit-scout`'s/`woodland-weavemaster`'s own pre-existing hand-authored
// sinks both already carry `excludeSelf: true`; `rook-turret`'s own
// pre-existing sink has none, matching its own `onArtifactEnters` name
// despite that card's own real text using the word "another" — a real,
// pre-existing, ACCEPTED data shape this recognizer reproduces rather than
// second-guesses), never re-derived from which English word ("a"/"an"/
// "another") the oracle text happens to use for that same real distinction.
// Confirmed both real phrasings exist among the "no Other" group itself:
// `golbez-crystal-collector`/`tidus-blitzball-star` (neither of which is
// itself an Artifact, so the distinction is moot for them either way) print
// "Whenever AN artifact you control enters," while `rook-turret` (which IS
// an Artifact Creature) prints "Whenever ANOTHER artifact you control
// enters" — both accepted as the same "no Other in the trigger name" shape,
// vocabulary widened to accept either determiner rather than declining
// `rook-turret` alone as an outlier.
//
// **`woodland-weavemaster` has no real oracle text checked in anywhere**
// (grepped every `data/*/*_scryfall.json` — zero hits, same cross-set-
// reference-card bucket `elvish-archdruid`/`thranduil-sindarin-liege` are
// already in per SYNERGY_DESIGN.md) — `apply-recognizers.mjs`'s own
// `loadOracleTextByName` loader finds no entry for it and skips the whole
// card before any recognizer ever runs, so this recognizer's own match for
// it is real and mechanically correct but can never actually retag this
// card's own on-disk fact through the real pipeline; exercised directly via
// its own unit test instead (a synthetic oracleText input, not the
// `finCards` loader).
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

export type EntersTriggerTypeFilterRecognizerInput = RecognizerInput & Pick<CardDefinition, 'triggers'>;

const RULE = 'entersTriggerTypeFilter-sink-structural' as const;

/** Only the 3 real, pool-confirmed type words this recognizer has ever seen
 * behind an `on(Other)?<Type>Enters` trigger name — see module doc comment.
 * Never guess a 4th. */
const TRIGGER_NAME_RE = /^on(Other)?(Artifact|Creature|Elf)Enters$/;

export function recognizeEntersTriggerTypeFilterSinkStructural(input: EntersTriggerTypeFilterRecognizerInput): RecognizerResult {
  const triggers = input.triggers ?? [];
  const facts: RecognizedFact[] = [];
  let anyEligible = false;

  for (const t of triggers) {
    const m = TRIGGER_NAME_RE.exec(t.name);
    if (!m) continue;
    anyEligible = true;

    const excludeSelf = m[1] === 'Other';
    const typeWord = m[2]!;
    const wordLower = typeWord.toLowerCase();
    // See module doc comment — "no Other" accepts either real confirmed
    // determiner ("a"/"an"/"another"); "Other" requires "another" (the only
    // confirmed phrasing for that shape).
    const determiner = excludeSelf ? 'another' : '(?:an?|another)';
    const pattern = new RegExp(`\\bWhenever ${determiner} ${wordLower} you control enters\\b`, 'i');
    const global = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(global)];
    if (matches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
      };
    }
    const mm = matches[0]!;
    const start = mm.index!;
    const end = start + mm[0]!.length;
    const annotation = toLineOffset(input.oracleText, start, end);
    if (!annotation) {
      return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
    }

    facts.push({
      role: 'sink',
      fact: {
        event: 'entersBattlefield',
        controller: 'you',
        types: { has: [typeWord] },
        ...(excludeSelf ? { excludeSelf: true } : {}),
        annotations: [annotation],
      },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  if (!anyEligible) {
    return { matched: false, reason: 'no on(Other)?(Artifact|Creature|Elf)Enters-named trigger on this face' };
  }
  return { matched: true, facts };
}
