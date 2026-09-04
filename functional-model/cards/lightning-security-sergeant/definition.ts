import type { CardDefinition, Effect } from '../../card';

// Real script (lightning_security_sergeant.txt): "exile the top card of
// your library. You may play that card for as long as you control
// NICKNAME" — the exile is plain declarative `move`; the granted MayPlay
// permission is real text only, same "no cast-from-exile/MayPlay tracking
// exists in this model" gap reno-and-rude's own "you may play the exiled
// card this turn" no-op custom effect already documents.
export const lightningSecuritySergeant: CardDefinition = {
  name: 'Lightning, Security Sergeant',
  manaCost: '{2}{R}',
  typeLine: 'Legendary Creature — Human Soldier',

  pt: [2, 3],
  keywords: ['Menace'],

  triggers: [
    {
      name: 'onDealsDamage',
      effects: [
        { kind: 'move', owner: 'you', from: 'Library', to: 'Exile', qty: 1 } satisfies Effect,
        {
          kind: 'custom',
          describe: 'you may play that card for as long as you control Lightning, Security Sergeant (no MayPlay/cast-from-exile permission tracking exists in this model)',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
