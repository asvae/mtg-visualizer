import type { CardDefinition, Effect } from '../../card';
import { anyPlayer, applyToBound, selectUpTo } from '../../combinator';

export const catharCommando: CardDefinition = {
  name: 'Cathar Commando',
  manaCost: '{1}{W}',
  typeLine: 'Creature — Human Soldier',
  pt: [3, 1],
  keywords: ['Flash'],

  activationCost: '{1}, sacrifice this creature',
  effects: [
    {
      kind: 'program',
      describe: 'destroy target artifact or enchantment',
      program: selectUpTo(anyPlayer.permanentsInPlay().filter('cardType', ['artifact', 'enchantment']), 1, 'target', [
        applyToBound('target', 0, { action: 'destroy' }),
      ]),
    } satisfies Effect,
  ],
};
