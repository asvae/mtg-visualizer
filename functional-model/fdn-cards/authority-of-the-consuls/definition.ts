import type { CardDefinition } from '../../card';

// Real Forge (authority_of_the_consuls.txt): `R:Event$ Moved | ValidCard$
// Creature.OppCtrl | Destination$ Battlefield | ReplaceWith$ ETBTapped` —
// a real CR 614 replacement on OTHER players' own creatures entering
// tapped. No such cross-controller ETB-tapped replacement grant exists
// anywhere in this schema (`millModifierGrants`/`spellCostReductionGrants`
// are the closest analogous "broadcast a replacement onto opponents' own
// events" shapes, neither covers entering-tapped). The lifegain trigger's
// own `ValidCard$ Creature.OppCtrl` filter also has no matching vocabulary:
// `otherPermanentEntersMatch.sameController` is only documented for "same
// controller as the granting permanent" (the you-case), never an
// opponent-only filter.
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
