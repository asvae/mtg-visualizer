import type { CardDefinition, Effect } from '../../card';

// Real script (crossroads_village.txt): "This land enters tapped" is the
// same real replacement effect every other Town in this batch has — modeled
// as an onEnter trigger tapping self (treno-dark-city's own precedent).
// "As it enters, choose a color" (K:ETBReplacement:Other:ChooseColor) is a
// SECOND real ETB event, but its only observable consequence is which color
// the later `{T}: Add one mana of the chosen color` ability produces — pure
// mana-ability plumbing (no mana-producing Effect/Action exists anywhere in
// this model, a documented, deliberate STILL-DEFERRED gap), so the choice
// and the mana ability both stay staticAbilities text rather than a second
// named trigger with nothing declarative to do.
export const crossroadsVillage: CardDefinition = {
  name: 'Crossroads Village',
  manaCost: '',
  typeLine: 'Land — Town',

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'tapTarget', validType: 'land', owner: 'you' } satisfies Effect],
    },
  ],

  staticAbilities: ['As this land enters, choose a color.', '{T}: Add one mana of the chosen color.'],
};
