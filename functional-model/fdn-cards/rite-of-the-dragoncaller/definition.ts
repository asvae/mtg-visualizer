import type { CardDefinition, Effect } from '../../card';

// Real Forge (rite_of_the_dragoncaller.txt): `T:Mode$ SpellCast | ValidCard$
// Instant,Sorcery | ValidActivatingPlayer$ You | Execute$ TrigToken`. No
// `Trigger.on` value exists for "you cast an instant or sorcery spell" (the
// closed union only has `enter|upkeep|endStep|tapLandForMana|attacks|
// equippedAttacks|otherPermanentEnters`) — kept as a bare name-only trigger,
// the same long-established convention every other not-yet-auto-fired
// trigger in this pool already uses (exemplar-of-light/courageous-goblin,
// e.g.); not itself declared as a `missingSchemaFunctionality` gap.
export const riteOfTheDragoncaller: CardDefinition = {
  name: 'Rite of the Dragoncaller',
  manaCost: '{4}{R}{R}',
  typeLine: 'Enchantment',

  triggers: [
    {
      name: 'onCastInstantOrSorcery',
      effects: [
        {
          kind: 'createToken',
          token: { name: 'Dragon', manaCost: '0', types: ['Creature', 'Dragon'], basePower: 5, baseToughness: 5, keywords: ['Flying'] },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
