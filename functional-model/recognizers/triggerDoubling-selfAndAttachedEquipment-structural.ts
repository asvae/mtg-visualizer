// New recognizer (2026-09-14, mechanization pass — fin/10 gap closure) —
// structural, same family as `saga-lore-and-sacrifice-structural.ts`/
// `ptFormula-scalingPump-structural.ts` (reads a CARD-DEFINITION-LEVEL
// structured field, never an `Effect[]` container): reads
// `CardDefinition.triggerDoubling` (`card.ts`'s `TriggerDoublingGrant[]`),
// and for the `scope: 'selfAndAttachedEquipment'` variant specifically,
// requires this variant's own confirmed, hardcoded real English clause to
// appear verbatim in this face's own real oracle text before asserting
// anything.
//
// **Real, whole-pool check done first** — `TriggerDoublingGrant.scope` is a
// closed 3-value union (`card.ts`), each value used by EXACTLY one real card
// today, each with a GENUINELY DIFFERENT real printed sentence — confirmed
// directly, not assumed:
//   - **Cloud, Midgar Mercenary** (`scope: 'selfAndAttachedEquipment'`) —
//     "As long as Cloud is equipped, if a triggered ability of Cloud or an
//     Equipment attached to it triggers, that ability triggers an
//     additional time." — the ONE shape this recognizer models.
//   - **The Masamune** (`scope: 'equippedSelf', causedBy: 'dying'`) —
//     "Equipped creature has 'If a creature dying causes a triggered ability
//     of this creature or an emblem you own to trigger, that ability
//     triggers an additional time.'" — a QUOTED granted-ability sentence with
//     a genuinely different structure (and an unmodelable "or an emblem you
//     own" clause) — out of scope for this recognizer.
//   - **Traveling Chocobo** (`scope: 'anyPermanentYouControl', causedBy:
//     'entersBattlefield', entersMatch: [...]`) — "If a land or Bird you
//     control entering the battlefield causes a triggered ability of a
//     permanent you control to trigger, that ability triggers an additional
//     time." — yet another genuinely different sentence structure.
// No single closed template covers all 3 real scopes (unlike, say,
// `dies-trigger-structural.ts`'s single "<self> dies" idiom) — this
// recognizer deliberately only claims the ONE scope value it has verified,
// verbatim, real text for; `'equippedSelf'`/`'anyPermanentYouControl'` are
// left declined (scope) rather than guessed at, pending a future recognizer
// (or a widening of this one) once/if a SECOND real card needs either shape
// to check a template against.
//
// **Two facts, mirroring Cloud's own real, pre-existing hand-authored pair
// byte-for-byte**: both are SINK facts (this static grant's own real
// precondition — it only matters once Cloud or its attached Equipment
// actually HAS a triggered ability to double; the doubling itself is real
// engine bookkeeping, not a produce/consume-shaped board relation any Fact
// vocabulary models, same "never a Fact" treatment `queueExtraPhase` already
// gets, ENGINE_DESIGN.md) — one for Cloud's own triggered abilities
// (`{event:'triggeredAbility', target:'self'}`), one for an attached
// Equipment's (`{event:'triggeredAbility', target:{types:{has:['Equipment']},
// attachedToSelf:true}}`), each anchored to its own real sub-span within the
// single real sentence.
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { toLineOffset } from './types';

const RULE = 'triggerDoubling-selfAndAttachedEquipment-structural' as const;

export type TriggerDoublingRecognizerInput = RecognizerInput & Pick<CardDefinition, 'triggerDoubling'>;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Same self-referential-subject vocabulary `dies-trigger-structural.ts`
 * already established (this card's own printed name, its short form before
 * a first comma if different, or a fixed permanent-supertype word) —
 * duplicated here per this catalog's own established per-file convention. */
const PERMANENT_TYPE_WORDS = ['Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle'];

function selfSubjectAlternation(name: string): string {
  const typeAlt = PERMANENT_TYPE_WORDS.map((w) => `this ${w.toLowerCase()}`).join('|');
  const shortName = name.split(',')[0]!.trim();
  const nameAlt = shortName !== name ? `${escapeRegExp(name)}|${escapeRegExp(shortName)}` : escapeRegExp(name);
  return `(?:${typeAlt}|this permanent|${nameAlt})`;
}

export function recognizeTriggerDoublingSelfAndAttachedEquipmentStructural(input: TriggerDoublingRecognizerInput): RecognizerResult {
  const grants = (input.triggerDoubling ?? []).filter((g) => g.scope === 'selfAndAttachedEquipment');
  if (grants.length === 0) {
    return { matched: false, reason: 'no triggerDoubling entry with scope:"selfAndAttachedEquipment" on this face' };
  }

  const selfPattern = new RegExp(`\\ba triggered ability of ${selfSubjectAlternation(input.name)}\\b`, 'i');
  const equipmentPattern = /\ban Equipment attached to it\b/i;

  const selfMatches = [...input.oracleText.matchAll(new RegExp(selfPattern.source, selfPattern.flags + 'g'))];
  if (selfMatches.length !== 1) {
    return {
      matched: false,
      kind: 'mismatch',
      reason: `expected clause /${selfPattern.source}/ matched ${selfMatches.length} times (expected exactly 1) in oracle text "${input.oracleText}"`,
    };
  }
  const equipmentMatches = [...input.oracleText.matchAll(new RegExp(equipmentPattern.source, equipmentPattern.flags + 'g'))];
  if (equipmentMatches.length !== 1) {
    return {
      matched: false,
      kind: 'mismatch',
      reason: `expected clause /${equipmentPattern.source}/ matched ${equipmentMatches.length} times (expected exactly 1) in oracle text "${input.oracleText}"`,
    };
  }

  const selfMatch = selfMatches[0]!;
  const selfAnnotation = toLineOffset(input.oracleText, selfMatch.index!, selfMatch.index! + selfMatch[0]!.length);
  const equipmentMatch = equipmentMatches[0]!;
  const equipmentAnnotation = toLineOffset(input.oracleText, equipmentMatch.index!, equipmentMatch.index! + equipmentMatch[0]!.length);
  if (!selfAnnotation || !equipmentAnnotation) {
    return { matched: false, reason: 'matched span did not resolve to a single real oracle-text line' };
  }

  const facts: RecognizedFact[] = [
    {
      role: 'sink',
      fact: { event: 'triggeredAbility', target: 'self', annotations: [selfAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    },
    {
      role: 'sink',
      fact: {
        event: 'triggeredAbility',
        target: { types: { has: ['Equipment'] }, attachedToSelf: true },
        annotations: [equipmentAnnotation],
      },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];
  return { matched: true, facts };
}
