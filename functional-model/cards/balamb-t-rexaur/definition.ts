import type { CardDefinition, Effect } from '../../card';

export const balambTRexaur: CardDefinition = {
  name: 'Balamb T-Rexaur',
  manaCost: '{4}{G}{G}',
  typeLine: 'Creature — Dinosaur',

  pt: [6, 6],
  keywords: ['Trample'],

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'gainLife', amount: 3 } satisfies Effect],
    },
  ],

  // Forestcycling {2} — a real alternate ACTIVATED-from-hand ability
  // (discard this card + pay {2}: search for a Forest), not a cast-time
  // alternate cost and not an activated ability on a battlefield permanent
  // — no `CardDefinition` field fits it, same gap hill-gigas' own
  // Mountaincycling already documents. Real text only.
  staticAbilities: ['Forestcycling {2} ({2}, Discard this card: Search your library for a Forest card, reveal it, put it into your hand, then shuffle.)'],
};
