import type { CardDefinition, Effect } from '../../card';

// Real Forge (ravenous_amulet.txt): both activation costs include a real
// sacrifice ("Sac<1/Creature>" / "Sac<1/CARDNAME>") — kept as plain
// descriptive `cost` text, same established convention `hungry-ghoul`'s own
// "{1}, sacrifice another creature" already uses (no cost-payment engine
// parses/enforces this string either way).
export const ravenousAmulet: CardDefinition = {
  name: 'Ravenous Amulet',
  manaCost: '{2}',
  typeLine: 'Artifact',

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
