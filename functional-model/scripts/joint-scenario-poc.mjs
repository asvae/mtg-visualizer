// Proof of concept: two DIFFERENT cards' resolutions chained against ONE
// real, shared GameState — the concrete case that was impossible with the
// old static mocks (each got a disposable snapshot). The Final Days really
// creates 3 Horror tokens on the battlefield; Warren Elder's pumpAll then
// really sees and pumps those SAME real objects, not a hand-authored mock
// creature count.
//
// Usage: npx vite-node functional-model/scripts/joint-scenario-poc.mjs

const { GameState, wrapPlayer, wrapCard, effectivePT } = await import('../state.ts');
const { resolveCard } = await import('../card.ts');
const { theFinalDays } = await import('../cards/the-final-days/definition.ts');
const { warrenElder } = await import('../cards/warren-elder/definition.ts');

const state = new GameState();
const you = state.addPlayer('you');
// 3 creature cards in the graveyard so The Final Days' flashback amount
// computes to 3 (its own `ctx.you.getCardsIn('Graveyard').filter(isCreature)`).
for (let i = 0; i < 3; i++) state.addCard(you, 'Graveyard', { name: `gy-creature-${i}`, types: ['Creature'] });

const actions = {
  createToken: (controller, token, qty = 1, opts) => state.createToken(state.players.get(controller.getId()), token, qty, opts).map((c) => wrapCard(state, c)),
  pump: (target, power, toughness) => state.pump(state.cards.get(target.getId()), power, toughness),
};

// Step 1: resolve The Final Days (cast from graveyard) for real.
const youPlayer = wrapPlayer(state, you);
resolveCard(theFinalDays, { self: null, you: youPlayer, opponents: [], castFrom: 'graveyard' }, actions);

const tokensAfterFinalDays = you.battlefield.filter((c) => c.name === 'Horror');
console.log(`After The Final Days: ${tokensAfterFinalDays.length} real Horror tokens on the battlefield (ids: ${tokensAfterFinalDays.map((c) => c.id).join(', ')})`);

// Step 2: resolve Warren Elder's activated ability against the SAME state.
resolveCard(warrenElder, { self: null, you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' }, actions);

console.log('\nAfter Warren Elder pumps "creatures you control" (via the real layers system, layers.ts):');
for (const c of you.battlefield) {
  const [power, toughness] = effectivePT(c);
  console.log(`  ${c.name} (id ${c.id}): base ${c.basePower}/${c.baseToughness} -> net ${power}/${toughness}`);
}
