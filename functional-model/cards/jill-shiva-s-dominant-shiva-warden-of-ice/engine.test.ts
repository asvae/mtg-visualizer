import { describe, expect, it } from 'vitest';
import type { Actions, EffectContext } from '../../card';
import { resolveCard } from '../../card';
import { GameState, wrapPlayer, wrapCard } from '../../state';
import type { RealCard, RealPlayer } from '../../state';
import { basicLandsFor } from '../../mana';
import { createEngine, canCastSpell, castSpell, canActivateAbility, activateAbility, resolveTop, advance } from '../../engine';
import { PHASES } from '../../turn';
import { jillShivasDominant } from './definition';

/**
 * Real, engine-piloted playthrough of this card (per the user's own request
 * to "recreate scenario for this card" against the turn-based engine, not
 * just harness.ts's flat trace tool). Unlike engine.test.ts's own generic
 * fixtures (`{} as Actions` — those cards have no real `effects`), Jill's
 * own effects genuinely call `moveTo`/`chooseTarget`/`grantKeyword`/`tap`,
 * so this file needs REAL functioning `Actions`, not a stub. `card.ts`'s own
 * `defaultActions` (the same shape) is intentionally NOT exported — it
 * exists only as `resolveCard`'s own internal default — so `realActions`
 * below reconstructs the same real-mutation shape directly against
 * `GameState`, the same way harness.ts's own `loggingActions` does, minus
 * the trace logging (nothing here needs a replay trace).
 */
function realActions(state: GameState): Actions {
  const cardOf = (c: { getId(): number }): RealCard => state.cards.get(c.getId())!;
  const playerOf = (p: { getId(): number }): RealPlayer => state.players.get(p.getId())!;
  return {
    createToken: (controller, token, qty = 1, opts) => state.createToken(playerOf(controller), token, qty, opts).map((c) => wrapCard(state, c)),
    pump: (target, power, toughness) => {
      if ('getId' in target && !('getLife' in target)) state.pump(cardOf(target as { getId(): number }), power, toughness);
    },
    moveTo: (target, zone) => state.move(cardOf(target), zone),
    // Same "which object got picked is pure targeting mechanics" convention
    // harness.ts's own `loggingActions.chooseTarget` already uses — a real
    // player's actual choice isn't modeled, deterministic first-candidate is.
    chooseTarget: (pool) => pool[0]!,
    move: (player, from, to, qty, validType) => {
      const real = playerOf(player);
      const fromArr = from === 'Hand' ? real.hand : from === 'Library' ? real.library : from === 'Graveyard' ? real.graveyard : from === 'Battlefield' ? real.battlefield : real.exile;
      const matches = (c: RealCard) => {
        if (!validType || validType === 'any') return true;
        const wrapped = wrapCard(state, c);
        if (validType === 'creature') return wrapped.isCreature();
        if (validType === 'artifact') return wrapped.isArtifact();
        if (validType === 'land') return wrapped.isLand();
        return true;
      };
      const chosen = fromArr.filter(matches).slice(0, qty);
      for (const c of chosen) state.move(c, to);
      return chosen.map((c) => wrapCard(state, c));
    },
    sacrifice: (player, qty, validType, notSelf, tokenFilter) => {
      const matches = (c: RealCard) => {
        if (tokenFilter === 'token' && !c.isTokenCard) return false;
        if (tokenFilter === 'nontoken' && c.isTokenCard) return false;
        if (!validType || validType === 'any') return true;
        const wrapped = wrapCard(state, c);
        if (validType === 'creature') return wrapped.isCreature();
        if (validType === 'artifact') return wrapped.isArtifact();
        return true;
      };
      return state.sacrifice(playerOf(player), qty, matches).map((c) => wrapCard(state, c));
    },
    discard: (player, qty) => {
      state.discard(playerOf(player), qty);
    },
    putCounter: (target, counterType, amount) => state.putCounter(cardOf(target), counterType, amount),
    equip: (equipment, target) => state.equip(cardOf(equipment), cardOf(target)),
    animate: (target, types) => state.animate(cardOf(target), types),
    gainControl: (controller, target) => state.gainControl(playerOf(controller), cardOf(target)),
    // No real card-drafting/library-reordering model — same log-only scope
    // harness.ts's own `surveil`/`counter` already document; nothing here
    // needs the observation, so these are simple no-ops.
    surveil: () => {},
    counter: () => {},
    destroy: (target) => {
      state.destroy(cardOf(target));
    },
    dealDamage: (source, target, amount) => {
      const sourceReal = cardOf(source);
      if ('getLife' in target) state.dealDamage(playerOf(target as { getId(): number }) as RealPlayer, amount, sourceReal);
      else state.dealDamage(cardOf(target as { getId(): number }), amount, sourceReal);
    },
    tap: (target) => state.tap(cardOf(target)),
    untap: (target) => state.untap(cardOf(target)),
    grantKeyword: (target, keyword) => state.grantKeyword(cardOf(target), keyword),
    copyPermanent: (source, controller) => wrapCard(state, state.copyPermanent(cardOf(source), playerOf(controller))),
    dig: (player, qty, take, validType) => {
      const matches = (c: RealCard) => !validType || validType === 'any' || (validType === 'artifact' && c.types.includes('Artifact'));
      return state.dig(playerOf(player), qty, take, matches).map((c) => wrapCard(state, c));
    },
    delayUntil: (phase, run) => state.scheduleDelayedTrigger(phase, run),
  };
}

function setupGame() {
  const state = new GameState();
  const you = state.addPlayer('you');
  const opp = state.addPlayer('opp');

  // Enough basic lands to cover the larger of Jill's two real costs
  // ({2}{U} to cast, {3}{U}{U} to activate the transform) — lands untap
  // between turns, so one shared pool covers both casts across this
  // playthrough (mana.ts's own `basicLandsFor`, the "don't hand-add 10
  // lands per scenario" answer).
  for (const landName of basicLandsFor('{3}{U}{U}')) {
    state.addCard(you, 'Battlefield', { name: landName, types: ['Land'], subtypes: [landName] });
  }
  // "1 creature on our side" (the user's own scenario setup) — a real
  // Unblockable-grant target for Shiva's chapter I/II.
  const hero = state.addCard(you, 'Battlefield', { name: 'Test Hero', types: ['Creature'], subtypes: ['Human'], basePower: 1, baseToughness: 1 });
  // "1 opp artifact and land" — the artifact is Jill's own ETB bounce
  // target, the land is chapter III's "tap all lands your opponents
  // control" target.
  const oppArtifact = state.addCard(opp, 'Battlefield', { name: 'Test Artifact', types: ['Artifact'], subtypes: [] });
  const oppLand = state.addCard(opp, 'Battlefield', { name: 'Forest', types: ['Land'], subtypes: ['Forest'] });
  const jill = state.addCard(you, 'Hand', { name: jillShivasDominant.name, types: ['Creature'], subtypes: ['Human', 'Noble', 'Warrior'], basePower: 2, baseToughness: 2 });

  // A real library for each player — this playthrough advances several
  // real turns for Shiva's own Saga chapters (one per draw step), which
  // would otherwise genuinely run a player out and trigger real 704.5a.
  for (let i = 0; i < 20; i++) {
    state.addCard(you, 'Library', { name: `you-library-filler-${i}`, types: [] });
    state.addCard(opp, 'Library', { name: `opp-library-filler-${i}`, types: [] });
  }

  const engine = createEngine(state, [you, opp]);
  advance(engine); // Untap -> Upkeep
  advance(engine); // Upkeep -> Draw
  advance(engine); // Draw -> Main1

  const youPlayer = wrapPlayer(state, you);
  const oppPlayer = wrapPlayer(state, opp);
  return { state, you, opp, engine, youPlayer, oppPlayer, hero, oppArtifact, oppLand, jill };
}

function ctxFor(self: ReturnType<typeof wrapCard>, you: ReturnType<typeof wrapPlayer>, opponents: ReturnType<typeof wrapPlayer>[]): EffectContext {
  return { self, you, opponents, castFrom: 'hand' };
}

/** Advances to the next Main1 where `you` (players[0]) is active — clears summoning sickness (turnNumber no longer matches) and satisfies the transform ability's own sorcery-speed timing (307.1a: your own main phase). */
function toYourNextMain1(engine: ReturnType<typeof createEngine>) {
  const startTurn = engine.turn.turnNumber;
  do {
    advance(engine);
  } while (!(PHASES[engine.turn.phaseIndex] === 'Main1' && engine.turn.turnNumber !== startTurn && engine.turn.activePlayerIndex === 0));
}

describe("Jill, Shiva's Dominant — full engine playthrough (cast -> ETB -> transform -> Saga chapters)", () => {
  it('walks the whole card through the real engine, one legal action at a time', () => {
    const { state, engine, you, opp, youPlayer, oppPlayer, hero, oppArtifact, oppLand, jill } = setupGame();
    const actions = realActions(state);
    const self = wrapCard(state, jill);
    const ctx = ctxFor(self, youPlayer, [oppPlayer]);

    // --- Cast Jill from hand (601) ---
    expect(canCastSpell(engine, you, jillShivasDominant).ok).toBe(true);
    const cast = castSpell(engine, you, jill, jillShivasDominant, ctx, actions);
    expect(cast.ok).toBe(true);
    expect(jill.zone).toBe('Stack');
    expect(engine.stack.size).toBe(1);

    // --- Resolves onto the battlefield; real ETB auto-fires (603.6b via
    // `Trigger.on === 'enter'`) — bounces the opponent's artifact (the
    // "up to one OTHER nonland permanent" pool has only one real candidate
    // here, so `chooseTarget`'s deterministic first-candidate pick is
    // unambiguous, same reasoning Summon: Bahamut's own scenarios settled on). ---
    resolveTop(engine);
    expect(jill.zone).toBe('Battlefield');
    expect(oppArtifact.zone).toBe('Hand');

    // --- Illegal: transform ability requires sorcery-speed timing AND is
    // blocked by summoning sickness the turn Jill entered (302.6 — a
    // {T}-cost activated ability, not just attacking, per this session's
    // own `canActivateAbility` fix). ---
    expect(canActivateAbility(engine, you, jill, jillShivasDominant)).toEqual({
      ok: false,
      reason: expect.stringMatching(/summoning sickness/),
    });

    // --- Illegal: the opponent doesn't control Jill (602.1). ---
    expect(canActivateAbility(engine, opp, jill, jillShivasDominant)).toEqual({
      ok: false,
      reason: expect.stringMatching(/do not control/),
    });

    // Advance to your own next Main1 — sickness clears, lands untap.
    toYourNextMain1(engine);

    // --- Activate the transform ability (602.1: {3}{U}{U}, {T}, sorcery-speed only) ---
    expect(canActivateAbility(engine, you, jill, jillShivasDominant).ok).toBe(true);
    const activate = activateAbility(engine, you, jill, jillShivasDominant, ctx, actions);
    expect(activate.ok).toBe(true);
    expect(jill.tapped).toBe(true); // {T} cost paid
    expect(engine.stack.size).toBe(1);

    // --- Resolves: the ability's own `custom` effect exiles then returns
    // Jill transformed (614.3a/b-style DFC simplification — see
    // definition.ts's own header comment). `resolveTop`'s `isAbility`
    // branch doesn't move the permanent itself; the effect's own
    // `actions.moveTo` calls do. ---
    resolveTop(engine);
    expect(jill.zone).toBe('Battlefield');

    // --- Shiva, Warden of Ice's own Saga chapters (back face) — fired
    // manually via `resolveCard` directly, NOT through the engine's stack/
    // priority machinery: this engine has no real lore-counter/Saga
    // automation yet (614.3/643.2 chapter-ability triggering is a
    // separate, not-yet-built piece — a different in-flight fork is
    // covering real Saga lore-counter automation; this test intentionally
    // doesn't duplicate or wait on that work, and drives the three chapters
    // by name instead, the same "named trigger" shape harness.ts's own
    // scenarios already use for this card). ---
    const backFace = jillShivasDominant.backFace!;
    const backSelf = wrapCard(state, jill);
    const backCtx = ctxFor(backSelf, youPlayer, [oppPlayer]);

    // Chapter I: target creature can't be blocked this turn (approximated
    // as a real Unblockable keyword grant — card.ts's own `Keyword` doc
    // comment). Only real creature candidate is the hero token.
    resolveCard(backFace, backCtx, actions, 'chapterI');
    expect(hero.keywords).toContain('Unblockable');

    // Chapter II: same grant again.
    resolveCard(backFace, backCtx, actions, 'chapterII');
    expect(hero.keywords).toContain('Unblockable');

    // Chapter III: tap all opponent lands, then Cold Snap exiles and
    // returns Shiva (front face up).
    expect(oppLand.tapped).toBe(false);
    resolveCard(backFace, backCtx, actions, 'chapterIII');
    expect(oppLand.tapped).toBe(true);
    expect(jill.zone).toBe('Battlefield');
  });
});
