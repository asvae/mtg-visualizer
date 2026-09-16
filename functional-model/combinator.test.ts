import { describe, expect, it } from 'vitest';
import type { EffectContext } from './card';
import { GameState, wrapCard, wrapPlayer, effectivePT, type RealPlayer } from './state';
import { loggingActions, type LogEntry } from './harness';
import {
  runProgram,
  walkProgram,
  you,
  opponents,
  anyPlayer,
  putCounter,
  tap,
  untap,
  destroyEach,
  dealDamageEach,
  pumpEach,
  gainControl,
  grantKeyword,
  equipTo,
  selfCounters,
  literal,
  add,
  compare,
  hasSubtype,
  branch,
  sequence,
  selectUpTo,
  applyToBound,
  drawCard,
  type ProgramNode,
  type Each,
  type Branch,
  type SelectUpTo,
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

  it('"untap" EachAction untaps every matched item, no parameters', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Source', types: [] });
    const bear = state.addCard(you, 'Battlefield', { name: 'Bear', types: ['Creature'], tapped: true });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    const program: Each = { kind: 'each', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, action: untap() };
    runProgram(program, ctx, actions);
    expect(bear.tapped).toBe(false);
  });

  it('SelectUpTo + ApplyToBound "dealDamage" with an "add" ValueRef (Slash of Light\'s own real "damage equal to the number of creatures you control plus the number of Equipment you control")', () => {
    const { state, you, opp, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Slash of Light', types: [] });
    state.addCard(you, 'Battlefield', { name: 'Bear', types: ['Creature'] });
    state.addCard(you, 'Battlefield', { name: 'Wolf', types: ['Creature'] });
    state.addCard(you, 'Battlefield', { name: 'Sword', types: ['Artifact'], subtypes: ['Equipment'] });
    const enemyCreature = state.addCard(opp, 'Battlefield', { name: 'Enemy Creature', types: ['Creature'] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [wrapPlayer(state, opp)], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    const creatureCount = { kind: 'aggregate', op: 'count', input: { kind: 'filter', input: { kind: 'query', source: 'permanentsInPlay', owner: 'you' }, predicate: { field: 'cardType', value: 'creature' } } } as const;
    const equipmentCount = { kind: 'aggregate', op: 'count', input: { kind: 'filter', input: { kind: 'query', source: 'permanentsInPlay', owner: 'you' }, predicate: { field: 'subtype', value: 'Equipment' } } } as const;
    // "target creature" — chooseTarget's own deterministic first pick off
    // the opponent's own pool, same as every other targeted test in this file.
    const program: SelectUpTo = selectUpTo({ kind: 'query', source: 'creaturesInPlay', owner: 'opponents' }, 1, 'target', [
      applyToBound('target', 0, dealDamageEach(add(creatureCount, equipmentCount))),
    ]);
    runProgram(program, ctx, actions);
    // 2 creatures you control (Bear, Wolf) + 1 Equipment (Sword) = 3 damage
    // to the opponent's own Enemy Creature — the target itself never counts
    // toward "creatures YOU control" since it belongs to the opponent.
    expect(enemyCreature.damageMarked).toBe(3);
  });

  it('SelectUpTo + ApplyToBound "pump" gated by a Branch (You\'re Not Alone\'s own real "+2/+2, or +4/+4 instead if you control three or more creatures")', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: "You're Not Alone", types: [] });
    // Added first — `getCreaturesInPlay()` preserves insertion order, so
    // this is `chooseTarget`'s own deterministic first pick below.
    const target = state.addCard(you, 'Battlefield', { name: 'Bear', types: ['Creature'], basePower: 1, baseToughness: 1 });
    state.addCard(you, 'Battlefield', { name: 'Wolf', types: ['Creature'] });
    state.addCard(you, 'Battlefield', { name: 'Owlbear', types: ['Creature'] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    const program: ProgramNode = {
      kind: 'branch',
      condition: { kind: 'compare', left: { kind: 'aggregate', op: 'count', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' } }, op: '>=', right: { kind: 'literal', value: 3 } },
      then: [{ kind: 'selectUpTo', from: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, max: 1, as: 'target', then: [{ kind: 'applyToBound', name: 'target', index: 0, action: pumpEach(4, 4) }] }],
      else: [{ kind: 'selectUpTo', from: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, max: 1, as: 'target', then: [{ kind: 'applyToBound', name: 'target', index: 0, action: pumpEach(2, 2) }] }],
    };
    runProgram(program, ctx, actions);
    // 3 creatures you control (Bear/Wolf/Owlbear) meets the real threshold
    // — the +4/+4 branch fires (not +2/+2), applied to Bear.
    expect(effectivePT(state, target)).toEqual([5, 5]); // base 1/1 + 4/+4
  });

  it('Filter field:"cardType" (single value) narrows to one card type — mirrors Card.isX()', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Source', types: [] });
    const bear = state.addCard(you, 'Battlefield', { name: 'Bear', types: ['Creature'] });
    const relic = state.addCard(you, 'Battlefield', { name: 'Relic', types: ['Artifact'] });
    const forest = state.addCard(you, 'Battlefield', { name: 'Forest', types: ['Land'] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    const program: Each = {
      kind: 'each',
      input: { kind: 'filter', input: { kind: 'query', source: 'permanentsInPlay', owner: 'you' }, predicate: { field: 'cardType', value: 'creature' } },
      action: { action: 'putCounter', counterType: '+1/+1', amount: { kind: 'literal', value: 1 } },
    };
    runProgram(program, ctx, actions);
    expect(bear.counters['+1/+1']).toBe(1);
    expect(relic.counters['+1/+1']).toBeUndefined();
    expect(forest.counters['+1/+1']).toBeUndefined();
  });

  it('Filter field:"cardType" (array value, OR-matched) + "destroy" EachAction — Ultima\'s own real "destroy all artifacts and creatures" shape', () => {
    const { state, you, opp, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Ultima', types: ['Sorcery'] });
    const bear = state.addCard(you, 'Battlefield', { name: 'Bear', types: ['Creature'] });
    const relic = state.addCard(opp, 'Battlefield', { name: 'Relic', types: ['Artifact'] });
    const forest = state.addCard(opp, 'Battlefield', { name: 'Forest', types: ['Land'] });
    const shrine = state.addCard(you, 'Battlefield', { name: 'Shrine', types: ['Enchantment'] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [wrapPlayer(state, opp)], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    const program: Each = {
      kind: 'each',
      input: {
        kind: 'filter',
        input: { kind: 'query', source: 'permanentsInPlay', owner: 'any' },
        predicate: { field: 'cardType', value: ['artifact', 'creature'] },
      },
      action: destroyEach(),
    };
    runProgram(program, ctx, actions);
    expect(bear.zone).toBe('Graveyard');
    expect(relic.zone).toBe('Graveyard');
    expect(forest.zone).toBe('Battlefield');
    expect(shrine.zone).toBe('Battlefield');
  });
});

describe('runProgram — SelectUpTo/ApplyToBound (2026-09-16 gainControl/untap/grantKeyword/equip actions — see EachAction\'s own doc comment)', () => {
  it('SelectUpTo + ApplyToBound chains gainControl → untap → grantKeyword onto the SAME picked object (zidane-tantalus-thief\'s own real onEnter shape: "gain control of target creature an opponent controls until end of turn. Untap it. It gains lifelink and haste until end of turn.")', () => {
    const { state, you, opp, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Zidane, Tantalus Thief', types: ['Creature'] });
    const stolen = state.addCard(opp, 'Battlefield', { name: 'Enemy Creature', types: ['Creature'], tapped: true });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [wrapPlayer(state, opp)], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    const program: SelectUpTo = selectUpTo({ kind: 'query', source: 'creaturesInPlay', owner: 'opponents' }, 1, 'target', [
      applyToBound('target', 0, gainControl('you')),
      applyToBound('target', 0, untap()),
      applyToBound('target', 0, grantKeyword('Lifelink', true)),
      applyToBound('target', 0, grantKeyword('Haste', true)),
    ]);
    runProgram(program, ctx, actions);
    expect(stolen.controllerId).toBe(you.id);
    expect(stolen.tapped).toBe(false);
    expect(stolen.keywords).toContain('Lifelink');
    expect(stolen.keywords).toContain('Haste');
  });

  it('"gainControl" EachAction with controller:"opponent" hands control to ctx.opponents[0] (stiltzkin-moogle-merchant\'s own real "target opponent gains control of another target permanent you control")', () => {
    const { state, you, opp, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Stiltzkin, Moogle Merchant', types: ['Creature'] });
    const given = state.addCard(you, 'Battlefield', { name: 'Given Permanent', types: ['Artifact'] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [wrapPlayer(state, opp)], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    // `Query.source:'permanentsInPlay'` (real Forge "another target
    // PERMANENT you control," genuinely broader than `'creaturesInPlay'` —
    // see that source's own doc comment) correctly picks up a non-creature
    // artifact here, unlike `'creaturesInPlay'` which would miss it.
    const program: SelectUpTo = selectUpTo({ kind: 'filter', input: { kind: 'query', source: 'permanentsInPlay', owner: 'you' }, predicate: { field: 'excludeSelf' } }, 1, 'given', [
      applyToBound('given', 0, gainControl('opponent')),
    ]);
    runProgram(program, ctx, actions);
    expect(given.controllerId).toBe(opp.id);
  });

  it('"equip" EachAction attaches the item it\'s applied to onto a SEPARATE binding\'s own picked object (stolen-uniform\'s own real "gain control of target Equipment... attach it to [target creature you control]")', () => {
    const { state, you, opp, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Stolen Uniform', types: ['Instant'] });
    const creature = state.addCard(you, 'Battlefield', { name: 'My Creature', types: ['Creature'] });
    const equipment = state.addCard(opp, 'Battlefield', { name: 'Their Equipment', types: ['Artifact'], subtypes: ['Equipment'] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [wrapPlayer(state, opp)], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    const program: SelectUpTo = selectUpTo({ kind: 'query', source: 'creaturesInPlay', owner: 'you' }, 1, 'creature', [
      selectUpTo({ kind: 'filter', input: { kind: 'query', source: 'permanentsInPlay', owner: 'opponents' }, predicate: { field: 'subtype', value: 'Equipment' } }, 1, 'equipment', [
        applyToBound('equipment', 0, gainControl('you')),
        applyToBound('equipment', 0, equipTo('creature', 0)),
      ]),
    ]);
    runProgram(program, ctx, actions);
    expect(equipment.controllerId).toBe(you.id);
    expect(equipment.attachedToId).toBe(creature.id);
  });
});

describe('runProgram — SelectUpTo consults ctx.declaredTargets before chooseTarget (2026-09-16 escalation triage — stuck-in-summoner-s-sanctum/sleep-magic\'s own real reconciliation, see SelectUpTo\'s own doc comment)', () => {
  it('honors a real cast-time-declared target over a fresh chooseTarget pick (the loggingActions stub always picks pool[0], so this only passes if declaredTargets is actually consulted first)', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: "Stuck in Summoner's Sanctum", types: ['Enchantment'], subtypes: ['Aura'] });
    const bears = state.addCard(you, 'Battlefield', { name: 'Grizzly Bears', types: ['Creature'] });
    const coeurl = state.addCard(you, 'Battlefield', { name: 'Coeurl', types: ['Creature'] });
    const ctx: EffectContext = {
      self: wrapCard(state, self),
      you: wrapPlayer(state, you),
      opponents: [],
      castFrom: 'hand',
      declaredTargets: [wrapCard(state, coeurl)],
    };
    const actions = loggingActions(state, log, self.id);
    const program: SelectUpTo = selectUpTo({ kind: 'query', source: 'creaturesInPlay', owner: 'you' }, 1, 'target', [applyToBound('target', 0, tap())]);
    runProgram(program, ctx, actions);
    expect(coeurl.tapped).toBe(true);
    expect(bears.tapped).toBe(false); // pool[0] — what the chooseTarget fallback would have picked instead
  });

  it('falls back to a fresh chooseTarget pick when ctx.declaredTargets is unset (pre-existing behavior, unchanged)', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: "Stuck in Summoner's Sanctum", types: ['Enchantment'], subtypes: ['Aura'] });
    const bears = state.addCard(you, 'Battlefield', { name: 'Grizzly Bears', types: ['Creature'] });
    const coeurl = state.addCard(you, 'Battlefield', { name: 'Coeurl', types: ['Creature'] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    const program: SelectUpTo = selectUpTo({ kind: 'query', source: 'creaturesInPlay', owner: 'you' }, 1, 'target', [applyToBound('target', 0, tap())]);
    runProgram(program, ctx, actions);
    expect(bears.tapped).toBe(true);
    expect(coeurl.tapped).toBe(false);
  });

  it('drops an illegal declared target (608.2b) and picks up to `max` from what remains, rather than replacing it', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: "Stuck in Summoner's Sanctum", types: ['Enchantment'], subtypes: ['Aura'] });
    const bears = state.addCard(you, 'Battlefield', { name: 'Grizzly Bears', types: ['Creature'] });
    const noLongerLegal = state.addCard(you, 'Battlefield', { name: 'Coeurl', types: ['Creature'] });
    const ctx: EffectContext = {
      self: wrapCard(state, self),
      you: wrapPlayer(state, you),
      opponents: [],
      castFrom: 'hand',
      // A stale declared target no longer in the real pool at resolution
      // (e.g. it left the battlefield between cast and resolution) — 608.2b
      // says drop it, don't substitute a fresh chooseTarget pick for it.
      declaredTargets: [wrapCard(state, state.addCard(you, 'Graveyard', { name: 'Long Gone', types: ['Creature'] }))],
    };
    const actions = loggingActions(state, log, self.id);
    const program: SelectUpTo = selectUpTo({ kind: 'query', source: 'creaturesInPlay', owner: 'you' }, 1, 'target', [applyToBound('target', 0, tap())]);
    runProgram(program, ctx, actions);
    expect(bears.tapped).toBe(false);
    expect(noLongerLegal.tapped).toBe(false);
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

describe('runProgram — Query source: "libraryTop" (2026-09-16, engine-lane primitive escalation, sidequest-catch-a-fish-cooking-campsite/fin-31)', () => {
  it('reads the top `amount` library cards, in real top-to-bottom order — untouched cards further down are never reached', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Sidequest: Catch a Fish', types: ['Enchantment'] });
    const top = state.addCard(you, 'Library', { name: 'Buster Sword', types: ['Artifact'] });
    const second = state.addCard(you, 'Library', { name: 'Grizzly Bears', types: ['Creature'] });
    const third = state.addCard(you, 'Library', { name: 'Plains', types: ['Land'] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    const program: Each = { kind: 'each', input: { kind: 'query', source: 'libraryTop', owner: 'you', amount: 2 }, action: { action: 'tap' } };
    runProgram(program, ctx, actions);
    expect(top.tapped).toBe(true);
    expect(second.tapped).toBe(true);
    expect(third.tapped).toBe(false); // 3rd card is not among the top 2 — never reached
  });

  it('throws a clear error when `amount` is missing/invalid — fail loud, not silent, same convention every other closed-vocabulary field in this file already accepts', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Source', types: [] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    const program: Each = { kind: 'each', input: { kind: 'query', source: 'libraryTop', owner: 'you' }, action: { action: 'tap' } };
    expect(() => runProgram(program, ctx, actions)).toThrow(/requires a positive amount/);
  });

  it('you.libraryTop(amount)/opponents.libraryTop/anyPlayer.libraryTop fluent builders assemble the identical AST', () => {
    expect(you.libraryTop(3).node).toEqual({ kind: 'query', source: 'libraryTop', owner: 'you', amount: 3 });
    expect(opponents.libraryTop(1).node).toEqual({ kind: 'query', source: 'libraryTop', owner: 'opponents', amount: 1 });
    expect(anyPlayer.libraryTop(2).node).toEqual({ kind: 'query', source: 'libraryTop', owner: 'any', amount: 2 });
  });
});

describe('runProgram — Branch, categorical "hasSubtype" condition (2026-09-16, engine-lane primitive escalation, venat-heart-of-hydaelyn-hydaelyn-the-mothercrystal/fin-39)', () => {
  it('SelectUpTo binds a target, Branch gates a further action on that SAME bound target\'s own subtype (Blessing of Light\'s own real "put a counter on target creature; if that creature is legendary, draw a card" shape)', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Venat', types: ['Creature'] });
    const legend = state.addCard(you, 'Battlefield', { name: 'Freya Crescent', types: ['Creature'], subtypes: ['Legendary'] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand', preferTarget: (c) => c.getName() === 'Freya Crescent' };
    const actions = loggingActions(state, log, self.id);
    const program: SelectUpTo = {
      kind: 'selectUpTo',
      from: { kind: 'filter', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, predicate: { field: 'excludeSelf' } },
      max: 1,
      as: 'blessed',
      then: [
        { kind: 'applyToBound', name: 'blessed', index: 0, action: { action: 'putCounter', counterType: '+1/+1', amount: { kind: 'literal', value: 1 } } },
        {
          kind: 'branch',
          condition: { kind: 'hasSubtype', target: { name: 'blessed', index: 0 }, subtype: 'Legendary' },
          then: [{ kind: 'each', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, action: { action: 'tap' } }],
          else: [],
        },
      ],
    };
    runProgram(program, ctx, actions);
    expect(legend.counters['+1/+1']).toBe(1);
    // the condition was TRUE (Freya Crescent is Legendary) — the `then` arm's
    // real "tap every creature you control" ran, unlike the negative case below.
    expect(self.tapped).toBe(true);
    expect(legend.tapped).toBe(true);
  });

  it('resolves false (and runs `else`, never `then`) when the bound target does NOT have the named subtype', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Venat', types: ['Creature'] });
    const plain = state.addCard(you, 'Battlefield', { name: 'Plain Bear', types: ['Creature'] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand', preferTarget: (c) => c.getName() === 'Plain Bear' };
    const actions = loggingActions(state, log, self.id);
    const program: SelectUpTo = {
      kind: 'selectUpTo',
      from: { kind: 'filter', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, predicate: { field: 'excludeSelf' } },
      max: 1,
      as: 'blessed',
      then: [
        {
          kind: 'branch',
          condition: { kind: 'hasSubtype', target: { name: 'blessed', index: 0 }, subtype: 'Legendary' },
          then: [{ kind: 'each', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, action: { action: 'tap' } }],
          else: [],
        },
      ],
    };
    runProgram(program, ctx, actions);
    expect(self.tapped).toBe(false);
    expect(plain.tapped).toBe(false);
  });

  it('resolves false (no throw) when the named binding has no item at that index — same "fewer than expected picked" tolerance ApplyToBound itself already has', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Venat', types: ['Creature'] });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    // `from` is `excludeSelf`-filtered creaturesInPlay(you), and Venat is the
    // ONLY creature — the binding legitimately picks zero items.
    const program: SelectUpTo = {
      kind: 'selectUpTo',
      from: { kind: 'filter', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, predicate: { field: 'excludeSelf' } },
      max: 1,
      as: 'blessed',
      then: [
        {
          kind: 'branch',
          condition: { kind: 'hasSubtype', target: { name: 'blessed', index: 0 }, subtype: 'Legendary' },
          then: [{ kind: 'each', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, action: { action: 'tap' } }],
          else: [],
        },
      ],
    };
    expect(() => runProgram(program, ctx, actions)).not.toThrow();
    expect(self.tapped).toBe(false);
  });

  it('hasSubtype(boundName, boundIndex, subtype) fluent builder assembles the identical AST', () => {
    expect(hasSubtype('blessed', 0, 'Legendary')).toEqual({ kind: 'hasSubtype', target: { name: 'blessed', index: 0 }, subtype: 'Legendary' });
  });
});

describe('runProgram — DrawCard (2026-09-16, engine-lane primitive escalation, venat-heart-of-hydaelyn-hydaelyn-the-mothercrystal/fin-39 — Blessing of Light\'s own real "...if that creature is legendary, draw a card")', () => {
  it('draws exactly 1 real card for ctx.you when amount is omitted', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Hydaelyn', types: ['Creature'] });
    for (let i = 0; i < 3; i++) state.addCard(you, 'Library', { name: `card-${i}` });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    runProgram({ kind: 'drawCard' }, ctx, actions);
    expect(you.hand).toHaveLength(1);
    expect(you.library).toHaveLength(2);
  });

  it('draws `amount` real cards when a literal ValueRef is given', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Hydaelyn', types: ['Creature'] });
    for (let i = 0; i < 5; i++) state.addCard(you, 'Library', { name: `card-${i}` });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
    const actions = loggingActions(state, log, self.id);
    runProgram({ kind: 'drawCard', amount: literal(3) }, ctx, actions);
    expect(you.hand).toHaveLength(3);
    expect(you.library).toHaveLength(2);
  });

  it('real Venat/Hydaelyn shape: SelectUpTo + Branch(hasSubtype) gates the draw on the SAME bound target\'s own subtype, exactly like the putCounter/tap shape above', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Hydaelyn', types: ['Creature'] });
    const legend = state.addCard(you, 'Battlefield', { name: 'Freya Crescent', types: ['Creature'], subtypes: ['Legendary'] });
    for (let i = 0; i < 2; i++) state.addCard(you, 'Library', { name: `card-${i}` });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand', preferTarget: (c) => c.getName() === 'Freya Crescent' };
    const actions = loggingActions(state, log, self.id);
    const program: SelectUpTo = {
      kind: 'selectUpTo',
      from: { kind: 'filter', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, predicate: { field: 'excludeSelf' } },
      max: 1,
      as: 'blessed',
      then: [
        { kind: 'applyToBound', name: 'blessed', index: 0, action: { action: 'putCounter', counterType: '+1/+1', amount: { kind: 'literal', value: 1 } } },
        {
          kind: 'branch',
          condition: { kind: 'hasSubtype', target: { name: 'blessed', index: 0 }, subtype: 'Legendary' },
          then: [{ kind: 'drawCard' }],
          else: [],
        },
      ],
    };
    runProgram(program, ctx, actions);
    expect(legend.counters['+1/+1']).toBe(1);
    expect(you.hand).toHaveLength(1); // the condition was TRUE — the real draw fired
  });

  it('does NOT draw (no throw either) when the guarded subtype condition is false', () => {
    const { state, you, log } = setupState();
    const self = state.addCard(you, 'Battlefield', { name: 'Hydaelyn', types: ['Creature'] });
    const plain = state.addCard(you, 'Battlefield', { name: 'Plain Bear', types: ['Creature'] });
    for (let i = 0; i < 2; i++) state.addCard(you, 'Library', { name: `card-${i}` });
    const ctx: EffectContext = { self: wrapCard(state, self), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand', preferTarget: (c) => c.getName() === 'Plain Bear' };
    const actions = loggingActions(state, log, self.id);
    const program: SelectUpTo = {
      kind: 'selectUpTo',
      from: { kind: 'filter', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, predicate: { field: 'excludeSelf' } },
      max: 1,
      as: 'blessed',
      then: [
        {
          kind: 'branch',
          condition: { kind: 'hasSubtype', target: { name: 'blessed', index: 0 }, subtype: 'Legendary' },
          then: [{ kind: 'drawCard' }],
          else: [],
        },
      ],
    };
    expect(() => runProgram(program, ctx, actions)).not.toThrow();
    expect(you.hand).toHaveLength(0);
  });

  it('drawCard(amount?) fluent builder assembles the identical AST (omitted amount, a plain number, and a ValueRef)', () => {
    expect(drawCard()).toEqual({ kind: 'drawCard' });
    expect(drawCard(2)).toEqual({ kind: 'drawCard', amount: { kind: 'literal', value: 2 } });
    expect(drawCard(selfCounters('+1/+1'))).toEqual({ kind: 'drawCard', amount: { kind: 'selfCounters', counterType: '+1/+1' } });
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

  it('walks a Query source:"libraryTop" node, its own `amount` visible in the detail string with zero execution', () => {
    const events = walkProgram({ kind: 'each', input: { kind: 'query', source: 'libraryTop', owner: 'you', amount: 1 }, action: { action: 'tap' } });
    expect(events.some((e) => e.node === 'query' && e.detail === 'libraryTop(you, amount=1)')).toBe(true);
  });

  it('walks a Branch\'s own categorical "hasSubtype" condition (no ctx/board — the bound target is never actually resolved, just described)', () => {
    const branch: Branch = {
      kind: 'branch',
      condition: { kind: 'hasSubtype', target: { name: 'blessed', index: 0 }, subtype: 'Legendary' },
      then: [{ kind: 'each', input: { kind: 'query', source: 'creaturesInPlay', owner: 'you' }, action: { action: 'tap' } }],
      else: [],
    };
    const events = walkProgram(branch);
    expect(events.some((e) => e.node === 'branch' && e.detail === 'hasSubtype(bound(blessed[0]), Legendary)')).toBe(true);
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

  it('a bare DrawCard node visits with ZERO execution (no ctx, no actions, no board) — omitted amount reads as 1', () => {
    const events = walkProgram({ kind: 'drawCard' });
    expect(events).toEqual([{ node: 'drawCard', detail: 'drawCard(1)' }]);
  });

  it('a DrawCard node with a literal ValueRef amount', () => {
    const events = walkProgram({ kind: 'drawCard', amount: literal(3) });
    expect(events).toEqual([{ node: 'drawCard', detail: 'drawCard(literal(3))' }]);
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
