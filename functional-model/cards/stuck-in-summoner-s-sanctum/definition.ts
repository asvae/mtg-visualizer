import type { CardDefinition, Effect } from '../../card';

export const stuckInSummonersSanctum: CardDefinition = {
  name: "Stuck in Summoner's Sanctum",
  manaCost: '{2}{U}',
  typeLine: 'Enchantment — Aura',

  keywords: ['Flash'],

  staticAbilities: [
    'Enchant artifact or creature',
    "Enchanted permanent doesn't untap during its controller's untap step and its activated abilities can't be activated.",
  ],

  triggers: [
    {
      // "When this Aura enters, tap enchanted permanent" — same `tapTarget`
      // stand-in sleep-magic's own onEnter trigger uses. Note `tapTarget`'s
      // own resolution pool (card.ts) is always creatures, regardless of
      // its `validType` field, so an artifact-only enchant target isn't
      // actually reachable here — a pre-existing limitation in the shared
      // effect resolver, not something introduced by this card.
      name: 'onEnter',
      effects: [{ kind: 'tapTarget', validType: 'any' } satisfies Effect],
    },
  ],
};
