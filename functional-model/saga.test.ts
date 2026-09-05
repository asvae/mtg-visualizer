import { describe, expect, it } from 'vitest';
import type { CardDefinition, EffectContext, Actions } from './card';
import { GameState, wrapPlayer, wrapCard } from './state';
import type { RealCard } from './state';
import { createEngine, canCastSpell, castSpell, resolveTop, advance } from './engine';
import { advanceSaga, transformPermanent, isSaga } from './saga';
import { PHASES } from './turn';

function setupGame() {
  const state = new GameState();
  const you = state.addPlayer('you');
  const opp = state.addPlayer('opp');
  state.addCard(you, 'Battlefield', { name: 'Mountain', types: ['Land'], subtypes: ['Mountain'] });
  state.addCard(you, 'Battlefield', { name: 'Mountain', types: ['Land'], subtypes: ['Mountain'] });
  const engine = createEngine(state, [you, opp]);
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

/** Just enough of `Actions` for these test cards' own `custom` effects (a marker push, and — for the transform-back cases — a real `moveTo` so `state.move`'s own 400.7 counter reset genuinely fires). */
function testActions(state: GameState): Actions {
  return {
    moveTo: (target, zone) => state.move(state.cards.get(target.getId())!, zone),
  } as Actions;
}

/** A plain (non-transforming) Saga, Bahamut-shaped: `chapterCount` named chapters, each pushing a distinct marker onto `order`. */
function plainSaga(order: string[], chapterCount: number): CardDefinition {
  const names = ['chapterI', 'chapterII', 'chapterIII', 'chapterIV'] as const;
  return {
    name: 'Test Saga',
    manaCost: '{1}{R}',
    typeLine: 'Enchantment Creature — Saga Dragon',
    triggers: names.slice(0, chapterCount).map((name) => ({
      name,
      effects: [{ kind: 'custom', describe: name, run: () => order.push(name) }],
    })),
  };
}

/** A Saga whose FINAL chapter exiles-and-returns itself — the same real shape Jill/Shiva's Dominant and Dion/Bahamut's Dominant use to transform back instead of being sacrificed by 714.4. */
function transformBackSaga(order: string[]): CardDefinition {
  return {
    name: 'Test Transforming Saga',
    manaCost: '',
    typeLine: 'Enchantment Creature — Saga Elemental',
    triggers: [
      { name: 'chapterI', effects: [{ kind: 'custom', describe: 'chapterI', run: () => order.push('chapterI') }] },
      { name: 'chapterII', effects: [{ kind: 'custom', describe: 'chapterII', run: () => order.push('chapterII') }] },
      {
        name: 'chapterIII',
        effects: [
          { kind: 'custom', describe: 'chapterIII', run: () => order.push('chapterIII') },
          {
            kind: 'custom',
            describe: 'exile then return (transform back)',
            run: (ctx: EffectContext, actions: Actions) => {
              actions.moveTo(ctx.self, 'Exile');
              actions.moveTo(ctx.self, 'Battlefield');
            },
          },
        ],
      },
    ],
  };
}

describe('isSaga', () => {
  it('recognizes a real Saga typeLine', () => {
    expect(isSaga({ name: 'x', manaCost: '', typeLine: 'Enchantment Creature — Saga Dragon' })).toBe(true);
  });

  it('does not recognize a non-Saga typeLine', () => {
    expect(isSaga({ name: 'x', manaCost: '', typeLine: 'Creature — Human Warrior' })).toBe(false);
  });
});

describe('a plain Saga (714.2b/c/714.3a/b/714.4) — cast, chapters across turns, final sacrifice', () => {
  function toYourNextMain1(engine: ReturnType<typeof setupGame>['engine']) {
    const startTurn = engine.turn.turnNumber;
    do {
      advance(engine);
    } while (!(PHASES[engine.turn.phaseIndex] === 'Main1' && engine.turn.turnNumber !== startTurn && engine.turn.activePlayerIndex === 0));
  }

  it('gets its first lore counter and fires chapterI the moment it enters (714.2b)', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const order: string[] = [];
    const card = plainSaga(order, 4);
    const real = state.addCard(you, 'Hand', { name: card.name, types: ['Enchantment', 'Creature'] });
    const self = wrapCard(state, real);
    const actions = testActions(state);
    expect(canCastSpell(engine, you, card).ok).toBe(true);
    castSpell(engine, you, real, card, ctxFor(state, self, youPlayer, [oppPlayer]), actions);
    resolveTop(engine);
    expect(real.counters['lore']).toBe(1);
    expect(order).toEqual(['chapterI']);
    expect(real.zone).toBe('Battlefield');
  });

  it('fires the remaining chapters one per subsequent controller draw step, then sacrifices itself after the last (714.4)', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const order: string[] = [];
    const card = plainSaga(order, 4);
    const real = state.addCard(you, 'Hand', { name: card.name, types: ['Enchantment', 'Creature'] });
    const self = wrapCard(state, real);
    const actions = testActions(state);
    castSpell(engine, you, real, card, ctxFor(state, self, youPlayer, [oppPlayer]), actions);
    resolveTop(engine); // chapterI, lore=1

    toYourNextMain1(engine); // your next draw step -> chapterII, lore=2
    expect(real.counters['lore']).toBe(2);
    expect(order).toEqual(['chapterI', 'chapterII']);
    expect(real.zone).toBe('Battlefield');

    toYourNextMain1(engine); // chapterIII, lore=3
    expect(real.counters['lore']).toBe(3);
    expect(order).toEqual(['chapterI', 'chapterII', 'chapterIII']);
    expect(real.zone).toBe('Battlefield');

    toYourNextMain1(engine); // chapterIV, lore=4 -> 714.4 sacrifice
    expect(order).toEqual(['chapterI', 'chapterII', 'chapterIII', 'chapterIV']);
    expect(real.zone).toBe('Graveyard');
  });

  it("does NOT advance on the OTHER player's draw step (714.2c is controller-scoped)", () => {
    const { state, you, opp, engine, youPlayer, oppPlayer } = setupGame();
    const order: string[] = [];
    const card = plainSaga(order, 4);
    const real = state.addCard(you, 'Hand', { name: card.name, types: ['Enchantment', 'Creature'] });
    const self = wrapCard(state, real);
    const actions = testActions(state);
    castSpell(engine, you, real, card, ctxFor(state, self, youPlayer, [oppPlayer]), actions);
    resolveTop(engine); // chapterI, lore=1

    // Advance only to the OPPONENT's Main1 (their own draw step), not yours.
    const startTurn = engine.turn.turnNumber;
    do {
      advance(engine);
    } while (!(PHASES[engine.turn.phaseIndex] === 'Main1' && engine.turn.turnNumber !== startTurn && engine.turn.activePlayerIndex === 1));

    expect(real.counters['lore']).toBe(1); // unchanged — that was the OPPONENT's draw step
    expect(order).toEqual(['chapterI']);
  });
});

describe('a transforming Saga whose final chapter exiles-and-returns itself is NOT sacrificed (714.4, via the real 400.7 counter reset)', () => {
  it('fires all three chapters, then survives (transformed back) instead of being sacrificed', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const order: string[] = [];
    const card = transformBackSaga(order);
    const real = state.addCard(you, 'Hand', { name: card.name, types: ['Enchantment', 'Creature'] });
    const self = wrapCard(state, real);
    const actions = testActions(state);
    castSpell(engine, you, real, card, ctxFor(state, self, youPlayer, [oppPlayer]), actions);
    resolveTop(engine); // chapterI

    const registered = { card, ctx: ctxFor(state, self, youPlayer, [oppPlayer]), actions };
    advanceSaga(engine, real, registered); // chapterII
    advanceSaga(engine, real, registered); // chapterIII -> exile+return, would-be sacrifice SKIPPED

    expect(order).toEqual(['chapterI', 'chapterII', 'chapterIII']);
    expect(real.zone).toBe('Battlefield'); // survived — NOT in the graveyard
    expect(real.counters['lore'] ?? 0).toBe(0); // reset by the exile+return (400.7), not left at 3
  });
});

describe('transformPermanent — a permanent transforming INTO a Saga starts its own chapter count immediately', () => {
  it('registers the new face and fires its chapterI right away, exactly like a fresh ETB', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const frontFace: CardDefinition = { name: 'Test Front', manaCost: '{1}', typeLine: 'Creature — Human', pt: [1, 1] };
    const real = state.addCard(you, 'Hand', { name: frontFace.name, types: ['Creature'] });
    const self = wrapCard(state, real);
    const ctx = ctxFor(state, self, youPlayer, [oppPlayer]);
    const actions = testActions(state);
    castSpell(engine, you, real, frontFace, ctx, actions);
    resolveTop(engine); // front face enters — not a Saga, no lore counter yet
    expect(real.counters['lore'] ?? 0).toBe(0);

    const order: string[] = [];
    const backFace = plainSaga(order, 3);
    transformPermanent(engine, real, backFace, ctx, actions);

    expect(real.counters['lore']).toBe(1);
    expect(order).toEqual(['chapterI']);
  });

  it('a permanent transforming into a NON-Saga face gets no lore counter at all', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const frontFace: CardDefinition = { name: 'Test Front', manaCost: '{1}', typeLine: 'Creature — Human', pt: [1, 1] };
    const otherFace: CardDefinition = { name: 'Test Other', manaCost: '', typeLine: 'Creature — Beast', pt: [3, 3] };
    const real = state.addCard(you, 'Hand', { name: frontFace.name, types: ['Creature'] });
    const self = wrapCard(state, real);
    const ctx = ctxFor(state, self, youPlayer, [oppPlayer]);
    const actions = testActions(state);
    castSpell(engine, you, real, frontFace, ctx, actions);
    resolveTop(engine);
    transformPermanent(engine, real, otherFace, ctx, actions);
    expect(real.counters['lore'] ?? 0).toBe(0);
  });
});

describe('advanceSaga — defensive/no-op paths', () => {
  it('does nothing for a non-Saga registered card', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const notASaga: CardDefinition = { name: 'Not A Saga', manaCost: '', typeLine: 'Creature — Beast', pt: [2, 2] };
    const real = state.addCard(you, 'Battlefield', { name: notASaga.name, types: ['Creature'] });
    const self = wrapCard(state, real);
    advanceSaga(engine, real, { card: notASaga, ctx: ctxFor(state, self, youPlayer, [oppPlayer]), actions: testActions(state) });
    expect(real.counters['lore'] ?? 0).toBe(0);
  });

  it('does nothing once a Saga has already reached its greatest chapter number', () => {
    const { state, you, engine, youPlayer, oppPlayer } = setupGame();
    const order: string[] = [];
    const card = plainSaga(order, 1); // a 1-chapter Saga, already at max after chapterI
    const real = state.addCard(you, 'Hand', { name: card.name, types: ['Enchantment', 'Creature'] });
    const self = wrapCard(state, real);
    const actions = testActions(state);
    castSpell(engine, you, real, card, ctxFor(state, self, youPlayer, [oppPlayer]), actions);
    resolveTop(engine); // chapterI fires, lore=1 -> 1 >= max(1) -> sacrificed
    expect(real.zone).toBe('Graveyard');
    expect(order).toEqual(['chapterI']);

    // Calling advanceSaga again on the (now graveyard-bound, and fully lore-complete) card is a defensive no-op.
    const registered = { card, ctx: ctxFor(state, self, youPlayer, [oppPlayer]), actions };
    advanceSaga(engine, real, registered);
    expect(order).toEqual(['chapterI']);
  });
});
