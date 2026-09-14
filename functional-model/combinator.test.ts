import { describe, expect, it } from 'vitest';
import type { EffectContext } from './card';
import { GameState, wrapCard, wrapPlayer, type RealPlayer } from './state';
import { loggingActions, type LogEntry } from './harness';
import {
  runProgram,
  walkProgram,
  you,
  opponents,
  putCounter,
  tap,
  selfCounters,
  literal,
  compare,
  branch,
  sequence,
  type ProgramNode,
  type Each,
  type Branch,
} from './combinator';

// ---------------------------------------------------------------------------
// Concrete interpreter (`runProgram`) — real `GameState` mutation via real
// `Actions` (`harness.ts`'s own `loggingActions`, the SAME real infrastructure
// `runScenario` uses), not a fake/simulated board. `you`/`opp` are real
// `RealPlayer`s; `state.addCard` creates real `RealCard` battlefield objects.

function setupState() {
  const state = new GameState();
  const you: RealPlayer = state.addPlayer('you');
  const opp: RealPlayer = state.addPlayer('opp');
  const log: LogEntry[] = [];
  return { state, you, opp, log };
}

describe('runProgram — Each over a Query/Filter', () => {
  it('putCounter on every creature a Query matches, no Filter (The Crystal\'s Chosen\'s own migrated shape)', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Source', types: [] });
    const bear = state.addCard(you, 'Battlefield', { name: 'Bear', types: ['Creature'] });
    const wolf = state.addCard(you, 'Battlefield', { name: 'Wolf', types: ['Creature'] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    const program: ProgramNode = {
      kind: 'each',
      input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' },
      action: { action: 'putCounter', counterType: '+1/+1', amount: { kind: 'literal', value: 1 } },
    };
    runProgram(program, ctx, actions);
    expect(bear.counters['+1/+1']).toBe(1);
    expect(wolf.counters['+1/+1']).toBe(1);
  });

  it('Filter field:"excludeSelf" excludes ctx.self from the Each (Dion/Bahamut\'s own migrated "each OTHER creature you control" shape)', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Bahamut', types: ['Creature'] });
    const other = state.addCard(you, 'Battlefield', { name: 'Knight Token', types: ['Creature'] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    const program: Each = {
      kind: 'each',
      input: { kind: 'filter', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, predicate: { field: 'excludeSelf' } },
      action: { action: 'putCounter', counterType: '+1/+1', amount: { kind: 'literal', value: 1 } },
    };
    runProgram(program, ctx, actions);
    expect(self.counters['+1/+1']).toBeUndefined();
    expect(other.counters['+1/+1']).toBe(1);
  });

  it('Filter field:"subtype" narrows to a named subtype (Aerith Gainsborough\'s own migrated "each legendary creature" shape)', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Aerith', types: ['Creature'], subtypes: ['Legendary'] });
    const legend = state.addCard(you, 'Battlefield', { name: 'Some Legend', types: ['Creature'], subtypes: ['Legendary'] });
    const plain = state.addCard(you, 'Battlefield', { name: 'Plain Bear', types: ['Creature'] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    const program: Each = {
      kind: 'each',
      input: { kind: 'filter', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, predicate: { field: 'subtype', value: 'Legendary' } },
      action: { action: 'putCounter', counterType: '+1/+1', amount: { kind: 'literal', value: 2 } },
    };
    runProgram(program, ctx, actions);
    // self ALSO matches (real Aerith Gainsborough's own oracle text has no
    // notSelf clause — she counts herself among "each legendary creature").
    expect(self.counters['+1/+1']).toBe(2);
    expect(legend.counters['+1/+1']).toBe(2);
    expect(plain.counters['+1/+1']).toBeUndefined();
  });

  it('action:"tap" over creaturesInPlay(opponents) (Crystal Fragments/Summon: Alexander\'s own migrated chapterIII shape)', () => {
    const { state, you, opp, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Summon: Alexander', types: ['Creature'] });
    const enemy1 = state.addCard(opp, 'Battlefield', { name: 'Enemy One', types: ['Creature'] });
    const enemy2 = state.addCard(opp, 'Battlefield', { name: 'Enemy Two', types: ['Creature'] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [wrapPlayer(state, opp)], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    const program: Each = { kind: 'each', input: { kind: 'query', source: 'creaturesInPlay', owner: 'opponents' }, action: { action: 'tap' } };
    runProgram(program, ctx, actions);
    expect(enemy1.tapped).toBe(true);
    expect(enemy2.tapped).toBe(true);
  });

  it('a "selfCounters" ValueRef reads ctx.self\'s own LIVE counter count, not a fixed number (Aerith Gainsborough\'s own migrated magnitude, X)', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Aerith', types: ['Creature'], subtypes: ['Legendary'] });
    self.counters['+1/+1'] = 3; // real, live board state — not a Computed/fixed value.
    const legend = state.addCard(you, 'Battlefield', { name: 'Other Legend', types: ['Creature'], subtypes: ['Legendary'] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    const program: Each = {
      kind: 'each',
      input: { kind: 'filter', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, predicate: { field: 'subtype', value: 'Legendary' } },
      action: { action: 'putCounter', counterType: '+1/+1', amount: { kind: 'selfCounters', counterType: '+1/+1' } },
    };
    runProgram(program, ctx, actions);
    expect(self.counters['+1/+1']).toBe(3 + 3); // self also matches "Legendary" and gets its own X (3) added on top of its starting 3.
    expect(legend.counters['+1/+1']).toBe(3);
  });
});

describe('runProgram — Aggregate (sum/count over a Query/Filter), reached via a Branch condition', () => {
  it('op:"count" over an unfiltered Query', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Source', types: [] });
    const bear = state.addCard(you, 'Battlefield', { name: 'Bear', types: ['Creature'] });
    const wolf = state.addCard(you, 'Battlefield', { name: 'Wolf', types: ['Creature'] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    // Synthetic program (no real migrated card needs Aggregate yet — see
    // combinator.ts's own header) — a real "if you control exactly 2
    // creatures" gate, using op:'count'.
    const branch: Branch = {
      kind: 'branch',
      condition: {
        kind: 'compare',
        left: { kind: 'aggregate', op: 'count', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' } },
        op: '==',
        right: { kind: 'literal', value: 2 },
      },
      then: [{ kind: 'each', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, action: { action: 'putCounter', counterType: 'test', amount: { kind: 'literal', value: 1 } } }],
      else: [],
    };
    runProgram(branch, ctx, actions);
    expect(bear.counters['test']).toBe(1);
    expect(wolf.counters['test']).toBe(1);
  });

  it('op:"sum" with field:"power" totals real Card.getNetPower() across the Query', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Source', types: [] });
    state.addCard(you, 'Battlefield', { name: 'Bear', types: ['Creature'], basePower: 2, baseToughness: 2 });
    state.addCard(you, 'Battlefield', { name: 'Wolf', types: ['Creature'], basePower: 3, baseToughness: 3 });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    // A real "if total power of creatures you control >= 5" gate.
    const branch: Branch = {
      kind: 'branch',
      condition: {
        kind: 'compare',
        left: { kind: 'aggregate', op: 'sum', field: 'power', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' } },
        op: '>=',
        right: { kind: 'literal', value: 5 },
      },
      then: [{ kind: 'sequence', steps: [{ action: 'moveSelf', to: 'Exile' }] }],
      else: [],
    };
    runProgram(branch, ctx, actions);
    expect(self.zone).toBe('Exile');
  });

  it('op:"sum" correctly does NOT branch when the real total falls short', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Source', types: [] });
    state.addCard(you, 'Battlefield', { name: 'Bear', types: ['Creature'], basePower: 2, baseToughness: 2 });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    const branch: Branch = {
      kind: 'branch',
      condition: {
        kind: 'compare',
        left: { kind: 'aggregate', op: 'sum', field: 'power', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' } },
        op: '>=',
        right: { kind: 'literal', value: 5 },
      },
      then: [{ kind: 'sequence', steps: [{ action: 'moveSelf', to: 'Exile' }] }],
      else: [],
    };
    runProgram(branch, ctx, actions);
    expect(self.zone).toBe('Battlefield');
  });
});

describe('runProgram — Branch', () => {
  it('runs `else` when the condition is false, never touching `then`', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Aerith', types: ['Creature'], subtypes: ['Legendary'] });
    self.counters['+1/+1'] = 3;
    const legend = state.addCard(you, 'Battlefield', { name: 'Other Legend', types: ['Creature'], subtypes: ['Legendary'] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    const branch: Branch = {
      kind: 'branch',
      condition: { kind: 'compare', left: { kind: 'selfCounters', counterType: '+1/+1' }, op: '<=', right: { kind: 'literal', value: 0 } },
      then: [],
      else: [
        {
          kind: 'each',
          input: { kind: 'filter', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, predicate: { field: 'subtype', value: 'Legendary' } },
          action: { action: 'putCounter', counterType: '+1/+1', amount: { kind: 'selfCounters', counterType: '+1/+1' } },
        },
      ],
    };
    runProgram(branch, ctx, actions);
    // condition is FALSE (3 <= 0 is false) — `else` ran, `then` (empty) did nothing.
    expect(legend.counters['+1/+1']).toBe(3);
  });

  it("runs `then` (empty here) — Aerith Gainsborough's own real early-return case: X<=0 does nothing at all", () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Aerith', types: ['Creature'], subtypes: ['Legendary'] });
    // self.counters['+1/+1'] left unset — getCounters returns 0 for an absent key (see state.ts's own GameEntity.getCounters).
    const legend = state.addCard(you, 'Battlefield', { name: 'Other Legend', types: ['Creature'], subtypes: ['Legendary'] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    const branch: Branch = {
      kind: 'branch',
      condition: { kind: 'compare', left: { kind: 'selfCounters', counterType: '+1/+1' }, op: '<=', right: { kind: 'literal', value: 0 } },
      then: [],
      else: [
        {
          kind: 'each',
          input: { kind: 'filter', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, predicate: { field: 'subtype', value: 'Legendary' } },
          action: { action: 'putCounter', counterType: '+1/+1', amount: { kind: 'selfCounters', counterType: '+1/+1' } },
        },
      ],
    };
    runProgram(branch, ctx, actions);
    // condition is TRUE (0 <= 0) — `then` (empty) ran, `else`'s putCounter never fired.
    expect(legend.counters['+1/+1']).toBeUndefined();
  });
});

describe('runProgram — Sequence', () => {
  it('runs each moveSelf step in order against ctx.self (crystal-fragments-summon-alexander/dion-bahamut\'s own migrated exile-then-return shape)', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Crystal Fragments', types: ['Artifact'], subtypes: ['Equipment'] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    const program: ProgramNode = { kind: 'sequence', steps: [{ action: 'moveSelf', to: 'Exile' }, { action: 'moveSelf', to: 'Battlefield' }] };
    expect(self.zone).toBe('Battlefield');
    runProgram(program, ctx, actions);
    expect(self.zone).toBe('Battlefield'); // exiled, then returned — real, sequential zone changes, not a no-op.
    expect(log.filter((l) => l.fn === 'moveTo')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// Symbolic walker (`walkProgram`) — reads the SAME AST with NO ctx/actions/
// board at all. `walkProgram`'s own signature takes only a `ProgramNode`, so
// there is structurally nothing here TO execute against, unlike the
// `runProgram` tests above.

describe('walkProgram', () => {
  it('a Branch visits BOTH `then` and `else`, never picking one — synthetic case with distinguishable content on both sides', () => {
    const branch: Branch = {
      kind: 'branch',
      condition: { kind: 'compare', left: { kind: 'literal', value: 1 }, op: '==', right: { kind: 'literal', value: 1 } },
      then: [{ kind: 'each', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, action: { action: 'tap' } }],
      else: [{ kind: 'each', input: { kind: 'query', source: 'creaturesInPlay', owner: 'opponents' }, action: { action: 'tap' } }],
    };
    const events = walkProgram(branch);
    const details = events.map((e) => e.detail);
    expect(details.some((d) => d.includes('creaturesInPlay(you)'))).toBe(true);
    expect(details.some((d) => d.includes('creaturesInPlay(opponents)'))).toBe(true);
  });

  it("walks Aerith Gainsborough's own REAL migrated program — both branches visited with ZERO execution (no ctx, no actions, no board)", () => {
    // The exact AST `cards/aerith-gainsborough/definition.ts`'s own onDies
    // effect now declares (see that file) — reproduced here rather than
    // imported so this test doesn't depend on that card's own module
    // resolution just to prove a pure-data property.
    const program: Branch = {
      kind: 'branch',
      condition: { kind: 'compare', left: { kind: 'selfCounters', counterType: '+1/+1' }, op: '<=', right: { kind: 'literal', value: 0 } },
      then: [],
      else: [
        {
          kind: 'each',
          input: {
            kind: 'filter',
            input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' },
            predicate: { field: 'subtype', value: 'Legendary' },
          },
          action: { action: 'putCounter', counterType: '+1/+1', amount: { kind: 'selfCounters', counterType: '+1/+1' } },
        },
      ],
    };
    // Called with ONLY the AST — no EffectContext, no Actions, no GameState
    // of any kind exists anywhere in this test. This is the "enumerable
    // without execution" property itself, not just an assertion about it.
    const events = walkProgram(program);
    // The `branch` node itself is always visited (its own condition, read structurally).
    expect(events.some((e) => e.node === 'branch' && e.detail.includes('selfCounters(+1/+1)') && e.detail.includes('<='))).toBe(true);
    // `then` is genuinely empty on this real card (its own early-return arm)
    // — walking it contributes zero further events, which is itself part of
    // what "both sides are visited, neither picked" means here: the walker's
    // own `for (const step of node.then)` loop runs (zero iterations) exactly
    // as unconditionally as the `else` loop below, not skipped because a
    // condition evaluated false the way `runProgram` would.
    //
    // `else` — its own Filter/Query/Each ARE walked (real, checkable events):
    expect(events.some((e) => e.node === 'query' && e.detail === 'creaturesInPlay(you)')).toBe(true);
    expect(events.some((e) => e.node === 'filter' && e.detail === 'subtype=Legendary')).toBe(true);
    expect(events.some((e) => e.node === 'each' && e.detail.includes('putCounter(+1/+1'))).toBe(true);
  });

  it('walks a Sequence as an ordered list of moveSelf events', () => {
    const events = walkProgram({ kind: 'sequence', steps: [{ action: 'moveSelf', to: 'Exile' }, { action: 'moveSelf', to: 'Battlefield' }] });
    expect(events).toEqual([
      { node: 'sequence', detail: 'moveSelf -> Exile' },
      { node: 'sequence', detail: 'moveSelf -> Battlefield' },
    ]);
  });

  it('walks an Aggregate reachable from a Branch condition (sum/count both structurally visible with zero execution)', () => {
    const branch: Branch = {
      kind: 'branch',
      condition: {
        kind: 'compare',
        left: { kind: 'aggregate', op: 'sum', field: 'power', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' } },
        op: '>=',
        right: { kind: 'literal', value: 5 },
      },
      then: [],
      else: [],
    };
    const events = walkProgram(branch);
    expect(events.some((e) => e.node === 'aggregate' && e.detail === 'sum:power')).toBe(true);
    expect(events.some((e) => e.node === 'query' && e.detail === 'creaturesInPlay(you)')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Fluent builder layer (`you`/`opponents`/`.filter()`/`.each()`/`putCounter`/
// `tap`/`selfCounters`/`literal`/`compare`/`branch`/`sequence`) — a
// construction-only ergonomics layer over the SAME AST types above. Every
// case below asserts the built value `toEqual`s a hand-written object literal
// (byte-identical AST, not just "behaves the same") — the ENTIRE point of this
// layer is that it changes nothing about what gets built, only how pleasant
// it is to write.

describe('fluent builder layer — built AST deep-equals the hand-written literal', () => {
  it("Aerith Gainsborough's own REAL migrated program (`cards/aerith-gainsborough/definition.ts`) — the exact motivating case", () => {
    const built = branch(compare(selfCounters('+1/+1'), '<=', 0), [], [
      you.creaturesInPlay().filter('subtype', 'Legendary').each(putCounter('+1/+1', selfCounters('+1/+1'))),
    ]);
    const handWritten: Branch = {
      kind: 'branch',
      condition: { kind: 'compare', left: { kind: 'selfCounters', counterType: '+1/+1' }, op: '<=', right: { kind: 'literal', value: 0 } },
      then: [],
      else: [
        {
          kind: 'each',
          input: {
            kind: 'filter',
            input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' },
            predicate: { field: 'subtype', value: 'Legendary' },
          },
          action: { action: 'putCounter', counterType: '+1/+1', amount: { kind: 'selfCounters', counterType: '+1/+1' } },
        },
      ],
    };
    expect(built).toEqual(handWritten);
    // And it's genuinely still zero-execution/traversable data, not a
    // wrapped closure — the SAME `walkProgram` from the tests above reads it
    // with no ctx/actions/board, identical result to the hand-written form.
    expect(walkProgram(built)).toEqual(walkProgram(handWritten));
  });

  it("The Crystal's Chosen own migrated program — a bare `Each`, no `.filter()`, amount as a plain number", () => {
    const built = you.creaturesInPlay().each(putCounter('+1/+1', 1));
    const handWritten: Each = {
      kind: 'each',
      input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' },
      action: { action: 'putCounter', counterType: '+1/+1', amount: { kind: 'literal', value: 1 } },
    };
    expect(built).toEqual(handWritten);
  });

  it("Crystal Fragments/Summon: Alexander's own migrated chapterIII program — `opponents.creaturesInPlay().each(tap())`", () => {
    const built = opponents.creaturesInPlay().each(tap());
    const handWritten: Each = { kind: 'each', input: { kind: 'query', source: 'creaturesInPlay', owner: 'opponents' }, action: { action: 'tap' } };
    expect(built).toEqual(handWritten);
  });

  it("Dion/Bahamut's own migrated Wings of Light program — `.filter('excludeSelf')` (no value arg)", () => {
    const built = you.creaturesInPlay().filter('excludeSelf').each(putCounter('+1/+1', 1));
    const handWritten: Each = {
      kind: 'each',
      input: { kind: 'filter', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, predicate: { field: 'excludeSelf' } },
      action: { action: 'putCounter', counterType: '+1/+1', amount: { kind: 'literal', value: 1 } },
    };
    expect(built).toEqual(handWritten);
  });

  it("the front-face transform shape shared by crystal-fragments-summon-alexander/dion-bahamut's own migrated programs — `sequence('Exile', 'Battlefield')`", () => {
    const built = sequence('Exile', 'Battlefield');
    expect(built).toEqual({ kind: 'sequence', steps: [{ action: 'moveSelf', to: 'Exile' }, { action: 'moveSelf', to: 'Battlefield' }] });
  });

  it('literal() spelled out explicitly matches the implicit number-wrapping every other builder already does', () => {
    expect(literal(2)).toEqual({ kind: 'literal', value: 2 });
    expect(putCounter('+1/+1', 2)).toEqual({ action: 'putCounter', counterType: '+1/+1', amount: literal(2) });
  });

  it('a QueryChain\'s own .count()/.sum() terminals produce a plain Aggregate, directly usable as a ValueRef with no unwrapping', () => {
    expect(you.creaturesInPlay().count()).toEqual({ kind: 'aggregate', op: 'count', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' } });
    expect(you.creaturesInPlay().sum('power')).toEqual({
      kind: 'aggregate',
      op: 'sum',
      field: 'power',
      input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' },
    });
    // Plugs directly into compare() as a left/right ValueRef, no wrapping:
    expect(compare(you.creaturesInPlay().count(), '==', 2)).toEqual({
      kind: 'compare',
      left: { kind: 'aggregate', op: 'count', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' } },
      op: '==',
      right: { kind: 'literal', value: 2 },
    });
  });

  it('branch() omits the `else` key entirely when called with only 2 args, but keeps a genuinely empty `[]` when passed explicitly', () => {
    const noElse = branch(compare(1, '==', 1), []);
    expect(noElse).toEqual({ kind: 'branch', condition: { kind: 'compare', left: { kind: 'literal', value: 1 }, op: '==', right: { kind: 'literal', value: 1 } }, then: [] });
    expect('else' in noElse).toBe(false);
    const emptyElse = branch(compare(1, '==', 1), [], []);
    expect('else' in emptyElse).toBe(true);
    expect(emptyElse.else).toEqual([]);
  });

  it('a QueryChain composes .filter().filter() (Filter.input allows Query|Filter structurally, even though no real card needs 2 predicates yet)', () => {
    const built = you.creaturesInPlay().filter('subtype', 'Legendary').filter('excludeSelf').each(tap());
    expect(built).toEqual({
      kind: 'each',
      input: {
        kind: 'filter',
        input: { kind: 'filter', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, predicate: { field: 'subtype', value: 'Legendary' } },
        predicate: { field: 'excludeSelf' },
      },
      action: { action: 'tap' },
    });
  });

  it('a builder call touches ZERO ctx/actions/GameState — assembling the AST alone throws nothing and needs no board at all', () => {
    // No GameState, no EffectContext, no Actions constructed anywhere in this
    // test — if any builder function secretly needed one, this would throw
    // (undefined access) rather than just returning a plain object.
    expect(() => branch(compare(selfCounters('+1/+1'), '<=', 0), [], [you.creaturesInPlay().filter('subtype', 'Legendary').each(putCounter('+1/+1', 1))])).not.toThrow();
  });
});
