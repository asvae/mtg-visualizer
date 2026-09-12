// A real stack object model — verified against `../mtg-forge`'s actual
// stack implementation, which is NOT a class literally named "GameStack"
// (an earlier guess before checking) but `MagicStack`
// (forge-game/src/main/java/forge/game/zone/MagicStack.java). Confirmed
// real LIFO: its own field comment at ~line 64-65 reads "They don't provide
// a LIFO queue, so had to use a deque" — `Deque<SpellAbilityStackInstance>`.
// `add(SpellAbility)` (~line 239) pushes; `resolveStack()` (~line 561,
// `peekAbility()` reads the front of the deque) resolves the most
// recently-added item first.
//
// This reuses `card.ts`'s own `CardDefinition`/`EffectContext`/`Actions`
// as the stack item's payload rather than inventing a parallel
// representation — a stack item genuinely IS "a card definition plus the
// context to resolve it," nothing more.
//
// Real target-legality re-check on resolution (ENGINE_GAPS.md gap #4,
// closed 2026-09-12): `StackObject.declaredTargets` below carries whatever
// real target(s) `engine.ts`'s `castSpell`/`activateAbility` locked in at
// cast/activation time (CR 601.2c/602.1) — `resolveTop` threads it onto
// `obj.ctx.declaredTargets` right before resolving, so `card.ts`'s own
// targeted-effect branches (via its shared `resolveTargets` helper) can
// re-validate each one against the LIVE game state and drop (never
// replace) any that became illegal in the meantime — CR 608.2b's "fizzle."
// See `card.ts`'s `EffectContext.declaredTargets` doc comment for the full
// design writeup, including what's deliberately still NOT covered.

import type { CardDefinition, EffectContext, Actions } from './card';
import { resolveCard } from './card';
import type { GameState } from './state';
import type { Card } from './interfaces';
import { fireTrigger } from './triggers';

export interface StackObject {
  card: CardDefinition;
  ctx: EffectContext;
  actions: Actions;
  /** Which named `card.triggers` entry this stack object resolves — omit to run `card.effects` instead (a cast/activated-ability resolution). */
  triggerName?: string;
  /** Which named `card.abilities` entry this stack object resolves (a permanent with MORE THAN ONE independent activated ability) — omit for the common single-ability case (`card.activationCost`+`card.effects`) or a plain spell cast, same as `resolveCard`'s own `abilityName` param. */
  abilityName?: string;
  /** True when this object came from `engine.ts`'s `activateAbility` (602.1) rather than a spell cast — `engine.ts`'s own `resolveTop` uses this to skip the spell-only "move to Battlefield/Graveyard after resolving" step (602.1 activated abilities don't move their source permanent; only their OWN effects, if any, do that). */
  isAbility?: boolean;
  /** True when this spell was cast via an `AlternateCost` (`card.ts`) whose own `thenExile` is set — Flashback/Jump-start's real rule (CR 702.32/702.67): once it resolves, it goes to exile instead of its owner's graveyard. `engine.ts`'s own `castSpell` sets this from the `AlternateCost` it was given; `resolveTop` reads it back to pick the real post-resolution zone for an instant/sorcery. */
  thenExile?: boolean;
  /**
   * The real target(s) chosen and locked in AT CAST/ACTIVATION time (CR
   * 601.2c/602.1), BEFORE this object ever reaches the top of the stack —
   * `engine.ts`'s `castSpell`/`activateAbility` set this from their own
   * caller-supplied `declaredTarget(s)` param (a real `RealCard`, wrapped
   * via `state.ts`'s `wrapCard`). `resolveTop` below copies it onto
   * `ctx.declaredTargets` right before resolving — see `card.ts`'s
   * `EffectContext.declaredTargets`/`resolveTargets` for what happens with
   * it there (re-validated against live state, CR 608.2b fizzle on an
   * illegal one). Omitted for every existing non-targeted call site, and
   * for any targeted card whose caller didn't opt into cast-time locking —
   * both preserve this file's prior, entirely lazy behavior exactly.
   */
  declaredTargets?: Card[];
}

export class Stack {
  private items: StackObject[] = [];

  /** `MagicStack.add` (~line 239) — pushes onto the top. */
  push(obj: StackObject): void {
    this.items.push(obj);
  }

  get size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /** The top item without resolving it — `MagicStack.peekAbility()`, called inside `resolveStack()` (~line 568). */
  peek(): StackObject | undefined {
    return this.items[this.items.length - 1];
  }

  /**
   * `MagicStack.resolveStack()` (~line 561) — pops the most-recently-added
   * item (real LIFO, per this file's own header) and runs its effects via
   * `resolveCard()`. A no-op, safely, on an empty stack. NO target-legality
   * re-check (see this file's header) — resolves unconditionally.
   *
   * `state` (optional) — when given AND this object names a `triggerName`
   * (a stack object representing a named trigger's own resolution, as
   * opposed to a plain cast/ability activation), routes through
   * `triggers.ts`'s own shared `fireTrigger` instead of calling
   * `resolveCard` directly, so a real `triggerDoubling` grant
   * (ENGINE_GAPS.md gap #13) genuinely re-fires it a second time when one
   * applies. Omitting `state` (every existing test call site that only
   * cares about plain LIFO push/pop ordering) preserves the exact prior
   * behavior — a bare, undoubled `resolveCard` call.
   *
   * Always assigns `obj.ctx.declaredTargets = obj.declaredTargets` first
   * (ENGINE_GAPS.md gap #4), UNCONDITIONALLY — including setting it back to
   * `undefined` when this particular object carries none. `ctx` is the SAME
   * object a resolved permanent's `resolvedPermanents` entry keeps around
   * for its whole battlefield lifetime (`engine.ts`'s own doc comment),
   * reused across MANY separate later resolutions (a permanent's own
   * repeated activated ability, e.g.) — without this unconditional reset, a
   * stale `declaredTargets` array left over (already drained to empty by a
   * PRIOR resolution's own `resolveTargets` calls, or never fully consumed)
   * could otherwise leak into a later, unrelated resolution of the same
   * `ctx`.
   */
  resolveTop(state?: GameState): StackObject | undefined {
    const obj = this.items.pop();
    if (!obj) return undefined;
    obj.ctx.declaredTargets = obj.declaredTargets;
    if (obj.triggerName && state) {
      fireTrigger(state, obj.card, obj.ctx, obj.actions, obj.triggerName);
    } else {
      resolveCard(obj.card, obj.ctx, obj.actions, obj.triggerName, obj.abilityName);
    }
    return obj;
  }
}
