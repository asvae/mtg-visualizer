import type { CardDefinition, Effect } from '../../card';

export const theWindCrystal: CardDefinition = {
  name: 'The Wind Crystal',
  manaCost: '{2}{W}{W}',
  typeLine: 'Legendary Artifact',

  // "White spells you cast cost {1} less to cast." — a real dynamic cost
  // reduction; `manaCost` is a fixed printed string never recomputed for a
  // specific cast (same treatment fate-of-the-sun-cryst's own conditional
  // cost reduction gets). "If you would gain life, you gain twice that much
  // life instead." — a real replacement effect; state.ts's own header
  // explicitly rules out replacement-effect machinery. Both real text only.
  staticAbilities: [
    'White spells you cast cost {1} less to cast.',
    'If you would gain life, you gain twice that much life instead.',
  ],

  // "{4}{W}{W}, {T}: Creatures you control gain flying and lifelink until
  // end of turn." — a real board-wide KEYWORD-ONLY grant (no P/T change at
  // all). No Effect kind grants a keyword anywhere in this model (the same
  // already-flagged gap Moogles' Valor/Dion, Bahamut's Dominant/Restoration
  // Magic/Zack Fair all hit in this same batch) — with nothing mechanical
  // left to do, this stays a real, honestly no-op `custom`, same treatment
  // Moogles' Valor's own keyword-only clause gets.
  activationCost: '{4}{W}{W}, {T}',
  effects: [
    {
      kind: 'custom',
      describe: 'creatures you control gain flying and lifelink until end of turn (no keyword-grant Effect shape exists yet — not mechanically enforced)',
      run: () => {},
    } satisfies Effect,
  ],
};
