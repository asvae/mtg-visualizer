import type { CardDefinition, Effect } from '../../card';

// Real script (baron_airship_kingdom.txt): a real nonbasic Land — Town.
// "This land enters tapped" is a real replacement effect, modeled as a
// real onEnter trigger tapping self — same precedent elixir's own
// "enters tapped" artifact establishes. The mana ability ("{T}: Add {U}
// or {R}") stays real text only — no mana-producing Effect/Action exists
// anywhere in this model (deliberate, no mana pool tracked).
export const baronAirshipKingdom: CardDefinition = {
  name: 'Baron, Airship Kingdom',
  manaCost: '',
  typeLine: 'Land — Town',

  staticAbilities: ['{T}: Add {U} or {R}.'],

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'tapTarget', validType: 'land', owner: 'you' } satisfies Effect],
    },
  ],
};
