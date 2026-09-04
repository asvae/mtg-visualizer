import { describe, expect, it } from 'vitest';
import { Stack, type StackObject } from './stack';
import { runPriorityRound } from './priority';
import type { CardDefinition, EffectContext, Actions } from './card';

const noopCtx = {} as EffectContext;
const noopActions = {} as Actions;

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

describe('runPriorityRound', () => {
  it('everyone passing with an empty stack -> advance-phase', () => {
    const stack = new Stack();
    expect(runPriorityRound(stack, [{ pass: true }, { pass: true }])).toBe('advance-phase');
  });

  it('everyone passing with something on the stack -> resolve-stack', () => {
    const order: string[] = [];
    const stack = new Stack();
    stack.push(obj(recordingCard('pending', order)));
    expect(runPriorityRound(stack, [{ pass: true }, { pass: true }])).toBe('resolve-stack');
    expect(stack.size).toBe(1); // a priority round never resolves anything itself
  });

  it('the active player pushing something -> pushed, and it lands on the stack', () => {
    const order: string[] = [];
    const stack = new Stack();
    const outcome = runPriorityRound(stack, [{ push: obj(recordingCard('active-players-spell', order)) }, { pass: true }]);
    expect(outcome).toBe('pushed');
    expect(stack.size).toBe(1);
    expect(stack.peek()!.card.name).toBe('active-players-spell');
  });

  it('a NON-active player pushing (after the active player passes) still ends the round immediately as pushed', () => {
    const order: string[] = [];
    const stack = new Stack();
    const outcome = runPriorityRound(stack, [{ pass: true }, { push: obj(recordingCard('responders-spell', order)) }]);
    expect(outcome).toBe('pushed');
    expect(stack.size).toBe(1);
  });

  it('APNAP order: choices[0] is checked first, so an active-player push wins even if a later choice also pushes', () => {
    const order: string[] = [];
    const stack = new Stack();
    runPriorityRound(stack, [{ push: obj(recordingCard('active', order)) }, { push: obj(recordingCard('never-reached', order)) }]);
    expect(stack.size).toBe(1);
    expect(stack.peek()!.card.name).toBe('active');
  });

  it('full real sequence: cast a sorcery, respond with an instant, instant resolves first (LIFO), then the sorcery, then the phase advances', () => {
    const order: string[] = [];
    const stack = new Stack();

    // Round 1: active player casts sorcery A.
    let outcome = runPriorityRound(stack, [{ push: obj(recordingCard('sorcery-A', order)) }, { pass: true }]);
    expect(outcome).toBe('pushed');

    // Round 2 (priority resets to active player after any action): active
    // player passes, opponent responds with instant B.
    outcome = runPriorityRound(stack, [{ pass: true }, { push: obj(recordingCard('instant-B', order)) }]);
    expect(outcome).toBe('pushed');

    // Round 3: everyone passes with B on top -> resolve B.
    outcome = runPriorityRound(stack, [{ pass: true }, { pass: true }]);
    expect(outcome).toBe('resolve-stack');
    stack.resolveTop();
    expect(order).toEqual(['instant-B']);

    // Round 4: everyone passes again, A is still on the stack -> resolve A.
    outcome = runPriorityRound(stack, [{ pass: true }, { pass: true }]);
    expect(outcome).toBe('resolve-stack');
    stack.resolveTop();
    expect(order).toEqual(['instant-B', 'sorcery-A']);

    // Round 5: stack is empty, everyone passes -> the phase can advance.
    outcome = runPriorityRound(stack, [{ pass: true }, { pass: true }]);
    expect(outcome).toBe('advance-phase');
  });
});
