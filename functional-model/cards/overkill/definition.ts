import type { CardDefinition, Effect } from '../../card';

export const overkill: CardDefinition = {
  name: 'Overkill',
  manaCost: '{2}{B}',
  typeLine: 'Instant',

  // Real text: "Target creature gets -0/-9999 until end of turn." —
  // `untilEndOfTurn: true` added 2026-09-15 (real, pre-existing bug this
  // session's `pumpTarget-effect-structural.ts` pool run surfaced: the
  // field was omitted despite the real duration being printed, same class
  // of gap `choco-seeker-of-paradise`/`jumbo-cactuar`/`loporrit-scout`/
  // `woodland-weavemaster`'s own `pumpSelf` effects already had, fixed the
  // same pass).
  effects: [{ kind: 'pumpTarget', power: 0, toughness: -9999, untilEndOfTurn: true } satisfies Effect],
};
