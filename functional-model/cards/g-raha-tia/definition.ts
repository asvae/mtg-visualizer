import type { CardDefinition, Effect } from '../../card';

export const gRahaTia: CardDefinition = {
  name: "G'raha Tia",
  manaCost: '{4}{W}',
  typeLine: 'Legendary Creature — Cat Archer',

  keywords: ['Reach'],

  // "The Allagan Eye ... triggers only once each turn" — an
  // ActivationLimit real Forge tracks per-turn; no turn-counter/trigger-
  // frequency-limiting state exists anywhere in this model (turn.ts tracks
  // phases/steps, not per-ability activation counts), so this is a real,
  // flagged gap rather than a fabricated once-per-turn guard. A scenario
  // exercises the trigger firing once, which is all `resolveCard()` ever
  // does per call regardless.
  triggers: [
    {
      name: 'onOtherPermanentsDie',
      effects: [{ kind: 'drawCard' } satisfies Effect],
    },
  ],
};
