// New recognizer (2026-09-14, mechanization pass — fin/9 gap closure) —
// structural, same family as `dealDamage-effect-structural.ts`/`drawCard-
// effect-structural.ts`: reads a `kind:'gainLife'` `Effect` (`card.ts`:
// `{ kind: 'gainLife'; amount: Computed<number> }`) straight off
// `CardDefinition` (`structural-effects.ts`'s shared `allEffects` walker),
// then requires a built clause to appear verbatim in this face's own real
// oracle text before asserting anything.
//
// **Real, whole-pool check done first** — grepped every real
// `kind: 'gainLife'` `Effect` across `functional-model/cards/*/
// definition.ts` (14 real occurrences) and read each one's own real
// Scryfall oracle text directly:
//   - **Matched real clean templates, literal number immediately adjacent to
//     both "gain" and "life"** ("[Yy]ou gain <N> life"): Battle Menu ("You
//     gain 4 life"), Adventurer's Inn ("you gain 2 life"), Balamb, T-Rexaur
//     ("you gain 3 life"), Restoration Magic (both its Cura/Curaga modes,
//     "You gain 3 life"/"You gain 6 life" — two literal DIFFERENT amounts on
//     the same face, each anchored to its own real line, no ambiguity),
//     Exdeath, Void Warlock ("you gain 3 life"), Sephiroth, Fabled Soldier //
//     Sephiroth, One-Winged Angel (both of its own two `gainLife` effects,
//     "you gain 1 life" each, on two different real lines), Al Bhed
//     Salvagers ("you gain 1 life" — the same real clause also contains an
//     unrelated `loseLife` effect's own "loses 1 life" immediately before
//     it; this recognizer's own tight, non-greedy pattern only ever matches
//     "gain 1 life", never the "loses" clause), Instant Ramen ("You gain 3
//     life"), Sephiroth's Intervention ("You gain 2 life"), Shinra
//     Reinforcements ("you gain 3 life"), Esper Origins ("You gain 2 life").
//   - **Structurally out of scope (declined at the SCOPE stage, before any
//     regex is even built)**: Omega, Heartless Evolution's own `amount:
//     (ctx) => ...` — a `Computed<number>` closure ("you gain X life, where X
//     is the number of nonbasic lands you control"), no literal number to
//     build a clause from at all.
//
// Every real match found is the caster's own life total ("you gain" —
// this Effect kind has no `owner`/`target` field at all, matching every real
// pool card's own printed wording, none of which ever grants life to anyone
// but the caster/controller) — `{event:'lifegain', controller:'you'}`, same
// shape the pool's own pre-existing hand-authored `lifegain` facts already
// use (including this recognizer's own sibling, `lifegain-trigger-
// structural.ts`'s "Whenever you gain life," SINK — a different real clause
// entirely, never in conflict: that one is the trigger PRECONDITION for a
// card that cares about OTHER lifegain; this one is the SOURCE fact for a
// card's own gainLife effect actually firing).
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, type StructuralRecognizerInput } from './structural-effects';

const RULE = 'gainLife-effect-structural' as const;

export type { StructuralRecognizerInput };

type GainLifeEffect = Extract<Effect, { kind: 'gainLife' }>;

function isGainLifeEffect(e: Effect): e is GainLifeEffect {
  return e.kind === 'gainLife';
}

/** "[Yy]ou gain <amount> life" — tight, immediately-adjacent (no gap at all,
 * unlike `putCounterSelf-effect-structural.ts`'s own bounded quantity-phrase
 * gap) — every real match found in the whole-pool check above has "gain"
 * directly followed by the literal number directly followed by "life," with
 * nothing in between (not even "a"/"an", since this is always a numeric
 * amount, never a single indefinite-article quantity the way a counter's
 * own "a counter" can be). The leading "you" is REQUIRED (not just a loose
 * "gain N life" scan) — every real match in this pool is the caster's own
 * lifegain, and including "you" matches the existing hand-authored
 * annotation convention (`battle-menu`'s own pre-existing span starts at
 * "You," not "gain"). */
function buildPattern(amount: number): RegExp {
  return new RegExp(`\\byou gain\\s+${amount}\\s+life\\b`, 'i');
}

export function recognizeGainLifeEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const candidates = allEffects(input).filter(isGainLifeEffect);
  if (candidates.length === 0) {
    return { matched: false, reason: 'no kind:"gainLife" Effect on this face' };
  }

  const facts: RecognizedFact[] = [];
  let anyEligible = false;

  for (const effect of candidates) {
    if (typeof effect.amount !== 'number') {
      continue; // Computed<number> closure — opaque, can't read without executing it; never a 'mismatch'
    }
    anyEligible = true;

    const pattern = buildPattern(effect.amount);
    const global = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(global)];
    if (matches.length === 0) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ not found (verbatim) in oracle text "${input.oracleText}"`,
      };
    }
    if (matches.length > 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ matched ${matches.length} times — ambiguous, declining rather than guessing which`,
      };
    }

    const m = matches[0]!;
    const start = m.index!;
    const end = start + m[0]!.length;
    const annotation = toLineOffset(input.oracleText, start, end);
    if (!annotation) {
      return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
    }

    facts.push({
      role: 'source',
      fact: { event: 'lifegain', controller: 'you', annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  if (!anyEligible) {
    return { matched: false, reason: 'every kind:"gainLife" Effect on this face was structurally out of scope (non-literal Computed<number> amount)' };
  }
  return { matched: true, facts };
}
