import type { CardDefinition, Effect } from '../../card';

export const sunBlessedHealer: CardDefinition = {
  name: 'Sun-Blessed Healer',
  manaCost: '{1}{W}',
  typeLine: 'Creature — Human Cleric',
  pt: [3, 1],

  keywords: ['Kicker', 'Lifelink'],
  keywordCosts: [{ keyword: 'Kicker', cost: '{1}{W}' }],

  // "When this creature enters, if it was kicked, return target nonland
  // permanent card with mana value 2 or less from your graveyard to the
  // battlefield."
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'modal',
          modes: [
            { describe: 'Not kicked — nothing happens.', effects: [] },
            {
              describe:
                'If this creature was kicked, return target nonland permanent card with mana value 2 or less from your graveyard to the battlefield.',
              effects: [
                {
                  kind: 'move',
                  owner: 'you',
                  from: 'Graveyard',
                  to: 'Battlefield',
                  validType: 'any',
                  nonLand: true,
                  maxCmc: 2,
                  qty: 1,
                  target: true,
                } satisfies Effect,
              ],
            },
          ],
        } satisfies Effect,
      ],
    },
  ],
};
