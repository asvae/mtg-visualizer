import type { CardDefinition, Effect } from '../../card';

export const cloudMidgarMercenary: CardDefinition = {
  name: 'Cloud, Midgar Mercenary',
  manaCost: '{W}{W}',
  typeLine: 'Legendary Creature — Human Soldier Mercenary',

  staticAbilities: [
    // A real conditional trigger-doubling effect ("if equipped, ... triggers
    // an additional time") — Cloud's own Panharmonicon-style static. No
    // trigger-multiplying machinery exists in this model (resolveCard()
    // dispatches a named trigger exactly once per scenario call), so left
    // as text rather than a fabricated doubling mechanism. Wording matches
    // real Scryfall oracle text (data/fin/fin_scryfall.json), not the
    // slightly older cardsfolder script wording ("an ability" vs "a
    // triggered ability").
    'As long as this is equipped, if a triggered ability of this or an Equipment attached to it triggers, that ability triggers an additional time.',
  ],

  triggers: [
    {
      name: 'onEnter',
      // Real search targets Equipment specifically; this model's `move`
      // validType union only distinguishes creature/artifact/any (no
      // Equipment subtype tracking on generic library cards — see
      // state.ts's RealCard), so 'artifact' is the closest honest match,
      // not a claim this is subtype-precise.
      effects: [{ kind: 'move', owner: 'you', from: 'Library', to: 'Hand', qty: 1, validType: 'artifact' } satisfies Effect],
    },
  ],
};
