import type { CardDefinition, Effect } from '../../card';

export const galufsFinalAct: CardDefinition = {
  name: "Galuf's Final Act",
  manaCost: '{1}{G}',
  typeLine: 'Instant',

  effects: [
    { kind: 'pumpTarget', power: 1, toughness: 0 } satisfies Effect,
    {
      // "...and gains 'When this creature dies, put a number of +1/+1
      // counters equal to its power on up to one target creature.'" — no
      // Effect kind exists anywhere in this model for dynamically granting
      // a NEW triggered ability at resolution time (`triggers` is a fixed,
      // static list on a `CardDefinition`, not something an effect can
      // append to) — same documented gap summon-primal-odin's own
      // Zantetsuken grant already establishes. No-op custom purely so
      // synergyTags() still records the real text.
      kind: 'custom',
      describe:
        'target creature also gains "when this creature dies, put a number of +1/+1 counters equal to its power on up to one target creature" until end of turn (no Effect kind exists for granting a new triggered ability)',
      run: () => {},
    } satisfies Effect,
  ],
};
