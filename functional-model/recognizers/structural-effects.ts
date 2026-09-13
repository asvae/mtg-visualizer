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

export function allEffects(input: StructuralRecognizerInput): Effect[] {
  const out: Effect[] = [];
  collectEffects(input.effects, out);
  for (const t of input.triggers ?? []) collectEffects(t.effects, out);
  for (const a of input.abilities ?? []) collectEffects(a.effects, out);
  return out;
}
