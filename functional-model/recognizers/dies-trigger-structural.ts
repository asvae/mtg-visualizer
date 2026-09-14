// New recognizer (`PRD_AUTOMATED_AUTHORING.md`, 2026-09-13, tier-3
// elimination pass for fin/1-5) — text-based, like Recognizers A/B (never
// reads `Effect[]` structure, unlike Recognizers C/D/E): "When/Whenever
// <self> dies, <effect>" — CR 700.4's own "dies means is put into a
// graveyard from the battlefield," applied to THIS permanent's own death,
// not some other trigger clause that merely mentions "dies."
//
// Two facts, same real, checked shape 2 real pool cards already carry
// hand-authored, byte for byte (`dwarven-castle-guard`, `al-bhed-
// salvagers` — see the whole-pool check below): the trigger's own firing
// PRECONDITION (a SINK — this card wants ITSELF to die) and the SAME real
// dying asserted from the SOURCE side (CR 700.4 — a guaranteed
// battlefield->graveyard move, real regardless of whatever upstream cause
// — combat, an opponent's removal, a state-based action — actually killed
// it; see `SYNERGY_DESIGN.md`'s own "ACT vs CONSEQUENCE" standing rule:
// this is squarely a CONSEQUENCE fact, always eligible once the dying
// clause exists at all, never conditional the way a `destroy`/`sacrifice`
// ACT fact is).
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
      // own former `authoredFacts` entry asserted by hand).
      role: 'sink',
      fact: { event: 'dies', target: 'self', annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
    {
      // The SAME real dying, asserted from the SOURCE side (CR 700.4 — a
      // guaranteed occurrence once this clause exists at all, regardless of
      // what upstream cause actually killed it).
      role: 'source',
      fact: {
        event: 'dies',
        from: 'Battlefield',
        to: 'Graveyard',
        controller: 'you',
        subject: 'self',
        target: 'self',
        annotations: [annotation],
      },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];
  return { matched: true, facts };
}
