// New recognizer (`PRD_AUTOMATED_AUTHORING.md`, 2026-09-13, tier-3
// elimination pass for fin/1-5) — text-based, like Recognizers A/B (never
// reads `Effect[]` structure, unlike Recognizers C/D/E): "When/Whenever
// <self> dies, <effect>" — CR 700.4's own "dies means is put into a
// graveyard from the battlefield," applied to THIS permanent's own death,
// not some other trigger clause that merely mentions "dies."
//
// **SINK-only, since 2026-09-17 — the companion SOURCE fact this
// recognizer used to ALSO emit was removed as a real over-claim, not a
// stylistic simplification (real user-reported redundancy, motivating
// card: `aerith-gainsborough`, fin/4).** The trigger's own firing
// PRECONDITION (a SINK — this card wants ITSELF to die, unchanged below)
// is the only real fact this clause backs. The removed SOURCE half used to
// assert the SAME dying from the CONSEQUENCE side (CR 700.4 —
// battlefield->graveyard, `subject`/`target: 'self'`), reasoning it as
// "a guaranteed occurrence once this clause exists at all" — that
// reasoning does not actually hold for THIS trigger the way it holds for
// `destroy-effect-structural.ts`'s own real `dies`-implying match (see
// `synergy.ts`'s `satisfiesDestroyImpliesDies`,
// `.claude/contracts/card-schema.md`'s "`destroy` implies `dies`" section):
// a `destroy` effect is an ACT this card's own resolution performs, and CR
// 700.4/704.5g make its target's death a CERTAIN follow-through once that
// destroy actually resolves against something. A self-referential
// "When/Whenever <self> dies" trigger's own SINK, by contrast, is not an
// act this card performs at all — it is a PRECONDITION the card merely
// reacts to if some wholly separate cause (combat, an opponent's removal,
// an unrelated state-based action) happens to kill it. Nothing about a
// card carrying this trigger makes that card any more or less likely to
// actually die than a plain vanilla creature with no dies-trigger
// whatsoever — the SOURCE fact was therefore granting a real, matchable
// "this card produces a Graveyard arrival" claim (and the cross-card
// synergy edges that claim produced) as an ARBITRARY byproduct of an
// unrelated ability's own text existing on the card, not because this
// specific card's own death is in any way more certain or more its own
// doing than any other creature's. Whether a MORE GENERAL "any creature
// could die" synthetic match-time fact (mirroring
// `isNormalPermanent`/`syntheticCastFact`-family below in `synergy.ts`)
// should exist to recover the lost cross-card edges pool-wide is a real,
// separate, much bigger scope question (every creature in the pool would
// newly connect to every graveyard-payoff card) — deliberately NOT decided
// or built here; flagged back to the orchestrator/user instead. See this
// recognizer's own `.test.ts` and the 7 real cards' `synergy.json` this
// removal touched for the exact, disclosed, accepted edge losses.
//
// **Real, whole-pool verification done BEFORE writing this recognizer's
// own matching regex** (same discipline every recognizer in this catalog
// already uses) — grepped every real `name: 'onDies'`-named trigger across
// `functional-model/cards/*/definition.ts` (8 real occurrences) and read
// each one's own real Scryfall oracle text directly:
//   - `dwarven-castle-guard`, `undercity-dire-rat`, `magic-pot`,
//     `ancient-adamantoise`: "When this creature dies, ..." — clean,
//     unqualified, self-only.
//   - `aerith-gainsborough`: "When Aerith Gainsborough dies, ..." — uses its
//     own printed name instead of "this creature."
//   - `vincent-valentine-galian-beast`'s own BACK face: "When Galian Beast
//     dies, ..." — same, own printed (face) name. Its FRONT face has a
//     completely different, unrelated trigger ("Whenever a creature an
//     OPPONENT controls dies...") that is NOT named `onDies` at all — a
//     real, confirmed non-overlap.
//   - `garland-knight-of-cornelia-chaos-the-endless`'s own BACK face: "When
//     Chaos dies, ..." — same, own printed (face) name.
//   - **`al-bhed-salvagers` (real card name has NO hyphen — "Al Bhed
//     Salvagers," confirmed against `data/fin/fin_scryfall.json` directly;
//     the slug is misleading) is the one real, deliberate DECLINE case this
//     recognizer's own regex must get right, not paper over**: its real
//     clause reads "Whenever this creature or another creature or artifact
//     you control dies, target opponent loses 1 life and you gain 1 life."
//     — a genuinely BROADER precondition (fires on ANY creature/artifact
//     you control dying, not just itself), confirmed against its own real
//     hand-authored `synergy.json` sink:
//     `{event:'dies', controller:'you', target:{types:{hasAny:['Creature',
//     'Artifact']}}}` — NOT `target:'self'`. Requiring "dies" IMMEDIATELY
//     adjacent to the self-subject (no unbounded `.*` in between) is what
//     makes this decline correctly and for free: "this creature" is not
//     immediately followed by "dies" in this card's own real text (it's
//     followed by "or another creature or artifact you control"), so no
//     special-casing for this one card is needed at all.
//
// **Deliberately does NOT read `Trigger.name` at all** (an earlier design
// sketch for this same task considered matching on the literal trigger
// name string `'onDies'` instead of oracle text) — rejected: a `Trigger
// .name` is a free-text identifier an author chose for readability, not a
// closed, engine-checked vocabulary the way `Trigger.on` is (only
// `'enter'|'upkeep'|'endStep'` are), and — concretely, not just
// hypothetically — `al-bhed-salvagers`'s own trigger is ALSO literally
// named `'onDies'` in its own `definition.ts` despite meaning something
// materially broader than "this card itself dies." Matching the real
// printed English (with a required immediate-adjacency boundary) is what
// correctly tells these two cases apart; the internal identifier alone
// cannot.
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

const RULE = 'dies-trigger-structural' as const;

const PERMANENT_TYPE_WORDS = ['Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle'];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Same self-referential-subject shape `permanent-enters-battlefield-
 * normally.ts` already established ("this <permanent type>"/"this
 * permanent"/the card's own printed name) — deliberately NOT bare pronouns
 * ("it"), same reasoning that file's own module doc comment gives.
 *
 * **Also accepts the SHORT form of a comma-epithet name** (real, confirmed
 * pool need, not speculative): `garland-knight-of-cornelia-chaos-the-
 * endless`'s own back face is named "Chaos, the Endless" but its own real
 * oracle text refers to itself as just "Chaos" ("When Chaos dies, put it on
 * the bottom of its owner's library.") — standard Magic templating drops
 * the epithet after the first reference. Only the substring before the
 * FIRST comma is tried as this short form (never a middle/later comma
 * segment), and only when it differs from the full name. */
function selfSubjectAlternation(name: string): string {
  const typeAlt = PERMANENT_TYPE_WORDS.map((w) => `this ${w.toLowerCase()}`).join('|');
  const shortName = name.split(',')[0]!.trim();
  const nameAlt = shortName !== name ? `${escapeRegExp(name)}|${escapeRegExp(shortName)}` : escapeRegExp(name);
  return `(?:${typeAlt}|this permanent|${nameAlt})`;
}

/** "When/Whenever <self> dies" — "dies" must be the IMMEDIATE next word
 * (only whitespace between, no `.*`) — see this file's own module doc
 * comment for why this exact adjacency is what correctly declines
 * `al-bhed-salvagers`'s own real, broader "this creature or another
 * creature or artifact you control dies" clause without any card-specific
 * carve-out. */
function diesClauseRegex(name: string): RegExp {
  const subject = selfSubjectAlternation(name);
  return new RegExp(`\\b(?:When|Whenever) ${subject} dies\\b`, 'i');
}

export function recognizeDiesTriggerStructural(input: RecognizerInput): RecognizerResult {
  const primaryTypes = input.typeLine.split('—')[0]!.trim();
  const isPermanent = PERMANENT_TYPE_WORDS.some((w) => primaryTypes.includes(w));
  if (!isPermanent) {
    return { matched: false, reason: `typeLine "${input.typeLine}" has no recognized permanent type` };
  }

  const match = diesClauseRegex(input.name).exec(input.oracleText);
  if (!match) {
    return {
      matched: false,
      reason:
        'no "When/Whenever <self> dies" clause found, with "dies" immediately adjacent to the self-subject (a broader compound clause — e.g. "...or another creature ... dies" — correctly does not match this)',
    };
  }

  const start = match.index;
  const end = start + match[0].length;
  const annotation = toLineOffset(input.oracleText, start, end);
  if (!annotation) {
    return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
  }

  const facts: RecognizedFact[] = [
    {
      // The trigger's own firing precondition — this card wants ITSELF to
      // die (co-located here as a SINK, same shape aerith-gainsborough's
      // own former `authoredFacts` entry asserted by hand). SINK-only since
      // 2026-09-17 — see this file's own module doc comment for why the
      // companion SOURCE fact this used to also emit was removed as a real
      // over-claim, not merged/replaced by anything else.
      role: 'sink',
      fact: { event: 'dies', target: 'self', annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];
  return { matched: true, facts };
}
