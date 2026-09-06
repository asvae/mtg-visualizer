import { describe, expect, it } from 'vitest';
import type { CardDefinition, EffectContext, Actions } from './card';
import { GameState, wrapPlayer, wrapCard } from './state';
import type { RealCard } from './state';
import { createEngine, canCastSpell, castSpell, canActivateAbility, activateAbility, resolveTop, stepPriority, canAttack, declareAttackers, canBlock, declareBlockers, resolveCombatDamage, queueExtraTurn, advance } from './engine';
import { PHASES } from './turn';

// Same `{} as Actions` stub stack.test.ts/priority.test.ts already use —
// none of this file's test cards declare real `effects`, so `resolveCard`
// never actually calls into `Actions`.
const noopActions = {} as Actions;

const CREATURE: CardDefinition = {
  name: 'Test Bear',
  manaCost: '{1}{G}',
  typeLine: 'Creature — Bear',
  pt: [2, 2],
};

const INSTANT: CardDefinition = {
  name: 'Test Bolt',
  manaCost: '{R}',
  typeLine: 'Instant',
};

function setupGame() {
  const state = new GameState();
  const you = state.addPlayer('you');
  const opp = state.addPlayer('opp');
  state.addCard(you, 'Battlefield', { name: 'Forest', types: ['Land'], subtypes: ['Forest'] });
  state.addCard(you, 'Battlefield', { name: 'Forest', types: ['Land'], subtypes: ['Forest'] });
  state.addCard(you, 'Battlefield', { name: 'Mountain', types: ['Land'], subtypes: ['Mountain'] });
  // A real library for each player — plenty for any test that advances
  // several turns (the automatic per-turn draw, turn.ts's own
  // runPhaseEntryAction, would otherwise genuinely run a player out and
  // trigger real 704.5a — a test that wants THAT specific case seeds its
  // own empty library deliberately instead, same as this file's own
  // "advance() refuses once a player has lost" describe block does).
  for (let i = 0; i < 20; i++) {
    state.addCard(you, 'Library', { name: `you-library-filler-${i}`, types: [] });
    state.addCard(opp, 'Library', { name: `opp-library-filler-${i}`, types: [] });
  }
  const engine = createEngine(state, [you, opp]);
  // `startGame()` (turn.ts) begins at Untap, turn 1 — advance to Main1
  // (harness.ts's own `advanceToPhase` doc comment notes this same gap
  // between turn.ts's real starting phase and a scenario's usual implicit
  // baseline). Turn 1's own Draw is real-rule-skipped for the active
  // player, and Untap of an empty/all-untapped board is inert, so this is
  // behaviorally identical to a game that's simply reached Main1.
  advance(engine); // Untap -> Upkeep
  advance(engine); // Upkeep -> Draw
  advance(engine); // Draw -> Main1
  const youPlayer = wrapPlayer(state, you);
  const oppPlayer = wrapPlayer(state, opp);
  return { state, you, opp, engine, youPlayer, oppPlayer };
}

function ctxFor(state: GameState, self: ReturnType<typeof wrapCard>, you: ReturnType<typeof wrapPlayer>, opponents: ReturnType<typeof wrapPlayer>[]): EffectContext {
  return { self, you, opponents, castFrom: 'hand' };
}

describe('canCastSpell / castSpell — sorcery-speed timing (307.1a/117.1a)', () => {
  it('allows a non-instant during the caster\'s own main phase with an empty stack', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const real = state.addCard(you, 'Hand', { name: CREATURE.name, types: ['Creature'] });
    const self = wrapCard(state, real);
    const result = canCastSpell(engine, you, CREATURE);
    expect(result.ok).toBe(true);
    const cast = castSpell(engine, you, real, CREATURE, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions);
    expect(cast.ok).toBe(true);
    expect(real.zone).toBe('Stack');
    expect(engine.stack.size).toBe(1);
    expect(you.battlefield.filter((c) => c.tapped)).toHaveLength(2); // {1}{G} paid off 2 Forests
  });

  it('rejects a non-instant when the stack is not empty', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const bolt = state.addCard(you, 'Hand', { name: INSTANT.name });
    const boltSelf = wrapCard(state, bolt);
    expect(castSpell(engine, you, bolt, INSTANT, ctxFor(state, boltSelf, youPlayer, [oppPlayer]), noopActions).ok).toBe(true);

    const bear = state.addCard(you, 'Hand', { name: CREATURE.name, types: ['Creature'] });
    const bearSelf = wrapCard(state, bear);
    const result = canCastSpell(engine, you, CREATURE);
    expect(result).toEqual({ ok: false, reason: expect.stringMatching(/sorcery-speed timing/) });
    // castSpell must mutate nothing when illegal.
    expect(bear.zone).toBe('Hand');
    expect(engine.stack.size).toBe(1);
  });

  it('rejects a non-instant outside the caster\'s main phase', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    // Advance out of Main1 into combat.
    while (engine.turn.turnNumber === 1 && PHASES[engine.turn.phaseIndex] !== 'CombatBegin') advance(engine);
    const real = state.addCard(you, 'Hand', { name: CREATURE.name, types: ['Creature'] });
    const self = wrapCard(state, real);
    expect(canCastSpell(engine, you, CREATURE).ok).toBe(false);
    const cast = castSpell(engine, you, real, CREATURE, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions);
    expect(cast.ok).toBe(false);
    expect(real.zone).toBe('Hand');
  });

  it('an Instant may be cast regardless of phase/stack state', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    while (engine.turn.turnNumber === 1 && PHASES[engine.turn.phaseIndex] !== 'CombatBegin') advance(engine);
    const real = state.addCard(you, 'Hand', { name: INSTANT.name });
    const self = wrapCard(state, real);
    expect(castSpell(engine, you, real, INSTANT, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions).ok).toBe(true);
  });
});

describe('castSpell — mana affordability (601.2g/602.2c)', () => {
  it('rejects a spell the caster cannot afford, mutating nothing', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const expensive: CardDefinition = { name: 'Test Giant', manaCost: '{5}{G}', typeLine: 'Creature — Giant' };
    const real = state.addCard(you, 'Hand', { name: expensive.name, types: ['Creature'] });
    const self = wrapCard(state, real);
    expect(canCastSpell(engine, you, expensive)).toEqual({ ok: false, reason: expect.stringMatching(/cannot afford/) });
    const cast = castSpell(engine, you, real, expensive, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions);
    expect(cast.ok).toBe(false);
    expect(real.zone).toBe('Hand');
    expect(you.battlefield.every((c) => !c.tapped)).toBe(true);
  });
});

describe('resolveTop / stepPriority', () => {
  it('resolving a permanent spell moves it to the battlefield and marks it summoning-sick this turn', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const real = state.addCard(you, 'Hand', { name: CREATURE.name, types: ['Creature'] });
    const self = wrapCard(state, real);
    castSpell(engine, you, real, CREATURE, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions);
    const outcome = stepPriority(engine, [{ pass: true }, { pass: true }]);
    expect(outcome).toBe('resolve-stack');
    expect(real.zone).toBe('Battlefield');
    expect(engine.enteredThisTurn.get(real.id)).toBe(engine.turn.turnNumber);
  });

  it('everyone passing with an empty stack advances the phase instead', () => {
    const { engine } = setupGame();
    const before = engine.turn.phaseIndex;
    const outcome = stepPriority(engine, [{ pass: true }, { pass: true }]);
    expect(outcome).toBe('advance-phase');
    expect(engine.turn.phaseIndex).toBe(before + 1);
  });
});

describe('declareAttackers — summoning sickness (302.6) / tapped (508.1a) / Vigilance (508.1f)', () => {
  function toCombat(engine: ReturnType<typeof setupGame>['engine']) {
    while (PHASES[engine.turn.phaseIndex] !== 'CombatDeclareAttackers') advance(engine);
  }

  it('rejects an attacker that just entered this turn (summoning sickness), tapping nothing', () => {
    const { state, you, engine } = setupGame();
    const creature = state.addCard(you, 'Battlefield', { name: 'Sick Bear', types: ['Creature'] });
    engine.enteredThisTurn.set(creature.id, engine.turn.turnNumber);
    toCombat(engine);
    expect(canAttack(engine, creature)).toEqual({ ok: false, reason: expect.stringMatching(/summoning sickness/) });
    expect(declareAttackers(engine, [creature]).ok).toBe(false);
    expect(creature.tapped).toBe(false);
  });

  it('allows an attacker that has been in play since a prior turn', () => {
    const { state, you, engine } = setupGame();
    const creature = state.addCard(you, 'Battlefield', { name: 'Veteran Bear', types: ['Creature'] });
    // No enteredThisTurn entry at all = "always been in play," same as a scenario's initial board setup.
    toCombat(engine);
    expect(canAttack(engine, creature).ok).toBe(true);
    expect(declareAttackers(engine, [creature]).ok).toBe(true);
    expect(creature.tapped).toBe(true);
  });

  it('a creature with Haste ignores summoning sickness', () => {
    const { state, you, engine } = setupGame();
    const creature = state.addCard(you, 'Battlefield', { name: 'Hasty Bear', types: ['Creature'], keywords: ['Haste'] });
    engine.enteredThisTurn.set(creature.id, engine.turn.turnNumber);
    toCombat(engine);
    expect(declareAttackers(engine, [creature]).ok).toBe(true);
  });

  it('a creature with Vigilance does not tap to attack', () => {
    const { state, you, engine } = setupGame();
    const creature = state.addCard(you, 'Battlefield', { name: 'Watchful Bear', types: ['Creature'], keywords: ['Vigilance'] });
    toCombat(engine);
    expect(declareAttackers(engine, [creature]).ok).toBe(true);
    expect(creature.tapped).toBe(false);
  });

  it('rejects an already-tapped creature as an attacker', () => {
    const { state, you, engine } = setupGame();
    const creature = state.addCard(you, 'Battlefield', { name: 'Tapped Bear', types: ['Creature'] });
    state.tap(creature);
    toCombat(engine);
    expect(declareAttackers(engine, [creature])).toEqual({ ok: false, reason: expect.stringMatching(/tapped creatures cannot attack/) });
  });

  it('rejects declaring attackers outside the Declare Attackers step', () => {
    const { state, you, engine } = setupGame();
    const creature = state.addCard(you, 'Battlefield', { name: 'Early Bear', types: ['Creature'] });
    expect(declareAttackers(engine, [creature])).toEqual({ ok: false, reason: expect.stringMatching(/Declare Attackers step/) });
  });

  it('one illegal attacker in the batch means NONE of them get tapped', () => {
    const { state, you, engine } = setupGame();
    const legal = state.addCard(you, 'Battlefield', { name: 'Legal Bear', types: ['Creature'] });
    const sick = state.addCard(you, 'Battlefield', { name: 'Sick Bear 2', types: ['Creature'] });
    engine.enteredThisTurn.set(sick.id, engine.turn.turnNumber);
    toCombat(engine);
    expect(declareAttackers(engine, [legal, sick]).ok).toBe(false);
    expect(legal.tapped).toBe(false);
  });
});

describe('canBlock / declareBlockers (509)', () => {
  function toDeclareAttackers(engine: ReturnType<typeof setupGame>['engine']) {
    while (PHASES[engine.turn.phaseIndex] !== 'CombatDeclareAttackers') advance(engine);
  }
  function toDeclareBlockers(engine: ReturnType<typeof setupGame>['engine'], attackers: RealCard[]) {
    toDeclareAttackers(engine);
    declareAttackers(engine, attackers);
    advance(engine);
  }

  it('allows an opponent creature to block a declared attacker', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker = state.addCard(you, 'Battlefield', { name: 'Attacker', types: ['Creature'] });
    const blocker = state.addCard(opp, 'Battlefield', { name: 'Blocker', types: ['Creature'] });
    toDeclareBlockers(engine, [attacker]);
    expect(canBlock(engine, blocker, attacker).ok).toBe(true);
    expect(declareBlockers(engine, [{ blocker, attacker }]).ok).toBe(true);
    expect(engine.blockers.get(attacker.id)).toEqual([blocker]);
  });

  it('rejects blocking outside the Declare Blockers step', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker = state.addCard(you, 'Battlefield', { name: 'Attacker', types: ['Creature'] });
    const blocker = state.addCard(opp, 'Battlefield', { name: 'Blocker', types: ['Creature'] });
    toDeclareAttackers(engine);
    declareAttackers(engine, [attacker]);
    expect(canBlock(engine, blocker, attacker)).toEqual({ ok: false, reason: expect.stringMatching(/Declare Blockers step/) });
  });

  it('rejects blocking a creature that never attacked', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker = state.addCard(you, 'Battlefield', { name: 'Attacker', types: ['Creature'] });
    const bystander = state.addCard(you, 'Battlefield', { name: 'Bystander', types: ['Creature'] });
    const blocker = state.addCard(opp, 'Battlefield', { name: 'Blocker', types: ['Creature'] });
    toDeclareBlockers(engine, [attacker]);
    expect(canBlock(engine, blocker, bystander)).toEqual({ ok: false, reason: expect.stringMatching(/not a declared attacker/) });
  });

  it("rejects a blocker controlled by the attacker's own controller", () => {
    const { state, you, engine } = setupGame();
    const attacker = state.addCard(you, 'Battlefield', { name: 'Attacker', types: ['Creature'] });
    const ownBlocker = state.addCard(you, 'Battlefield', { name: 'Own Blocker', types: ['Creature'] });
    toDeclareBlockers(engine, [attacker]);
    expect(canBlock(engine, ownBlocker, attacker)).toEqual({ ok: false, reason: expect.stringMatching(/opponent/) });
  });

  it('rejects a tapped blocker', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker = state.addCard(you, 'Battlefield', { name: 'Attacker', types: ['Creature'] });
    const blocker = state.addCard(opp, 'Battlefield', { name: 'Blocker', types: ['Creature'] });
    state.tap(blocker);
    toDeclareBlockers(engine, [attacker]);
    expect(canBlock(engine, blocker, attacker)).toEqual({ ok: false, reason: expect.stringMatching(/tapped creatures can't be declared as blockers/) });
  });

  it('rejects blocking an Unblockable attacker', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker = state.addCard(you, 'Battlefield', { name: 'Ghost', types: ['Creature'], keywords: ['Unblockable'] });
    const blocker = state.addCard(opp, 'Battlefield', { name: 'Blocker', types: ['Creature'] });
    toDeclareBlockers(engine, [attacker]);
    expect(canBlock(engine, blocker, attacker)).toEqual({ ok: false, reason: expect.stringMatching(/can't be blocked/) });
  });

  it('rejects a non-Flying/Reach blocker against a Flying attacker, allows Reach', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker = state.addCard(you, 'Battlefield', { name: 'Flier', types: ['Creature'], keywords: ['Flying'] });
    const grounded = state.addCard(opp, 'Battlefield', { name: 'Grounded', types: ['Creature'] });
    const reacher = state.addCard(opp, 'Battlefield', { name: 'Reacher', types: ['Creature'], keywords: ['Reach'] });
    toDeclareBlockers(engine, [attacker]);
    expect(canBlock(engine, grounded, attacker)).toEqual({ ok: false, reason: expect.stringMatching(/only a creature with flying or reach/) });
    expect(canBlock(engine, reacher, attacker).ok).toBe(true);
  });

  it('rejects a non-creature blocker', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker = state.addCard(you, 'Battlefield', { name: 'Attacker', types: ['Creature'] });
    const artifact = state.addCard(opp, 'Battlefield', { name: 'Not A Creature', types: ['Artifact'] });
    toDeclareBlockers(engine, [attacker]);
    expect(canBlock(engine, artifact, attacker)).toEqual({ ok: false, reason: expect.stringMatching(/not a creature/) });
  });

  it('rejects a Menace attacker blocked by only one creature, mutating nothing', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker = state.addCard(you, 'Battlefield', { name: 'Menacing', types: ['Creature'], keywords: ['Menace'] });
    const blocker = state.addCard(opp, 'Battlefield', { name: 'Blocker', types: ['Creature'] });
    toDeclareBlockers(engine, [attacker]);
    expect(declareBlockers(engine, [{ blocker, attacker }])).toEqual({ ok: false, reason: expect.stringMatching(/menace/) });
    expect(engine.blockers.size).toBe(0);
  });

  it('allows a Menace attacker blocked by two creatures', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker = state.addCard(you, 'Battlefield', { name: 'Menacing', types: ['Creature'], keywords: ['Menace'] });
    const blocker1 = state.addCard(opp, 'Battlefield', { name: 'Blocker 1', types: ['Creature'] });
    const blocker2 = state.addCard(opp, 'Battlefield', { name: 'Blocker 2', types: ['Creature'] });
    toDeclareBlockers(engine, [attacker]);
    expect(declareBlockers(engine, [{ blocker: blocker1, attacker }, { blocker: blocker2, attacker }]).ok).toBe(true);
    expect(engine.blockers.get(attacker.id)).toHaveLength(2);
  });

  it('rejects assigning the same blocker to two attackers, mutating nothing', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker1 = state.addCard(you, 'Battlefield', { name: 'Attacker 1', types: ['Creature'] });
    const attacker2 = state.addCard(you, 'Battlefield', { name: 'Attacker 2', types: ['Creature'] });
    const blocker = state.addCard(opp, 'Battlefield', { name: 'Blocker', types: ['Creature'] });
    toDeclareBlockers(engine, [attacker1, attacker2]);
    expect(declareBlockers(engine, [{ blocker, attacker: attacker1 }, { blocker, attacker: attacker2 }])).toEqual({
      ok: false,
      reason: expect.stringMatching(/can only block one attacker/),
    });
    expect(engine.blockers.size).toBe(0);
  });

  it('one illegal pairing in the batch rejects the whole declaration (all-or-nothing)', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker1 = state.addCard(you, 'Battlefield', { name: 'Attacker 1', types: ['Creature'] });
    const attacker2 = state.addCard(you, 'Battlefield', { name: 'Attacker 2', types: ['Creature'] });
    const legalBlocker = state.addCard(opp, 'Battlefield', { name: 'Legal Blocker', types: ['Creature'] });
    const tappedBlocker = state.addCard(opp, 'Battlefield', { name: 'Tapped Blocker', types: ['Creature'] });
    state.tap(tappedBlocker);
    toDeclareBlockers(engine, [attacker1, attacker2]);
    expect(declareBlockers(engine, [{ blocker: legalBlocker, attacker: attacker1 }, { blocker: tappedBlocker, attacker: attacker2 }]).ok).toBe(false);
    expect(engine.blockers.size).toBe(0);
  });
});

describe('resolveCombatDamage (510)', () => {
  function toDeclareAttackers(engine: ReturnType<typeof setupGame>['engine']) {
    while (PHASES[engine.turn.phaseIndex] !== 'CombatDeclareAttackers') advance(engine);
  }

  it('an unblocked attacker deals its full power to the defending player', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker = state.addCard(you, 'Battlefield', { name: 'Attacker', types: ['Creature'], basePower: 3, baseToughness: 3 });
    toDeclareAttackers(engine);
    declareAttackers(engine, [attacker]);
    advance(engine);
    declareBlockers(engine, []);
    const before = opp.life;
    const result = resolveCombatDamage(engine);
    expect(opp.life).toBe(before - 3);
    expect(result.entries).toEqual([]);
  });

  it('a 1-1 trade deals damage to both creatures and none to the defending player', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker = state.addCard(you, 'Battlefield', { name: 'Attacker', types: ['Creature'], basePower: 2, baseToughness: 2 });
    const blocker = state.addCard(opp, 'Battlefield', { name: 'Blocker', types: ['Creature'], basePower: 2, baseToughness: 2 });
    toDeclareAttackers(engine);
    declareAttackers(engine, [attacker]);
    advance(engine);
    declareBlockers(engine, [{ blocker, attacker }]);
    const before = opp.life;
    const result = resolveCombatDamage(engine);
    expect(opp.life).toBe(before);
    expect(result.entries).toEqual(
      expect.arrayContaining([
        { card: attacker, damage: 2, lethal: true },
        { card: blocker, damage: 2, lethal: true },
      ]),
    );
  });

  it('Trample assigns lethal damage to the blocker and overflows the rest to the defending player', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker = state.addCard(you, 'Battlefield', { name: 'Trampler', types: ['Creature'], basePower: 5, baseToughness: 5, keywords: ['Trample'] });
    const blocker = state.addCard(opp, 'Battlefield', { name: 'Blocker', types: ['Creature'], basePower: 1, baseToughness: 2 });
    toDeclareAttackers(engine);
    declareAttackers(engine, [attacker]);
    advance(engine);
    declareBlockers(engine, [{ blocker, attacker }]);
    const before = opp.life;
    const result = resolveCombatDamage(engine);
    expect(opp.life).toBe(before - 3); // 5 power - 2 lethal-to-blocker = 3 tramples over
    const blockerEntry = result.entries.find((e) => e.card === blocker)!;
    expect(blockerEntry).toEqual({ card: blocker, damage: 2, lethal: true });
  });

  it('Deathtouch marks a single point of damage as lethal regardless of toughness', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker = state.addCard(you, 'Battlefield', { name: 'Toucher', types: ['Creature'], basePower: 1, baseToughness: 1, keywords: ['Deathtouch'] });
    const blocker = state.addCard(opp, 'Battlefield', { name: 'Big Blocker', types: ['Creature'], basePower: 1, baseToughness: 4 });
    toDeclareAttackers(engine);
    declareAttackers(engine, [attacker]);
    advance(engine);
    declareBlockers(engine, [{ blocker, attacker }]);
    const result = resolveCombatDamage(engine);
    const blockerEntry = result.entries.find((e) => e.card === blocker)!;
    expect(blockerEntry).toEqual({ card: blocker, damage: 1, lethal: true });
  });

  it('First Strike: a blocker killed in the first-strike step deals no damage back', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker = state.addCard(you, 'Battlefield', { name: 'Fast Striker', types: ['Creature'], basePower: 3, baseToughness: 3, keywords: ['FirstStrike'] });
    const blocker = state.addCard(opp, 'Battlefield', { name: 'Slow Blocker', types: ['Creature'], basePower: 3, baseToughness: 2 });
    toDeclareAttackers(engine);
    declareAttackers(engine, [attacker]);
    advance(engine);
    declareBlockers(engine, [{ blocker, attacker }]);
    const result = resolveCombatDamage(engine);
    const attackerEntry = result.entries.find((e) => e.card === attacker);
    expect(attackerEntry).toBeUndefined(); // took no damage at all — the blocker never got to swing
    const blockerEntry = result.entries.find((e) => e.card === blocker)!;
    expect(blockerEntry).toEqual({ card: blocker, damage: 3, lethal: true });
  });

  it('Double Strike deals damage in both sub-steps against a blocker that survives the first', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker = state.addCard(you, 'Battlefield', { name: 'Double Striker', types: ['Creature'], basePower: 2, baseToughness: 4, keywords: ['DoubleStrike'] });
    const blocker = state.addCard(opp, 'Battlefield', { name: 'Tough Blocker', types: ['Creature'], basePower: 2, baseToughness: 5 });
    toDeclareAttackers(engine);
    declareAttackers(engine, [attacker]);
    advance(engine);
    declareBlockers(engine, [{ blocker, attacker }]);
    const result = resolveCombatDamage(engine);
    const blockerEntry = result.entries.find((e) => e.card === blocker)!;
    expect(blockerEntry).toEqual({ card: blocker, damage: 4, lethal: false }); // 2 (first strike) + 2 (regular) = 4, still short of 5 toughness
    const attackerEntry = result.entries.find((e) => e.card === attacker)!;
    expect(attackerEntry).toEqual({ card: attacker, damage: 2, lethal: false }); // the blocker itself only ever swings once, in the regular step — 2 damage, short of the attacker's own 4 toughness
  });

  it('a blocked attacker whose blocker already died in the first-strike step deals no further damage without Trample', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker = state.addCard(you, 'Battlefield', { name: 'Double Striker', types: ['Creature'], basePower: 3, baseToughness: 3, keywords: ['DoubleStrike'] });
    const blocker = state.addCard(opp, 'Battlefield', { name: 'Fragile Blocker', types: ['Creature'], basePower: 1, baseToughness: 2 });
    toDeclareAttackers(engine);
    declareAttackers(engine, [attacker]);
    advance(engine);
    declareBlockers(engine, [{ blocker, attacker }]);
    const before = opp.life;
    const result = resolveCombatDamage(engine);
    expect(opp.life).toBe(before); // no Trample — the second strike has nothing left to hit
    const attackerEntry = result.entries.find((e) => e.card === attacker);
    expect(attackerEntry).toBeUndefined(); // the blocker died before ever swinging back
    const blockerEntry = result.entries.find((e) => e.card === blocker)!;
    expect(blockerEntry).toEqual({ card: blocker, damage: 3, lethal: true });
  });
});

describe('canActivateAbility / activateAbility (602.1)', () => {
  const TAP_ABILITY: CardDefinition = {
    name: 'Test Tapper',
    manaCost: '{1}{G}',
    typeLine: 'Creature — Test',
    activationCost: '{T}',
    effects: [],
  };

  it('allows activating a {T}-cost ability on an untapped permanent you control', () => {
    const { state, you, engine } = setupGame();
    const permanent = state.addCard(you, 'Battlefield', { name: TAP_ABILITY.name, types: ['Creature'] });
    const self = wrapCard(state, permanent);
    const youPlayer = wrapPlayer(state, you);
    expect(canActivateAbility(engine, you, permanent, TAP_ABILITY).ok).toBe(true);
    const result = activateAbility(engine, you, permanent, TAP_ABILITY, { self, you: youPlayer, opponents: [], castFrom: 'hand' }, noopActions);
    expect(result.ok).toBe(true);
    expect(permanent.tapped).toBe(true);
    expect(engine.stack.size).toBe(1);
  });

  it('rejects activating an already-tapped {T}-cost ability, mutating nothing', () => {
    const { state, you, engine } = setupGame();
    const permanent = state.addCard(you, 'Battlefield', { name: TAP_ABILITY.name, types: ['Creature'] });
    state.tap(permanent);
    expect(canActivateAbility(engine, you, permanent, TAP_ABILITY)).toEqual({ ok: false, reason: expect.stringMatching(/already tapped/) });
    expect(engine.stack.size).toBe(0);
  });

  it("rejects activating a permanent you don't control", () => {
    const { state, you, opp, engine } = setupGame();
    const permanent = state.addCard(opp, 'Battlefield', { name: TAP_ABILITY.name, types: ['Creature'] });
    expect(canActivateAbility(engine, you, permanent, TAP_ABILITY)).toEqual({ ok: false, reason: expect.stringMatching(/do not control/) });
  });

  it('rejects a sorcery-speed-restricted ability outside a main phase with an empty stack', () => {
    const { state, you, engine } = setupGame();
    const sorceryOnly: CardDefinition = { ...TAP_ABILITY, activationCost: '{T} (activate only as a sorcery)' };
    const permanent = state.addCard(you, 'Battlefield', { name: sorceryOnly.name, types: ['Creature'] });
    while (PHASES[engine.turn.phaseIndex] !== 'CombatBegin') advance(engine);
    expect(canActivateAbility(engine, you, permanent, sorceryOnly)).toEqual({ ok: false, reason: expect.stringMatching(/sorcery-speed timing/) });
  });

  it('rejects a cost component this engine cannot pay (Sacrifice/Crew/Equip/etc), not silently mispaying', () => {
    const { state, you, engine } = setupGame();
    const sacCost: CardDefinition = { ...TAP_ABILITY, activationCost: '{1}, Sacrifice another creature' };
    const permanent = state.addCard(you, 'Battlefield', { name: sacCost.name, types: ['Creature'] });
    expect(canActivateAbility(engine, you, permanent, sacCost)).toEqual({ ok: false, reason: expect.stringMatching(/unsupported component/) });
  });

  it('rejects an unaffordable mana cost, mutating nothing', () => {
    const { state, you, engine } = setupGame();
    const expensive: CardDefinition = { ...TAP_ABILITY, activationCost: '{5}{G}{G}, {T}' };
    const permanent = state.addCard(you, 'Battlefield', { name: expensive.name, types: ['Creature'] });
    expect(canActivateAbility(engine, you, permanent, expensive)).toEqual({ ok: false, reason: expect.stringMatching(/cannot afford/) });
    expect(permanent.tapped).toBe(false);
    expect(you.battlefield.every((c) => !c.tapped)).toBe(true);
  });

  it("an activated ability's own resolution does not relocate its source permanent (602.1 has no such rule)", () => {
    const { state, you, engine } = setupGame();
    const permanent = state.addCard(you, 'Battlefield', { name: TAP_ABILITY.name, types: ['Creature'] });
    const self = wrapCard(state, permanent);
    const youPlayer = wrapPlayer(state, you);
    activateAbility(engine, you, permanent, TAP_ABILITY, { self, you: youPlayer, opponents: [], castFrom: 'hand' }, noopActions);
    resolveTop(engine);
    expect(permanent.zone).toBe('Battlefield');
  });
});

describe('Equip (301.5c) — canActivateAbility/activateAbility', () => {
  const EQUIPMENT: CardDefinition = {
    name: 'Test Blade',
    manaCost: '{1}',
    typeLine: 'Artifact — Equipment',
    activationCost: 'Equip {1}',
    effects: [],
  };

  it('allows activating a real "Equip {N}" mana-only cost during a main phase with an empty stack', () => {
    const { state, you, engine } = setupGame();
    const permanent = state.addCard(you, 'Battlefield', { name: EQUIPMENT.name, types: ['Artifact'] });
    const self = wrapCard(state, permanent);
    const youPlayer = wrapPlayer(state, you);
    expect(canActivateAbility(engine, you, permanent, EQUIPMENT).ok).toBe(true);
    const result = activateAbility(engine, you, permanent, EQUIPMENT, { self, you: youPlayer, opponents: [], castFrom: 'hand' }, noopActions);
    expect(result.ok).toBe(true);
    expect(engine.stack.size).toBe(1);
    // Equip has no {T} in its own cost — the Equipment itself is never
    // tapped by activating it (real 301.5c/read of Card.java's own equip
    // ability generation: no `Tap$ True` on the cost side).
    expect(permanent.tapped).toBe(false);
  });

  it('rejects equip outside a main phase with an empty stack (301.5c), even though "Equip {N}" has no "activate only as a sorcery" text', () => {
    const { state, you, engine } = setupGame();
    const permanent = state.addCard(you, 'Battlefield', { name: EQUIPMENT.name, types: ['Artifact'] });
    while (PHASES[engine.turn.phaseIndex] !== 'CombatBegin') advance(engine);
    expect(canActivateAbility(engine, you, permanent, EQUIPMENT)).toEqual({ ok: false, reason: expect.stringMatching(/301\.5c/) });
  });

  it('rejects an unaffordable "Equip {N}" cost (bard-s-bow-shaped Equip {6}), mutating nothing', () => {
    const { state, you, engine } = setupGame();
    const expensive: CardDefinition = { ...EQUIPMENT, activationCost: 'Equip {6}' };
    const permanent = state.addCard(you, 'Battlefield', { name: expensive.name, types: ['Artifact'] });
    expect(canActivateAbility(engine, you, permanent, expensive)).toEqual({ ok: false, reason: expect.stringMatching(/cannot afford/) });
    expect(you.battlefield.every((c) => !c.tapped)).toBe(true);
  });

  it('a non-mana equip cost (dark-knight-s-greatsword-shaped "Equip—Pay 3 life") still correctly rejects as unsupported — stripping "Equip" does not accidentally legalize Pay-life', () => {
    const { state, you, engine } = setupGame();
    const payLife: CardDefinition = { ...EQUIPMENT, activationCost: 'Equip—Pay 3 life (activate only once each turn)' };
    const permanent = state.addCard(you, 'Battlefield', { name: payLife.name, types: ['Artifact'] });
    expect(canActivateAbility(engine, you, permanent, payLife)).toEqual({ ok: false, reason: expect.stringMatching(/unsupported component/) });
  });

  it('a non-Equipment permanent with a {T}-cost ability is unaffected by 301.5c (no false-positive sorcery-speed gate)', () => {
    const { state, you, engine } = setupGame();
    const nonEquipment: CardDefinition = { name: 'Test Tapper 2', manaCost: '{1}', typeLine: 'Creature — Test', activationCost: '{T}', effects: [] };
    const permanent = state.addCard(you, 'Battlefield', { name: nonEquipment.name, types: ['Creature'] });
    while (PHASES[engine.turn.phaseIndex] !== 'CombatBegin') advance(engine);
    expect(canActivateAbility(engine, you, permanent, nonEquipment).ok).toBe(true);
  });
});

describe('Crew (702.121b/c) — canActivateAbility/activateAbility', () => {
  const VEHICLE: CardDefinition = {
    name: 'Test Vehicle',
    manaCost: '{3}',
    typeLine: 'Artifact — Vehicle',
    crewCost: 2,
    activationCost: 'Crew 2 (tap creatures with total power 2 or more)',
    effects: [{ kind: 'animate', target: 'self', types: ['Artifact', 'Creature'] }],
  };

  it('allows crewing with one creature whose power alone meets the total, taps only the creature (not the Vehicle), and the resolved ability really animates it', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const vehicle = state.addCard(you, 'Battlefield', { name: VEHICLE.name, types: ['Artifact'] });
    const crewer = state.addCard(you, 'Battlefield', { name: 'Crewer', types: ['Creature'], basePower: 2, baseToughness: 2 });
    const self = wrapCard(state, vehicle);
    // A real `animate` (unlike `noopActions`) so the ability's own
    // `{ kind: 'animate' }` effect genuinely resolves, same "just enough
    // of `Actions` for this test card's own effect" convention
    // `saga.test.ts`'s own `testActions` already established.
    const animateActions = { animate: (target, types) => state.animate(state.cards.get(target.getId())!, types) } as Actions;
    expect(canActivateAbility(engine, you, vehicle, VEHICLE, undefined, [crewer]).ok).toBe(true);
    const result = activateAbility(engine, you, vehicle, VEHICLE, ctxFor(state, self, youPlayer, [oppPlayer]), animateActions, undefined, [crewer]);
    expect(result.ok).toBe(true);
    expect(crewer.tapped).toBe(true);
    expect(vehicle.tapped).toBe(false);
    expect(engine.stack.size).toBe(1);
    resolveTop(engine);
    expect(wrapCard(state, vehicle).isCreature()).toBe(true);
  });

  it('allows crewing with MULTIPLE creatures whose combined power meets the total', () => {
    const { state, you, engine } = setupGame();
    const vehicle = state.addCard(you, 'Battlefield', { name: VEHICLE.name, types: ['Artifact'] });
    const crewerA = state.addCard(you, 'Battlefield', { name: 'Crewer A', types: ['Creature'], basePower: 1, baseToughness: 1 });
    const crewerB = state.addCard(you, 'Battlefield', { name: 'Crewer B', types: ['Creature'], basePower: 1, baseToughness: 1 });
    expect(canActivateAbility(engine, you, vehicle, VEHICLE, undefined, [crewerA, crewerB]).ok).toBe(true);
  });

  it("rejects crewing when the tapped creatures' total power is below crewCost, mutating nothing", () => {
    const { state, you, engine } = setupGame();
    const vehicle = state.addCard(you, 'Battlefield', { name: VEHICLE.name, types: ['Artifact'] });
    const weak = state.addCard(you, 'Battlefield', { name: 'Weak', types: ['Creature'], basePower: 1, baseToughness: 1 });
    expect(canActivateAbility(engine, you, vehicle, VEHICLE, undefined, [weak])).toEqual({ ok: false, reason: expect.stringMatching(/total power/) });
    expect(weak.tapped).toBe(false);
  });

  it('rejects crewing with no creatures specified at all', () => {
    const { state, you, engine } = setupGame();
    const vehicle = state.addCard(you, 'Battlefield', { name: VEHICLE.name, types: ['Artifact'] });
    expect(canActivateAbility(engine, you, vehicle, VEHICLE)).toEqual({ ok: false, reason: expect.stringMatching(/no creatures specified/) });
  });

  it("rejects crewing with a creature the controller doesn't control, mutating nothing", () => {
    const { state, you, opp, engine } = setupGame();
    const vehicle = state.addCard(you, 'Battlefield', { name: VEHICLE.name, types: ['Artifact'] });
    const oppCreature = state.addCard(opp, 'Battlefield', { name: 'Opp Creature', types: ['Creature'], basePower: 5, baseToughness: 5 });
    expect(canActivateAbility(engine, you, vehicle, VEHICLE, undefined, [oppCreature])).toEqual({ ok: false, reason: expect.stringMatching(/not a permanent you control/) });
    expect(oppCreature.tapped).toBe(false);
  });

  it('rejects crewing with an already-tapped creature', () => {
    const { state, you, engine } = setupGame();
    const vehicle = state.addCard(you, 'Battlefield', { name: VEHICLE.name, types: ['Artifact'] });
    const tapped = state.addCard(you, 'Battlefield', { name: 'Tapped', types: ['Creature'], basePower: 5, baseToughness: 5 });
    state.tap(tapped);
    expect(canActivateAbility(engine, you, vehicle, VEHICLE, undefined, [tapped])).toEqual({ ok: false, reason: expect.stringMatching(/already tapped/) });
  });

  it('rejects crewing with a non-creature permanent even if it has high power (this engine has no "power" outside effectivePT anyway, but the type check must fire regardless)', () => {
    const { state, you, engine } = setupGame();
    const vehicle = state.addCard(you, 'Battlefield', { name: VEHICLE.name, types: ['Artifact'] });
    const notACreature = state.addCard(you, 'Battlefield', { name: 'Just An Artifact', types: ['Artifact'] });
    expect(canActivateAbility(engine, you, vehicle, VEHICLE, undefined, [notACreature])).toEqual({ ok: false, reason: expect.stringMatching(/not a creature/) });
  });

  it('crewing is legal outside a main phase / with a non-empty stack (702.121c has no sorcery-speed restriction)', () => {
    const { state, you, engine } = setupGame();
    const vehicle = state.addCard(you, 'Battlefield', { name: VEHICLE.name, types: ['Artifact'] });
    const crewer = state.addCard(you, 'Battlefield', { name: 'Crewer', types: ['Creature'], basePower: 2, baseToughness: 2 });
    while (PHASES[engine.turn.phaseIndex] !== 'CombatBegin') advance(engine);
    expect(canActivateAbility(engine, you, vehicle, VEHICLE, undefined, [crewer]).ok).toBe(true);
  });

  it('a freshly-entered (summoning-sick) creature can still crew — 302.6 restricts its OWN {T} ability/attacking, not being tapped as a cost by another permanent', () => {
    const { state, you, engine } = setupGame();
    const vehicle = state.addCard(you, 'Battlefield', { name: VEHICLE.name, types: ['Artifact'] });
    const sickCreature = state.addCard(you, 'Battlefield', { name: 'Sick Crewer', types: ['Creature'], basePower: 2, baseToughness: 2 });
    engine.enteredThisTurn.set(sickCreature.id, engine.turn.turnNumber);
    expect(canActivateAbility(engine, you, vehicle, VEHICLE, undefined, [sickCreature]).ok).toBe(true);
  });
});

describe('Non-basic mana sources (mana.ts\'s narrow gap #5 slice) — real ETB derivation + 302.6', () => {
  const MANA_ROCK: CardDefinition = {
    name: 'Test Mana Rock',
    manaCost: '{1}',
    typeLine: 'Artifact',
    staticAbilities: ['{T}: Add {W}.'],
  };

  const MANA_DORK: CardDefinition = {
    name: 'Test Mana Dork',
    manaCost: '{G}',
    typeLine: 'Creature — Elf Druid',
    pt: [1, 1],
    staticAbilities: ['{T}: Add {G}.'],
  };

  const DUAL_ROCK: CardDefinition = {
    name: 'Test Dual Rock',
    manaCost: '{1}',
    typeLine: 'Artifact',
    staticAbilities: ['{T}: Add {G} or {U}.'],
  };

  it('a resolved non-Land mana-ability permanent (an artifact) really becomes a payable mana source', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const rockReal = state.addCard(you, 'Hand', { name: MANA_ROCK.name, types: ['Artifact'] });
    const rockSelf = wrapCard(state, rockReal);
    castSpell(engine, you, rockReal, MANA_ROCK, ctxFor(state, rockSelf, youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    expect(rockReal.manaAbility).toBe('W');

    const whiteSpell: CardDefinition = { name: 'Test White Spell', manaCost: '{W}', typeLine: 'Sorcery', effects: [] };
    expect(canCastSpell(engine, you, whiteSpell).ok).toBe(true);
    const spellReal = state.addCard(you, 'Hand', { name: whiteSpell.name });
    const spellSelf = wrapCard(state, spellReal);
    castSpell(engine, you, spellReal, whiteSpell, ctxFor(state, spellSelf, youPlayer, [oppPlayer]), noopActions);
    expect(rockReal.tapped).toBe(true);
  });

  it('a freshly-resolved mana-dork CREATURE cannot pay with its own mana ability the turn it enters (302.6)', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    // setupGame's own board has 2 Forests + 1 Mountain; casting the dork's
    // own {G} cost taps ONE of those Forests, leaving exactly 1 untapped
    // real {G} source (the other Forest) once the dork resolves — so
    // {G}{G} is affordable ONLY if the (still summoning-sick) dork's own
    // ability incorrectly counts as a second source.
    const dorkReal = state.addCard(you, 'Hand', { name: MANA_DORK.name, types: ['Creature'] });
    const dorkSelf = wrapCard(state, dorkReal);
    castSpell(engine, you, dorkReal, MANA_DORK, ctxFor(state, dorkSelf, youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    expect(dorkReal.manaAbility).toBe('G');

    const greenSpell: CardDefinition = { name: 'Test Green Spell', manaCost: '{G}{G}', typeLine: 'Sorcery', effects: [] };
    expect(canCastSpell(engine, you, greenSpell)).toEqual({ ok: false, reason: expect.stringMatching(/cannot afford/) });
  });

  it('a mana-dork creature CAN pay with its own mana ability on a later turn (no longer summoning-sick)', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const dorkReal = state.addCard(you, 'Hand', { name: MANA_DORK.name, types: ['Creature'] });
    const dorkSelf = wrapCard(state, dorkReal);
    castSpell(engine, you, dorkReal, MANA_DORK, ctxFor(state, dorkSelf, youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    const startTurn = engine.turn.turnNumber;
    do {
      advance(engine);
    } while (!(PHASES[engine.turn.phaseIndex] === 'Main1' && engine.turn.turnNumber !== startTurn && engine.turn.activePlayerIndex === 0));

    const tooGreenSpell: CardDefinition = { name: 'Test Too Green Spell', manaCost: '{G}{G}{G}', typeLine: 'Sorcery', effects: [] };
    expect(canCastSpell(engine, you, tooGreenSpell).ok).toBe(true);
  });

  it('a dual-color "{T}: Add {G} or {U}." ability is NOT recognized (not modeled — see mana.ts\'s own scope note)', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const rockReal = state.addCard(you, 'Hand', { name: DUAL_ROCK.name, types: ['Artifact'] });
    const rockSelf = wrapCard(state, rockReal);
    castSpell(engine, you, rockReal, DUAL_ROCK, ctxFor(state, rockSelf, youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    expect(rockReal.manaAbility).toBeUndefined();
  });
});

describe('Sacrifice cost trusted when matched by the card\'s own effects (Ahriman/Phantom Train/Quina-shaped)', () => {
  const AHRIMAN_SHAPED: CardDefinition = {
    name: 'Test Ahriman',
    manaCost: '{2}{B}',
    typeLine: 'Creature — Eye Horror',
    pt: [2, 2],
    activationCost: '{3}, Sacrifice another creature or artifact',
    effects: [
      { kind: 'sacrifice', owner: 'you', validType: 'creature-or-artifact', notSelf: true },
      { kind: 'drawCard' },
    ],
  };

  const GOLD_SAUCER_SHAPED: CardDefinition = {
    name: 'Test Gold Saucer',
    manaCost: '',
    typeLine: 'Land — Town',
    activationCost: '{3}, Sacrifice two artifacts',
    effects: [{ kind: 'drawCard' }],
  };

  it('is legal once the mana portion is affordable (a real, matched sacrifice effect is trusted, not re-paid)', () => {
    const { state, you, engine } = setupGame();
    const source = state.addCard(you, 'Battlefield', { name: AHRIMAN_SHAPED.name, types: ['Creature'] });
    expect(canActivateAbility(engine, you, source, AHRIMAN_SHAPED).ok).toBe(true);
  });

  it("resolving it sacrifices exactly ONE other permanent (never the source itself, never twice)", () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const source = state.addCard(you, 'Battlefield', { name: AHRIMAN_SHAPED.name, types: ['Creature'] });
    const fodderA = state.addCard(you, 'Battlefield', { name: 'Fodder A', types: ['Creature'] });
    const fodderB = state.addCard(you, 'Battlefield', { name: 'Fodder B', types: ['Creature'] });
    const self = wrapCard(state, source);
    const sacActions: Actions = {
      sacrifice: (_controller, qty, validType, notSelf) => {
        const matches = (c: RealCard) => {
          if (notSelf && c.id === source.id) return false;
          if (validType === 'creature-or-artifact') return c.types.includes('Creature') || c.types.includes('Artifact');
          return true;
        };
        return state.sacrifice(you, qty, matches).map((c) => wrapCard(state, c));
      },
    } as Actions;
    const result = activateAbility(engine, you, source, AHRIMAN_SHAPED, ctxFor(state, self, youPlayer, [oppPlayer]), sacActions);
    expect(result.ok).toBe(true);
    resolveTop(engine);
    const remaining = you.battlefield.filter((c) => c.name === 'Fodder A' || c.name === 'Fodder B');
    expect(remaining).toHaveLength(1); // exactly one fodder sacrificed, not zero, not both
    expect(source.zone).toBe('Battlefield'); // the source itself was never touched — "notSelf" honored
  });

  it('a "Sacrifice N X" cost with NO matching effect in card.effects (The Gold Saucer-shaped) stays rejected — nothing would ever actually be sacrificed', () => {
    const { state, you, engine } = setupGame();
    const source = state.addCard(you, 'Battlefield', { name: GOLD_SAUCER_SHAPED.name, types: ['Land'] });
    expect(canActivateAbility(engine, you, source, GOLD_SAUCER_SHAPED)).toEqual({ ok: false, reason: expect.stringMatching(/unsupported component/) });
  });

  it('self-sacrifice cost text ("Sacrifice this creature") is never recognized, even with a matching sacrifice effect present', () => {
    const { state, you, engine } = setupGame();
    const selfSac: CardDefinition = { ...AHRIMAN_SHAPED, activationCost: '{3}, Sacrifice this creature' };
    const source = state.addCard(you, 'Battlefield', { name: selfSac.name, types: ['Creature'] });
    expect(canActivateAbility(engine, you, source, selfSac)).toEqual({ ok: false, reason: expect.stringMatching(/unsupported component/) });
  });
});

describe('resolveCard dispatch collision (a permanent with BOTH an on:"enter" trigger AND activationCost+effects)', () => {
  function dualCard(order: string[]): CardDefinition {
    return {
      name: 'Test Dominant',
      manaCost: '{1}{G}',
      typeLine: 'Creature — Test',
      triggers: [{ name: 'onEnter', on: 'enter', effects: [{ kind: 'custom', describe: 'enter', run: () => order.push('enter') }] }],
      activationCost: '{T}',
      effects: [{ kind: 'custom', describe: 'ability', run: () => order.push('ability') }],
    };
  }

  it("casting and resolving the permanent auto-fires its ETB trigger, NOT the ability's own effects", () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const order: string[] = [];
    const card = dualCard(order);
    const real = state.addCard(you, 'Hand', { name: card.name, types: ['Creature'] });
    const self = wrapCard(state, real);
    castSpell(engine, you, real, card, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    expect(order).toEqual(['enter']);
    expect(real.zone).toBe('Battlefield');
  });

  it("later activating the SAME permanent's own ability runs the ability's effects, not the ETB again", () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const order: string[] = [];
    const card = dualCard(order);
    // Haste — this test is about dispatch (ETB vs. ability effects), not
    // 302.6 summoning sickness (a real, separate restriction this same
    // session added to `canActivateAbility` for its {T} cost); Haste keeps
    // the {T} activation legal the same turn without conflating the two.
    const real = state.addCard(you, 'Hand', { name: card.name, types: ['Creature'], keywords: ['Haste'] });
    const self = wrapCard(state, real);
    castSpell(engine, you, real, card, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    order.length = 0;
    activateAbility(engine, you, real, card, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    expect(order).toEqual(['ability']);
  });
});

describe('fireOnPhaseEnterTriggers — real "at the beginning of your upkeep/end step" auto-fire (603.6b)', () => {
  function stepCardWithTrigger(order: string[], on: 'upkeep' | 'endStep'): CardDefinition {
    return {
      name: 'Test Ticker',
      manaCost: '{1}{G}',
      typeLine: 'Creature — Test',
      triggers: [{ name: 'onStep', on, effects: [{ kind: 'custom', describe: 'tick', run: () => order.push('tick') }] }],
    };
  }
  function toPhase(engine: ReturnType<typeof setupGame>['engine'], phase: (typeof PHASES)[number]) {
    while (PHASES[engine.turn.phaseIndex] !== phase) advance(engine);
  }

  it('auto-fires an onEndStep trigger for a permanent cast through this engine, during its own controller’s end step', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const order: string[] = [];
    const card = stepCardWithTrigger(order, 'endStep');
    const real = state.addCard(you, 'Hand', { name: card.name, types: ['Creature'] });
    const self = wrapCard(state, real);
    castSpell(engine, you, real, card, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    toPhase(engine, 'EndOfTurn');
    expect(order).toEqual(['tick']);
  });

  it('auto-fires an onUpkeep trigger during a LATER upkeep that is genuinely its controller’s own (this turn’s own upkeep already passed, and turn 2 belongs to the other player)', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const order: string[] = [];
    const card = stepCardWithTrigger(order, 'upkeep');
    const real = state.addCard(you, 'Hand', { name: card.name, types: ['Creature'] });
    const self = wrapCard(state, real);
    castSpell(engine, you, real, card, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    toPhase(engine, 'Upkeep'); // turn 2's Upkeep — but turn 2 is the OTHER player's turn, so this shouldn't fire yet
    expect(order).toEqual([]);
    while (engine.turn.turnNumber < 3) advance(engine);
    toPhase(engine, 'Upkeep'); // turn 3 — `you` is active again
    expect(order).toEqual(['tick']);
  });

  it('does NOT fire for a permanent seeded directly onto the battlefield (never cast through this engine)', () => {
    const { state, you, engine } = setupGame();
    const order: string[] = [];
    stepCardWithTrigger(order, 'endStep'); // a CardDefinition exists, but is never wired up via castSpell+resolveTop
    state.addCard(you, 'Battlefield', { name: 'Test Ticker', types: ['Creature'] }); // seeded directly — no resolvedPermanents entry
    toPhase(engine, 'EndOfTurn');
    expect(order).toEqual([]);
  });

  it('does NOT fire for the non-active player’s permanent during the active player’s own end step', () => {
    const { state, you, opp, engine, youPlayer, oppPlayer } = setupGame();
    const order: string[] = [];
    const card = stepCardWithTrigger(order, 'endStep');
    const real = state.addCard(opp, 'Hand', { name: card.name, types: ['Creature'] });
    const self = wrapCard(state, real);
    castSpell(engine, opp, real, card, ctxFor(state, self, oppPlayer, [youPlayer]), noopActions);
    resolveTop(engine);
    toPhase(engine, 'EndOfTurn'); // still turn 1, `you` is active — this is `opp`'s permanent
    expect(order).toEqual([]);
  });
});

describe('queueExtraTurn (500.7)', () => {
  it('the queued player takes the next turn ahead of the normal rotation', () => {
    const { you, opp, engine } = setupGame();
    queueExtraTurn(engine, you);
    while (engine.turn.turnNumber === 1) advance(engine);
    expect(engine.players[engine.turn.activePlayerIndex]).toBe(you);
    expect(you).not.toBe(opp); // sanity: distinct players
  });
});

describe('advance() refuses once a player has lost (704.5a)', () => {
  it('throws rather than silently continuing to simulate a game that is already over', () => {
    const { you, engine } = setupGame();
    you.hasLost = true; // sba.ts's own real 704.5a detection is covered separately (sba.test.ts) — this tests the engine's own stop
    expect(() => advance(engine)).toThrow(/game is already over/);
  });

  it('an active player instructed to draw more cards than remain in their library really loses the game on the very next draw step', () => {
    const { you, opp, engine } = setupGame();
    you.library.length = 0; // this test specifically wants `you` to run out — `opp` keeps setupGame's own real library, drawing normally on their own turn 2 in between.
    // Advance a full round back to `you`'s own next Draw step — the real
    // automatic per-turn draw (turn.ts's own runPhaseEntryAction) attempts
    // to draw 1 with 0 cards left, setting `attemptedDrawFromEmpty` for
    // real (state.ts's own `drawCards`), which `engine.ts`'s own `doAdvance`
    // now checks for real via `checkStateBasedActions` right after.
    while (!(engine.turn.turnNumber === 3 && engine.players[engine.turn.activePlayerIndex] === you && PHASES[engine.turn.phaseIndex] === 'Main1')) advance(engine);
    expect(you.hasLost).toBe(true);
    expect(() => advance(engine)).toThrow(/game is already over/);
    expect(opp.hasLost).toBeFalsy(); // only the player who actually attempted the draw loses
  });
});
