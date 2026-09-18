import type { CardDefinition, Effect } from '../../card';

export const ravenousAmulet: CardDefinition = {
  name: 'Ravenous Amulet',
  manaCost: '{2}',
  typeLine: 'Artifact',

  missingSchemaFunctionality: [
    {
      clause: 'Activate only as a sorcery.',
      demand: 'No timing/speed-restriction field exists on a named `abilities[]` entry (only `ManaAbility` has an analogous `restriction`/`activationCondition` pair) — no priority/stack-timing model exists anywhere in this engine for a plain (non-mana) activated ability either way.',
    },
  ],

  abilities: [
    {
      name: 'drawAndSoul',
      cost: '{1}, {T}, Sacrifice a creature',
      effects: [
        { kind: 'drawCard', amount: 1 } satisfies Effect,
        { kind: 'putCounter', target: 'self', counterType: 'SOUL', amount: 1 } satisfies Effect,
      ],
    },
    {
      name: 'sacForLife',
      cost: '{4}, {T}, Sacrifice this artifact',
      effects: [{ kind: 'loseLife', owner: 'opponents', amount: (ctx) => ctx.self.getCounters('SOUL') } satisfies Effect],
    },
  ],
};
