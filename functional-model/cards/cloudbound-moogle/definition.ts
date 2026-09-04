import type { CardDefinition, Effect } from '../../card';

export const cloudboundMoogle: CardDefinition = {
  name: 'Cloudbound Moogle',
  manaCost: '{3}{W}{W}',
  typeLine: 'Creature — Moogle',

  keywords: ['Flying'],
  staticAbilities: [
    // Plainscycling is a real alternate ACTIVATED-from-hand ability (discard
    // this card + pay {2}: search for a Plains) — not a cast-time
    // alternate cost (`alternateCosts` models Flashback-shaped "cast from
    // elsewhere," not "activate while discarding this from hand instead of
    // casting it at all"). Same gap Malboro's own Swampcycling hit; same
    // honest text-only treatment.
    'Plainscycling {2} ({2}, Discard this card: Search your library for a Plains card, reveal it, put it into your hand, then shuffle.)',
  ],

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'putCounterTarget', validType: 'creature', counterType: '+1/+1', amount: 1, qty: 1 } satisfies Effect],
    },
  ],
};
