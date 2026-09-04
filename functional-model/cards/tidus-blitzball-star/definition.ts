import type { CardDefinition, Effect } from '../../card';

export const tidusBlitzballStar: CardDefinition = {
  name: 'Tidus, Blitzball Star',
  manaCost: '{1}{W}{U}',
  typeLine: 'Legendary Creature — Human Warrior',

  pt: [2, 1],

  triggers: [
    {
      name: 'onArtifactEnters',
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    },
    {
      // Real `ValidTgts$ Creature.OppCtrl` — a genuinely restricted target,
      // confirmed in the script itself (not the "self-targeting looks odd"
      // trap the `owner` field's own doc comment warns against).
      name: 'onAttacks',
      effects: [{ kind: 'tapTarget', validType: 'creature', owner: 'opponents' } satisfies Effect],
    },
  ],
};
