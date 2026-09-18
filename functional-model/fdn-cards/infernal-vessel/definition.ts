import type { CardDefinition, Effect } from '../../card';

export const infernalVessel: CardDefinition = {
  name: 'Infernal Vessel',
  manaCost: '{2}{B}',
  typeLine: 'Creature — Human Cleric',
  pt: [2, 1],

  // "When this creature dies, if it wasn't a Demon, return it to the
  // battlefield under its owner's control with two +1/+1 counters on it.
  // It's a Demon in addition to its other types."
  triggers: [
    {
      name: 'onDeath',
      on: 'dies',
      condition: { kind: 'selfLacksType', type: 'Demon' },
      effects: [
        {
          kind: 'custom',
          describe: "if it wasn't a Demon, return it to the battlefield under its owner's control with two +1/+1 counters on it; it's a Demon in addition to its other types",
          run: (ctx, actions) => {
            // Real, functional guard (not just the documentary `condition`
            // field above, which isn't consulted by resolveCard) — a
            // `kind:'custom'` closure has real access to ctx.self, so the
            // "if it wasn't a Demon" gate is checked for real here.
            if (ctx.self.hasSubtype('Demon')) return;
            actions.moveTo(ctx.self, 'Battlefield');
            actions.putCounter(ctx.self, '+1/+1', 2);
            actions.animate(ctx.self, ['Demon']);
          },
        } satisfies Effect,
      ],
    },
  ],
};
