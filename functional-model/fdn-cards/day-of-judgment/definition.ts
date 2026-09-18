import type { CardDefinition, Effect } from '../../card';
import { anyPlayer, destroyEach } from '../../combinator';

export const dayOfJudgment: CardDefinition = {
  name: 'Day of Judgment',
  manaCost: '{2}{W}{W}',
  typeLine: 'Sorcery',

  effects: [
    {
      kind: 'program',
      describe: 'destroy all creatures',
      program: anyPlayer.permanentsInPlay().filter('cardType', 'creature').each(destroyEach()),
    } satisfies Effect,
  ],
};
