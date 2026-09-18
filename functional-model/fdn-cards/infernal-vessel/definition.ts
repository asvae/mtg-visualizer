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
      effects: [
        {
          kind: 'custom',
          describe: "return it to the battlefield under its owner's control with two +1/+1 counters on it; it's a Demon in addition to its other types",
          run: (ctx, actions) => {
            actions.moveTo(ctx.self, 'Battlefield');
            actions.putCounter(ctx.self, '+1/+1', 2);
            actions.animate(ctx.self, ['Demon']);
          },
        } satisfies Effect,
      ],
    },
  ],
};
