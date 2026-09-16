// New recognizer (2026-09-16, fin/26-50 re-triage follow-up) — structural
// (reads `input.triggers[].name` directly, same `StructuralRecognizerInput`
// container `destroy-effect-structural.ts`/`drawCard-effect-structural.ts`
// already use for `Effect[]`, here applied to `Trigger[]` instead), a real
// sibling of the existing NAME-keyed trigger recognizers
// (`attacks-trigger-structural.ts`/`dies-trigger-structural.ts`/
// `landfall-trigger-structural.ts`/`lifegain-trigger-structural.ts`) — none
// of which cover the `onCast<Type>Spell` naming convention this pool's own
// definition.ts files already establish for "whenever you cast a [type]
// spell" reactive triggers.
//
// **Deliberately keyed on `Trigger.name`, not a bare oracle-text regex scan**
// (unlike this recognizer's own text-only siblings above) — a real,
// necessary difference, not an arbitrary style choice. A pure oracle-text
// scan for "Whenever you cast a ... spell" would ALSO match several real FIN
// cards whose printed clause is a GRANTED ability living inside a quoted
// string (an Equipment's own static grant, or a card that creates a token
// carrying this text) — that clause is never this permanent's OWN trigger in
// those cases, and asserting a sink fact for it would be a real false
// positive. Grepped the full real pool BEFORE writing this file (`Whenever
// you cast a[^.]*spell` across `data/fin/fin_scryfall.json`, 23 real
// occurrences) and confirmed several of these ARE exactly that trap: Black
// Mage's Rod, Circle of Power, Cornered by Black Mages, Mysidian Elder
// (granted/token ability text), plus several real cards using a
// DIFFERENTLY-shaped `Trigger.name` for the identical real clause
// (`onNoncreatureSpellCast`/`onNoncreatureSpellCast4Mana`/
// `onNoncreatureSpellCastGE4Mana`/`onNoncreatureSpellCastGE8Mana`/
// `onExpensiveNoncreatureSpellCast`/`onEquippedCastsNoncreatureSpell` —
// Black Waltz No. 3, The Emperor of Palamecia, Garland/Chaos, Prompto
// Argentum, Ultros, Blazing Bomb, Red Mage's Rapier). Keying on the SPECIFIC
// `onCast<Type>Spell` trigger name (not the underlying English clause alone)
// sidesteps every one of these by construction: none of those other cards'
// own `Trigger.name` matches this recognizer's known set at all, so this
// recognizer never even looks at their oracle text. Same "build the expected
// clause from the structured field, then require it verbatim" discipline
// `destroy-effect-structural.ts` already established, just keyed off
// `Trigger.name` instead of an `Effect`'s own typed fields (a `Trigger.name`
// is itself a free-text identifier with no closed enum — `card.ts`'s own
// `Trigger.name` doc comment — so this is still fundamentally a "structural
// re-derivation with a real-text confirmation gate," same family, not a
// looser guess).
//
// **Real, whole-pool verification of the full 8-card family this covers**
// (grepped every real `name: 'onCast...'` in `functional-model/cards/*/
// definition.ts` — 8 real occurrences; a 9th file, `ether`, only MENTIONS
// `onCast` in a prose comment discussing this same convention in the
// abstract, no actual trigger by that name exists there — corrected down
// from a 9-card estimate for that reason), each one's own real oracle text
// read directly via `forge-lookup.mjs`:
//   - `onCastCreatureSpell` (Champions of the Perfect, fin/26-50): "Whenever
//     you cast a creature spell, draw a card." Matches this card's own
//     EXISTING hand-authored sink exactly (`{event:'castCreatureSpell',
//     controller:'you', types:{has:['Creature']}}`, flat `types`, no
//     `target` wrapper) — `verify-synergy.mjs`'s own `TRIGGER_EVENT_MAP`
//     already maps this name to the `'castCreatureSpell'` event, confirming
//     this is real, established, checkable vocabulary already, not a guess.
//   - `onCastLegendarySpell` (Venat, Heart of Hydaelyn): "Whenever you cast a
//     legendary spell, draw a card. This ability triggers only once each
//     turn." Matches this card's own existing hand-authored sink
//     (`{event:'cast', controller:'you', target:{types:{has:['Legendary']}},
//     oncePerTurn:true}`) — `TRIGGER_EVENT_MAP` already maps this name to the
//     generic `'cast'` event (documented there as deliberately generic,
//     since `factsInteract`'s own `Constraints`-shaped event `target` branch
//     is what narrows it, not the event name).
//   - `onCastNoncreatureSpell4Mana` (Sahagin, The Prima Vista): "Whenever you
//     cast a noncreature spell, if at least four mana was spent to cast it,
//     ...". Matches both cards' own existing hand-authored sink
//     (`{event:'cast', controller:'you', target:{types:{not:['Creature']},
//     cmc:{min:4}}}` — the same honest `cmc`-as-approximation-for-"mana
//     spent" convention those two facts' own pre-existing annotations
//     already establish, this model has no real mana-spent tracking, see
//     `SYNERGY_DESIGN.md`'s Phoenix Down precedent). Already mapped in
//     `TRIGGER_EVENT_MAP` to `'cast'`.
//   - `onCastNoncreatureSpell` (Shantotto, Tactician Magician; Tellah, Great
//     Sage; Vivi Ornitier): "Whenever you cast a noncreature spell, ..." with
//     NO mana-spent qualifier at all (checked all three real cards' own
//     oracle text directly — genuinely bare, not a truncated form of the
//     4-mana sibling above). **None of these 3 real cards has ANY existing
//     hand-authored sink fact for this want at all** — a genuine gap this
//     recognizer closes, not a re-confirmation. `TRIGGER_EVENT_MAP` did NOT
//     map this bare name before this pass (only its `4Mana` sibling was
//     mapped) — added alongside this recognizer (see that script's own
//     comment) so these 3 new facts have real scenario-trace evidence
//     (all three cards' own `scenarios.ts` already fires
//     `trigger: 'onCastNoncreatureSpell'` directly).
//   - `onCastSpellYouDontOwn` (Vaan, Street Thief) — deliberately, explicitly
//     DECLINED, not silently skipped: "Whenever you cast a spell you don't
//     own, put a +1/+1 counter on each Scout, Pirate, and Rogue you
//     control." This pool's own `Constraints` vocabulary (`synergy.ts`) has
//     no `owner`/ownership-of-the-CAST-SPELL field at all (checked directly
//     — `types`/`cmc`/`power`/`toughness`/`amount`/`name`/`attacking`/
//     `attached`/etc., nothing about who owns the spell being cast); no real
//     hand-authored fact in the pool asserts a "you cast a spell you don't
//     own" want either, so there's no confirmed real shape to build even by
//     analogy. Same "grow only when a real card forces it, decline rather
//     than guess" discipline `destroy-effect-structural.ts`'s own
//     `owner`-restricted decline already establishes for the ACT side of an
//     ownership-adjacent concept.
import type { Fact } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import type { StructuralRecognizerInput } from './structural-effects';

const RULE = 'castTypeSpell-trigger-structural' as const;

type FactShape = Omit<Fact, 'role' | 'annotations'>;

interface Spec {
  /** The exact literal clause this trigger name structurally implies —
   * required to appear verbatim (case-insensitive), exactly once, in this
   * face's own real oracle text (same "build from the structured field,
   * confirm verbatim" discipline `destroy-effect-structural.ts` already
   * uses, just keyed off `Trigger.name` instead of an `Effect`'s own typed
   * fields). */
  clauseRe: RegExp;
  buildFact: (oracleText: string) => FactShape;
}

const SPEC_BY_TRIGGER_NAME: Record<string, Spec> = {
  onCastCreatureSpell: {
    clauseRe: /\bWhenever you cast a creature spell\b/i,
    buildFact: () => ({ event: 'castCreatureSpell', controller: 'you', types: { has: ['Creature'] } }),
  },
  onCastLegendarySpell: {
    clauseRe: /\bWhenever you cast a legendary spell\b/i,
    buildFact: (oracleText) => ({
      event: 'cast',
      controller: 'you',
      target: { types: { has: ['Legendary'] } },
      // Documentary-only cap (`synergy.ts`'s own `oncePerTurn` doc comment —
      // "only ever set on the TRIGGER/condition side... nothing in
      // state.ts/turn.ts enforces that cap yet") — only set when this face's
      // own real text actually prints the real, fixed CR-adjacent phrase
      // G'raha Tia's/Elrond's own `activationLimit` doc comment already cites
      // (`card.ts:1344-1358`), never assumed.
      ...(/\bThis ability triggers only once each turn\b/i.test(oracleText) ? { oncePerTurn: true } : {}),
    }),
  },
  // Checked BEFORE the bare sibling below in `recognize`'s own loop order
  // doesn't matter here (both are keyed by exact `Trigger.name`, never
  // ambiguous which spec a given trigger resolves to) — kept as two entries,
  // not one with an optional suffix, because they're two REAL, independently
  // established `Trigger.name` strings/Fact shapes in this pool already
  // (`sahagin`'s own module comment: "the SAME name/convention The Prima
  // Vista's own identical-shaped trigger already established").
  onCastNoncreatureSpell4Mana: {
    clauseRe: /\bWhenever you cast a noncreature spell, if at least four mana was spent to cast it\b/i,
    buildFact: () => ({ event: 'cast', controller: 'you', target: { types: { not: ['Creature'] }, cmc: { min: 4 } } }),
  },
  onCastNoncreatureSpell: {
    // Negative lookahead guards against this SPECIFIC name accidentally
    // resolving against the 4-mana sibling's own longer clause (never
    // observed in the real pool — every real `onCastNoncreatureSpell`-named
    // trigger's own oracle text is genuinely bare — but a real, free
    // correctness check in the same spirit as `attacks-trigger-structural
    // .ts`'s own adjacency requirement, not defensive dead code).
    clauseRe: /\bWhenever you cast a noncreature spell\b(?!, if at least four mana was spent to cast it)/i,
    buildFact: () => ({ event: 'cast', controller: 'you', target: { types: { not: ['Creature'] } } }),
  },
};

// Named explicitly (not just silently falling through "unknown trigger
// name") so a future "rule review" pass — and anyone reading this file —
// sees the real reason this known real trigger name is deliberately
// excluded, rather than assuming it was simply never noticed. See this
// file's own module doc comment for the full reasoning.
const KNOWN_BUT_UNSUPPORTED: Record<string, string> = {
  onCastSpellYouDontOwn:
    'no `owner`/ownership-of-the-cast-spell field exists anywhere in this pool\'s Constraints vocabulary, and no real hand-authored fact asserts this want to confirm a shape by analogy — declining rather than inventing new vocabulary',
};

/**
 * Reads this face's own structured `Trigger[]` directly (never guesses from
 * oracle text alone — see module doc comment for why a name-only text scan
 * would be unsafe here) and derives the `event`-shaped SINK fact each
 * recognized `onCast<Type>Spell`-named trigger's own firing PRECONDITION
 * implies — the trigger's own condition, not its resulting effects (same
 * "no single owning Effect to read this off of" shape
 * `attacks-trigger-structural.ts`/`landfall-trigger-structural.ts`/
 * `lifegain-trigger-structural.ts` already established for their own named
 * triggers).
 *
 * **All-or-nothing per face, not per-trigger** (same stated simplification
 * `destroy-effect-structural.ts` already uses for its own per-effect loop):
 * if this face has zero triggers whose name this recognizer knows about at
 * all, declines with a `'scope'` reason (the ordinary "this card doesn't use
 * this convention" case); if it has one or more RECOGNIZED names but any of
 * them can't be confidently verified against this face's own real oracle
 * text, the whole face declines via `kind:'mismatch'` rather than partially
 * claiming only the resolvable ones (no real pool card needs finer-grained
 * partial success here — every one of the 7 real cards this recognizer
 * confidently matches has exactly one such trigger).
 */
export function recognizeCastTypeSpellTriggerStructural(input: StructuralRecognizerInput): RecognizerResult {
  const triggers = input.triggers ?? [];
  const recognizedTriggers = triggers.filter((t) => t.name in SPEC_BY_TRIGGER_NAME);
  const unsupportedTriggers = triggers.filter((t) => t.name in KNOWN_BUT_UNSUPPORTED);

  if (recognizedTriggers.length === 0) {
    if (unsupportedTriggers.length > 0) {
      const t = unsupportedTriggers[0]!;
      return { matched: false, reason: `trigger '${t.name}' is a known onCast<Type>Spell-family name but unsupported: ${KNOWN_BUT_UNSUPPORTED[t.name]}` };
    }
    return { matched: false, reason: 'no onCast<Type>Spell-named trigger on this face' };
  }

  const facts: RecognizedFact[] = [];

  for (const trigger of recognizedTriggers) {
    const spec = SPEC_BY_TRIGGER_NAME[trigger.name]!;
    const global = new RegExp(spec.clauseRe.source, spec.clauseRe.flags.includes('g') ? spec.clauseRe.flags : `${spec.clauseRe.flags}g`);
    const matches = [...input.oracleText.matchAll(global)];
    if (matches.length === 0) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `trigger '${trigger.name}' expects clause /${spec.clauseRe.source}/ verbatim but it was not found in oracle text "${input.oracleText}"`,
      };
    }
    if (matches.length > 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `trigger '${trigger.name}'s own expected clause /${spec.clauseRe.source}/ matched ${matches.length} times — ambiguous, declining rather than guessing which`,
      };
    }

    const m = matches[0]!;
    const start = m.index!;
    let end = start + m[0]!.length;
    // WIDENED (2026-09-16, fin/20-47 pass) — `onCastLegendarySpell`'s own
    // real corroborating "This ability triggers only once each turn."
    // sentence (Venat, Heart of Hydaelyn's own text, the ONE real user of
    // this spec, checked directly) is now part of the SAME sink fact's
    // annotation, not left uncovered — this recognizer already reads this
    // exact sentence (immediately below) to decide whether to set
    // `oncePerTurn: true` at all; only extends `end` when that sentence is
    // genuinely present immediately after the main clause (never guessed).
    const trailingOncePerTurn = /^,\s*draw a card\.\s*This ability triggers only once each turn\.?/i.exec(input.oracleText.slice(end));
    if (trailingOncePerTurn) end += trailingOncePerTurn[0].length;
    const annotation = toLineOffset(input.oracleText, start, end);
    if (!annotation) {
      return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
    }

    facts.push({
      role: 'sink',
      fact: { ...spec.buildFact(input.oracleText), annotations: [annotation] } as RecognizedFact['fact'],
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  return { matched: true, facts };
}
