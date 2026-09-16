// New recognizer (2026-09-14, mechanization pass — fin/7 gap closure) —
// structural, same family as `putCounterTarget-effect-structural.ts`: reads a
// `kind:'dig'` `Effect` (`card.ts`: `{ kind:'dig'; qty: Computed<number>;
// take: Computed<number>; validType?: 'artifact' | 'any'; optional?:
// boolean }`) straight off `CardDefinition`, then requires a built clause to
// appear verbatim in this face's own real oracle text before asserting
// anything.
//
// **Real, whole-pool check done first** — grepped every real
// `kind: 'dig'` `Effect` across `functional-model/cards/*/definition.ts` (6
// real occurrences, 6 distinct cards) and read each one's own real Scryfall
// oracle text directly:
//   - **Ashe, Princess of Dalmasca** (`qty:5, take:1, validType:'artifact',
//     optional:true`) — "look at the top five cards of your library. You may
//     reveal an artifact card from among them and put it into your hand. Put
//     the rest on the bottom of your library in a random order." — the ONE
//     real, clean, matched template this recognizer models.
//   - **Commune with Beavers** (`qty:3, take:1, validType:'any', optional:
//     true`) — real text: "You may reveal an ARTIFACT, CREATURE, OR LAND
//     card from among them" — this card's own `definition.ts` comment
//     already documents `validType:'any'` here as a known, deliberate
//     OVER-broadening (no combined 3-way type predicate exists on `dig`'s own
//     `validType` union) — a recognizer keyed on `validType:'any'` building
//     "reveal a card" would NOT verbatim-match this card's own real,
//     narrower-worded "reveal an artifact, creature, or land card" clause.
//     Declined at the SCOPE stage (`validType:'any'` has no single confirmed
//     real English rendering — it can mean either a genuinely unrestricted
//     reveal OR, as here, an approximation of a real multi-type disjunction
//     the structured field can't distinguish).
//   - **Esper Origins // Summon: Esper Maduin's own Saga chapter I**
//     (`qty:1, take:1, validType:'any'`, no `optional`) — real text: "Reveal
//     the top card of your library. If it's a permanent card, put it into
//     your hand." — no "You may"/`optional` at all (an unconditional reveal
//     with a CONDITIONAL put, not a player choice), and this card's own
//     comment documents the identical `validType:'any'`-approximates-
//     "permanent card" gap as Commune with Beavers. Declined (no `optional:
//     true`, AND `validType:'any'` per the same reasoning above).
//   - **Dark Confidant** (`qty:1, take:1`, no `validType`/`optional` at all)
//     — real text: "reveal the top card of your library and put THAT CARD
//     into your hand" — no "may," no type restriction at all, structurally
//     out of scope (no `validType` to build a type-word clause from).
//   - **Memories, Returning** (`qty:5, take:3`, no `validType`/`optional`) —
//     real text has no "reveal"/"You may" wording anywhere (its own
//     `definition.ts` comment: models a real 4-step alternating-choice `DB$
//     Dig` chain as one net `dig(5,3)`) — structurally out of scope, same
//     reason as Dark Confidant.
//   - **Choco, Seeker of Paradise** — `qty` is a `Computed<number>` closure
//     (a trigger-fixed "that many," the number of attacking Birds), no
//     `validType` at all — structurally out of scope (non-literal qty).
//
// This confirms `validType: 'artifact'` (a single, clean, unqualified type
// word — never combined with a real multi-type disjunction or a documented
// approximation) is the one real, safely-generalizable shape in this pool
// today; every other real occurrence is either non-literal, has no
// `optional`/type restriction at all, or is a confirmed `validType:'any'`
// approximation of something narrower/broader than "any card" — declined
// rather than guessed.
//
// **Two facts, mirroring Ashe's own real, pre-existing hand-authored pair
// byte-for-byte**: the SOURCE (the real "reveal ... and put it into your
// hand" clause) and the paired SINK (the narrower "reveal a[n] <type> card"
// precondition it's keyed on — a "wants a matching card somewhere in the
// library" want, same shape `putCounterTarget-effect-structural.ts`'s own
// paired sink already establishes for a different Effect kind), each
// anchored to its own real, independently-verified sub-span.
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

const RULE = 'digReveal-effect-structural' as const;

export type { StructuralRecognizerInput };

type DigEffect = Extract<Effect, { kind: 'dig' }>;

function isDigEffect(e: Effect): e is DigEffect {
  return e.kind === 'dig';
}

/** `validType` -> the one type word this recognizer has a confirmed real
 * English template for — only `'artifact'` (see module doc comment for why
 * `'any'` is deliberately never attempted here: every real `'any'` card in
 * this pool is a confirmed approximation of something narrower/differently
 * worded, not a genuine "reveal a card" clause). */
function typeWordFor(validType: DigEffect['validType']): string | undefined {
  return validType === 'artifact' ? 'artifact' : undefined;
}

export function recognizeDigRevealEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const candidates = allEffects(input).map((o) => o.effect).filter(isDigEffect);
  if (candidates.length === 0) {
    return { matched: false, reason: 'no kind:"dig" Effect on this face' };
  }

  const facts: RecognizedFact[] = [];
  let anyEligible = false;
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);

  for (const effect of candidates) {
    const typeWord = typeWordFor(effect.validType);
    if (!typeWord || effect.optional !== true || effect.take !== 1) {
      continue; // structurally out of scope — see module doc comment; never a 'mismatch'
    }
    anyEligible = true;
    const triggeredBy = triggeredByOf(effectSource.get(effect));

    const sinkPattern = new RegExp(`\\breveal an ${typeWord} card\\b`, 'i');
    const sourcePattern = new RegExp(`\\breveal an ${typeWord} card from among them and put it into your hand\\b`, 'i');

    const sinkMatches = [...input.oracleText.matchAll(new RegExp(sinkPattern.source, sinkPattern.flags + 'g'))];
    if (sinkMatches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${sinkPattern.source}/ matched ${sinkMatches.length} times (expected exactly 1) in oracle text "${input.oracleText}"`,
      };
    }
    const sourceMatches = [...input.oracleText.matchAll(new RegExp(sourcePattern.source, sourcePattern.flags + 'g'))];
    if (sourceMatches.length !== 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${sourcePattern.source}/ matched ${sourceMatches.length} times (expected exactly 1) in oracle text "${input.oracleText}"`,
      };
    }

    const sinkMatch = sinkMatches[0]!;
    const sinkAnnotation = toLineOffset(input.oracleText, sinkMatch.index!, sinkMatch.index! + sinkMatch[0]!.length);
    const sourceMatch = sourceMatches[0]!;
    const sourceAnnotation = toLineOffset(input.oracleText, sourceMatch.index!, sourceMatch.index! + sourceMatch[0]!.length);
    if (!sinkAnnotation || !sourceAnnotation) {
      return { matched: false, reason: 'matched span did not resolve to a single real oracle-text line' };
    }

    const typeWordCap = typeWord[0]!.toUpperCase() + typeWord.slice(1);
    facts.push({
      role: 'source',
      fact: { to: 'Hand', from: 'Library', controller: 'you', types: { has: [typeWordCap] }, annotations: [sourceAnnotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: { to: 'Library', controller: 'you', types: { has: [typeWordCap] }, annotations: [sinkAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  if (!anyEligible) {
    return {
      matched: false,
      reason: 'every kind:"dig" Effect on this face was structurally out of scope (no confirmed validType template, not optional, or take !== 1)',
    };
  }
  return { matched: true, facts };
}
