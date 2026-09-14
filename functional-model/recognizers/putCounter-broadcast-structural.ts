// New recognizer (2026-09-13, promoting `runtime-action-probe.ts`'s own
// `probeBroadcastPutCounter` — see that file's own header — out of
// prototype status into the real `apply-recognizers.mjs` pipeline).
//
// A `kind: 'custom'` effect's own `run` closure is opaque by construction
// (`structural-effects.ts`'s own doc comment — no static recognizer can read
// into it). This recognizer is the one place in this catalog that doesn't
// try to: it EXECUTES the closure against `runtime-action-probe.ts`'s fake
// instrumented board and classifies ONLY the one narrow shape that probe
// recognizes (see its own header) — an unconditional `actions.putCounter`
// broadcast over a subtype-filtered same-side collection, never a chosen
// target. That classification alone isn't enough to safely assert a real
// Fact, though: it tells us WHICH counter type and WHICH type constraint,
// but not where in the card's own printed text this clause lives, or
// whether the classification is even real (as opposed to an artifact of the
// probe's own fixed fake board). So this recognizer ALSO builds the
// expected literal English clause from the probe's own classified output
// and requires it to appear verbatim in the face's own real oracle text —
// same conservative-declining discipline (build-then-verify, decline rather
// than guess) `destroy-effect-structural.ts`/`dealDamage-effect-
// structural.ts` already establish, just with the probe's runtime output
// standing in for a literal `Effect` field as the thing a clause gets built
// from.
//
// **Real, whole-pool check done first**: every real `kind:'custom'` effect
// that calls `actions.putCounter` at all (18 real occurrences, checked
// individually against `probeBroadcastPutCounter`) — only 3 classify as a
// genuine unconditional broadcast (the rest either call
// `actions.chooseTarget` first — a chosen-target shape, correctly out of
// the probe's own scope — or never call `putCounter` against this probe's
// own fake board at all, or crash safely and decline):
//   - Aerith Gainsborough (`onDies`): "put X +1/+1 counters on each
//     legendary creature you control" — classified `target.types.has:
//     ['Creature','Legendary']`.
//   - Dion, Bahamut's Dominant's own back face (Bahamut, Warden of Light),
//     chapters I+II (same real shared Saga line, "repeats, not a typo"):
//     "Put a +1/+1 counter on each OTHER creature you control" — classified
//     `target.types.has: ['Creature']` (no subtype — the probe's own
//     touched-vs-untouched induction correctly does NOT invent an "Elf" or
//     "Legendary" narrowing here, since neither is uniformly true of every
//     touched candidate in its fixture).
//   - The Crystal's Chosen: "put a +1/+1 counter on each creature you
//     control" (no "other" — this effect does NOT exclude itself, since
//     it's a Sorcery, not a permanent, so there's no `self` creature on the
//     battlefield to exclude in the first place) — classified
//     `target.types.has: ['Creature']`.
//
// **The "other" vs. plain wording is a real, closed, two-way English
// variation this recognizer tries BOTH forms of, rather than guessing
// which** — the probe's own classified `target.types.has` alone can't tell
// these apart (Dion's own closure explicitly filters `c.getId() !==
// ctx.self.getId()`; The Crystal's Chosen's closure has no such filter at
// all, and its own fixture-`self` was never a real candidate anyway since
// it's a Sorcery — the probe has no notion of "would self have qualified
// had it been a permanent"). Both real cases above are individually
// confirmed against their own printed text; requiring the built pattern to
// match EXACTLY ONE of the two variants (never both, never neither) is what
// keeps this decline-safe rather than a guess.
import type { Effect } from '../card';
import type { Constraints } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, type StructuralRecognizerInput } from './structural-effects';
import { probeBroadcastPutCounter } from './runtime-action-probe';

const RULE = 'putCounter-broadcast-structural' as const;

export type { StructuralRecognizerInput };

type CustomEffect = Extract<Effect, { kind: 'custom' }>;

function isCustomEffect(e: Effect): e is CustomEffect {
  return e.kind === 'custom';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Builds BOTH real candidate clauses for one classified broadcast — see
 * module doc comment for why both are tried rather than one guessed. The
 * quantifier between "put" and the counter type (`a`/`an`/a literal
 * number/`X`) is deliberately matched as a single wildcard token
 * (`\S+`) rather than anchored to a specific word: unlike `destroy`'s own
 * literal `qty`, this recognizer's own asserted Fact carries no magnitude at
 * all (a fixed `value: 1` placeholder, same as every other recognizer in
 * this catalog — see `dealDamage-effect-structural.ts`'s own doc comment for
 * the identical reasoning applied to a different Effect kind), so there is
 * nothing to lose by not pinning the quantifier word down. */
function buildPatterns(counterType: string, typeWord: string): RegExp[] {
  const ct = escapeRegExp(counterType);
  const tw = escapeRegExp(typeWord);
  return [
    new RegExp(`\\bput \\S+ ${ct} counters? on each other ${tw} you control\\b`, 'i'),
    new RegExp(`\\bput \\S+ ${ct} counters? on each ${tw} you control\\b`, 'i'),
  ];
}

/**
 * Reads one face's own structured `effects`/`triggers`/`abilities` for every
 * `kind:'custom'` effect, runs `probeBroadcastPutCounter` against each one's
 * own `run` closure, and — for every effect the probe classifies as a
 * genuine unconditional broadcast — requires ITS OWN built clause (see
 * `buildPatterns`) to appear verbatim, exactly once (across BOTH candidate
 * phrasings combined), in this face's own real oracle text.
 *
 * **All-or-nothing only among PROBE-CLASSIFIED effects, not every
 * `kind:'custom'` effect on the face** — an effect the probe doesn't
 * classify at all (a chosen-target shape, no `putCounter` call, a crash) is
 * silently out of THIS recognizer's own scope and skipped, same as
 * `destroy-effect-structural.ts` silently skips a non-`destroy` Effect
 * before its own all-or-nothing loop even starts; but once the probe HAS
 * classified an effect, that effect's own text-match is required to
 * succeed, or the WHOLE face declines (mismatch) — a probe classification
 * with no matching real text is a genuine divergence (a bug in this
 * recognizer's own template, or a probe false-positive), not something to
 * silently swallow.
 *
 * **A supported constraint shape is deliberately narrow**: only 0 or 1
 * subtype beyond the probe's own baseline `'Creature'` (a 2+-subtype
 * classification has no confirmed, checked real English adjective-ordering
 * template — same "no real card to verify plural/compound templating
 * against" restraint `destroy-effect-structural.ts`'s own `qty!==1` decline
 * already establishes for a different field).
 */
export function recognizePutCounterBroadcastStructural(input: StructuralRecognizerInput): RecognizerResult {
  const customEffects = allEffects(input).filter(isCustomEffect);
  if (customEffects.length === 0) {
    return { matched: false, reason: 'no kind:"custom" Effect on this face' };
  }

  const facts: RecognizedFact[] = [];
  let anyClassified = false;

  for (const effect of customEffects) {
    if (typeof effect.run !== 'function') continue;
    const result = probeBroadcastPutCounter(effect.run, { selfCounters: { '+1/+1': 2 } });
    if (!result.classified) continue; // out of this recognizer's own scope — see doc comment
    anyClassified = true;

    const extraSubtypes = result.fact.target.types.has.filter((t) => t !== 'Creature');
    if (extraSubtypes.length > 1) {
      return {
        matched: false,
        reason: `probe classified ${extraSubtypes.length} extra subtype constraints (${extraSubtypes.join(', ')}) on this face's own custom effect — no confirmed multi-adjective English template`,
      };
    }
    const typeWord = extraSubtypes.length === 1 ? `${extraSubtypes[0]!.toLowerCase()} creature` : 'creature';

    const patterns = buildPatterns(result.fact.counterType, typeWord);
    let matches: RegExpMatchArray[] = [];
    for (const pattern of patterns) {
      const global = new RegExp(pattern.source, pattern.flags + 'g');
      matches = matches.concat([...input.oracleText.matchAll(global)]);
    }
    if (matches.length === 0) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `probe classified a "${result.fact.counterType}" broadcast onto "${typeWord}" but neither the "each ${typeWord}"/"each other ${typeWord}" clause appears verbatim in oracle text "${input.oracleText}"`,
      };
    }
    if (matches.length > 1) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `${matches.length} candidate clauses matched across the "other"/plain phrasing variants — ambiguous, declining rather than guessing which`,
      };
    }

    const m = matches[0]!;
    const start = m.index!;
    const end = start + m[0]!.length;
    const annotation = toLineOffset(input.oracleText, start, end);
    if (!annotation) {
      return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
    }

    const target: Constraints = result.fact.target;
    facts.push({
      role: 'source',
      fact: { event: 'putCounter', counterType: result.fact.counterType, controller: 'you', target, targeted: false, value: 1, annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
    // Paired "wants this present" sink — same real convention
    // `dealDamage-effect-structural.ts`'s own tier-2 sink and this pool's
    // established `mirroredPresenceSinks`-style pairing already use: a
    // produce fact whose `target` is a positive type list implies a real
    // "wants this present" want, anchored at the SAME real clause (there is
    // no narrower, separately-anchorable span for "what it wants present"
    // than the clause that both creates the counter AND names its own
    // target bucket).
    facts.push({
      role: 'sink',
      fact: { to: 'Battlefield', controller: 'you', types: target.types!, value: 1, annotations: [annotation] },
      provenance: { origin: 'parser', rule: RULE },
    });
  }

  if (!anyClassified) {
    return { matched: false, reason: 'no custom effect on this face was classified as an unconditional putCounter broadcast by the action probe' };
  }
  return { matched: true, facts };
}
