import { describe, expect, it } from 'vitest';
import { Stack, type StackObject } from './stack';
import type { CardDefinition, EffectContext, Actions } from './card';
import { GameState, wrapCard, wrapPlayer, type RealPlayer } from './state';
import { loggingActions, type LogEntry } from './harness';

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

describe('StackObject.declaredTargets — real target-legality re-check at resolution (CR 608.2b "fizzle", ENGINE_GAPS.md gap #4)', () => {
  // Same real shape fate-of-the-sun-cryst's own "Destroy target nonland
  // permanent" declares (card.ts's own `destroy` effect, `validType:
  // 'permanent'` matching anything, `nonLand` unset here since these test
  // fixtures are all creatures anyway).
  const DESTROY_ONE: CardDefinition = {
    name: 'Test Destroy Spell',
    manaCost: '{1}{W}',
    typeLine: 'Instant',
    effects: [{ kind: 'destroy', validType: 'permanent', qty: 1 }],
  };

  // Fight On!'s own real shape ("return up to two target creature cards") —
  // `qty: 2`, same `destroy` kind reused here purely for test-fixture
  // simplicity (the SAME `resolveTargets` machinery backs both `destroy` and
  // `move`'s own targeted branch identically).
  const DESTROY_UP_TO_TWO: CardDefinition = {
    name: 'Test Multi-Destroy Spell',
    manaCost: '{2}{W}{W}',
    typeLine: 'Sorcery',
    effects: [{ kind: 'destroy', validType: 'permanent', qty: 2 }],
  };

  function setup() {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    const log: LogEntry[] = [];
    return { state, you, opp, log };
  }

  function pushDestroy(state: GameState, you: RealPlayer, opp: RealPlayer, log: LogEntry[], card: CardDefinition, declaredTargets: ReturnType<typeof wrapCard>[]): Stack {
    const selfReal = state.addCard(you, 'Stack', { name: card.name, types: [] });
    const ctx: EffectContext = { self: wrapCard(state, selfReal), you: wrapPlayer(state, you), opponents: [wrapPlayer(state, opp)], castFrom: 'hand' };
    const actions = loggingActions(state, log, selfReal.id);
    const stack = new Stack();
    stack.push({ card, ctx, actions, declaredTargets });
    return stack;
  }

  it('baseline: a target that stays legal all the way through resolution is genuinely destroyed', () => {
    const { state, you, opp, log } = setup();
    const target = state.addCard(opp, 'Battlefield', { name: 'Test Target', types: ['Creature'] });
    const stack = pushDestroy(state, you, opp, log, DESTROY_ONE, [wrapCard(state, target)]);
    stack.resolveTop();
    expect(state.cards.get(target.id)?.zone).toBe('Graveyard');
  });

  it('fizzles (608.2b): a declared target removed from the battlefield before resolution is DROPPED, never replaced by a fresh pick — no effect happens, but the spell still safely resolves off the stack', () => {
    const { state, you, opp, log } = setup();
    const target = state.addCard(opp, 'Battlefield', { name: 'Test Target', types: ['Creature'] });
    const bystander = state.addCard(opp, 'Battlefield', { name: 'Bystander', types: ['Creature'] });
    const stack = pushDestroy(state, you, opp, log, DESTROY_ONE, [wrapCard(state, target)]);
    // Something else (another spell, a state-based action, ...) removes the
    // declared target from the battlefield before this ever resolves.
    state.move(target, 'Hand');
    const resolved = stack.resolveTop();
    expect(resolved).toBeDefined(); // the spell genuinely still resolves — 608.2b's "fizzle" is a no-op resolution, not a countered spell
    expect(state.cards.get(target.id)?.zone).toBe('Hand'); // untouched by the fizzled destroy — not bounced/destroyed further
    expect(state.cards.get(bystander.id)?.zone).toBe('Battlefield'); // and NOT silently retargeted onto a different, still-legal creature
    expect(stack.isEmpty()).toBe(true);
  });

  it('fizzles when the declared target is destroyed outright (zone change to Graveyard) before resolution, same as any other now-illegal target', () => {
    const { state, you, opp, log } = setup();
    const target = state.addCard(opp, 'Battlefield', { name: 'Test Target', types: ['Creature'] });
    const stack = pushDestroy(state, you, opp, log, DESTROY_ONE, [wrapCard(state, target)]);
    state.move(target, 'Graveyard'); // already dead by the time this resolves
    stack.resolveTop();
    expect(state.cards.get(target.id)?.zone).toBe('Graveyard'); // unaffected — no double-destroy, no crash
  });

  it('multi-target partial fizzle: keeps whichever declared targets are STILL legal, drops the rest, without substituting new ones (Fight On!\'s real shape)', () => {
    const { state, you, opp, log } = setup();
    const targetA = state.addCard(opp, 'Battlefield', { name: 'Target A', types: ['Creature'] });
    const targetB = state.addCard(opp, 'Battlefield', { name: 'Target B', types: ['Creature'] });
    const spared = state.addCard(opp, 'Battlefield', { name: 'Spared Bystander', types: ['Creature'] });
    const stack = pushDestroy(state, you, opp, log, DESTROY_UP_TO_TWO, [wrapCard(state, targetA), wrapCard(state, targetB)]);
    // targetA is removed by something else before resolution; targetB stays legal.
    state.move(targetA, 'Hand');
    stack.resolveTop();
    expect(state.cards.get(targetA.id)?.zone).toBe('Hand'); // dropped, not re-destroyed
    expect(state.cards.get(targetB.id)?.zone).toBe('Graveyard'); // the still-legal target IS destroyed
    expect(state.cards.get(spared.id)?.zone).toBe('Battlefield'); // never substituted in for the illegal targetA
  });

  it('with no declaredTargets at all, behavior is UNCHANGED from before this pass — a fresh lazy chooseTarget pick at resolution', () => {
    const { state, you, opp, log } = setup();
    const target = state.addCard(opp, 'Battlefield', { name: 'Test Target', types: ['Creature'] });
    const selfReal = state.addCard(you, 'Stack', { name: DESTROY_ONE.name, types: [] });
    const ctx: EffectContext = { self: wrapCard(state, selfReal), you: wrapPlayer(state, you), opponents: [wrapPlayer(state, opp)], castFrom: 'hand' };
    const actions = loggingActions(state, log, selfReal.id);
    const stack = new Stack();
    stack.push({ card: DESTROY_ONE, ctx, actions }); // no declaredTargets — the old, still-supported lazy path
    stack.resolveTop();
    expect(state.cards.get(target.id)?.zone).toBe('Graveyard'); // still destroyed via the old chooseTarget(pool) default (pool[0])
  });
});
