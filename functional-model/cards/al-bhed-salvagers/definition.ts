import type { CardDefinition, Effect } from '../../card';

export const alBhedSalvagers: CardDefinition = {
  name: 'Al Bhed Salvagers',
  manaCost: '{2}{B}',
  typeLine: 'Creature — Human Artificer Warrior',

  pt: [2, 3],

  // "Whenever this creature or another creature or artifact you control
  // dies" — a real ChangesZone Battlefield->Graveyard trigger. The effect
  // itself doesn't depend on WHICH permanent died, so one named trigger
  // covers every real firing condition. "target opponent loses 1 life" —
  // `loseLife`'s `owner: 'opponents'` hits every opponent, the same
  // established simplification for "a single target opponent" this batch's
  // Al Bhed/Cornered-by-Black-Mages own effects use elsewhere (no
  // single-chosen-opponent Effect shape exists — real MTG matters here
  // only with 3+ players).
  triggers: [
    {
      name: 'onDies',
      effects: [{ kind: 'loseLife', owner: 'opponents', amount: 1 } satisfies Effect, { kind: 'gainLife', amount: 1 } satisfies Effect],
    },
  ],
};
