import type { CardDefinition, Effect } from '../../card';

export const judgeMagisterGabranth: CardDefinition = {
  name: 'Judge Magister Gabranth',
  manaCost: '{W}{B}',
  typeLine: 'Legendary Creature — Human Advisor Knight',

  pt: [2, 2],
  keywords: ['Menace'],

  triggers: [
    {
      name: 'onCreatureOrArtifactDies',
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    },
  ],
};
