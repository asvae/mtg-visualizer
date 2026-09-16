// New recognizer (2026-09-16, card-results/fin-76-100 re-triage backlog
// item #3) — structural (`Effect[]`-reading, same family as `destroy-
// effect-structural.ts`/`drawCard-effect-structural.ts`), covering `card
// .ts`'s own `kind:'mill'` Effect: `{ kind: 'mill'; owner: EffectOwner;
// amount: Computed<number> }` (real CR 701.14/`GameState.mill`, added
// alongside `millModifierGrants` — ENGINE_GAPS.md gap #19, closed — see
// this recognizer's own sibling `millModifierGrants-structural.ts` for the
// adjacent CARD-DEFINITION-LEVEL field this card also has).
//
// **Real, whole-pool check**: `the-water-crystal` is the ONLY real card
// using `kind:'mill'` today ("{4}{U}{U}, {T}: Each opponent mills cards
// equal to the number of cards in your hand" — real Forge `A:AB$ Mill |
// ... | NumCards$ Y | SVar:Y:Count$ValidHand Card.YouOwn`), with a
// non-literal (`Computed<number>`) amount — no real card anywhere in this
// pool has a LITERAL mill amount, so this recognizer only builds the ONE
// confirmed magnitude template below; a literal-amount `kind:'mill'`
// effect declines (scope) rather than guessing at an unconfirmed "mill N
// cards" phrasing.
//
// **The one confirmed magnitude template**: "<subject> mill(s) cards equal
// to the number of cards in your hand" — `owner` maps to the subject
// phrase the same way `loseLife-effect-structural.ts`'s own `controllerFor`
// helper already does for a different Effect kind (`'you'` → "you mill",
// `'opponents'` → "each opponent mills", `'each'` → "each player mills" —
// only `'opponents'` has a real confirmed card; the other two are the same
// real English CR-templating convention, kept for when a future card needs
// them, same "grow the vocabulary, not the guess" discipline as every other
// small closed-vocabulary recognizer in this catalog). This recognizer
// never asserts anything about a DIFFERENT magnitude source (a future
// "mill cards equal to the number of lands you control," say) — that would
// need its own confirmed template, not a blind stretch of this one; an
// unconfirmed magnitude clause simply doesn't match this pattern and
// declines (scope), same "0 matches = scope, 2+ matches = mismatch"
// discipline `putCounterMagnitude-clause-structural.ts`'s own pure-text
// recognizer already establishes for an analogously un-guessable
// `Computed<number>` magnitude.
//
// Fact shape: matches `the-water-crystal`'s own PRE-EXISTING hand-authored
// facts exactly — SOURCE `{event:'mill', from:'Library', to:'Graveyard',
// controller}` (real zone movement CR 701.14, library→graveyard, the same
// `from`/`to` pair a `move` Effect would use), paired with a SINK
// `{to:'Hand', controller:'you'}` for the magnitude's own real aggregate
// read (your own hand size) — same "one real clause names both what
// happens and what it wants present" convention `putCounter-broadcast-
// structural.ts`/`ptFormula-scalingPump-structural.ts` already establish.
import type { Effect, EffectOwner } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'mill-effect-structural' as const;

type MillEffect = Extract<Effect, { kind: 'mill' }>;

function isMillEffect(e: Effect): e is MillEffect {
  return e.kind === 'mill';
}

function controllerFor(owner: EffectOwner): 'you' | 'opp' {
  return owner === 'you' ? 'you' : owner === 'opponents' ? 'opp' : 'you';
}

function subjectPhraseFor(owner: EffectOwner): string {
  if (owner === 'you') return 'you mill';
  if (owner === 'opponents') return 'each opponent mills';
  return 'each player mills';
}

const MAGNITUDE_PHRASE = 'the number of cards in your hand';

export function recognizeMillEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const millEffects = allEffects(input).map((o) => o.effect).filter(isMillEffect);
  if (millEffects.length === 0) {
    return { matched: false, reason: "no kind:'mill' Effect on this face" };
  }

  const facts: RecognizedFact[] = [];
  let anyEligible = false;
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);

  for (const effect of millEffects) {
    if (typeof effect.amount === 'number') {
      continue; // no confirmed real English template for a literal mill amount yet — see module doc comment
    }
    anyEligible = true;
    const triggeredBy = triggeredByOf(effectSource.get(effect));

    const pattern = new RegExp(`\\b${subjectPhraseFor(effect.owner)} cards equal to (${MAGNITUDE_PHRASE})\\b`, 'i');
    const global = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(global)];
    if (matches.length === 0) {
      return { matched: false, reason: `no confirmed "${pattern.source}" clause found in oracle text "${input.oracleText}"` };
    }
    if (matches.length > 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected clause /${pattern.source}/ matched ${matches.length} times — ambiguous, declining rather than guessing which`,
      };
    }

    const m = matches[0]!;
    const clauseStart = m.index!;
    const clauseEnd = clauseStart + m[0]!.length;
    const clauseAnnotation = toLineOffset(input.oracleText, clauseStart, clauseEnd);
    if (!clauseAnnotation) {
      return { matched: false, reason: `matched span [${clauseStart},${clauseEnd}) did not resolve to a single real oracle-text line` };
    }

    const group = m[1]!;
    const groupStart = clauseStart + m[0]!.lastIndexOf(group);
    const groupEnd = groupStart + group.length;
    const groupAnnotation = toLineOffset(input.oracleText, groupStart, groupEnd);
    if (!groupAnnotation) {
      return { matched: false, reason: `matched span [${groupStart},${groupEnd}) did not resolve to a single real oracle-text line` };
    }

    facts.push({
      role: 'source',
      fact: { event: 'mill', from: 'Library', to: 'Graveyard', controller: controllerFor(effect.owner), annotations: [clauseAnnotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: { to: 'Hand', controller: 'you', annotations: [groupAnnotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  if (!anyEligible) {
    return { matched: false, reason: 'every kind:"mill" Effect on this face has a literal amount — no confirmed real English template for that shape yet' };
  }
  return { matched: true, facts };
}
