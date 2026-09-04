import { describe, expect, it } from 'vitest';
import { Stack, type StackObject } from './stack';
import type { CardDefinition, EffectContext, Actions } from './card';

const noopCtx = {} as EffectContext;
const noopActions = {} as Actions;

/** A minimal card whose only effect records that it resolved, via `custom` — enough to observe resolution ORDER without needing a real board. */
function recordingCard(name: string, order: string[]): CardDefinition {
  return {
    name,
    manaCost: '{0}',
    typeLine: 'Instant',
    effects: [{ kind: 'custom', describe: 'record', run: () => order.push(name) }],
  };
}

function obj(card: CardDefinition): StackObject {
  return { card, ctx: noopCtx, actions: noopActions };
}

describe('Stack', () => {
  it('starts empty', () => {
    const stack = new Stack();
    expect(stack.isEmpty()).toBe(true);
    expect(stack.size).toBe(0);
  });

  it('resolving an empty stack is a safe no-op', () => {
    const stack = new Stack();
    expect(stack.resolveTop()).toBeUndefined();
    expect(stack.size).toBe(0);
  });

  it('push then resolve runs exactly that item’s effects', () => {
    const order: string[] = [];
    const stack = new Stack();
    stack.push(obj(recordingCard('A', order)));
    expect(stack.size).toBe(1);
    stack.resolveTop();
    expect(order).toEqual(['A']);
    expect(stack.isEmpty()).toBe(true);
  });

  it('LIFO: pushing A then B resolves B first, then A', () => {
    const order: string[] = [];
    const stack = new Stack();
    stack.push(obj(recordingCard('A', order)));
    stack.push(obj(recordingCard('B', order)));
    stack.resolveTop();
    stack.resolveTop();
    expect(order).toEqual(['B', 'A']);
  });

  it('LIFO holds for three items too', () => {
    const order: string[] = [];
    const stack = new Stack();
    stack.push(obj(recordingCard('A', order)));
    stack.push(obj(recordingCard('B', order)));
    stack.push(obj(recordingCard('C', order)));
    stack.resolveTop();
    stack.resolveTop();
    stack.resolveTop();
    expect(order).toEqual(['C', 'B', 'A']);
  });

  it('peek returns the top item without removing it', () => {
    const order: string[] = [];
    const stack = new Stack();
    const a = obj(recordingCard('A', order));
    stack.push(a);
    expect(stack.peek()).toBe(a);
    expect(stack.size).toBe(1);
    expect(order).toEqual([]); // peeking never resolves
  });

  it('a pushed-in-response item resolves before the item it responded to', () => {
    // Real MTG shape: cast a sorcery (A), in response cast an instant (B) —
    // B resolves first, then A, precisely because B landed on TOP of A.
    const order: string[] = [];
    const stack = new Stack();
    stack.push(obj(recordingCard('sorcery-A', order)));
    stack.push(obj(recordingCard('instant-B-in-response', order)));
    stack.resolveTop();
    stack.resolveTop();
    expect(order).toEqual(['instant-B-in-response', 'sorcery-A']);
  });
});
