// New recognizer (2026-09-14, fact-parity pass — ENGINE_GAPS.md's own
// "Counter-conditional continuous effects" closure, Ultima, Origin of
// Oblivion's own `onTapLandForC` trigger) — structural, same family as
// `dealDamage-effect-structural.ts`: reads a `kind:'addMana'` `Effect`
// straight off `CardDefinition` (`structural-effects.ts`'s shared
// `collectEffects` walker), requires a built clause to appear verbatim in
// this face's own real oracle text, and asserts the SAME real
// `{event:'addMana', ...}` Fact shape every existing hand-authored one in
// this pool already uses.
//
// **Real, whole-pool check done first** — grepped every real
// `kind:'addMana'` `Effect` across `functional-model/cards/*/definition.ts`
// (4 occurrences): Cargo Ship ("{T}: Add {C}. Spend this mana only to..."),
// Ether ("{T}, Exile this artifact: Add {U}. When you next cast..."), Ultima,
// Origin of Oblivion ("Whenever you tap a land for {C}, add an additional
// {C}."), Elvish Archdruid ("{T}: Add {G} for each Elf you control." — a
// cross-set reference card with no `data/*/*_scryfall.json` entry at all;
// `apply-recognizers.mjs` already skips any card with no real oracle text
// found, same as every other recognizer here, so this one is never actually
// exercised against it. Its own pre-existing `synergy.json` also predates
// this pool's `colors: {has:[...]}` convention (a bare legacy `color: 'G'`
// field) — untouched either way).
//
// **Clause shape, deliberately loose** — real printed templates found across
// the 3 real in-scope cards are genuinely different phrasings ("Add {C}.",
// "Add {U}.", "add an additional {C}.") sharing only two anchors: the word
// "add" and the produced color's own mana symbol, `{<color>}`, somewhere
// after it on the same line — same "only anchor what's actually confirmed
// common, leave everything between loose" discipline `dealDamage-effect-
// structural.ts`'s own module doc comment documents for a similar real
// heterogeneity.
//
// **Paired SINK fact, deliberately narrow scope** — a plain `addMana` Effect
// has no real "what does this want present" pairing in this pool (Cargo
// Ship/Ether's own mana abilities are unconditional once activated; neither
// has ever carried a sink fact for it, checked). The ONE real exception is
// Ultima's own `onTapLandForC` trigger: `Trigger.on: 'tapLandForMana'` +
// `Trigger.tapLandForManaColor` (ENGINE_GAPS.md gap #3(d), closed
// 2026-09-14) is real, closed, structural vocabulary for "this trigger only
// fires off a LAND you control being tapped for THIS color" — exactly the
// real want Ultima's own former `CardDefinition.authoredFacts` tier-3 entry
// asserted by hand (see that field's own now-removed comment on this card).
// Retired the same way Ashe, Princess of Dalmasca's own `authoredFacts`
// escape hatch was retired once `Trigger.on: 'attacks'` made it real
// (ENGINE_GAPS.md gap #22) — this recognizer walks `input.triggers` directly
// (not the flattened `allEffects`) specifically to reach this pairing, gated
// on the trigger's own `tapLandForManaColor` agreeing with the addMana
// effect's own `color` (never asserted from `on: 'tapLandForMana'` alone —
// a mismatched color would be a genuinely different, unconfirmed claim).
// **Real, deliberately NOT generalized further**: no other real FIN card
// uses `on: 'tapLandForMana'` at all today (checked) — this pairing is
// honest, closed-vocabulary-driven engine mechanism, not Ultima-specific
// hardcoding, but it's only ever exercised by this one card until a second
// real card needs it.
import type { CardDefinition, Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, collectEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

const RULE = 'addMana-effect-structural' as const;

export type { StructuralRecognizerInput };

type AddManaEffect = Extract<Effect, { kind: 'addMana' }>;

function isAddManaEffect(e: Effect): e is AddManaEffect {
  return e.kind === 'addMana';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "add ... {<color>}" — same non-greedy, newline-excluded `[^\n]*?`
 * convention every recognizer in this catalog uses between anchors; never
 * anchors the AMOUNT (a literal "an additional," "for each Elf you
 * control," or nothing at all) since this Fact carries no magnitude, same
 * reasoning `dealDamage-effect-structural.ts`'s own module doc comment
 * documents for a different Effect kind. */
function buildPattern(color: string): RegExp {
  return new RegExp(`\\badd\\b[^\\n]*?\\{${escapeRegExp(color)}\\}`, 'i');
}

/** "whenever ... tap ... land ... {<color>}" — the printed TRIGGER CONDITION
 * clause for a real `Trigger.on: 'tapLandForMana'` (Forge's own `TapsForMana`
 * trigger mode, e.g. Ultima, Origin of Oblivion's own real oracle line,
 * "Whenever you tap a land for {C}, add an additional {C}."), never the
 * consequence clause after the comma — that's the SOURCE `addMana` Effect's
 * own clause, already matched by `buildPattern` above. This is what the
 * paired SINK fact (below) actually represents: "this card depends on a land
 * you control being tapped for this color," which is what the trigger
 * CONDITION describes, not what the trigger's own consequence produces. Same
 * non-greedy `[^\n]*?` convention as `buildPattern`; stops at the first
 * `{<color>}` on the line, which is exactly the condition's own mana symbol
 * (the consequence's later `{<color>}`, if the same color, sits further
 * right and is never reached since the match isn't global here). */
function buildTriggerConditionPattern(color: string): RegExp {
  return new RegExp(`\\bwhenever\\b[^\\n]*?\\btap\\b[^\\n]*?\\bland\\b[^\\n]*?\\{${escapeRegExp(color)}\\}`, 'i');
}

/**
 * Same `pattern`, but excludes any match sitting inside a double-quoted
 * span of ITS OWN line — real, necessary for Ultima, Origin of Oblivion's
 * own face: its `onAttack` trigger's continuous grant clause prints the
 * GRANTED ability's own text verbatim, in quotes, as part of a DIFFERENT
 * effect's description ("...has \"{T}: Add {C}.\""), which textually
 * collides with this face's OWN real `addMana` trigger clause ("add an
 * additional {C}.") a few words later on the FOLLOWING line — confirmed via
 * this recognizer's own pool-wide run (2 raw matches, ambiguous, before this
 * filter existed). A quoted reminder of a granted ability's own printed
 * text is never itself a real, independently-modeled `addMana` Effect on
 * THIS card, so excluding anything inside quotes is a general, reusable
 * disambiguation — not an Ultima-specific carve-out — for any future card
 * whose own printed text quotes a granted ability containing the identical
 * mana symbol.
 */
function matchesOutsideQuotes(oracleText: string, pattern: RegExp): RegExpMatchArray[] {
  const lines = oracleText.split('\n');
  const results: RegExpMatchArray[] = [];
  let base = 0;
  for (const line of lines) {
    const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    for (const m of line.matchAll(global)) {
      const before = line.slice(0, m.index!);
      const quoteCount = (before.match(/"/g) ?? []).length;
      if (quoteCount % 2 === 0) {
        const absolute = [...m] as unknown as RegExpMatchArray;
        absolute.index = base + m.index!;
        results.push(absolute);
      }
    }
    base += line.length + 1; // +1 for the '\n' split() consumed
  }
  return results;
}

export function recognizeAddManaEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const effects = allEffects(input).map((o) => o.effect).filter(isAddManaEffect);
  if (effects.length === 0) {
    return { matched: false, reason: 'no kind:"addMana" Effect on this face' };
  }

  const facts: RecognizedFact[] = [];
  const annotationByEffect = new Map<AddManaEffect, ReturnType<typeof toLineOffset>>();
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);

  for (const effect of effects) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    const pattern = buildPattern(effect.color);
    const matches = matchesOutsideQuotes(input.oracleText, pattern);
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
    annotationByEffect.set(effect, annotation);

    facts.push({
      role: 'source',
      fact: { event: 'addMana', colors: { has: [effect.color] }, controller: 'you', annotations: [annotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  // Paired SINK, narrowly scoped to a real `on: 'tapLandForMana'` trigger —
  // see module doc comment. Anchored on the TRIGGER'S OWN condition clause
  // ("Whenever you tap a land for {C}"), never the source fact's own
  // consequence-clause annotation — the sink represents what this trigger
  // DEPENDS ON (a land being tapped for this color), which is what the
  // condition clause describes, not what the consequence produces.
  for (const trigger of input.triggers ?? []) {
    if (trigger.on !== 'tapLandForMana' || !trigger.tapLandForManaColor) continue;
    const triggerEffects: Effect[] = [];
    collectEffects(trigger.effects, triggerEffects);
    const pairedEffects = triggerEffects.filter(isAddManaEffect).filter((effect) => effect.color === trigger.tapLandForManaColor);
    if (pairedEffects.length === 0) continue;

    const conditionPattern = buildTriggerConditionPattern(trigger.tapLandForManaColor);
    const conditionMatches = matchesOutsideQuotes(input.oracleText, conditionPattern);
    if (conditionMatches.length === 0) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected trigger-condition clause /${conditionPattern.source}/ not found (verbatim) in oracle text "${input.oracleText}"`,
      };
    }
    if (conditionMatches.length > 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `expected trigger-condition clause /${conditionPattern.source}/ matched ${conditionMatches.length} times — ambiguous, declining rather than guessing which`,
      };
    }
    const cm = conditionMatches[0]!;
    const conditionStart = cm.index!;
    const conditionEnd = conditionStart + cm[0]!.length;
    const conditionAnnotation = toLineOffset(input.oracleText, conditionStart, conditionEnd);
    if (!conditionAnnotation) {
      return {
        matched: false,
        reason: `trigger-condition span [${conditionStart},${conditionEnd}) did not resolve to a single real oracle-text line`,
      };
    }

    for (const effect of pairedEffects) {
      if (!annotationByEffect.has(effect)) continue; // this effect's own source match failed/was skipped above — nothing to pair
      facts.push({
        role: 'sink',
        fact: {
          event: 'addMana',
          colors: { has: [effect.color] },
          controller: 'you',
          types: { has: ['Land'] },
          annotations: [conditionAnnotation],
        },
        provenance: { origin: 'parser', rule: RULE },
      });
    }
  }

  return { matched: true, facts };
}
