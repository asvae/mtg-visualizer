import { describe, expect, it } from 'vitest';
import type { CardDefinition, EffectContext, Actions } from './card';
import { GameState, wrapPlayer, wrapCard } from './state';
import type { RealCard } from './state';
import { createEngine, canCastSpell, castSpell, canActivateAbility, activateAbility, resolveTop, stepPriority, canAttack, declareAttackers, canBlock, declareBlockers, resolveCombatDamage, advance } from './engine';
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
    const real = state.addCard(you, 'Hand', { name: card.name, types: ['Creature'] });
    const self = wrapCard(state, real);
    castSpell(engine, you, real, card, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    order.length = 0;
    activateAbility(engine, you, real, card, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    expect(order).toEqual(['ability']);
  });
});
