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
// Explicit scope, agreed in conversation ("simplify, don't skip"): NO
// target-legality re-check on resolution (real Forge re-validates targets
// when a spell/ability resolves and can "fizzle" it if all targets became
// illegal — 608.2b) — this stack always resolves exactly what was pushed,
// unconditionally. A real, plainly-flagged gap, not silently assumed away.

import type { CardDefinition, EffectContext, Actions } from './card';
import { resolveCard } from './card';

export interface StackObject {
  card: CardDefinition;
  ctx: EffectContext;
  actions: Actions;
  /** Which named `card.triggers` entry this stack object resolves — omit to run `card.effects` instead (a cast/activated-ability resolution). */
  triggerName?: string;
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
   */
  resolveTop(): StackObject | undefined {
    const obj = this.items.pop();
    if (!obj) return undefined;
    resolveCard(obj.card, obj.ctx, obj.actions, obj.triggerName);
    return obj;
  }
}
