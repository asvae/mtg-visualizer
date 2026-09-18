import type { CardDefinition, Effect } from '../../card';

export const ravenousAmulet: CardDefinition = {
  name: 'Ravenous Amulet',
  manaCost: '{2}',
  typeLine: 'Artifact',

  abilities: [
    {
      // Real "Activate only as a sorcery." — engine.ts's own real
      // `canActivateAbility` already runs `/activate only as a sorcery/i
      // .test(cost)` against a named ability's own `cost` string and
      // enforces `sorcerySpeedTimingOk` when it matches — no missing
      // primitive here, just appending the literal restriction text onto
      // this ability's own `cost`, same real pool precedent
      // garland-knight-of-cornelia's own `cost: '{3}{B}{B}{R}{R}, Activate
      // only as a sorcery'` already establishes for a NAMED `abilities[]`
      // entry (comma-joined, no trailing period, no parens — distinct from
      // this pool's other, more common `activationCost`-level convention,
      // `'... (activate only as a sorcery)'`, which is for the single
      // top-level ability slot, not a named one).
      name: 'drawAndSoul',
      cost: '{1}, {T}, Sacrifice a creature, Activate only as a sorcery',
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
