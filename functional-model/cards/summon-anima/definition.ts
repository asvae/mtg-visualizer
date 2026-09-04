import type { CardDefinition, Effect } from '../../card';

export const summonAnima: CardDefinition = {
  name: 'Summon: Anima',
  manaCost: '{4}{B}{B}',
  typeLine: 'Enchantment Creature — Saga Horror',

  pt: [4, 4],
  keywords: ['Menace'],

  triggers: [
    { name: 'chapterI', effects: [{ kind: 'drawCard' } satisfies Effect, { kind: 'loseLife', owner: 'you', amount: 1 } satisfies Effect] },
    { name: 'chapterII', effects: [{ kind: 'drawCard' } satisfies Effect, { kind: 'loseLife', owner: 'you', amount: 1 } satisfies Effect] },
    { name: 'chapterIII', effects: [{ kind: 'drawCard' } satisfies Effect, { kind: 'loseLife', owner: 'you', amount: 1 } satisfies Effect] },
    {
      name: 'chapterIV',
      effects: [
        { kind: 'sacrifice', owner: 'opponents', validType: 'creature', qty: 1 } satisfies Effect,
        { kind: 'loseLife', owner: 'opponents', amount: 3 } satisfies Effect,
      ],
    },
  ],
};
