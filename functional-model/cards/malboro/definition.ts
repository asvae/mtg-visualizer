import type { CardDefinition, Effect } from '../../card';

export const malboro: CardDefinition = {
  name: 'Malboro',
  manaCost: '{4}{B}{B}',
  typeLine: 'Creature — Plant Horror',

  // Swampcycling {2} (discard this card from hand: search your library for
  // a Swamp) isn't modeled as an executable effect — it's a special action
  // FROM HAND, not a cast, not an activated ability on a permanent, and not
  // a triggered ability; none of CardDefinition's current fields fit a
  // real "discard this card as its own cost" mechanic. Left as a plain
  // description rather than forced into a bad-fit shape — flagged as a
  // real gap, not derived.
  staticAbilities: ['Swampcycling {2} ({2}, Discard this card: Search your library for a Swamp card, reveal it, put it into your hand, then shuffle.)'],

  triggers: [
    {
      name: 'onEnter',
      effects: [
        { kind: 'discard', owner: 'opponents', qty: 1 } satisfies Effect,
        { kind: 'loseLife', owner: 'opponents', amount: 2 } satisfies Effect,
        { kind: 'move', owner: 'opponents', from: 'Library', to: 'Exile', qty: 3 } satisfies Effect,
      ],
    },
  ],
};
