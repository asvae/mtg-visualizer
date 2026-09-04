import type { CardDefinition, Effect } from '../../card';

// Real script (lindblum_industrial_regency_mage_siege.txt): the Adventure
// layout, same real mechanic zanarkand-ancient-metropolis-lasting-fayth's
// own doc comment (a different agent's own FIN batch) explains in full.
//
// Front face: same real "enters tapped" replacement effect and mana-
// ability-as-text treatment as treno-dark-city's own doc comment.
//
// Back face ("Mage Siege"): "Create a 0/1 black Wizard creature token with
// 'Whenever you cast a noncreature spell, this token deals 1 damage to
// each opponent.'" — the token itself is a plain `createToken`; the
// GRANTED triggered ability text has no home on `TokenInfo` (only a
// controlled `keywords` list, no freeform granted-ability text field), so
// it's lost the same way every other token's own granted keyword/ability
// is lost here (same real gap call-the-mountain-chocobo's own comment
// already documents for its own Bird token).
export const lindblumIndustrialRegency: CardDefinition = {
  name: 'Lindblum, Industrial Regency',
  manaCost: '',
  typeLine: 'Land — Town',

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'tapTarget', validType: 'land', owner: 'you' } satisfies Effect],
    },
  ],

  staticAbilities: ['{T}: Add {R}.'],

  backFace: {
    name: 'Mage Siege',
    manaCost: '{2}{R}',
    typeLine: 'Instant — Adventure',

    effects: [
      {
        kind: 'createToken',
        token: { name: 'Wizard', manaCost: '0', types: ['Creature', 'Wizard'], basePower: 0, baseToughness: 1 },
        amount: 1,
      } satisfies Effect,
    ],
  },
};
