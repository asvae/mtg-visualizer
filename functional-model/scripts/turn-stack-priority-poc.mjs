// Proof of concept: turn/phase structure + a real stack + priority actually
// chaining a real sequence, against ONE shared, real GameState — "you cast
// a sorcery (Flashback), in response you (well, someone) activates Warren
// Elder, LIFO resolves Warren Elder FIRST, then the sorcery — meaning the
// tokens the sorcery creates come too LATE to be pumped by an ability that
// already resolved. A real, subtle rules-accurate consequence of correct
// LIFO order, not a hand-picked example.
//
// Usage: npx vite-node functional-model/scripts/turn-stack-priority-poc.mjs

const { GameState, wrapPlayer, wrapCard, effectivePT } = await import('../state.ts');
const { startGame, currentPhase, advancePhase, activePlayer } = await import('../turn.ts');
const { Stack } = await import('../stack.ts');
const { runPriorityRound } = await import('../priority.ts');
const { theFinalDays } = await import('../cards/the-final-days/index.ts');
const { warrenElder } = await import('../cards/warren-elder/index.ts');

const state = new GameState();
const you = state.addPlayer('you');
const opp = state.addPlayer('opp');
for (let i = 0; i < 2; i++) state.addCard(you, 'Graveyard', { name: `gy-creature-${i}`, types: ['Creature'] });
state.addCard(you, 'Battlefield', { name: 'Warren Elder', types: ['Creature'], basePower: 2, baseToughness: 2 }); // real printed 2/2

const actions = {
  createToken: (controller, token, qty = 1, opts) => state.createToken(state.players.get(controller.getId()), token, qty, opts).map((c) => wrapCard(state, c)),
  pump: (target, power, toughness) => state.pump(state.cards.get(target.getId()), power, toughness),
};

let turn = startGame();
console.log(`Turn ${turn.turnNumber}, ${currentPhase(turn)}, active: ${activePlayer(turn, [you, opp]).name}`);
turn = advancePhase(state, turn, [you, opp]); // Upkeep
turn = advancePhase(state, turn, [you, opp]); // Draw (skipped — turn 1, 2 players)
turn = advancePhase(state, turn, [you, opp]); // Main1
console.log(`Advanced to ${currentPhase(turn)} (turn 1's draw step correctly skipped)`);

const stack = new Stack();
const youPlayer = wrapPlayer(state, you);
const oppPlayer = wrapPlayer(state, opp);

// Round 1: you cast The Final Days via Flashback.
let outcome = runPriorityRound(stack, [
  { push: { card: theFinalDays, ctx: { self: null, you: youPlayer, opponents: [oppPlayer], castFrom: 'graveyard' }, actions } },
  { pass: true },
]);
console.log(`\nRound 1 (you cast The Final Days): ${outcome}, stack size ${stack.size}`);

// Round 2: priority resets to the active player after any action (117.3c)
// — you pass this time, and in response, Warren Elder's ability goes on
// the stack ON TOP of The Final Days.
outcome = runPriorityRound(stack, [
  { pass: true },
  { push: { card: warrenElder, ctx: { self: null, you: youPlayer, opponents: [oppPlayer], castFrom: 'hand' }, actions } },
]);
console.log(`Round 2 (Warren Elder activated in response): ${outcome}, stack size ${stack.size}`);

// Round 3: everyone passes -> resolve the TOP object (Warren Elder, LIFO).
outcome = runPriorityRound(stack, [{ pass: true }, { pass: true }]);
console.log(`Round 3: ${outcome} -> resolving top of stack`);
stack.resolveTop();
const creaturesAtPumpTime = you.battlefield.filter((c) => c.types.includes('Creature'));
console.log(`Warren Elder resolved FIRST. Creatures pumped: ${creaturesAtPumpTime.map((c) => c.name).join(', ')} (The Final Days hasn't resolved yet — no Horror tokens exist)`);

// Round 4: resolve The Final Days.
outcome = runPriorityRound(stack, [{ pass: true }, { pass: true }]);
stack.resolveTop();
const horrors = you.battlefield.filter((c) => c.name === 'Horror');
console.log(`The Final Days resolved SECOND. Horror tokens created: ${horrors.length}`);

console.log('\nFinal board state (net P/T via the real layers system):');
for (const c of you.battlefield) {
  const [p, t] = effectivePT(c);
  console.log(`  ${c.name}: ${p}/${t}`);
}
console.log('-> Warren Elder itself is pumped (it existed when its own ability resolved); the Horror tokens are NOT (they arrived too late) — a real consequence of LIFO order, not something either card\'s own script says explicitly.');

outcome = runPriorityRound(stack, [{ pass: true }, { pass: true }]);
console.log(`\nStack empty, round outcome: ${outcome}`);
turn = advancePhase(state, turn, [you, opp]);
console.log(`Phase advances to ${currentPhase(turn)}`);
