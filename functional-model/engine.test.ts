import { describe, expect, it, vi } from 'vitest';
import type { CardDefinition, EffectContext, Actions } from './card';
import { GameState, wrapPlayer, wrapCard } from './state';
import type { RealCard, RealPlayer } from './state';
import {
  createEngine,
  canCastSpell,
  castSpell,
  canPlayLand,
  playLand,
  canPlayFromLibraryTop,
  playFromLibraryTop,
  canActivateAbility,
  activateAbility,
  resolveTop,
  stepPriority,
  canAttack,
  declareAttackers,
  canBlock,
  declareBlockers,
  resolveFirstStrikeCombatDamage,
  resolveCombatDamage,
  queueExtraTurn,
  queueExtraPhase,
  advance,
} from './engine';
import { PHASES, currentPhase } from './turn';
import { loggingActions } from './harness';
import { checkStateBasedActions } from './sba';

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

// A real onEnter ETB trigger (`gainLife`, the simplest real Effect kind —
// `applyEffect`'s own `case 'gainLife'` calls `ctx.you.gainLife` directly,
// no `Actions` methods involved, same reason this file's own `noopActions`
// stub is safe to use with it) — proves `playLand` genuinely fires a land's
// own `Trigger.on === 'enter'` entry, not just moving it to the battlefield.
const LAND: CardDefinition = {
  name: 'Test Karoo',
  manaCost: '',
  typeLine: 'Land',
  triggers: [{ name: 'onEnter', on: 'enter', effects: [{ kind: 'gainLife', amount: 1 }] }],
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

describe('Cost reduction (CR 601.2f) — canCastSpell/castSpell\'s declaredTarget + card.costReduction (Fate of the Sun-Cryst\'s real shape)', () => {
  // setupGame()'s own board: 2 Forest + 1 Mountain = 3 untapped mana
  // sources total — {3}{G} (4 mana) is genuinely UNAFFORDABLE with no
  // discount, but the real {2} discount reduces it to {1}{G} (2 mana),
  // which IS affordable — a real behavioral difference, not just a
  // logged-cost cosmetic change.
  const REDUCIBLE: CardDefinition = {
    name: 'Test Fatebolt',
    manaCost: '{3}{G}',
    typeLine: 'Instant',
    costReduction: { amount: 2, condition: 'tappedCreatureTarget' },
  };

  it('applies the discount when declaredTarget is a genuinely tapped creature, making an otherwise-unaffordable cost payable', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const target = state.addCard(you, 'Battlefield', { name: 'Test Blocker', types: ['Creature'] });
    target.tapped = true;
    const real = state.addCard(you, 'Hand', { name: REDUCIBLE.name, types: [] });
    const self = wrapCard(state, real);

    expect(canCastSpell(engine, you, REDUCIBLE, undefined, target)).toEqual({ ok: true });
    const cast = castSpell(engine, you, real, REDUCIBLE, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions, undefined, undefined, target);
    expect(cast.ok).toBe(true);
    expect(cast.tappedForMana).toHaveLength(2); // {1}{G} — the real discounted cost, not the printed {3}{G}'s 4.
  });

  it('does NOT apply the discount when declaredTarget is an untapped creature — the full cost stays unaffordable', () => {
    const { state, you, engine } = setupGame();
    const target = state.addCard(you, 'Battlefield', { name: 'Test Blocker', types: ['Creature'] });
    // Left untapped (its own real default state).
    expect(canCastSpell(engine, you, REDUCIBLE, undefined, target)).toEqual({ ok: false, reason: expect.stringMatching(/cannot afford/) });
  });

  it('does NOT apply the discount when declaredTarget is a tapped NON-creature — Forge\'s own ValidTarget$ Creature.tapped requires both', () => {
    const { state, you, engine } = setupGame();
    const target = state.addCard(you, 'Battlefield', { name: 'Test Rock', types: ['Artifact'] });
    target.tapped = true;
    expect(canCastSpell(engine, you, REDUCIBLE, undefined, target)).toEqual({ ok: false, reason: expect.stringMatching(/cannot afford/) });
  });

  it('does NOT apply the discount with no declaredTarget at all — absence is a real "false," never a silent match', () => {
    const { engine, you } = setupGame();
    expect(canCastSpell(engine, you, REDUCIBLE)).toEqual({ ok: false, reason: expect.stringMatching(/cannot afford/) });
  });

  it('a plain AlternateCost REPLACEMENT is never combined with costReduction', () => {
    const { state, you, engine } = setupGame();
    const target = state.addCard(you, 'Battlefield', { name: 'Test Blocker', types: ['Creature'] });
    target.tapped = true;
    // Same {3}{G}-costed card, but cast via a (synthetic) alternate cost of {G} — costReduction must NOT also discount this, since real Flashback-shaped alt costs replace the whole cost outright, not stack with a card's own reduction.
    const alt = { name: 'Test Alt', cost: '{G}', from: 'graveyard' as const };
    expect(canCastSpell(engine, you, REDUCIBLE, alt, target)).toEqual({ ok: true }); // {G} alone is trivially affordable regardless
  });
});

describe('Cost reduction — flat, unconditional, BROADCAST from a DIFFERENT permanent (The Wind Crystal\'s real shape, ENGINE_GAPS.md gap #7\'s second example, card.ts\'s SpellCostReductionGrant)', () => {
  const WHITE_SPELL: CardDefinition = { name: 'Test Whitebolt', manaCost: '{4}{W}', typeLine: 'Instant' };
  const OTHER_COLOR_SPELL: CardDefinition = { name: 'Test Redbolt', manaCost: '{4}{R}', typeLine: 'Instant' };

  it("a battlefield permanent's own spellCostReductionGrants discounts a DIFFERENT white spell the same controller casts, making an otherwise-unaffordable cost payable", () => {
    const { state, you, engine } = setupGame(); // 2 Forest + 1 Mountain = 3 untapped sources
    const plains = state.addCard(you, 'Battlefield', { name: 'Test Plains', types: ['Land'], subtypes: ['Plains'] }); // 4th source
    // {4}{W} = 5 mana, genuinely unaffordable with only 4 untapped sources.
    expect(canCastSpell(engine, you, WHITE_SPELL)).toEqual({ ok: false, reason: expect.stringMatching(/cannot afford/) });
    const crystal = state.addCard(you, 'Battlefield', { name: 'Test Wind Crystal', types: ['Artifact'] });
    crystal.spellCostReductionGrants = [{ amount: 1, colors: ['W'] }];
    // The real {1} broadcast discount reduces it to {3}{W} = 4 mana, now affordable with the same 4 sources.
    expect(canCastSpell(engine, you, WHITE_SPELL)).toEqual({ ok: true });
    const real = state.addCard(you, 'Hand', { name: WHITE_SPELL.name, types: [] });
    const self = wrapCard(state, real);
    const youPlayer = wrapPlayer(state, you);
    const cast = castSpell(engine, you, real, WHITE_SPELL, ctxFor(state, self, youPlayer, []), noopActions);
    expect(cast.ok).toBe(true);
    expect(cast.tappedForMana).toHaveLength(4); // the real discounted cost, not the printed {4}{W}'s 5.
    expect(plains.tapped).toBe(true);
  });

  it('does NOT discount a spell of a non-matching color — the full cost stays unaffordable', () => {
    const { state, you, engine } = setupGame();
    state.addCard(you, 'Battlefield', { name: 'Test Plains', types: ['Land'], subtypes: ['Plains'] });
    const crystal = state.addCard(you, 'Battlefield', { name: 'Test Wind Crystal', types: ['Artifact'] });
    crystal.spellCostReductionGrants = [{ amount: 1, colors: ['W'] }];
    expect(canCastSpell(engine, you, OTHER_COLOR_SPELL)).toEqual({ ok: false, reason: expect.stringMatching(/cannot afford/) });
  });

  it('does NOT discount when the grant is on an opponent\'s permanent — the grant only applies to its OWN controller\'s casts', () => {
    const { state, you, opp, engine } = setupGame();
    state.addCard(you, 'Battlefield', { name: 'Test Plains', types: ['Land'], subtypes: ['Plains'] });
    const oppCrystal = state.addCard(opp, 'Battlefield', { name: 'Test Wind Crystal', types: ['Artifact'] });
    oppCrystal.spellCostReductionGrants = [{ amount: 1, colors: ['W'] }];
    expect(canCastSpell(engine, you, WHITE_SPELL)).toEqual({ ok: false, reason: expect.stringMatching(/cannot afford/) });
  });
});

describe('canCastSpell / castSpell — reject a Land typeLine (305.1, dormant-bug fix)', () => {
  it('canCastSpell rejects a Land outright, regardless of timing/affordability', () => {
    const { engine, you } = setupGame();
    expect(canCastSpell(engine, you, LAND)).toEqual({ ok: false, reason: expect.stringMatching(/is a Land/) });
  });

  it('castSpell mutates nothing for a Land — never moves it to the Stack', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const real = state.addCard(you, 'Hand', { name: LAND.name, types: ['Land'] });
    const self = wrapCard(state, real);
    const result = castSpell(engine, you, real, LAND, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions);
    expect(result.ok).toBe(false);
    expect(real.zone).toBe('Hand');
    expect(engine.stack.size).toBe(0);
  });
});

describe('canPlayLand / playLand — CR 305 special action', () => {
  it('canPlayLand rejects a non-Land CardDefinition outright', () => {
    const { engine, you } = setupGame();
    expect(canPlayLand(engine, you, CREATURE)).toEqual({ ok: false, reason: expect.stringMatching(/not a Land/) });
  });

  it('plays a legal land: real Hand -> Battlefield move (never the Stack), fires its own real ETB trigger, and increments the per-turn counter', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const real = state.addCard(you, 'Hand', { name: LAND.name, types: ['Land'] });
    const self = wrapCard(state, real);
    const ctx = ctxFor(state, self, youPlayer, [oppPlayer]);
    expect(canPlayLand(engine, you, LAND)).toEqual({ ok: true });
    const startingLife = you.life;
    const result = playLand(engine, you, real, LAND, ctx, noopActions);
    expect(result).toEqual({ ok: true });
    expect(real.zone).toBe('Battlefield');
    expect(you.battlefield).toContain(real);
    expect(engine.stack.size).toBe(0); // CR 305.1: a land never touches the Stack
    expect(you.life).toBe(startingLife + 1); // the real onEnter ETB fired
    expect(you.landsPlayedThisTurn).toBe(1);
  });

  it('rejects a second land-play the same turn (305.1 once-per-turn limit), mutating nothing', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const first = state.addCard(you, 'Hand', { name: LAND.name, types: ['Land'] });
    const firstResult = playLand(engine, you, first, LAND, ctxFor(state, wrapCard(state, first), youPlayer, [oppPlayer]), noopActions);
    expect(firstResult.ok).toBe(true);

    const second = state.addCard(you, 'Hand', { name: LAND.name, types: ['Land'] });
    expect(canPlayLand(engine, you, LAND)).toEqual({ ok: false, reason: expect.stringMatching(/land-play limit/) });
    const secondResult = playLand(engine, you, second, LAND, ctxFor(state, wrapCard(state, second), youPlayer, [oppPlayer]), noopActions);
    expect(secondResult.ok).toBe(false);
    expect(second.zone).toBe('Hand');
    expect(you.landsPlayedThisTurn).toBe(1); // unchanged by the rejected attempt
  });

  it('rejects a land-play with a non-empty stack (305.3 timing, same gate a sorcery-speed spell uses)', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const bolt = state.addCard(you, 'Hand', { name: INSTANT.name });
    expect(castSpell(engine, you, bolt, INSTANT, ctxFor(state, wrapCard(state, bolt), youPlayer, [oppPlayer]), noopActions).ok).toBe(true);

    const real = state.addCard(you, 'Hand', { name: LAND.name, types: ['Land'] });
    expect(canPlayLand(engine, you, LAND)).toEqual({ ok: false, reason: expect.stringMatching(/land-play timing violated/) });
    const result = playLand(engine, you, real, LAND, ctxFor(state, wrapCard(state, real), youPlayer, [oppPlayer]), noopActions);
    expect(result.ok).toBe(false);
    expect(real.zone).toBe('Hand');
  });

  it('rejects a land-play outside the caster\'s own main phase', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    while (engine.turn.turnNumber === 1 && PHASES[engine.turn.phaseIndex] !== 'CombatBegin') advance(engine);
    const real = state.addCard(you, 'Hand', { name: LAND.name, types: ['Land'] });
    expect(canPlayLand(engine, you, LAND).ok).toBe(false);
    const result = playLand(engine, you, real, LAND, ctxFor(state, wrapCard(state, real), youPlayer, [oppPlayer]), noopActions);
    expect(result.ok).toBe(false);
    expect(real.zone).toBe('Hand');
  });

  it('resets the once-per-turn limit at Cleanup, allowing a land again next turn', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const first = state.addCard(you, 'Hand', { name: LAND.name, types: ['Land'] });
    playLand(engine, you, first, LAND, ctxFor(state, wrapCard(state, first), youPlayer, [oppPlayer]), noopActions);
    expect(you.landsPlayedThisTurn).toBe(1);

    const startTurn = engine.turn.turnNumber;
    do {
      advance(engine);
    } while (!(PHASES[engine.turn.phaseIndex] === 'Main1' && engine.turn.turnNumber !== startTurn && engine.turn.activePlayerIndex === 0));
    expect(you.landsPlayedThisTurn).toBe(0); // reset by Cleanup, real 305.1

    const second = state.addCard(you, 'Hand', { name: LAND.name, types: ['Land'] });
    expect(canPlayLand(engine, you, LAND)).toEqual({ ok: true });
    const result = playLand(engine, you, second, LAND, ctxFor(state, wrapCard(state, second), youPlayer, [oppPlayer]), noopActions);
    expect(result.ok).toBe(true);
    expect(you.landsPlayedThisTurn).toBe(1);
  });
});

/** Moves `real` (already added to `player.library` by `state.addCard`, which always pushes to the END) to the FRONT — the real top of library, `state.dig`'s own `.splice(0, qty)` convention (ENGINE_GAPS.md gap #16). Test-only convenience; no production code needs to reorder a library this way. */
function moveToLibraryTop(player: RealPlayer, real: RealCard): void {
  const idx = player.library.indexOf(real);
  player.library.splice(idx, 1);
  player.library.unshift(real);
}

describe('canPlayFromLibraryTop / playFromLibraryTop — CR 601/305 umbrella "play" (ENGINE_GAPS.md gap #16)', () => {
  it('rejects a card that is not genuinely the top card of the library', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const notTop = state.addCard(you, 'Library', { name: LAND.name, types: ['Land'] });
    // `setupGame()` already seeded 20 filler library cards ahead of it — `notTop` sits at the back, not the top.
    const ctx = ctxFor(state, wrapCard(state, notTop), youPlayer, [oppPlayer]);
    expect(canPlayFromLibraryTop(engine, you, notTop, LAND)).toEqual({ ok: false, reason: expect.stringMatching(/not the top card/) });
    const result = playFromLibraryTop(engine, you, notTop, LAND, ctx, noopActions);
    expect(result.ok).toBe(false);
    expect(notTop.zone).toBe('Library'); // mutates nothing when illegal
  });

  it('dispatches a LAND top card to the real playLand path: direct Battlefield move, never the Stack, real ETB fires', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const top = state.addCard(you, 'Library', { name: LAND.name, types: ['Land'] });
    moveToLibraryTop(you, top);
    const ctx = ctxFor(state, wrapCard(state, top), youPlayer, [oppPlayer]);
    expect(canPlayFromLibraryTop(engine, you, top, LAND)).toEqual({ ok: true });
    const startingLife = you.life;
    const result = playFromLibraryTop(engine, you, top, LAND, ctx, noopActions);
    expect(result.ok).toBe(true);
    expect(top.zone).toBe('Battlefield');
    expect(engine.stack.size).toBe(0); // CR 305.1: a land never touches the Stack, even played this way
    expect(you.life).toBe(startingLife + 1); // the land's own real onEnter ETB fired
    expect(you.landsPlayedThisTurn).toBe(1); // real 305.1 per-turn counter, same as an ordinary land-drop
  });

  it('dispatches a SPELL top card to the real castSpell path: real mana paid, pushed onto the real Stack (not yet resolved)', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const top = state.addCard(you, 'Library', { name: CREATURE.name, types: ['Creature'] });
    moveToLibraryTop(you, top);
    const ctx = ctxFor(state, wrapCard(state, top), youPlayer, [oppPlayer]);
    expect(canPlayFromLibraryTop(engine, you, top, CREATURE)).toEqual({ ok: true });
    const result = playFromLibraryTop(engine, you, top, CREATURE, ctx, noopActions);
    expect(result.ok).toBe(true);
    expect(top.zone).toBe('Stack'); // real 601 cast — waits on the Stack, same as an ordinary hand-cast
    expect(engine.stack.size).toBe(1);
    expect(you.battlefield.filter((c) => c.tapped)).toHaveLength(2); // {1}{G} genuinely paid
  });

  it('rejects an unaffordable SPELL top card, mutating nothing (real 601.2g/602.2c affordability, not bypassed for this path)', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    // Strip this player's mana sources so a {1}{G} creature is unaffordable.
    for (const land of [...you.battlefield]) state.move(land, 'Exile');
    const top = state.addCard(you, 'Library', { name: CREATURE.name, types: ['Creature'] });
    moveToLibraryTop(you, top);
    const ctx = ctxFor(state, wrapCard(state, top), youPlayer, [oppPlayer]);
    expect(canPlayFromLibraryTop(engine, you, top, CREATURE)).toEqual({ ok: false, reason: expect.stringMatching(/cannot afford/) });
    const result = playFromLibraryTop(engine, you, top, CREATURE, ctx, noopActions);
    expect(result.ok).toBe(false);
    expect(top.zone).toBe('Library');
  });

  it('rejects a land top card outside a main phase / with a non-empty stack, mutating nothing (real 305.3 timing, same gate playLand already uses)', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    while (engine.turn.turnNumber === 1 && PHASES[engine.turn.phaseIndex] !== 'CombatBegin') advance(engine);
    const top = state.addCard(you, 'Library', { name: LAND.name, types: ['Land'] });
    moveToLibraryTop(you, top);
    const ctx = ctxFor(state, wrapCard(state, top), youPlayer, [oppPlayer]);
    expect(canPlayFromLibraryTop(engine, you, top, LAND).ok).toBe(false);
    const result = playFromLibraryTop(engine, you, top, LAND, ctx, noopActions);
    expect(result.ok).toBe(false);
    expect(top.zone).toBe('Library');
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

  it('a legal attacker gets its real attackedThisTurn flag set (ENGINE_GAPS.md gap #16 — The Lunar Whale\'s own "as long as it attacked this turn" condition)', () => {
    const { state, you, engine } = setupGame();
    const creature = state.addCard(you, 'Battlefield', { name: 'Veteran Bear', types: ['Creature'] });
    expect(creature.attackedThisTurn).toBeFalsy();
    toCombat(engine);
    expect(declareAttackers(engine, [creature]).ok).toBe(true);
    expect(creature.attackedThisTurn).toBe(true);
  });

  it('a rejected attacker declaration does NOT set attackedThisTurn', () => {
    const { state, you, engine } = setupGame();
    const creature = state.addCard(you, 'Battlefield', { name: 'Sick Bear 3', types: ['Creature'] });
    engine.enteredThisTurn.set(creature.id, engine.turn.turnNumber);
    toCombat(engine);
    expect(declareAttackers(engine, [creature]).ok).toBe(false);
    expect(creature.attackedThisTurn).toBeFalsy();
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

describe('fireOnAttackTriggers — real "whenever ~ attacks" auto-fire (ENGINE_GAPS.md — attack-triggered-ability auto-dispatch)', () => {
  function toCombat(engine: ReturnType<typeof setupGame>['engine']) {
    while (PHASES[engine.turn.phaseIndex] !== 'CombatDeclareAttackers') advance(engine);
  }
  function attackTriggerCard(order: string[]): CardDefinition {
    return {
      name: 'Test Attacker',
      manaCost: '{1}{G}',
      typeLine: 'Creature — Test',
      triggers: [{ name: 'onAttack', on: 'attacks', effects: [{ kind: 'custom', describe: 'tick', run: () => order.push('tick') }] }],
    };
  }

  it('auto-fires a registered on:\'attacks\' trigger the moment its own creature is legally declared as an attacker (Ashe, Princess of Dalmasca\'s own shape)', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const order: string[] = [];
    const card = attackTriggerCard(order);
    // Haste (302.6) — otherwise this same-turn-cast creature would be
    // summoning-sick and `declareAttackers` would (correctly) reject it,
    // never reaching `fireOnAttackTriggers` at all — this test is about the
    // auto-fire itself, not summoning sickness (see its own dedicated
    // describe block above for that).
    const real = state.addCard(you, 'Hand', { name: card.name, types: ['Creature'], keywords: ['Haste'] });
    const self = wrapCard(state, real);
    castSpell(engine, you, real, card, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    toCombat(engine);
    expect(declareAttackers(engine, [real]).ok).toBe(true);
    expect(order).toEqual(['tick']);
  });

  it('does NOT fire for a permanent seeded directly onto the battlefield (never cast through this engine — same real, documented limitation upkeep/endStep already carry)', () => {
    const { state, you, engine } = setupGame();
    const order: string[] = [];
    attackTriggerCard(order); // a CardDefinition exists, but is never wired up via castSpell+resolveTop
    const real = state.addCard(you, 'Battlefield', { name: 'Test Attacker', types: ['Creature'] }); // seeded directly — no resolvedPermanents entry
    toCombat(engine);
    expect(declareAttackers(engine, [real]).ok).toBe(true);
    expect(order).toEqual([]);
  });

  it('does NOT fire when the attacker declaration itself is rejected (summoning sickness, e.g.) — no half-applied trigger', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const order: string[] = [];
    const card = attackTriggerCard(order);
    const real = state.addCard(you, 'Hand', { name: card.name, types: ['Creature'] });
    const self = wrapCard(state, real);
    castSpell(engine, you, real, card, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    engine.enteredThisTurn.set(real.id, engine.turn.turnNumber); // still sick — this same turn
    toCombat(engine);
    expect(declareAttackers(engine, [real]).ok).toBe(false);
    expect(order).toEqual([]);
  });

  it('does NOT fire a DIFFERENT attacker\'s own registered permanent that has no on:\'attacks\' trigger', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const order: string[] = [];
    const triggerCard = attackTriggerCard(order);
    const attackerWithTrigger = state.addCard(you, 'Hand', { name: triggerCard.name, types: ['Creature'], keywords: ['Haste'] });
    castSpell(engine, you, attackerWithTrigger, triggerCard, ctxFor(state, wrapCard(state, attackerWithTrigger), youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    const plainCard: CardDefinition = { name: 'Plain Attacker', manaCost: '{1}{G}', typeLine: 'Creature — Test' };
    const plainAttacker = state.addCard(you, 'Hand', { name: plainCard.name, types: ['Creature'], keywords: ['Haste'] });
    castSpell(engine, you, plainAttacker, plainCard, ctxFor(state, wrapCard(state, plainAttacker), youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    toCombat(engine);
    expect(declareAttackers(engine, [plainAttacker]).ok).toBe(true); // ONLY the plain one attacks
    expect(order).toEqual([]); // its own trigger never registered on the attacking creature
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

  // Real ENGINE_GAPS.md gap #9 (closed 2026-09-12): CombatFirstStrikeDamage
  // is now a genuinely distinct, separately-reachable `turn.ts` phase, not
  // just internal math — every test below actually ADVANCES into it
  // (asserting `currentPhase`) and calls `resolveFirstStrikeCombatDamage`
  // there, THEN advances again into the real `CombatDamage` phase for
  // `resolveCombatDamage`, running a real `checkStateBasedActions` sweep in
  // between (same "caller runs it" convention this file's other combat
  // tests already document) — matching how a real engine-piloted scenario
  // (`keywords/first-strike-double-strike/scenarios.ts`) now walks this too.
  it('a normal creature vs. a normal creature never even reaches CombatFirstStrikeDamage — the phase is skipped outright (510.5 conditionality)', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker = state.addCard(you, 'Battlefield', { name: 'Attacker', types: ['Creature'], basePower: 2, baseToughness: 2 });
    const blocker = state.addCard(opp, 'Battlefield', { name: 'Blocker', types: ['Creature'], basePower: 2, baseToughness: 2 });
    toDeclareAttackers(engine);
    declareAttackers(engine, [attacker]);
    advance(engine);
    declareBlockers(engine, [{ blocker, attacker }]);
    advance(engine); // CombatDeclareBlockers -> straight to CombatDamage, skipping CombatFirstStrikeDamage entirely
    expect(currentPhase(engine.turn)).toBe('CombatDamage');
  });

  it('First Strike: the engine genuinely stops at CombatFirstStrikeDamage, and a blocker killed there deals no damage back in the regular step', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker = state.addCard(you, 'Battlefield', { name: 'Fast Striker', types: ['Creature'], basePower: 3, baseToughness: 3, keywords: ['FirstStrike'] });
    const blocker = state.addCard(opp, 'Battlefield', { name: 'Slow Blocker', types: ['Creature'], basePower: 3, baseToughness: 2 });
    toDeclareAttackers(engine);
    declareAttackers(engine, [attacker]);
    advance(engine);
    declareBlockers(engine, [{ blocker, attacker }]);
    advance(engine); // CombatDeclareBlockers -> CombatFirstStrikeDamage (real: Fast Striker has First Strike)
    expect(currentPhase(engine.turn)).toBe('CombatFirstStrikeDamage');
    resolveFirstStrikeCombatDamage(engine);
    checkStateBasedActions(state, engine.players);
    advance(engine); // CombatFirstStrikeDamage -> CombatDamage
    expect(currentPhase(engine.turn)).toBe('CombatDamage');
    const result = resolveCombatDamage(engine);
    const attackerEntry = result.entries.find((e) => e.card === attacker);
    expect(attackerEntry).toBeUndefined(); // took no damage at all — the blocker never got to swing
    const blockerEntry = result.entries.find((e) => e.card === blocker)!;
    expect(blockerEntry).toEqual({ card: blocker, damage: 3, lethal: true });
  });

  it('Double Strike deals damage in BOTH real steps against a blocker that survives the first', () => {
    const { state, you, opp, engine } = setupGame();
    const attacker = state.addCard(you, 'Battlefield', { name: 'Double Striker', types: ['Creature'], basePower: 2, baseToughness: 4, keywords: ['DoubleStrike'] });
    const blocker = state.addCard(opp, 'Battlefield', { name: 'Tough Blocker', types: ['Creature'], basePower: 2, baseToughness: 5 });
    toDeclareAttackers(engine);
    declareAttackers(engine, [attacker]);
    advance(engine);
    declareBlockers(engine, [{ blocker, attacker }]);
    advance(engine); // CombatFirstStrikeDamage (real: Double Striker has Double Strike)
    expect(currentPhase(engine.turn)).toBe('CombatFirstStrikeDamage');
    resolveFirstStrikeCombatDamage(engine);
    expect(blocker.damageMarked).toBe(2); // only the FIRST strike hit so far
    checkStateBasedActions(state, engine.players);
    advance(engine);
    expect(currentPhase(engine.turn)).toBe('CombatDamage');
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
    advance(engine);
    expect(currentPhase(engine.turn)).toBe('CombatFirstStrikeDamage');
    resolveFirstStrikeCombatDamage(engine);
    checkStateBasedActions(state, engine.players);
    advance(engine);
    expect(currentPhase(engine.turn)).toBe('CombatDamage');
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

// ENGINE_GAPS.md gap #18 (closed 2026-09-12) — a real, query-time
// "CantBeActivated" lock a static effect imposes on a DIFFERENT permanent's
// own activated-ability activation (Stuck in Summoner's Sanctum's own real
// "its activated abilities can't be activated" clause, fin/76) — checked at
// `canActivateAbility` itself (`state.ts`'s new `isActivationLocked`), BEFORE
// any cost-shape/affordability check, same as real Forge's own
// `AbilityActivated.checkRestrictions`.
describe('canActivateAbility — a static CantBeActivated lock on a DIFFERENT permanent (613/602.1, ENGINE_GAPS.md gap #18)', () => {
  const TAP_ABILITY: CardDefinition = {
    name: 'Test Tapper',
    manaCost: '{1}{G}',
    typeLine: 'Creature — Test',
    activationCost: '{T}',
    effects: [],
  };

  it("Stuck in Summoner's Sanctum-shaped: a locked permanent's own activated ability is correctly refused", () => {
    const { state, you, engine } = setupGame();
    const permanent = state.addCard(you, 'Battlefield', { name: TAP_ABILITY.name, types: ['Creature'] });
    state.addCard(you, 'Battlefield', {
      name: "Stuck in Summoner's Sanctum",
      types: ['Enchantment'],
      activatedAbilityLock: [{ includeSelf: false, equippedBySelf: true }],
    });
    const aura = you.battlefield.find((c) => c.name === "Stuck in Summoner's Sanctum")!;
    state.equip(aura, permanent);
    expect(canActivateAbility(engine, you, permanent, TAP_ABILITY)).toEqual({
      ok: false,
      reason: expect.stringMatching(/can't be activated/),
    });
    expect(engine.stack.size).toBe(0);
  });

  it('removing the locking permanent (it leaves the battlefield) lifts the lock, live', () => {
    const { state, you, engine } = setupGame();
    const permanent = state.addCard(you, 'Battlefield', { name: TAP_ABILITY.name, types: ['Creature'] });
    const aura = state.addCard(you, 'Battlefield', {
      name: "Stuck in Summoner's Sanctum",
      types: ['Enchantment'],
      activatedAbilityLock: [{ includeSelf: false, equippedBySelf: true }],
    });
    state.equip(aura, permanent);
    expect(canActivateAbility(engine, you, permanent, TAP_ABILITY).ok).toBe(false);
    state.move(aura, 'Graveyard'); // the Aura itself is destroyed/sacrificed
    expect(canActivateAbility(engine, you, permanent, TAP_ABILITY).ok).toBe(true);
  });

  it('a DIFFERENT permanent (not the enchanted/locked one) remains unaffected', () => {
    const { state, you, engine } = setupGame();
    const locked = state.addCard(you, 'Battlefield', { name: TAP_ABILITY.name, types: ['Creature'] });
    const bystander = state.addCard(you, 'Battlefield', { name: 'bystander', types: ['Creature'], subtypes: ['Test'] });
    const aura = state.addCard(you, 'Battlefield', {
      name: "Stuck in Summoner's Sanctum",
      types: ['Enchantment'],
      activatedAbilityLock: [{ includeSelf: false, equippedBySelf: true }],
    });
    state.equip(aura, locked);
    expect(canActivateAbility(engine, you, locked, TAP_ABILITY).ok).toBe(false);
    expect(canActivateAbility(engine, you, bystander, TAP_ABILITY).ok).toBe(true);
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

  it('a non-mana equip cost (dark-knight-s-greatsword-shaped "Equip—Pay 3 life") is now real — stripping "Equip" plus real Pay-life support (ENGINE_GAPS.md gap #11) legalizes it, and activating it really deducts the life', () => {
    const { state, you, engine } = setupGame();
    const payLife: CardDefinition = { ...EQUIPMENT, activationCost: 'Equip—Pay 3 life (activate only once each turn)' };
    const permanent = state.addCard(you, 'Battlefield', { name: payLife.name, types: ['Artifact'] });
    const self = wrapCard(state, permanent);
    const youPlayer = wrapPlayer(state, you);
    expect(canActivateAbility(engine, you, permanent, payLife)).toEqual({ ok: true });
    expect(you.life).toBe(20);
    const result = activateAbility(engine, you, permanent, payLife, { self, you: youPlayer, opponents: [], castFrom: 'hand' }, noopActions);
    expect(result.ok).toBe(true);
    expect(you.life).toBe(17);
  });

  it('rejects paying life it cannot afford (a "Pay N life" cost costing more than the controller\'s remaining life), mutating nothing', () => {
    const { state, you, engine } = setupGame();
    you.life = 2;
    const payLife: CardDefinition = { ...EQUIPMENT, activationCost: 'Equip—Pay 3 life (activate only once each turn)' };
    const permanent = state.addCard(you, 'Battlefield', { name: payLife.name, types: ['Artifact'] });
    expect(canActivateAbility(engine, you, permanent, payLife)).toEqual({ ok: false, reason: expect.stringMatching(/cannot pay 3 life/) });
    expect(you.life).toBe(2);
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

  describe('crewCost + a separate NAMED ability on the same permanent (Cargo Ship-shaped, ENGINE_GAPS.md gap #11 bug fix)', () => {
    const CREW_PLUS_NAMED: CardDefinition = {
      name: 'Test Cargo Ship',
      manaCost: '{1}{U}',
      typeLine: 'Artifact — Vehicle',
      crewCost: 1,
      activationCost: 'Crew 1 (tap creatures with total power 1 or more)',
      effects: [{ kind: 'animate', target: 'self', types: ['Artifact', 'Creature'] }],
      abilities: [{ name: 'mana', cost: '{T}', effects: [{ kind: 'addMana', color: 'C', amount: 1 }] }],
    };

    it('a named-ability request (abilityName set) is routed through the ordinary {T}/mana cost path, NOT the crew path, even though the card also has crewCost', () => {
      const { state, you, engine } = setupGame();
      const vehicle = state.addCard(you, 'Battlefield', { name: CREW_PLUS_NAMED.name, types: ['Artifact'] });
      // No crewedBy list at all — if this were (wrongly) routed through the
      // crew path, it would reject with "no creatures specified to tap"
      // (the real bug this fix closes); routed correctly, it's a plain
      // {T}-only cost with nothing else to check.
      expect(canActivateAbility(engine, you, vehicle, CREW_PLUS_NAMED, 'mana')).toEqual({ ok: true });
      const result = activateAbility(engine, you, vehicle, CREW_PLUS_NAMED, { self: wrapCard(state, vehicle), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' }, noopActions, 'mana');
      expect(result.ok).toBe(true);
      expect(vehicle.tapped).toBe(true); // the NAMED ability's own {T} cost, paid for real — crewing never taps the Vehicle itself.
    });

    it('omitting abilityName still routes through the real crew path, unchanged', () => {
      const { state, you, engine } = setupGame();
      const vehicle = state.addCard(you, 'Battlefield', { name: CREW_PLUS_NAMED.name, types: ['Artifact'] });
      const crewer = state.addCard(you, 'Battlefield', { name: 'Crewer', types: ['Creature'], basePower: 1, baseToughness: 1 });
      expect(canActivateAbility(engine, you, vehicle, CREW_PLUS_NAMED, undefined, [crewer]).ok).toBe(true);
      const result = activateAbility(engine, you, vehicle, CREW_PLUS_NAMED, { self: wrapCard(state, vehicle), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' }, noopActions, undefined, [crewer]);
      expect(result.ok).toBe(true);
      expect(crewer.tapped).toBe(true);
      expect(vehicle.tapped).toBe(false); // crewing taps the CREATURE, never the Vehicle.
    });
  });
});

describe('Cost reduction — board-state-COUNTED, on an ACTIVATED ABILITY\'s own cost (Qiqirn Merchant\'s real shape, ENGINE_GAPS.md gap #7\'s third example, card.ts\'s ActivationCostReduction)', () => {
  const BIG_DRAW: CardDefinition = {
    name: 'Test Merchant',
    manaCost: '{2}{U}',
    typeLine: 'Creature — Test',
    abilities: [{ name: 'bigDraw', cost: '{7}, {T}', effects: [{ kind: 'drawCard', amount: 3 }], costReduction: { amountPerMatch: 1, subtype: 'Town' } }],
  };

  it('discounts the generic portion by 1 per real Town permanent controlled, making an otherwise-unaffordable cost payable', () => {
    const { state, you, engine } = setupGame(); // 2 Forest + 1 Mountain = 3 untapped sources
    const permanent = state.addCard(you, 'Battlefield', { name: BIG_DRAW.name, types: ['Creature'] });
    for (let i = 0; i < 5; i++) state.addCard(you, 'Battlefield', { name: `Test Town ${i}`, types: ['Land'], subtypes: ['Town'] });
    // 5 real Town lands controlled -> {7} discounted by 5 -> {2}, affordable with the 3 untapped Forest/Mountain sources (the 5 Towns produce no mana in this test, so they don't double as payment).
    expect(canActivateAbility(engine, you, permanent, BIG_DRAW, 'bigDraw')).toEqual({ ok: true });
    const result = activateAbility(engine, you, permanent, BIG_DRAW, { self: wrapCard(state, permanent), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' }, noopActions, 'bigDraw');
    expect(result.ok).toBe(true);
    expect(result.tappedForMana).toHaveLength(2); // {2} — the real discounted cost, not the printed {7}.
    expect(permanent.tapped).toBe(true); // the ability's own real {T} cost.
  });

  it('with zero real Town permanents controlled, the full {7} cost stays unaffordable', () => {
    const { state, you, engine } = setupGame();
    const permanent = state.addCard(you, 'Battlefield', { name: BIG_DRAW.name, types: ['Creature'] });
    expect(canActivateAbility(engine, you, permanent, BIG_DRAW, 'bigDraw')).toEqual({ ok: false, reason: expect.stringMatching(/cannot afford/) });
  });
});

describe('{X} cost on an ACTIVATED ABILITY (Rydia, Summoner of Mist\'s real shape, ENGINE_GAPS.md gap #11)', () => {
  const X_ABILITY: CardDefinition = {
    name: 'Test Summoner',
    manaCost: '{R}{G}',
    typeLine: 'Creature — Test',
    activationCost: '{X}, {T} (activate only as a sorcery)',
    effects: [{ kind: 'custom', describe: 'test', run: () => {} }],
  };

  it('a real chosen X value is resolved into the generic portion, affecting affordability for real', () => {
    const { state, you, engine } = setupGame(); // 2 Forest + 1 Mountain = 3 untapped sources
    const permanent = state.addCard(you, 'Battlefield', { name: X_ABILITY.name, types: ['Creature'] });
    expect(canActivateAbility(engine, you, permanent, X_ABILITY, undefined, undefined, 3)).toEqual({ ok: true });
    const result = activateAbility(engine, you, permanent, X_ABILITY, { self: wrapCard(state, permanent), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' }, noopActions, undefined, undefined, 3);
    expect(result.ok).toBe(true);
    expect(result.tappedForMana).toHaveLength(3);
  });

  it('an unaffordable chosen X rejects, mutating nothing', () => {
    const { state, you, engine } = setupGame();
    const permanent = state.addCard(you, 'Battlefield', { name: X_ABILITY.name, types: ['Creature'] });
    expect(canActivateAbility(engine, you, permanent, X_ABILITY, undefined, undefined, 5)).toEqual({ ok: false, reason: expect.stringMatching(/cannot afford/) });
    expect(permanent.tapped).toBe(false);
  });

  it('omitting X defaults to 0 (CR 601.2b, a real legal choice) — the ability is payable with just its own {T}', () => {
    const { state, you, engine } = setupGame();
    const permanent = state.addCard(you, 'Battlefield', { name: X_ABILITY.name, types: ['Creature'] });
    expect(canActivateAbility(engine, you, permanent, X_ABILITY)).toEqual({ ok: true });
  });
});

describe('Non-basic mana sources (mana.ts\'s narrow gap #5 slice) — real manaAbilities copy + 302.6', () => {
  const MANA_ROCK: CardDefinition = {
    name: 'Test Mana Rock',
    manaCost: '{1}',
    typeLine: 'Artifact',
    manaAbilities: [{ colors: ['W'] }],
  };

  const MANA_DORK: CardDefinition = {
    name: 'Test Mana Dork',
    manaCost: '{G}',
    typeLine: 'Creature — Elf Druid',
    pt: [1, 1],
    manaAbilities: [{ colors: ['G'] }],
  };

  const DUAL_ROCK: CardDefinition = {
    name: 'Test Dual Rock',
    manaCost: '{1}',
    typeLine: 'Artifact',
    manaAbilities: [{ colors: ['G', 'U'] }],
  };

  it('a resolved non-Land mana-ability permanent (an artifact) really becomes a payable mana source', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const rockReal = state.addCard(you, 'Hand', { name: MANA_ROCK.name, types: ['Artifact'] });
    const rockSelf = wrapCard(state, rockReal);
    castSpell(engine, you, rockReal, MANA_ROCK, ctxFor(state, rockSelf, youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    expect(rockReal.manaAbilities).toEqual([{ colors: ['W'] }]);

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
    expect(dorkReal.manaAbilities).toEqual([{ colors: ['G'] }]);

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

  it('a dual-color "{T}: Add {G} or {U}." ability IS now recognized as a real ManaColor[] source (ENGINE_GAPS.md gap #5, closed 2026-09-12) — genuinely payable toward EITHER color', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    // setupGame's own board has 2 Forests + 1 Mountain, no Island — casting
    // the dual rock's own {1} taps one Forest, leaving 1 Forest + 1
    // Mountain + the (untapped) dual rock. A {U} cost is affordable ONLY if
    // the dual rock's own real choice-of-color genuinely counts toward U.
    const rockReal = state.addCard(you, 'Hand', { name: DUAL_ROCK.name, types: ['Artifact'] });
    const rockSelf = wrapCard(state, rockReal);
    castSpell(engine, you, rockReal, DUAL_ROCK, ctxFor(state, rockSelf, youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    expect(rockReal.manaAbilities).toEqual([{ colors: ['G', 'U'] }]);

    const blueSpell: CardDefinition = { name: 'Test Blue Spell', manaCost: '{U}', typeLine: 'Sorcery', effects: [] };
    expect(canCastSpell(engine, you, blueSpell).ok).toBe(true);
    const spellReal = state.addCard(you, 'Hand', { name: blueSpell.name });
    const spellSelf = wrapCard(state, spellReal);
    castSpell(engine, you, spellReal, blueSpell, ctxFor(state, spellSelf, youPlayer, [oppPlayer]), noopActions);
    expect(rockReal.tapped).toBe(true);
  });

  it('a dual-color source is still NOT recognized as a THIRD color it never named (correctly still unaffordable)', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const rockReal = state.addCard(you, 'Hand', { name: DUAL_ROCK.name, types: ['Artifact'] });
    const rockSelf = wrapCard(state, rockReal);
    castSpell(engine, you, rockReal, DUAL_ROCK, ctxFor(state, rockSelf, youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    // Board after casting the dual rock: 1 untapped Forest, 1 Mountain, the
    // dual rock — no real black source anywhere.
    const blackSpell: CardDefinition = { name: 'Test Black Spell', manaCost: '{B}', typeLine: 'Sorcery', effects: [] };
    expect(canCastSpell(engine, you, blackSpell)).toEqual({ ok: false, reason: expect.stringMatching(/cannot afford/) });
  });
});

describe('Hybrid mana costs (ENGINE_GAPS.md gap #6, closed 2026-09-12) — canCastSpell/castSpell can now actually cast a real Hybrid-costed card', () => {
  // Real cost string — Thranduil, Sindarin Liege // Silvan Rally's own
  // front-face cost (`{2}{G/U}{G/U}`, one of the only two real FIN cards
  // using Hybrid mana).
  const HYBRID_CARD: CardDefinition = {
    name: 'Test Thranduil',
    manaCost: '{2}{G/U}{G/U}',
    typeLine: 'Legendary Creature — Elf Noble',
    pt: [2, 3],
  };

  it('was previously uncastable at all (parseManaCost threw) — now affordable off an all-Forest/Mountain board (no Island at all), proving both Hybrid pips are genuinely paid with G, the OTHER of their two legal colors', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    // setupGame's own board is 2 Forest + 1 Mountain (3 sources) — one
    // short of this real cost's 4 total mana. Add a 2nd Mountain (still no
    // Island anywhere) so the ONLY way to pay the two {G/U} pips is via
    // Forest's own G, not U.
    state.addCard(you, 'Battlefield', { name: 'Mountain', types: ['Land'], subtypes: ['Mountain'] });
    const real = state.addCard(you, 'Hand', { name: HYBRID_CARD.name, types: ['Creature'] });
    const self = wrapCard(state, real);
    expect(canCastSpell(engine, you, HYBRID_CARD)).toEqual({ ok: true });
    const cast = castSpell(engine, you, real, HYBRID_CARD, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions);
    expect(cast.ok).toBe(true);
    expect(cast.tappedForMana).toHaveLength(4); // {2}{G/U}{G/U} — all 4 real lands (2 Forest for the Hybrid pips, 2 Mountain for generic).
    expect(you.battlefield.every((c) => c.tapped)).toBe(true);
  });

  it('is genuinely unaffordable with too few total sources, same as any other real cost', () => {
    const { engine, you } = setupGame();
    // setupGame's own board: 2 Forest + 1 Mountain = 3 total sources; this
    // cost needs 4.
    expect(canCastSpell(engine, you, HYBRID_CARD)).toEqual({ ok: false, reason: expect.stringMatching(/cannot afford/) });
  });
});

describe('{X} mana costs (ENGINE_GAPS.md gap #6, closed 2026-09-12) — canCastSpell/castSpell can now actually cast a real {X}-costed card', () => {
  // Real cost strings — Choco Comet's own `{X}{R}{R}` and Doppelgang's own
  // `{X}{X}{X}{G}{U}` (the only two real FIN cards using {X}). `x` is an
  // optional param threaded the same way `declaredTarget` already is.
  const X_CARD: CardDefinition = { name: 'Test Choco Comet', manaCost: '{X}{R}{R}', typeLine: 'Sorcery', effects: [] };

  it('was previously uncastable at all (parseManaCost threw {X}) — now affordable at X=0 (a real, legal default) with just the 2 red pips paid', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    // setupGame's own board has only 1 Mountain — X=0 needs just {R}{R}? No,
    // it needs 2 RED specifically; setupGame only has 1 Mountain, so add a
    // second real red source for this test.
    state.addCard(you, 'Battlefield', { name: 'Mountain', types: ['Land'], subtypes: ['Mountain'] });
    const real = state.addCard(you, 'Hand', { name: X_CARD.name, types: [] });
    const self = wrapCard(state, real);
    expect(canCastSpell(engine, you, X_CARD, undefined, undefined, 0)).toEqual({ ok: true });
    const cast = castSpell(engine, you, real, X_CARD, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions, undefined, undefined, undefined, 0);
    expect(cast.ok).toBe(true);
    expect(cast.tappedForMana).toHaveLength(2); // just the 2 red pips — X=0 adds no generic.
  });

  it('a real caster-chosen X > 0 genuinely raises the affordable/paid cost — the SAME printed cost is unaffordable at X=3 but affordable at X=0', () => {
    const { engine, you } = setupGame();
    // setupGame's own board: 2 Forest + 1 Mountain = 3 total sources, only 1 red.
    expect(canCastSpell(engine, you, X_CARD, undefined, undefined, 3)).toEqual({ ok: false, reason: expect.stringMatching(/cannot afford/) });
    expect(canCastSpell(engine, you, X_CARD, undefined, undefined, 0)).toEqual({ ok: false, reason: expect.stringMatching(/cannot afford/) }); // still needs 2 red, only 1 Mountain
  });

  it('x defaults to 0 when omitted entirely (same real CR 107.3b default resolveXCost documents)', () => {
    const { engine, you } = setupGame();
    // Omitting x is identical to passing x: 0 — both need just the 2 red pips (still unaffordable here, only 1 Mountain, but for the SAME reason either way).
    expect(canCastSpell(engine, you, X_CARD)).toEqual(canCastSpell(engine, you, X_CARD, undefined, undefined, 0));
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

// ENGINE_GAPS.md gap #23 (closed 2026-09-14) — real 702.13 Cycling/
// TypeCycling: a genuine 602.1 activation FROM HAND (not the Battlefield
// every OTHER activated ability in this pool implicitly assumes), cost =
// mana + discarding the permanent itself (a real Hand->Graveyard move, paid
// for real, not merely trusted the way the Sacrifice-cost-trusted describe
// block above works).
describe('Cycling (702.13) — activate FROM HAND, discard self as cost (ENGINE_GAPS.md gap #23)', () => {
  const CYCLER: CardDefinition = {
    name: 'Test Cycler',
    manaCost: '{3}{W}',
    typeLine: 'Creature — Test',
    abilities: [{ name: 'cycling', cost: '{2}, Discard this card', effects: [{ kind: 'drawCard' }] }],
  };

  it('allows activating Cycling from Hand once the mana is affordable', () => {
    const { state, you, engine } = setupGame();
    const permanent = state.addCard(you, 'Hand', { name: CYCLER.name, types: ['Creature'] });
    expect(canActivateAbility(engine, you, permanent, CYCLER, 'cycling').ok).toBe(true);
  });

  it("rejects Cycling when the permanent is NOT in Hand (701.9a — discarding is a Hand->Graveyard move; real ActivationZone$ Hand), even though every other check would pass", () => {
    const { state, you, engine } = setupGame();
    const onBattlefield = state.addCard(you, 'Battlefield', { name: CYCLER.name, types: ['Creature'] });
    expect(canActivateAbility(engine, you, onBattlefield, CYCLER, 'cycling')).toEqual({
      ok: false,
      reason: expect.stringMatching(/can only be activated from Hand/),
    });
  });

  it('rejects an unaffordable Cycling cost, mutating nothing (permanent stays in Hand)', () => {
    const { state, you, engine } = setupGame();
    const expensive: CardDefinition = { ...CYCLER, abilities: [{ name: 'cycling', cost: '{5}{G}{G}, Discard this card', effects: [{ kind: 'drawCard' }] }] };
    const permanent = state.addCard(you, 'Hand', { name: expensive.name, types: ['Creature'] });
    expect(canActivateAbility(engine, you, permanent, expensive, 'cycling')).toEqual({ ok: false, reason: expect.stringMatching(/cannot afford/) });
    expect(permanent.zone).toBe('Hand');
  });

  it('activateAbility genuinely discards the permanent (real Hand->Graveyard move) as part of paying the cost, BEFORE the ability even resolves', () => {
    const { state, you, engine, youPlayer } = setupGame();
    const permanent = state.addCard(you, 'Hand', { name: CYCLER.name, types: ['Creature'] });
    const self = wrapCard(state, permanent);
    const result = activateAbility(engine, you, permanent, CYCLER, { self, you: youPlayer, opponents: [], castFrom: 'hand' }, noopActions, 'cycling');
    expect(result.ok).toBe(true);
    expect(permanent.zone).toBe('Graveyard'); // discarded for real, not deferred to resolution
    expect(engine.stack.size).toBe(1);
  });

  it("resolving the pushed ability runs its own real effect (drawCard) without relocating the already-discarded source (602.1 has no such rule, and it's not on the stack's own zone anyway)", () => {
    const { state, you, engine, youPlayer } = setupGame();
    const permanent = state.addCard(you, 'Hand', { name: CYCLER.name, types: ['Creature'] });
    const self = wrapCard(state, permanent);
    const libraryBefore = you.library.length;
    activateAbility(engine, you, permanent, CYCLER, { self, you: youPlayer, opponents: [], castFrom: 'hand' }, noopActions, 'cycling');
    resolveTop(engine);
    expect(permanent.zone).toBe('Graveyard'); // still there, never moved a second time
    expect(you.library.length).toBe(libraryBefore - 1); // the real drawCard effect genuinely ran
  });

  it('TypeCycling\'s own real library search (move with subtype+shuffleAfter) finds the matching card, puts it in hand, and shuffles', () => {
    const { state, you, engine, youPlayer } = setupGame();
    const SEARCHER: CardDefinition = {
      name: 'Test Searcher',
      manaCost: '{2}{G}',
      typeLine: 'Creature — Test',
      abilities: [
        {
          name: 'cycling',
          cost: '{2}, Discard this card',
          effects: [{ kind: 'move', owner: 'you', from: 'Library', to: 'Hand', qty: 1, target: true, validType: 'land', subtype: 'Plains', shuffleAfter: true }],
        },
      ],
    };
    const permanent = state.addCard(you, 'Hand', { name: SEARCHER.name, types: ['Creature'] });
    const plains = state.addCard(you, 'Library', { name: 'Plains', types: ['Land'], subtypes: ['Plains'] });
    const self = wrapCard(state, permanent);
    const shuffleSpy = vi.fn();
    const actions: Actions = { ...loggingActions(state, [], permanent.id), shuffleLibrary: shuffleSpy };
    activateAbility(engine, you, permanent, SEARCHER, { self, you: youPlayer, opponents: [], castFrom: 'hand' }, actions, 'cycling');
    resolveTop(engine);
    expect(plains.zone).toBe('Hand'); // the real Plains card genuinely found and moved
    expect(shuffleSpy).toHaveBeenCalledTimes(1); // real 601.2/701.19 "then shuffle"
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

describe('queueExtraPhase — real "insert one more occurrence of a phase group" wiring (500-series, ENGINE_GAPS.md gap #17)', () => {
  function toPhase(engine: ReturnType<typeof setupGame>['engine'], phase: (typeof PHASES)[number]) {
    while (PHASES[engine.turn.phaseIndex] !== phase) advance(engine);
  }

  /** Y'shtola Rhul's own real shape: an `onEndStep` trigger that queues one more End Step ONLY on the first occurrence this turn (`ctx.firstPhaseGroupOccurrenceThisTurn`, card.ts). */
  function endStepQueueCard(order: string[]): CardDefinition {
    return {
      name: 'Test Y\'shtola-shaped',
      manaCost: '{1}{G}',
      typeLine: 'Creature — Test',
      triggers: [
        {
          name: 'onEndStep',
          on: 'endStep',
          effects: [
            {
              kind: 'custom',
              describe: 'tick, then queue an additional end step on the first occurrence this turn',
              run: (ctx: EffectContext, actions: Actions) => {
                order.push('tick');
                if (ctx.firstPhaseGroupOccurrenceThisTurn) actions.queueExtraPhase('EndOfTurn');
              },
            },
          ],
        },
      ],
    };
  }

  /** Just enough of `Actions` for this describe block's own test cards — a real `queueExtraPhase` wired to the SAME real `engine.ts` wrapper a pilot script/card effect would call, the rest unused (same `as Actions` narrowing pattern this file's own `sacActions`/`animateActions` already use). */
  function queueActions(engine: ReturnType<typeof setupGame>['engine']): Actions {
    return { queueExtraPhase: (phaseType) => queueExtraPhase(engine, phaseType) } as Actions;
  }

  it('the engine.ts wrapper mutates the real TurnState the same way turn.ts\'s own queueExtraPhase does', () => {
    const { engine } = setupGame();
    queueExtraPhase(engine, 'Combat');
    expect(engine.turn.queuedExtraPhases).toEqual(['Combat']);
  });

  it('a real onEndStep trigger that queues on the first occurrence re-enters End Step ONCE (re-firing the trigger), then does not queue again, and Cleanup still runs normally afterward', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const order: string[] = [];
    const card = endStepQueueCard(order);
    const real = state.addCard(you, 'Hand', { name: card.name, types: ['Creature'] });
    const self = wrapCard(state, real);
    castSpell(engine, you, real, card, ctxFor(state, self, youPlayer, [oppPlayer]), queueActions(engine));
    resolveTop(engine);
    toPhase(engine, 'EndOfTurn'); // first end step this turn — fires once, queues a second
    expect(order).toEqual(['tick']);
    expect(engine.turn.queuedExtraPhases).toEqual(['EndOfTurn']);
    advance(engine); // consumes the queued entry — re-enters EndOfTurn (same turn), re-fires the trigger
    expect(currentPhase(engine.turn)).toBe('EndOfTurn');
    expect(engine.turn.turnNumber).toBe(1); // still the SAME turn — genuinely distinct from a whole extra turn (gap #3)
    expect(order).toEqual(['tick', 'tick']); // fired again
    expect(engine.turn.queuedExtraPhases).toEqual([]); // NOT re-queued (this occurrence isn't the first anymore)
    advance(engine); // nothing queued this time -> genuinely moves on
    expect(currentPhase(engine.turn)).toBe('Cleanup'); // Cleanup's own real automatic actions still run untouched
    expect(order).toEqual(['tick', 'tick']); // no third fire
  });

  it('with no queued extra phase, a full turn behaves identically to before this pass (regression check)', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const order: string[] = [];
    // Same card shape, but its own effect never reads ctx.firstPhaseGroupOccurrenceThisTurn — a plain onEndStep trigger.
    const card: CardDefinition = {
      name: 'Test Plain Ticker',
      manaCost: '{1}{G}',
      typeLine: 'Creature — Test',
      triggers: [{ name: 'onEndStep', on: 'endStep', effects: [{ kind: 'custom', describe: 'tick', run: () => order.push('tick') }] }],
    };
    const real = state.addCard(you, 'Hand', { name: card.name, types: ['Creature'] });
    const self = wrapCard(state, real);
    castSpell(engine, you, real, card, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    toPhase(engine, 'EndOfTurn');
    expect(order).toEqual(['tick']);
    advance(engine);
    expect(currentPhase(engine.turn)).toBe('Cleanup'); // moves straight on, no repeat
    expect(order).toEqual(['tick']);
  });
});

describe('Trigger-doubling (ENGINE_GAPS.md gap #13) — real engine.ts wiring, not just triggers.ts\'s own pure logic', () => {
  function cloudShapedCard(order: string[]): CardDefinition {
    return {
      name: 'Test Cloud',
      manaCost: '{1}{G}',
      typeLine: 'Creature — Test',
      // Real Cloud, Midgar Mercenary shape: no `causedBy` restriction at
      // all, gated purely on "genuinely equipped right now."
      triggerDoubling: [{ scope: 'selfAndAttachedEquipment' }],
      triggers: [
        { name: 'onEnter', on: 'enter', effects: [{ kind: 'custom', describe: 'enter', run: () => order.push('enter') }] },
        { name: 'onStep', on: 'endStep', effects: [{ kind: 'custom', describe: 'tick', run: () => order.push('tick') }] },
      ],
    };
  }

  it("a permanent's own ETB does NOT double through the real castSpell->resolveTop path when NOTHING is equipped to it yet (Cloud's own real story: the doubling static is present from the moment he resolves, but his own ETB tutor still only fires once, since he isn't equipped when it fires)", () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const order: string[] = [];
    const card = cloudShapedCard(order);
    const real = state.addCard(you, 'Hand', { name: card.name, types: ['Creature'] });
    const self = wrapCard(state, real);
    castSpell(engine, you, real, card, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine); // real 603.6b ETB auto-fire, engine.ts's resolveTop -> fireTrigger
    expect(order).toEqual(['enter']);
  });

  it('once genuinely equipped, a LATER real upkeep/end-step auto-fire (fireOnPhaseEnterTriggers) genuinely doubles', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const order: string[] = [];
    const card = cloudShapedCard(order);
    const real = state.addCard(you, 'Hand', { name: card.name, types: ['Creature'] });
    const self = wrapCard(state, real);
    castSpell(engine, you, real, card, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    order.length = 0;
    // A real Equipment, attached for real (`state.equip`) — same real
    // mutation `Equip (301.5c)`'s own describe block already exercises.
    const equipment = state.addCard(you, 'Battlefield', { name: 'Test Equipment' });
    state.equip(equipment, real);
    while (PHASES[engine.turn.phaseIndex] !== 'EndOfTurn') advance(engine);
    expect(order).toEqual(['tick', 'tick']);
  });

  it("does NOT double a DIFFERENT permanent's own trigger — the grant is genuinely scoped to Cloud himself and whatever's attached to him, not every permanent on the board", () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const order: string[] = [];
    const card = cloudShapedCard(order);
    const real = state.addCard(you, 'Hand', { name: card.name, types: ['Creature'] });
    const self = wrapCard(state, real);
    castSpell(engine, you, real, card, ctxFor(state, self, youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    const equipment = state.addCard(you, 'Battlefield', { name: 'Test Equipment' });
    state.equip(equipment, real); // Cloud is equipped now, so his own future triggers double...
    order.length = 0;
    // ...but a wholly unrelated permanent's own end-step trigger must not.
    const bystanderOrder: string[] = [];
    const bystanderCard: CardDefinition = {
      name: 'Test Bystander',
      // Free — Cloud's own `{1}{G}` cast already tapped this fixture's 3
      // lands (setupGame's own fixed board), same turn; this test is about
      // trigger-doubling scope, not a second real mana payment.
      manaCost: '',
      typeLine: 'Creature — Test',
      triggers: [{ name: 'onStep', on: 'endStep', effects: [{ kind: 'custom', describe: 'tick', run: () => bystanderOrder.push('tick') }] }],
    };
    const bystanderReal = state.addCard(you, 'Hand', { name: bystanderCard.name, types: ['Creature'] });
    castSpell(engine, you, bystanderReal, bystanderCard, ctxFor(state, wrapCard(state, bystanderReal), youPlayer, [oppPlayer]), noopActions);
    resolveTop(engine);
    while (PHASES[engine.turn.phaseIndex] !== 'EndOfTurn') advance(engine);
    expect(order).toEqual(['tick', 'tick']); // Cloud's own trigger still doubles
    expect(bystanderOrder).toEqual(['tick']); // the bystander's does not
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

describe('Target-legality re-validation at resolution (CR 601.2c cast-time locking + 608.2b "fizzle", ENGINE_GAPS.md gap #4) — real end-to-end via castSpell/resolveTop', () => {
  // Real shape: fate-of-the-sun-cryst's own "Destroy target nonland
  // permanent" (`validType: 'permanent'`, `nonLand: true`, `qty: 1`) —
  // `{1}{G}` here (not that card's own printed `{1}{W}`) purely so
  // `setupGame()`'s fixed 2 Forest + 1 Mountain board can afford it with no
  // extra land setup per test; the cost's own color is irrelevant to what
  // this describe block is actually testing (target-legality re-validation,
  // not mana).
  const DESTROY_TARGET: CardDefinition = {
    name: 'Test Fate Bolt',
    manaCost: '{1}{G}',
    typeLine: 'Instant',
    effects: [{ kind: 'destroy', validType: 'permanent', nonLand: true, qty: 1 }],
  };

  it('locks the real target at CAST time (castSpell\'s declaredTarget) and destroys it normally when it stays legal all the way through resolution (baseline)', () => {
    const { state, you, opp, engine, youPlayer, oppPlayer } = setupGame();
    const target = state.addCard(opp, 'Battlefield', { name: 'Test Blocker', types: ['Creature'] });
    const real = state.addCard(you, 'Hand', { name: DESTROY_TARGET.name, types: [] });
    const self = wrapCard(state, real);
    const log: any[] = [];
    const actions = loggingActions(state, log, real.id);
    const cast = castSpell(engine, you, real, DESTROY_TARGET, ctxFor(state, self, youPlayer, [oppPlayer]), actions, undefined, undefined, target);
    expect(cast.ok).toBe(true);
    resolveTop(engine);
    expect(state.cards.get(target.id)?.zone).toBe('Graveyard');
  });

  it('fizzles (608.2b): the declared target is destroyed by something ELSE between casting and resolution — the removal spell still resolves off the stack, but does nothing', () => {
    const { state, you, opp, engine, youPlayer, oppPlayer } = setupGame();
    const target = state.addCard(opp, 'Battlefield', { name: 'Test Blocker', types: ['Creature'] });
    const bystander = state.addCard(opp, 'Battlefield', { name: 'Test Bystander', types: ['Creature'] });
    const real = state.addCard(you, 'Hand', { name: DESTROY_TARGET.name, types: [] });
    const self = wrapCard(state, real);
    const log: any[] = [];
    const actions = loggingActions(state, log, real.id);
    const cast = castSpell(engine, you, real, DESTROY_TARGET, ctxFor(state, self, youPlayer, [oppPlayer]), actions, undefined, undefined, target);
    expect(cast.ok).toBe(true);
    // In response, something else (another removal spell, a lethal-damage
    // SBA, ...) genuinely destroys the declared target BEFORE this spell
    // resolves — real 608.2b: this spell's own only target is now illegal.
    state.move(target, 'Graveyard');
    const resolved = resolveTop(engine);
    expect(resolved).toBeDefined(); // the spell still genuinely resolves (a no-op resolution, not countered)
    expect(state.cards.get(target.id)?.zone).toBe('Graveyard'); // unaffected further — no double-destroy
    expect(state.cards.get(bystander.id)?.zone).toBe('Battlefield'); // and NOT silently retargeted onto a different, still-legal creature
    // The spell itself still moves to its real post-resolution zone —
    // 608.2b: fizzling still counts as "resolved," not "removed some other way."
    expect(state.cards.get(real.id)?.zone).toBe('Graveyard');
  });

  it('fizzles when the declared target instead LEAVES THE BATTLEFIELD (bounced to hand) rather than dying outright', () => {
    const { state, you, opp, engine, youPlayer, oppPlayer } = setupGame();
    const target = state.addCard(opp, 'Battlefield', { name: 'Test Blocker', types: ['Creature'] });
    const real = state.addCard(you, 'Hand', { name: DESTROY_TARGET.name, types: [] });
    const self = wrapCard(state, real);
    const log: any[] = [];
    const actions = loggingActions(state, log, real.id);
    castSpell(engine, you, real, DESTROY_TARGET, ctxFor(state, self, youPlayer, [oppPlayer]), actions, undefined, undefined, target);
    state.move(target, 'Hand'); // bounced by something else before this resolves
    resolveTop(engine);
    expect(state.cards.get(target.id)?.zone).toBe('Hand'); // never destroyed — it wasn't on the battlefield to destroy anymore
  });

  it('with NO declaredTarget at all, behavior is unchanged — a fresh lazy chooseTarget pick at resolution (backward compatible, zero regression for every existing scenario)', () => {
    const { state, you, opp, engine, youPlayer, oppPlayer } = setupGame();
    const target = state.addCard(opp, 'Battlefield', { name: 'Test Blocker', types: ['Creature'] });
    const real = state.addCard(you, 'Hand', { name: DESTROY_TARGET.name, types: [] });
    const self = wrapCard(state, real);
    const log: any[] = [];
    const actions = loggingActions(state, log, real.id);
    castSpell(engine, you, real, DESTROY_TARGET, ctxFor(state, self, youPlayer, [oppPlayer]), actions); // no declaredTarget
    resolveTop(engine);
    expect(state.cards.get(target.id)?.zone).toBe('Graveyard'); // still destroyed via the old lazy chooseTarget(pool) default
  });
});
