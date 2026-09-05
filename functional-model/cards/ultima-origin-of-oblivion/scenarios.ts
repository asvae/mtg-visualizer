import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  // One scenario carrying the whole real story rather than one per step —
  // Ultima attacks (summoning sickness having worn off is a real-game
  // precondition this harness doesn't simulate turn-by-turn, so it's not a
  // separate beat here, just the reason `trigger: 'onAttack'` is reachable
  // at all), puts a blight counter on the opponent's only land, which then
  // (per the real card's own static text) loses its land types/abilities
  // and gains "{T}: Add {C}," doubled to 2 colorless by Ultima's second
  // static whenever tapped. Only the counter placement itself is real,
  // engine-verified trace output (`putCounterTarget`) — the land's granted
  // ability and the mana-doubling are real card text with no engine
  // machinery behind them (no counter-tied continuous-effect grant, no
  // "land tapped for mana" trigger hook — see progress.json's own
  // documented gap), so `result` narrates them as the human-known real
  // consequence rather than asserting a trace line backs them.
  {
    result:
      'attacks, puts a blight counter on the opponent\'s only land — that land then loses all land types/abilities and gains "{T}: Add {C}" (real static consequence, no engine machinery to verify it), doubled to 2 colorless when tapped per the second static (also unmodeled — no "land tapped for mana" trigger hook)',
    trigger: 'onAttack',
    opponents: [{ landsCount: 1 }],
  },
];
