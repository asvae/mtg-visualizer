// New recognizer (2026-09-15, fin/16-25 pass) — structural, sibling of
// `crewCost-structural.ts` (same real Vehicle-card family): reads
// `kind:'animate', target:'self', types` effects that grant the Creature
// type — real CR 205.3g/301.5b "this permanent is an artifact creature
// until end of turn," Forge's own implicit crew-makes-it-a-creature rule
// (`the-lunar-whale`'s own `definition.ts` comment: "Forge's own bare
// `K:Crew:1` implicitly makes the Vehicle an artifact creature when
// crewed, no separate scripted SVar anywhere in the real card file").
//
// **Real, whole-pool check**: grepped every real `kind:'animate', target:
// 'self'` effect whose own `types` includes `'Creature'` — 7 real
// occurrences across 6 real cards (`the-prima-vista` has TWO: one on its
// own Crew ability, one on a separate "casts a noncreature spell" trigger).
//
// **Two real anchor shapes, tried in order**:
//   1. An explicit "becomes a[n] <word> creature until end of turn" clause
//      — 6 of 7 real occurrences (`magitek-armor`/`cargo-ship`/
//      `sidequest-card-collection-magicked-card`(back)/`the-prima-vista`
//      (both) — the Crew-reminder-text cards from `crewCost-structural.ts`'s
//      own doc comment, PLUS `the-prima-vista`'s own second, non-Crew
//      trigger clause, which prints this same phrase independently). Each
//      qualifying effect claims its own unclaimed occurrence (same
//      "claimedLines" discipline `move-effect-structural.ts` already uses)
//      — `the-prima-vista`'s two effects correctly claim two DIFFERENT real
//      clauses, never the same one twice.
//   2. **Bare "Crew N" fallback** (`the-lunar-whale`/`the-regalia` — the
//      SAME two real cards `crewCost-structural.ts`'s own doc comment
//      already identifies as printing NO reminder text at all): when a
//      qualifying `animate` effect can't find an explicit "becomes a...
//      creature" clause anywhere, AND this same face also has a
//      `crewCost` set, the bare "Crew N" line itself (real Forge's own
//      IMPLICIT crew-animate rule — the mechanic is real regardless of
//      whether the reminder text spells it out) is the anchor instead —
//      same bare-line pattern `crewCost-structural.ts` itself already
//      confirms, reused here rather than re-derived.
import type { Effect } from '../card';
import type { CardDefinition } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';

export type AnimateSelfCreatureRecognizerInput = StructuralRecognizerInput & Pick<CardDefinition, 'crewCost'>;

const RULE = 'animateSelfCreature-effect-structural' as const;

type AnimateEffect = Extract<Effect, { kind: 'animate' }>;

function isCandidateEffect(e: Effect): e is AnimateEffect {
  return e.kind === 'animate' && e.target === 'self' && e.types.includes('Creature');
}

const BECOMES_CREATURE_RE = /\bbecomes an? \w+ creature until end of turn\b/gi;

export function recognizeAnimateSelfCreatureEffectStructural(input: AnimateSelfCreatureRecognizerInput): RecognizerResult {
  const candidates = allEffects(input).map((o) => o.effect).filter(isCandidateEffect);
  if (candidates.length === 0) {
    return { matched: false, reason: "no kind:'animate' Effect on this face shaped {target:'self', types: [...,'Creature']}" };
  }
  // Gated on a real `crewCost` (2026-09-15, `ride-the-shoopuf`'s own real,
  // DIFFERENT "becomes a 7/7 Beast creature in addition to its other
  // types" clause — no "until end of turn," a genuinely PERMANENT type/PT
  // change, activated by mana, nothing to do with Crew) — every one of
  // the 6 real cards this recognizer's own whole-pool check found for the
  // explicit "becomes a[n] ... creature until end of turn" clause ALSO has
  // a real `crewCost` set (the Crew mechanic is what "until end of turn"
  // is describing); a face with no `crewCost` at all is out of this
  // recognizer's own confirmed scope entirely, correctly declined here
  // rather than mismatched against a clause shape that was never going to
  // apply to it.
  if (input.crewCost === undefined) {
    return { matched: false, reason: 'no crewCost on this face — this recognizer only covers the Crew mechanic\'s own "becomes a creature" clause' };
  }

  const explicitMatches = [...input.oracleText.matchAll(BECOMES_CREATURE_RE)];
  const bareCrewMatches = input.crewCost !== undefined ? [...input.oracleText.matchAll(new RegExp(`^Crew ${input.crewCost}$`, 'gim'))] : [];

  // Each candidate effect claims one real, unclaimed span — explicit clauses
  // first (the more specific anchor), the bare "Crew N" line only once
  // every explicit clause is exhausted (real motivating case: exactly one
  // qualifying effect AND zero explicit clauses AND a real `crewCost`).
  const claimed = new Set<number>();
  const facts: RecognizedFact[] = [];
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);
  for (const effect of candidates) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    let m = explicitMatches.find((x) => !claimed.has(x.index!));
    if (!m) m = bareCrewMatches.find((x) => !claimed.has(x.index!));
    if (!m) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `a qualifying animate-self-to-Creature effect has no unclaimed "becomes a[n] ... creature until end of turn" clause (nor a bare "Crew ${input.crewCost}" fallback) left in oracle text "${input.oracleText}"`,
      };
    }
    claimed.add(m.index!);
    const start = m.index!;
    const end = start + m[0]!.length;
    const annotation = toLineOffset(input.oracleText, start, end);
    if (!annotation) {
      return { matched: false, reason: `matched span [${start},${end}) did not resolve to a single real oracle-text line` };
    }
    facts.push({
      role: 'source',
      fact: { event: 'grantType', type: 'Creature', target: 'self', untilEndOfTurn: true, annotations: [annotation], ...(triggeredBy ? { triggeredBy } : {}) },
      provenance: { origin: 'parser', rule: RULE },
    });
  }
  return { matched: true, facts };
}
