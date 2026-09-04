import type { CardDefinition, Effect } from '../../card';

// Real script (instant_ramen.txt): Artifact Food, Flash, ETB draw, and a
// tap-sacrifice activated ability for life gain — same shape elixir's own
// ETB-trigger-plus-activationCost card carries, no gaps.
export const instantRamen: CardDefinition = {
  name: 'Instant Ramen',
  manaCost: '{2}',
  typeLine: 'Artifact — Food',

  keywords: ['Flash'],

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'drawCard' } satisfies Effect],
    },
  ],

  // "{2}, {T}, Sacrifice this artifact" — the {T}/Sacrifice-self are COSTS
  // (real Forge `Cost$ 2 T Sac<1/CARDNAME/this artifact>`), kept as
  // documentary `activationCost` text only, same convention qiqirn-
  // merchant's own self-sacrificing ability uses.
  activationCost: '{2}, {T}, Sacrifice this artifact',
  effects: [{ kind: 'gainLife', amount: 3 } satisfies Effect],
};
