// New recognizer (2026-09-16, card-results/fin-51-75 triage backlog item
// #3 — "no untapTarget-effect-structural recognizer exists"). Structural —
// reads a face's own `kind:'untapTarget'` `Effect[]` directly, same
// `tapTarget-effect-structural.ts`/`putCounterTarget-effect-structural.ts`
// sibling family (`UntapEffect`, `card.ts`'s own real Forge counterpart to
// `TapEffect`).
//
// **Real, whole-pool check — only 2 real `kind:'untapTarget'` occurrences,
// and only ONE is actually reachable by any recognizer at all**:
// `formidable-speaker`'s own `{validType:'any', notSelf:true}` (activated
// ability, "Untap target permanent") has NO real oracle text checked in
// anywhere under `data/*/*_scryfall.json` at all (a cross-set reference
// card, same bucket `apply-recognizers.mjs`'s own loader already skips
// wholesale — confirmed directly, not assumed) — never reaches this
// recognizer, no decline needed for it.
//
// `magic-damper`'s own `{validType:'creature', owner:'you'}` is the one
// real, checked target: "Target creature you control gets +1/+1 and gains
// hexproof until end of turn. Untap it." — a chained PRONOUN reference
// ("it"), not a fresh "untap target X" clause. `putCounterTarget-effect-
// structural.ts`'s own module doc comment already declines this exact
// SHAPE of problem (a target-effect immediately preceded by a `tapTarget`
// effect, "put a counter on it") for lack of a confirmed real template —
// but Magic Damper's own case is a materially STRONGER, structurally
// confirmable signal than that generic caution: its own THREE effects
// (`pumpTarget`, `grantKeywordTarget`, `untapTarget`) all declare the
// IDENTICAL `owner:'you'`/(where applicable) `validType:'creature'` filter,
// and this card's own `definition.ts` module doc comment already states
// this explicitly by hand ("all three pools are identical... `chooseTarget`'s
// own deterministic first-pool-candidate rule lands on the same creature
// every time") — a human-confirmed, not merely plausible, shared-target
// claim. This recognizer therefore accepts the narrower, specifically
// gated case: an `untapTarget` effect immediately preceded, in the SAME
// container, by a `pumpTarget`/`grantKeywordTarget` effect whose own
// `owner` (and, when present, `validType`) is IDENTICAL — never a bare
// "any untapTarget preceded by anything" rule.
//
// **`validType:'attacking'` widened 2026-09-16 (recognizer-lane
// escalation)** — a real, THIRD, genuinely SIMPLER shape: Sage's Nouliths
// (fin/70)'s own granted "Whenever this creature attacks, untap target
// attacking creature" — a plain, standalone "untap target attacking
// creature" clause with no pronoun/chaining at all (unlike Magic Damper's
// own `validType:'creature'` case above, whose own clause is a bare pronoun
// "Untap it"). Handled as a wholly separate, unconditional branch — no
// chaining check applies to `'attacking'` at all, since its own real clause
// already names its target directly, needing no earlier effect to borrow a
// pool from.
//
// **2026-09-16 SOURCE/SINK span-narrowing fix** (systemic-annotation-bug
// audit, `'attacking'` branch only): the sink used to reuse the SOURCE's
// own whole-clause span byte-for-byte (Sage's Nouliths' own sink covered
// the ENTIRE "untap target attacking creature," when the sink only
// actually claims "an attacking creature exists"). `untap` (the bare
// verb) is now its own capturing group (source), "target attacking
// creature" a second, separate one (sink) — same split `tapTarget-
// effect-structural.ts`'s own confirmed fix already establishes for a
// different `tap`-shaped recognizer. The `'creature'` branch (Magic
// Damper's own pronoun-carryover "Untap it") never builds a sink at all
// (`needsSink: false`) — nothing to split there, untouched.
import type { Effect } from '../card';
import type { Constraints } from '../synergy';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { type StructuralRecognizerInput, collectEffects } from './structural-effects';

export type { StructuralRecognizerInput };

const RULE = 'untapTarget-effect-structural' as const;

type UntapTargetEffect = Extract<Effect, { kind: 'untapTarget' }>;

function isUntapTargetEffect(e: Effect): e is UntapTargetEffect {
  return e.kind === 'untapTarget';
}

/** Does the immediately-preceding effect in the SAME container establish
 * the exact same chosen-target pool this untapTarget effect's own
 * `owner`/`validType` describes? See module doc comment — deliberately
 * narrow, never a bare "preceded by anything" rule. */
function chainedFromMatchingTarget(preceding: Effect | undefined, effect: UntapTargetEffect): boolean {
  if (!preceding) return false;
  if (preceding.kind !== 'pumpTarget' && preceding.kind !== 'grantKeywordTarget') return false;
  if (preceding.owner !== effect.owner) return false;
  if ('validType' in preceding && preceding.validType !== undefined && preceding.validType !== effect.validType) return false;
  return true;
}

function containers(input: StructuralRecognizerInput): Effect[][] {
  const list: Effect[][] = [];
  if (input.effects) list.push(input.effects);
  for (const t of input.triggers ?? []) if (t.effects) list.push(t.effects);
  for (const a of input.abilities ?? []) if (a.effects) list.push(a.effects);
  return list;
}

export function recognizeUntapTargetEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const allUntapTargets: Effect[] = [];
  for (const c of containers(input)) collectEffects(c, allUntapTargets);
  const untapTargets = allUntapTargets.filter(isUntapTargetEffect);
  if (untapTargets.length === 0) {
    return { matched: false, reason: "no kind:'untapTarget' Effect on this face" };
  }

  const facts: RecognizedFact[] = [];

  for (const container of containers(input)) {
    for (let i = 0; i < container.length; i++) {
      const effect = container[i]!;
      if (!isUntapTargetEffect(effect)) continue;

      let pattern: RegExp;
      let target: Constraints;
      let controller: 'you' | undefined;
      let needsSink: boolean;
      // Only the `'attacking'` branch's own pattern carries 2 capturing
      // groups (verb/object split, see module doc comment); the
      // `'creature'` branch's own "Untap it" pattern stays a single,
      // unsplit whole-match span (no sink to split it against).
      let hasSplitGroups: boolean;

      if (effect.validType === 'creature') {
        const preceding = i > 0 ? container[i - 1] : undefined;
        if (!chainedFromMatchingTarget(preceding, effect)) {
          return {
            matched: false,
            reason: `an untapTarget effect on this face (${JSON.stringify(effect)}) is not immediately preceded, in the same container, by a pumpTarget/grantKeywordTarget effect declaring the identical owner/validType — no confirmed real English template for this shape (see module doc comment)`,
          };
        }
        pattern = /\bUntap it\b(?=[.\n]|$)/i;
        target = { types: { has: ['Creature'] } };
        controller = 'you';
        needsSink = false;
        hasSplitGroups = false;
      } else if (effect.validType === 'attacking') {
        // Sage's Nouliths' own real, non-chained "untap target attacking
        // creature" — see module doc comment. No `controller` on the
        // SOURCE fact — the real text names no controller restriction at
        // all (any attacking creature, not just "yours"/"an opponent's").
        pattern = /\b(untap) (target attacking creature)\b/i;
        target = { types: { has: ['Creature'] }, attacking: true };
        controller = undefined;
        needsSink = true;
        hasSplitGroups = true;
      } else {
        return { matched: false, reason: `validType:'${effect.validType}' — no confirmed real English template (only 'creature'/'attacking' are confirmed against a real pool card, see module doc comment)` };
      }

      const global = new RegExp(pattern.source, pattern.flags + 'gd');
      const matches = [...input.oracleText.matchAll(global)] as Array<RegExpMatchArray & { indices: Array<[number, number] | undefined> }>;
      if (matches.length !== 1) {
        return {
          matched: false,
          kind: 'mismatch',
          reason: `expected clause /${pattern.source}/ matched ${matches.length} times (want exactly 1) in oracle text "${input.oracleText}"`,
        };
      }
      const m = matches[0]!;
      const [fullStart, fullEnd] = m.indices[0]!;
      const [sourceStart, sourceEnd] = hasSplitGroups ? m.indices[1]! : [fullStart, fullEnd];
      const [sinkStart, sinkEnd] = hasSplitGroups ? m.indices[2]! : [fullStart, fullEnd];
      const sourceAnnotation = toLineOffset(input.oracleText, sourceStart, sourceEnd);
      const sinkAnnotation = toLineOffset(input.oracleText, sinkStart, sinkEnd);
      if (!sourceAnnotation || !sinkAnnotation) {
        return { matched: false, reason: `matched span [${fullStart},${fullEnd}) (or its own inner source/sink split spans) did not resolve to a single real oracle-text line` };
      }

      facts.push({
        role: 'source',
        fact: { event: 'untap', ...(controller ? { controller } : {}), target, targeted: true, annotations: [sourceAnnotation] },
        provenance: { origin: 'parser', rule: RULE },
      });

      if (needsSink) {
        facts.push({
          role: 'sink',
          fact: { to: 'Battlefield', types: { has: ['Creature'] }, attacking: true, annotations: [sinkAnnotation] },
          provenance: { origin: 'parser', rule: RULE },
        });
      }
    }
  }

  return { matched: true, facts };
}
