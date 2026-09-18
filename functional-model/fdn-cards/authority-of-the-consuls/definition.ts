import type { CardDefinition } from '../../card';

export const authorityOfTheConsuls: CardDefinition = {
  name: 'Authority of the Consuls',
  manaCost: '{W}',
  typeLine: 'Enchantment',

  missingSchemaFunctionality: [
    {
      clause: 'Creatures your opponents control enter tapped.',
      demand:
        'No cross-controller "creatures your opponents control enter tapped" replacement-effect grant exists anywhere in this schema — needs a new static grant field parallel to `millModifierGrants`/`spellCostReductionGrants`.',
    },
    {
      clause: 'Whenever a creature an opponent controls enters, you gain 1 life.',
      demand:
        '`Trigger.otherPermanentEntersMatch.sameController` is only documented/established for "same controller as the granting permanent" — no vocabulary exists for "controlled by an OPPONENT specifically."',
    },
  ],
};
