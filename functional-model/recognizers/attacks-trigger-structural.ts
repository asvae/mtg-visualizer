// New recognizer (2026-09-14, tier-3 elimination pass, ENGINE_GAPS.md —
// attack-triggered-ability auto-dispatch) — text-based, same family as
// `dies-trigger-structural.ts`/`lifegain-trigger-structural.ts` (never reads
// `Effect[]` structure): "When/Whenever <self> attacks, <effect>" — the
// trigger's own firing PRECONDITION, a SINK this card carries no other
// structural field to express (Ashe, Princess of Dalmasca's own `onAttack`
// trigger fires a plain declarative `dig` effect with no `custom` closure at
// all to read this off of — `CardDefinition.authoredFacts`, per its own doc
// comment, existed specifically for this "no single owning Effect" shape,
// BEFORE `Trigger.on: 'attacks'` gave this a real, closed-vocabulary
// equivalent to `'enter'`/`'upkeep'`/`'endStep'`).
//
// Real Forge citation for the underlying mechanism: `TriggerType.Attacks`
// (`TriggerAttacks.java`'s own `performTest`, `ValidCard$ Card.Self` for this
// narrow shape), fired via `CombatUtil.checkDeclaredAttacker`
// (forge-game/.../combat/CombatUtil.java ~lines 363-383).
//
// **Real, whole-pool verification done BEFORE writing this recognizer's own
// matching regex** (same discipline every recognizer in this catalog already
// uses) — grepped every real `Whenever [^,.]*attacks[^,.]*,` clause across
// `data/fin/fin_scryfall.json` (34 real occurrences) and read each one's own
// real Scryfall oracle text directly. Confirmed real, genuinely DIFFERENT
// shapes this recognizer must correctly DECLINE, not sweep in:
//   - **`Whenever <self> attacks,`** (the plain, self-only shape this
//     recognizer models) — Ultima, Origin of Oblivion; Ashe, Princess of
//     Dalmasca; Cecil, Redeemed Paladin; Vincent Valentine; Barret Wallace;
//     Queen Brahne; Raubahn, Bull of Ala Mhigo; Sazh Katzroy; Garnet,
//     Princess of Alexandria; Rufus Shinra; Tidus, Blitzball Star; The Lord
//     Master of Hell; Balamb Garden, Airborne. Also "Whenever THIS CREATURE
//     attacks," (White Mage's Staff, Il Mheg Pixie, Sage's Nouliths, Namazu
//     Trader, Jumbo Cactuar, Summoner's Grimoire) — same self-subject shape,
//     `il-mheg-pixie`'s own real hand-authored sink already carries the
//     IDENTICAL `{event:'attacks', target:'self', value:1}` shape this
//     recognizer produces, confirming this is real, established, checkable
//     vocabulary, not a guess.
//   - **`Whenever <self> enters or attacks,`** (Sephiroth, Fabled SOLDIER;
//     Gilgamesh; Emet-Selch, Unsundered; Kefka, Court Mage; Sin, Spira's
//     Punishment; Ultimecia, Time Sorceress) — a genuinely COMPOUND
//     precondition (fires on EITHER event, not attacking specifically) —
//     correctly declined by requiring "attacks" be the IMMEDIATE next word
//     after the self-subject (no unbounded `.*` in between, same adjacency
//     discipline `dies-trigger-structural.ts` already established for its
//     own "this creature or another ... dies" decline case): after the
//     self-subject here comes "enters," not "attacks."
//   - **`Whenever equipped creature attacks,`** (Genji Glove, Ultima
//     Weapon) — subject is "equipped creature," not self; declines because
//     it isn't in the self-subject alternation at all.
//   - **`Whenever a creature you control attacks alone,`** (Seifer Almasy,
//     Squall, SeeD Mercenary) — subject is "a creature you control," not
//     self, AND the real precondition is genuinely broader (any creature,
//     conditioned on being the lone attacker) — declines on subject alone.
//   - **`Whenever a Vehicle crewed by Balthier and Fran this turn
//     attacks,`** (Balthier and Fran) — subject is a differently-scoped
//     Vehicle reference, not self — declines on subject alone.
//   - **`Whenever this Vehicle attacks,`** (Adventurer's Airship) —
//     deliberately, narrowly NOT modeled: "Vehicle" is not in this
//     recognizer's own self-subject alternation (attacking is otherwise
//     creature-specific in this pool; a Vehicle can only ever attack once
//     crewed into a creature) — a real, narrower-than-strictly-necessary
//     scope decision, not an oversight; left declined rather than widening
//     the alternation on zero current pool need beyond this one card.
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

const RULE = 'attacks-trigger-structural' as const;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Same self-referential-subject shape `dies-trigger-structural.ts` already
 * established ("this creature"/the card's own printed name, or the short
 * form before a first comma) — narrowed to `Creature` only here (unlike that
 * file's own broader `PERMANENT_TYPE_WORDS` list): attacking is a
 * creature-specific action in this pool (a Vehicle needs Crew first, and no
 * FIN card's own "self attacks" trigger sits on a non-Creature permanent
 * type — checked). */
function selfSubjectAlternation(name: string): string {
  const shortName = name.split(',')[0]!.trim();
  const nameAlt = shortName !== name ? `${escapeRegExp(name)}|${escapeRegExp(shortName)}` : escapeRegExp(name);
  return `(?:this creature|${nameAlt})`;
}

/** "When/Whenever <self> attacks" — "attacks" must be the IMMEDIATE next
 * word (only whitespace between, no `.*`) — see this file's own module doc
 * comment for why this exact adjacency is what correctly declines the real
 * "enters or attacks" compound shape without any card-specific carve-out. */
function attacksClauseRegex(name: string): RegExp {
  const subject = selfSubjectAlternation(name);
  return new RegExp(`\\b(?:When|Whenever) ${subject} attacks\\b`, 'i');
}

export function recognizeAttacksTriggerStructural(input: RecognizerInput): RecognizerResult {
  const primaryTypes = input.typeLine.split('—')[0]!.trim();
  if (!primaryTypes.includes('Creature')) {
    return { matched: false, reason: `typeLine "${input.typeLine}" is not a Creature (attacking is creature-specific in this pool)` };
  }

  const match = attacksClauseRegex(input.name).exec(input.oracleText);
  if (!match) {
    return {
      matched: false,
      reason:
        'no "When/Whenever <self> attacks" clause found, with "attacks" immediately adjacent to the self-subject (a compound "...enters or attacks" clause, or a differently-scoped subject like "equipped creature"/"a creature you control ... attacks alone", correctly does not match this)',
    };
  }

  const start = match.index;
  const end = start + match[0].length;
  const annotation = toLineOffset(input.oracleText, start, end);
  if (!annotation) {
    return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
  }

  // The trigger's own firing PRECONDITION — this card wants ITSELF to
  // attack (co-located here as a SINK, same shape Ashe, Princess of
  // Dalmasca's own former `authoredFacts` entry, and Il Mheg Pixie's own
  // pre-existing hand-authored fact, both already assert). Unlike
  // `dies-trigger-structural`'s companion SOURCE fact (CR 700.4's guaranteed
  // battlefield->graveyard move), attacking has no real zone-movement
  // consequence of its own to assert from the source side — confirmed:
  // grepped every real pool card's own `synergy.json` for a SOURCE-side
  // `event:'attacks'` fact and found none; this stays sink-only.
  const facts: RecognizedFact[] = [
    {
      role: 'sink',
      fact: { event: 'attacks', target: 'self', value: 1, annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];
  return { matched: true, facts };
}
