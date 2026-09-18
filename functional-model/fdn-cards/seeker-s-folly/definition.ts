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
          // "Target opponent discards two cards" — approximated to every
          // opponent (`owner: 'opponents'`), same established
          // single-chosen-opponent simplification al-bhed-salvagers/
          // combat-tutorial already document (no single-chosen-opponent
          // Effect shape exists; only matters with 3+ players).
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
          // Real Forge: `DB$ PumpAll | ValidCards$ Creature.OppCtrl |
          // NumAtt$ -1 | NumDef$ -1` — `pumpAll`'s own `predicate` union
          // has no "opponents' creatures" shape (only
          // 'creatures-you-control'|'attacking-creatures'), so this needs
          // `custom` — real, executable code (`actions.pump`, not the
          // nonexistent `actions.pumpTarget`), not a placeholder.
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
