import type { CardDefinition, Effect } from '../../card';

export const mischiefousMystic: CardDefinition = {
  name: 'Mischievous Mystic',
  manaCost: '{1}{U}',
  typeLine: 'Creature — Human Wizard',
  pt: [2, 1],
  keywords: ['Flying'],

  // Real Forge: `Mode$ Drawn | ValidCard$ Card.YouCtrl | Number$ 2` —
  // "Whenever you draw your second card each turn, create a 1/1 blue
  // Faerie creature token with flying." No `on` value exists for a
  // "drew your Nth card this turn" event — a real, already-documented gap
  // (card.ts's own `Trigger.on` doc comment: "no drawNthCardThisTurn on
  // value exists anywhere in this union"); kept as a name-only trigger,
  // same convention every other not-yet-auto-fired trigger in this pool
  // already uses.
  triggers: [
    {
      name: 'onSecondDraw',
      effects: [
        {
          kind: 'createToken',
          token: {
            name: 'Faerie',
            manaCost: '0',
            types: ['Creature', 'Faerie'],
            basePower: 1,
            baseToughness: 1,
            keywords: ['Flying'],
          },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
