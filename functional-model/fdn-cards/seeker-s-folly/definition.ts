import type { CardDefinition, Effect } from '../../card';

export const seekersFolly: CardDefinition = {
  name: "Seeker's Folly",
  manaCost: '{2}{B}',
  typeLine: 'Sorcery',

  effects: [
    {
      kind: 'modal',
      modes: [
        {
          describe: 'Target opponent discards two cards.',
          effects: [
            {
              kind: 'discard',
              owner: 'opponents',
              qty: 2,
            } satisfies Effect,
          ],
        },
        {
          describe: 'Creatures your opponents control get -1/-1 until end of turn.',
          effects: [
            {
              kind: 'custom',
              describe: 'Creatures your opponents control get -1/-1 until end of turn.',
              run: (ctx, actions) => {
                for (const opp of ctx.opponents) {
                  for (const creature of opp.getCreaturesInPlay()) {
                    actions.pump(creature, -1, -1, { untilEndOfTurn: true });
                  }
                }
              },
            } satisfies Effect,
          ],
        },
      ],
    } satisfies Effect,
  ],
};
