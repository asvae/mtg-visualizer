import type { CardDefinition } from '../../card';

export const sphinxOfForgottenLore: CardDefinition = {
  name: 'Sphinx of Forgotten Lore',
  manaCost: '{2}{U}{U}',
  typeLine: 'Creature — Sphinx',
  pt: [3, 3],
  keywords: ['Flash', 'Flying'],
  triggers: [
    {
      name: 'AttackFlashback',
      condition: 'attacks',
      description: 'Whenever this creature attacks, target instant or sorcery card in your graveyard gains flashback until end of turn. The flashback cost is equal to that card\'s mana cost.',
      effects: [
        {
          kind: 'custom',
          describe: 'Grant flashback to target instant or sorcery in graveyard until end of turn (flashback grant mechanic not yet modeled)',
          run: () => {
            // NOTE: Granting flashback to graveyard cards is not modeled.
            // This would require a new Effect kind or a complex custom implementation.
          },
        },
      ],
    },
  ],
};
