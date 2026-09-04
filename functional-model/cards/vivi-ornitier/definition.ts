import type { CardDefinition, Effect } from '../../card';

// Real script (vivi_ornitier.txt): the printed `{0}: Add X mana in any
// combination of {U} and/or {R}, where X is CARDNAME's power` ability is a
// real mana ability — no Effect kind (nor any interfaces.ts action) models
// mana production anywhere in this system (the same deliberate boundary
// cargo-ship's own mana-ability comment documents), so it's omitted
// entirely rather than partially modeled. The card's other real ability
// (the trigger below) is fully modelable on its own.
export const viviOrnitier: CardDefinition = {
  name: 'Vivi Ornitier',
  manaCost: '{1}{U}{R}',
  typeLine: 'Legendary Creature — Wizard',

  pt: [0, 3],

  triggers: [
    {
      name: 'onCastNoncreatureSpell',
      effects: [
        { kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect,
        { kind: 'dealDamage', target: 'opponents', amount: 1 } satisfies Effect,
      ],
    },
  ],
};
