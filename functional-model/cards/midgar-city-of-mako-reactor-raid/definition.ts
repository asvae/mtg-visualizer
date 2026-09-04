import type { CardDefinition, Effect } from '../../card';

// Real script (midgar_city_of_mako_reactor_raid.txt): the Adventure
// layout, same real mechanic zanarkand-ancient-metropolis-lasting-fayth's
// own doc comment (a different agent's own FIN batch) explains in full.
//
// Front face: same real "enters tapped" replacement effect and mana-
// ability-as-text treatment as treno-dark-city's own doc comment.
//
// Back face ("Reactor Raid"): "You may sacrifice an artifact or creature.
// If you do, draw two cards." Real `ConditionCheckSVar$ X` gates the draw
// on whether the sacrifice actually happened — this model has no player-
// decision engine anywhere (`sacrifice`'s own `optional` field is
// documentary only: a legal-but-declined target still gets sacrificed when
// one exists — the SAME convention every other `optional` field here
// carries), so the draw is modeled as always following the sacrifice
// rather than conditionally gated, matching that existing simplification
// rather than inventing a new conditional-effect mechanism for one card.
export const midgarCityOfMako: CardDefinition = {
  name: 'Midgar, City of Mako',
  manaCost: '',
  typeLine: 'Land — Town',

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'tapTarget', validType: 'land', owner: 'you' } satisfies Effect],
    },
  ],

  staticAbilities: ['{T}: Add {B}.'],

  backFace: {
    name: 'Reactor Raid',
    manaCost: '{2}{B}',
    typeLine: 'Sorcery — Adventure',

    effects: [
      { kind: 'sacrifice', owner: 'you', validType: 'creature-or-artifact', optional: true, qty: 1 } satisfies Effect,
      { kind: 'drawCard', amount: 2 } satisfies Effect,
    ],
  },
};
