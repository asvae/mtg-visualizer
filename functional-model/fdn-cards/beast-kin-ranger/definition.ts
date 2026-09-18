import type { CardDefinition, Effect } from '../../card';

// Real Forge (beast_kin_ranger.txt): `T:Mode$ ChangesZone | ValidCard$
// Creature.Other+YouCtrl | Execute$ TrigPump` — "whenever another creature
// you control enters." Kept as a bare name-only trigger, not
// `on:'otherPermanentEnters'`: that shape's own `otherPermanentEntersMatch`
// only supports a creature SUBTYPE filter, never a generic "must be a
// Creature" type filter — using it unfiltered would incorrectly also match
// a land/artifact/enchantment entering.
export const beastKinRanger: CardDefinition = {
  name: 'Beast-Kin Ranger',
  manaCost: '{2}{G}',
  typeLine: 'Creature — Elf Ranger',
  pt: [3, 3],
  keywords: ['Trample'],

  triggers: [
    {
      name: 'onOtherCreatureEnters',
      effects: [{ kind: 'pumpSelf', power: 1, toughness: 0, untilEndOfTurn: true } satisfies Effect],
    },
  ],
};
