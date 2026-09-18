import type { CardDefinition, Effect } from '../../card';

export const strongboxRaider: CardDefinition = {
  name: 'Strongbox Raider',
  manaCost: '{2}{R}{R}',
  typeLine: 'Creature — Orc Pirate',
  pt: [5, 2],

  triggers: [
    {
      name: 'onEnterRaid',
      on: 'enter',
      condition: { kind: 'attackedThisTurn' },
      effects: [
        {
          kind: 'move',
          owner: 'you',
          from: 'Library',
          to: 'Exile',
          qty: 2,
        } satisfies Effect,
      ],
    },
  ],

  missingSchemaFunctionality: [
    {
      clause: 'Choose one of them. Until the end of your next turn, you may play that card.',
      demand:
        'Needs a general "you may play this specific exiled card until a stated deadline" standing-permission primitive — `interfaces.ts`\'s `play()` only covers the library-top special action, no MayPlay-grant mechanism exists (same gap `zul-ashur-lich-lord`\'s castFromGraveyard ability already names).',
    },
  ],
};
