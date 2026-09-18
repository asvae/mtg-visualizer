import type { CardDefinition, Effect } from '../../card';

// Real Forge (elfsworn_giant.txt): `T:Mode$ ChangesZone | ValidCard$
// Land.YouCtrl | Execute$ TrigToken` — Landfall. Kept as a bare name-only
// trigger, not `on:'otherPermanentEnters'`: that shape's own
// `otherPermanentEntersMatch` only supports a creature SUBTYPE filter, no
// general "must be a Land" type filter (land types like Forest/Island are a
// different vocabulary this field was never built to read).
export const elfswornGiant: CardDefinition = {
  name: 'Elfsworn Giant',
  manaCost: '{3}{G}{G}',
  typeLine: 'Creature — Giant',
  pt: [5, 3],
  keywords: ['Reach'],

  triggers: [
    {
      name: 'onLandfall',
      effects: [
        {
          kind: 'createToken',
          token: { name: 'Elf Warrior', manaCost: '0', types: ['Creature', 'Elf', 'Warrior'], basePower: 1, baseToughness: 1 },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
