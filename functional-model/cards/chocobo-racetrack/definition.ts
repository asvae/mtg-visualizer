import type { CardDefinition, Effect } from '../../card';

export const chocoboRacetrack: CardDefinition = {
  name: 'Chocobo Racetrack',
  manaCost: '{3}{G}{G}',
  typeLine: 'Artifact',

  triggers: [
    {
      name: 'onLandfall',
      effects: [
        {
          kind: 'createToken',
          // The real token (`g_2_2_bird_landfall`) carries its OWN granted
          // ability text ("Whenever a land you control enters, this token
          // gets +1/+0 until end of turn") — `TokenInfo` has no field for a
          // token's own triggered ability (only `keywords`), so that half
          // of the real text isn't mechanically modeled; the token itself
          // (a real 2/2 green Bird) is created correctly.
          token: { name: 'Bird', manaCost: '0', types: ['Creature', 'Bird'], basePower: 2, baseToughness: 2 },
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
