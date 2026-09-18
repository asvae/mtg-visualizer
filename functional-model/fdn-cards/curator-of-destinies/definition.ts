import type { CardDefinition, Effect } from '../../card';

export const curatorOfDestinies: CardDefinition = {
  name: 'Curator of Destinies',
  manaCost: '{4}{U}{U}',
  typeLine: 'Creature — Sphinx',
  pt: [5, 5],

  keywords: ['Flying'],

  missingSchemaFunctionality: [
    {
      clause: "This spell can't be countered.",
      demand:
        'No replacement-effect/"can\'t happen" vocabulary exists anywhere in this schema for overriding a game rule (CR 616-style "this can\'t be countered") — there is no field on a spell/Effect that can suppress a future counter attempt against this specific object.',
    },
    {
      clause:
        'look at the top five cards of your library and separate them into a face-down pile and a face-up pile. An opponent chooses one of those piles. Put that pile into your hand and the other into your graveyard.',
      demand:
        'No "pile" primitive exists: looking at a fixed number of library cards, splitting them into two player-assigned piles, and letting an OPPONENT (not the controller) choose which pile goes where has no `move`/`custom`-adjacent declarative shape — `move`\'s own `qty`/`target` fields choose a single pool of cards for the controller\'s own benefit, never a two-pile split with an opposing player\'s choice deciding the outcome.',
    },
  ],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'custom',
          describe:
            'look at top 5 cards of your library and separate into face-down/face-up piles; opponent chooses which pile goes to hand/graveyard (vocabulary gap: no pile management or opponent choice)',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
