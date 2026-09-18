import type { CardDefinition, Effect } from '../../card';

export const curatorOfDestinies: CardDefinition = {
  name: 'Curator of Destinies',
  manaCost: '{4}{U}{U}',
  typeLine: 'Creature — Sphinx',
  pt: [5, 5],

  keywords: ['Flying'],

  // Real Forge: R:Event$ Counter | ValidCard$ Card.Self | ValidSA$ Spell | Layer$ CantHappen
  // "This spell can't be countered."
  // The vocabulary has no way to express replacement effects or uncounterable mechanics.

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          // Real Forge: DB$ PeekAndReveal | Defined$ You | PeekAmount$ 5 | ... | TwoPiles | ...
          // "look at the top five cards of your library and separate them into a face-down pile
          // and a face-up pile. An opponent chooses one of those piles. Put that pile into your
          // hand and the other into your graveyard."
          // The vocabulary has no way to express: looking at library cards, separating into piles,
          // or letting an opponent choose between piles. No move effect can handle conditional
          // pile selection by opponent. Flagged in final report.
          kind: 'custom',
          describe:
            'look at top 5 cards of your library and separate into face-down/face-up piles; opponent chooses which pile goes to hand/graveyard (vocabulary gap: no pile management or opponent choice)',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
