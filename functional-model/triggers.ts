// The ONE shared chokepoint for firing a NAMED trigger (ENGINE_GAPS.md gap
// #13, closed 2026-09-12) — every real trigger-firing call site in this
// codebase (`stack.ts`'s `Stack.resolveTop`, `engine.ts`'s 3 dispatch sites
// — `playLand`'s ETB, `resolveTop`'s ETB, `fireOnPhaseEnterTriggers`'s
// upkeep/endStep — `saga.ts`'s `advanceSaga`, `harness.ts`'s scenario
// runner, and `engine-trace.ts`'s `pilotFireTrigger`) now calls `fireTrigger`
// here instead of calling `card.ts`'s `resolveCard` directly for a named
// trigger.
//
// Why this file exists rather than folding `fireTrigger` into `state.ts` or
// `engine.ts`: it needs BOTH `card.ts` (`resolveCard`/`CardDefinition`/
// `EffectContext`/`Actions`) AND `state.ts` (`GameState`/`shouldDoubleTrigger`)
// — `state.ts`'s own header is explicit that it deliberately never imports
// from `card.ts` (keeping the mutable-game-object model decoupled from the
// declarative effect model), and `engine.ts` already has a real, one-
// directional runtime import relationship with `saga.ts` (`engine.ts`
// imports `{advanceSaga}` from `saga.ts` as a VALUE, not just a type) — if
// `fireTrigger` lived in `engine.ts`, `saga.ts` calling it back would be a
// genuine circular VALUE import between the two, which neither file has
// today (their existing `GameEngine`/`RealCard` cross-references are all
// `import type`, erased before anything runs). This file sits below both,
// with no runtime cycle: `card.ts` and `state.ts` both import nothing from
// here, so every other module (`stack.ts`, `engine.ts`, `saga.ts`,
// `harness.ts`, `engine-trace.ts`) can safely import from it.
//
// Real Forge citation for the general mechanism (`S:Mode$ Panharmonicon`,
// `res/cardsfolder/c/cloud_midgar_mercenary.txt`) and the 3 real FIN cards
// needing it (Cloud, Midgar Mercenary; The Masamune; Traveling Chocobo, each
// with a genuinely different gate) — see `card.ts`'s own `TriggerDoublingGrant`
// doc comment and `state.ts`'s own `shouldDoubleTrigger` for the full writeup.

import type { CardDefinition, EffectContext, Actions } from './card';
import { resolveCard } from './card';
import { shouldDoubleTrigger, type GameState, type TriggerCause } from './state';

/**
 * Resolves `card`'s named trigger `triggerName` exactly like a bare
 * `resolveCard(card, ctx, actions, triggerName)` call would — then, if a
 * real `triggerDoubling` grant anywhere on `state`'s battlefield currently
 * covers this firing (`shouldDoubleTrigger`, keyed off `ctx.self` — the
 * RealCard whose trigger this is — and the optional `cause`), resolves the
 * SAME named trigger a second time (601.2f/603.2's own "an ability that
 * triggers an additional time genuinely triggers twice," not "a bigger
 * single effect" — modeled here as literally running the same effects
 * twice, the simplest faithful shape given this model has no separate
 * "trigger objects queued on the stack" concept to duplicate instead).
 *
 * `ctx.self.getId()` must resolve to a real `state.cards` entry for the
 * doubling check to run at all — same "no entry = gap, not a silent
 * success" convention `resolvedPermanents`/`enteredThisTurn` already
 * establish; a caller whose `ctx.self` isn't a real tracked `RealCard`
 * (shouldn't happen at any real call site today) simply never doubles,
 * which is the safe default, not a crash.
 *
 * Returns whether it doubled, so a caller that logs a bracket entry for the
 * trigger (`engine-trace.ts`'s `pilotFireTrigger`/`pilotResolveTop`, e.g.)
 * can log a second one too, matching the real doubled firing rather than
 * silently doubling the underlying effects while the trace's own bracket
 * still implies it happened once.
 *
 * `onDoubled` (optional) fires exactly once, right before the SECOND
 * `resolveCard` call — a caller that wants its own second bracket entry
 * logged in true causal order (bracket, first round of effects, SECOND
 * bracket, second round of effects — not both brackets up front) passes a
 * callback here instead of checking `shouldDoubleTrigger` itself
 * beforehand, which would duplicate this function's own real doubling
 * logic in the caller.
 */
export function fireTrigger(state: GameState, card: CardDefinition, ctx: EffectContext, actions: Actions, triggerName: string, cause?: TriggerCause, onDoubled?: () => void): boolean {
  resolveCard(card, ctx, actions, triggerName);
  const source = state.cards.get(ctx.self.getId());
  const doubled = source !== undefined && shouldDoubleTrigger(state, source, cause);
  if (doubled) {
    onDoubled?.();
    resolveCard(card, ctx, actions, triggerName);
  }
  return doubled;
}
