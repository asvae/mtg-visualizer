import type { CardDefinition, Effect } from '../../card';

// Real Forge (ashroot_animist.txt): `T:Mode$ Attacks | ValidCard$
// Card.Self` — real `on:'attacks'` dispatch. Two independent effects both
// targeting "another target creature you control": `chooseTarget` is
// documented as deterministically picking the first qualifying pool
// candidate (no real player-decision engine), so both effects resolve
// against the SAME creature by construction, not by coincidence.
export const ashrootAnimist: CardDefinition = {
  name: 'Ashroot Animist',
  manaCost: '{2}{R}{G}',
  typeLine: 'Creature — Lizard Druid',
  pt: [4, 4],
  keywords: ['Trample'],

  triggers: [
    {
      name: 'onAttacks',
      on: 'attacks',
      effects: [
        {
          kind: 'pumpTarget',
          power: (ctx) => ctx.self.getNetPower(),
          toughness: (ctx) => ctx.self.getNetPower(),
          owner: 'you',
          notSelf: true,
          untilEndOfTurn: true,
        } satisfies Effect,
        { kind: 'grantKeywordTarget', keyword: 'Trample', validType: 'creature', owner: 'you', notSelf: true, untilEndOfTurn: true } satisfies Effect,
      ],
    },
  ],
};
