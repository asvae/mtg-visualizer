import type { CardDefinition, Effect } from '../../card';

export const theLunarWhale: CardDefinition = {
  name: 'The Lunar Whale',
  manaCost: '{3}{U}',
  typeLine: 'Legendary Artifact — Vehicle',
  pt: [3, 5],

  keywords: ['Flying'],

  staticAbilities: [
    'You may look at the top card of your library any time.',
    'As long as The Lunar Whale attacked this turn, you may play the top card of your library.',
  ],

  // Real bare `K:Crew:1` — Forge's own Crew keyword implicitly makes the
  // Vehicle an artifact creature when crewed (no separate scripted SVar
  // anywhere in the real card file); represented the same explicit way
  // magitek-armor's own identical bare-Crew case already is: `crewCost`
  // (the structured N) AND `activationCost` (drives harness.ts's own
  // activate-not-cast lifecycle) both set, `effects: [animate]` standing in
  // for that implicit rule.
  crewCost: 1,
  activationCost: 'Crew 1 (tap creatures with total power 1 or more)',
  effects: [{ kind: 'animate', target: 'self', types: ['Artifact', 'Creature'] } satisfies Effect],
};
