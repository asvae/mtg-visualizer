// Shared container-walking helpers for the "structural" recognizer family
// (`destroy-effect-structural.ts`, `drawCard-effect-structural.ts`, and any
// future recognizer that reads a `CardDefinition`'s own already-typed
// `Effect[]` STRUCTURE directly rather than its printed text — see
// `destroy-effect-structural.ts`'s own module doc comment for the full
// "why structural, not Forge-script" rationale, not repeated here).
//
// Factored out of `destroy-effect-structural.ts` (2026-09-13, once a SECOND
// structural recognizer needed the exact same walk) rather than duplicated a
// second time — both recognizers' own input shape and container-walking
// logic are byte-for-byte identical; only WHICH `Effect.kind` each one
// filters for differs.
import type { CardDefinition, Effect } from '../card';
import type { RecognizerInput } from './types';

/**
 * A structural recognizer's own input: the two real things Recognizers A/B
 * already read (`name`/`typeLine`/`oracleText`, this face's own printed
 * text) PLUS the STRUCTURED `Effect`-bearing containers straight off this
 * face's own `CardDefinition` (or its `backFace`, for a transforming DFC —
 * the caller's job to pick the right half, same as `faceOf` already does for
 * Recognizers A/B's own `RecognizerInput`). Reuses `CardDefinition`'s own
 * real field types directly (`Pick`, not a redeclared shape) so this
 * recognizer family can never silently drift from what a real card
 * definition actually looks like.
 */
export type StructuralRecognizerInput = RecognizerInput & Pick<CardDefinition, 'effects' | 'triggers' | 'abilities'>;

/** Every effect-bearing container a structural recognizer knows how to walk
 * on one face: the card's own top-level `effects`, every named
 * `triggers[].effects`, every named `abilities[].effects`, and
 * (recursively) every `modal` mode's own `effects` — real container shapes
 * `card.ts`'s own `CardDefinition`/`Effect` types define, not invented here.
 * A `custom` effect's own `run` closure is opaque by construction (`card.ts`'s
 * own header, "Trade-off, stated plainly") — never walked into, same wall
 * the PRD's own black-box-execution section names as the one thing NO
 * static source can read. */
export function collectEffects(list: Effect[] | undefined, out: Effect[]): void {
  if (!list) return;
  for (const effect of list) {
    out.push(effect);
    if (effect.kind === 'modal') {
      for (const mode of effect.modes) collectEffects(mode.effects, out);
    }
  }
}

/**
 * Which structural container an `allEffects()` entry's own `effect` came
 * from — `'top-level'` (a card's own bare `effects` array: an Instant/
 * Sorcery's CAST resolution, or a permanent's own static ETB-independent
 * effect list), `'trigger'` (named — `Trigger.name`, e.g. `'onEnter'`), or
 * `'ability'` (named — a named activated ability). Real motivating need
 * (2026-09-16, causal-links plumbing — coordinator-approved "do now" scope
 * off the causal-links design assessment): `Fact.triggeredBy` needs a
 * trigger's own NAME to link a resulting effect-fact back to the trigger
 * CONDITION that fires it, and until now `allEffects()` discarded exactly
 * that information by flattening every trigger's/ability's own effects
 * into one bare `Effect[]` before any recognizer ever saw them — see this
 * file's own header (`collectEffects`'s doc comment) for why the WALK
 * itself is still the same real container shapes, just no longer thrown
 * away once collected.
 */
export type EffectSource = { kind: 'top-level' } | { kind: 'trigger'; name: string } | { kind: 'ability'; name: string };

/** One `allEffects()` entry — the real `Effect` object plus which real
 * structural container it came from (see `EffectSource`'s own doc
 * comment). */
export interface EffectOccurrence {
  effect: Effect;
  from: EffectSource;
}

/**
 * Every effect-bearing container a structural recognizer knows how to walk
 * on one face, each tagged with its own real structural origin (see
 * `EffectOccurrence`/`EffectSource`'s own doc comments).
 *
 * **`collectEffects` itself is UNCHANGED** (2026-09-16) — still returns a
 * bare, flat `Effect[]` via its own `out` accumulator parameter, exactly as
 * before. This function (`allEffects`, the one place that actually
 * FLATTENS multiple named containers — top-level, every trigger, every
 * ability — into ONE list) is the only thing that changed shape: it now
 * calls `collectEffects` once per real container (same as before) into a
 * fresh LOCAL array, then tags each result with that container's own
 * identity before appending to the final output. `collectEffects`'s own 6
 * direct callers elsewhere in this recognizer catalog (`addMana-effect-
 * structural.ts`, `saga-lore-and-sacrifice-structural.ts`,
 * `untapTarget-effect-structural.ts`, etc.) each already iterate their own
 * trigger/container directly at their own call site (they already have
 * `trigger.name` in scope when they call `collectEffects(trigger.effects,
 * ...)`), so none of them ever had this discarded-identity problem in the
 * first place — only `allEffects`'s own aggregate flattening did, and only
 * it needed to change.
 */
export function allEffects(input: StructuralRecognizerInput): EffectOccurrence[] {
  const out: EffectOccurrence[] = [];
  const pushFrom = (list: Effect[] | undefined, from: EffectSource) => {
    const collected: Effect[] = [];
    collectEffects(list, collected);
    for (const effect of collected) out.push({ effect, from });
  };
  pushFrom(input.effects, { kind: 'top-level' });
  for (const t of input.triggers ?? []) pushFrom(t.effects, { kind: 'trigger', name: t.name });
  for (const a of input.abilities ?? []) pushFrom(a.effects, { kind: 'ability', name: a.name });
  return out;
}

/**
 * `Fact.triggeredBy`'s own real source (2026-09-16, causal-links "widen
 * populate" pass) — a plain `Effect -> EffectSource` lookup built off
 * `allEffects()`'s own real output, keyed by object IDENTITY (every
 * `Effect` literal in a real `CardDefinition` only ever appears once, in
 * exactly one container, so reference-equality is a safe, real key here —
 * never a value-shape key, which could collide across two structurally
 * identical but textually distinct effects on the same face).
 *
 * Exists so each per-recognizer call site can keep its OWN existing
 * `effects`/`candidates` variable exactly as already declared (still a bare
 * `Effect[]`, still whatever `.filter`/index-based pairing logic it already
 * had) and just ask this map "which container did this ONE effect come
 * from" at the point it builds a `RecognizedFact`, rather than threading a
 * new `EffectOccurrence` shape through every existing helper function's own
 * signature (a much bigger, higher-risk retrofit than this informational
 * field is worth — see `Fact.triggeredBy`'s own doc comment, "purely
 * informational").
 */
export function effectSourceMap(input: StructuralRecognizerInput): Map<Effect, EffectSource> {
  const map = new Map<Effect, EffectSource>();
  for (const o of allEffects(input)) map.set(o.effect, o.from);
  return map;
}

/** `EffectSource` -> the `Trigger.name` it should populate `Fact.triggeredBy`
 * with, or `undefined` for `'ability'`/`'top-level'` (by design — see
 * `Fact.triggeredBy`'s own doc comment: only a TRIGGER's own condition
 * counts as a "cause" this field promises to name; a top-level spell effect
 * or an activated ability's own effect has no trigger condition to link
 * back to at all). */
export function triggeredByOf(from: EffectSource | undefined): string | undefined {
  return from?.kind === 'trigger' ? from.name : undefined;
}
