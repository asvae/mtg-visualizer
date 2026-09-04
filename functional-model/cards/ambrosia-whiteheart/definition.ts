import type { CardDefinition, Effect } from '../../card';

export const ambrosiaWhiteheart: CardDefinition = {
  name: 'Ambrosia Whiteheart',
  manaCost: '{1}{W}',
  typeLine: 'Legendary Creature — Bird',

  keywords: ['Flash'],

  triggers: [
    {
      // Real Forge: `OptionalDecider$ You` — the whole return is a "you
      // MAY," a real binary decline option, not just "up to one target"
      // (which the pool-exhaustion behavior of `move`'s targeted branch
      // already models for free when nothing else is in play). `optional`
      // is documentary only, like `sacrifice`'s own field — this model has
      // no player-decision engine, so a legal target still gets returned.
      name: 'onEnter',
      effects: [{ kind: 'move', owner: 'you', from: 'Battlefield', to: 'Hand', qty: 1, target: true, notSelf: true, optional: true } satisfies Effect],
    },
    {
      // Landfall — real Forge fires this off ANOTHER permanent (a land)
      // entering, not this creature's own event. This model only dispatches
      // named triggers a scenario explicitly picks (no automatic "a land
      // entered" detection anywhere), so it's modeled the same way every
      // other trigger here is: a real, correctly-shaped effect, invoked
      // on cue rather than auto-detected.
      name: 'onLandfall',
      effects: [{ kind: 'pumpSelf', power: 1, toughness: 0 } satisfies Effect],
    },
  ],
};
