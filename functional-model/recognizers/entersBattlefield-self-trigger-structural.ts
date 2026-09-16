// New recognizer (2026-09-15) — STRUCTURAL gate (`Trigger.on === 'enter'`,
// `card.ts`'s own closed real-603.6b-auto-fire vocabulary — unambiguously
// means "THIS permanent's own entering fires this trigger," never "another
// permanent enters") PLUS a text-anchor verification, same two-part shape
// `dies-trigger-structural.ts` already established for the sibling "When/
// Whenever <self> dies" precondition. Derives the SINK fact for a card's own
// ETB-self trigger CONDITION: `{event:'entersBattlefield', target:'self'}` —
// "this card wants to (re-)enter the battlefield" (blink/reanimation
// synergy), matching `cloud-midgar-mercenary`'s own pre-existing
// hand-authored fact of the identical shape.
//
// **Why structural, not text-only (unlike `dies-trigger-structural.ts`)**:
// "dies" has no OTHER real trigger shape in this engine to confuse it with
// (every `dies` event is inherently self-or-broader). "enters" does:
// `loporrit-scout`/`rook-turret`/`woodland-weavemaster` each have a real,
// board-wide "whenever ANOTHER creature/artifact/Elf enters" trigger — a
// genuinely DIFFERENT real fact shape (`{event:'entersBattlefield',
// controller:'you', types:{...}, excludeSelf:true}`, no `target:'self'` at
// all). `Trigger.on` has no structural vocabulary for "another permanent
// enters" at all (`card.ts`: `on?: 'enter' | 'upkeep' | 'endStep' |
// 'tapLandForMana' | 'attacks'` — only ever the SELF-entering case), so
// those three stay bare-NAMED triggers (`onOtherCreatureEnters`, etc.) with
// no `on` field this recognizer could ever key on. **Deliberately, correctly
// declined by this recognizer** — not the same shape, no structural signal
// exists to build the OTHER shape's own type/exclude-self filter from a bare
// trigger name; would need a real new recognizer (reading the trigger's own
// oracle-text condition clause, not `on`) if that shape is ever mechanized.
//
// **Real, whole-pool check**: 15 real cards carry `on: 'enter'` (grepped
// `functional-model/cards/*/definition.ts`; 14 as of 2026-09-15, plus
// `sage-s-nouliths` 2026-09-16). 14 have a real "When/Whenever <self>
// enters" clause verified against real oracle text (`cloud`/`jill-shiva`/
// `edgar`/`dion` via their own short name before the first comma;
// `ambrosia-whiteheart`/`quistis-trepe` via their own full name; `dragoon-s-
// wyvern`/`delivery-moogle`/`weapons-vendor` via "this creature";
// `sleep-magic`/`stuck-in-summoner-s-sanctum` via "this Aura" — a real,
// confirmed subtype-specific wording NEITHER prior "self-subject" recognizer
// (`dies-trigger-structural.ts`/`putCounterSelf-effect-structural.ts`) has
// needed before, since Aura is a subtype, not one of `PERMANENT_TYPE_WORDS`'
// own 5 primary types — added to THIS recognizer's own local alternation,
// same "extend only when a real card needs it" discipline every sibling
// recognizer already documents; `sidequest-card-collection-magicked-card`
// via "this enchantment"; `white-auracite` via "this artifact"; `sage-s-
// nouliths` via "this Equipment," the same subtype-specific pattern as Aura).
// `quistis-trepe` has no `synergy.json` yet (not migrated off the pre-Fact
// shape) — this recognizer will simply have nothing to write until it is,
// same tolerance every other recognizer already has for an unmigrated card.
// **`zack-fair` is the one real, confirmed, DELIBERATE decline**: `on:
// 'enter'` is set (modeling CR 614.12 "enters with a +1/+1 counter," this
// engine's own documented workaround — see that card's own `definition.ts`
// comment), but the real printed text is "Zack Fair enters WITH a +1/+1
// counter on it" — no "When"/"Whenever" prefix at all, because it's a
// replacement effect, not a triggered ability. This recognizer's own text
// verification correctly finds zero matches; suppressed via a
// `// recognizer-exception: entersBattlefield-self-trigger-structural`
// marker on that card (same escape hatch `putCounterSelf-effect-
// structural`'s own sibling exception on the identical card already uses),
// not a silent decline.
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'entersBattlefield-self-trigger-structural' as const;

// Real, confirmed pool need (see module doc comment): Aura is a genuine
// subtype-specific self-reference this recognizer's own two real Aura
// candidates (`sleep-magic`, `stuck-in-summoner-s-sanctum`) both use instead
// of "this enchantment" — kept as this recognizer's own local list (same
// "own small copy, not shared" convention `dies-trigger-structural.ts`/
// `putCounterSelf-effect-structural.ts`/`putCounterMagnitude-clause-
// structural.ts`/`triggerDoubling-selfAndAttachedEquipment-structural.ts`
// each already keep their own copy of the base 5) rather than widening a
// shared constant every sibling recognizer's own type-line-only check relies
// on staying exactly the 5 primary types.
//
// `Equipment` (2026-09-16, found while converting `sage-s-nouliths`'s own
// scenario to a real engine-piloted trace, which requires `on:'enter'` to
// be genuinely SET for its Job select trigger to auto-fire — previously
// only exercised via the old name-fired declarative harness, which never
// needed `on:'enter'` at all): its own real Oracle text reads "Job select
// (When this Equipment enters, create a 1/1 colorless Hero creature token,
// then attach this to it.)" — "this Equipment," not "this artifact," same
// real subtype-specific-wording shape `Aura` already established for
// Enchantment. `dragoon-s-lance`/`paladin-s-arms`/`machinist-s-arsenal`
// (this card's own Job-select siblings) are real, confirmed, LATENT users
// of this same "this Equipment enters" wording too, once/if a future
// engine-piloted scenario or `on:'enter'` fix makes their own trigger
// structurally visible to this recognizer (not fixed here — flagged only).
//
// `Land`/`Vehicle` (2026-09-16, definition-lane 76-card `on:'enter'` sweep —
// both newly structurally visible the moment `on:'enter'` was added to the
// two real cards that needed them): `adventurer-s-inn`'s own real text
// ("When this land enters, you gain 2 life.") and `magitek-armor`'s own real
// text ("When this Vehicle enters, create a 1/1 colorless Hero creature
// token.") are both genuine "When/Whenever <self> enters" triggered
// abilities — not a CR 614.12 replacement effect like this same sweep's
// other 20 "This land enters tapped"/"This creature enters tapped" cards
// (those stay real, correctly-declined `recognizer-exception`s, see each
// card's own comment) — this recognizer was simply missing these two real
// type-line nouns from its own local list, same "extend only when a real
// card needs it" discipline as `Aura`/`Equipment` above.
const TYPE_WORDS = ['Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle', 'Aura', 'Equipment', 'Land', 'Vehicle'];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Same self-referential-subject alternation `dies-trigger-structural.ts`'s
 * own `selfSubjectAlternation` already established (full name / short name
 * before the first comma / a generic "this <type>" word) — see that file's
 * own doc comment for the short-name rationale, not repeated here. */
function selfSubjectAlternation(name: string): string {
  const typeAlt = TYPE_WORDS.map((w) => `this ${w.toLowerCase()}`).join('|');
  const shortName = name.split(',')[0]!.trim();
  const nameAlt = shortName !== name ? `${escapeRegExp(name)}|${escapeRegExp(shortName)}` : escapeRegExp(name);
  return `(?:${typeAlt}|this permanent|${nameAlt})`;
}

function entersClauseRegex(name: string): RegExp {
  const subject = selfSubjectAlternation(name);
  return new RegExp(`\\b(?:When|Whenever) ${subject} enters\\b`, 'i');
}

/**
 * Reads a face's own `triggers[]` for `on:'enter'` (the structural gate that
 * distinguishes this card's OWN entering from a board-wide "another
 * permanent enters" watcher — see module doc comment), then verifies a real
 * "When/Whenever <self> enters" clause anchors it before asserting the
 * `{event:'entersBattlefield', target:'self'}` SINK fact.
 */
export function recognizeEntersBattlefieldSelfTriggerStructural(input: StructuralRecognizerInput): RecognizerResult {
  // If more than one real `on:'enter'` trigger ever existed on one face
  // (none do today — checked, every real card in this recognizer's own
  // module doc comment "15 real cards" list has exactly one), the first is
  // used; same "first match wins, no card needs more" discipline every
  // other recognizer in this catalog already accepts.
  const selfEnterTrigger = (input.triggers ?? []).find((t) => t.on === 'enter');
  if (!selfEnterTrigger) {
    return { matched: false, reason: 'no trigger with on:"enter" on this face' };
  }

  const pattern = entersClauseRegex(input.name);
  const matches = [...input.oracleText.matchAll(new RegExp(pattern.source, pattern.flags + 'g'))];
  if (matches.length !== 1) {
    return {
      matched: false,
      kind: 'mismatch',
      reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}" — a trigger with on:'enter' was found structurally, but no confirming "When/Whenever <self> enters" clause verifies it (a real CR 614.12 replacement effect worded without "When/Whenever," e.g. "enters with a counter," is the one confirmed real case — see this file's own module doc comment)`,
    };
  }

  const start = matches[0]!.index!;
  const end = start + matches[0]![0]!.length;
  const annotation = toLineOffset(input.oracleText, start, end);
  if (!annotation) {
    return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
  }

  const facts: RecognizedFact[] = [
    {
      role: 'sink',
      // No `triggeredBy` here (2026-09-16, sink/triggeredBy architecture
      // correction — see `Fact.triggeredBy`'s own doc comment, synergy.ts):
      // this fact IS the trigger-condition/structural-want itself, never a
      // caused effect, so it never carries a causal link back to a trigger.
      fact: { event: 'entersBattlefield', target: 'self', annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];

  return { matched: true, facts };
}
