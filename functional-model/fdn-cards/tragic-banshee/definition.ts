import type { CardDefinition, Effect } from '../../card';

export const tragicBanshee: CardDefinition = {
  name: 'Tragic Banshee',
  manaCost: '{4}{B}',
  typeLine: 'Creature — Spirit',
  pt: [5, 3],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'custom',
          describe:
            'Morbid — target creature an opponent controls gets -1/-1 until end of turn. If a creature died this turn, that creature gets -13/-13 until end of turn instead. (no "did a creature die this turn"/Morbid tracking exists anywhere in this engine)',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
