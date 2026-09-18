import type { CardDefinition, Effect } from '../../card';

export const nineLivesFamiliar: CardDefinition = {
  name: 'Nine-Lives Familiar',
  manaCost: '{1}{B}{B}',
  typeLine: 'Creature — Cat',
  pt: [1, 1],

  missingSchemaFunctionality: [
    {
      clause: 'if you cast it',
      demand: 'No field anywhere gates an "enters with N counters" effect on HOW the permanent reached the battlefield (cast vs. put onto the battlefield some other way, CR 601-vs-707) — `putCounter`/`onEnter` fire identically regardless of the entering permanent\'s own cast-vs-other-arrival history.',
    },
  ],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [{ kind: 'putCounter', target: 'self', counterType: 'revival', amount: 8 } satisfies Effect],
    },
    {
      // "When this creature dies, if it had a revival counter on it,
      // return it to the battlefield with one fewer revival counter on it
      // at the beginning of the next end step."
      name: 'onDeath',
      effects: [
        {
          kind: 'custom',
          describe: 'if it had a revival counter on it, return it to the battlefield with one fewer revival counter on it at the beginning of the next end step',
          run: (ctx, actions) => {
            if (ctx.self.getCounters('revival') <= 0) return;
            actions.delayUntil('EndOfTurn', () => {
              actions.moveTo(ctx.self, 'Battlefield');
              actions.putCounter(ctx.self, 'revival', -1);
            });
          },
        } satisfies Effect,
      ],
    },
  ],
};
