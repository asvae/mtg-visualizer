import type { CardDefinition, Effect } from '../../card';
import { anyPlayer, applyToBound, selectUpTo } from '../../combinator';

// "Destroy target artifact or enchantment" — `destroy.validType` has no
// artifact/enchantment option (only 'permanent'|'creature'|'land'), but
// `combinator.ts`'s `FilterPredicate.cardType` DOES support an OR-matched
// type set (`['artifact','enchantment']`) — expressed as a real `program`
// (select one qualifying permanent, then destroy it), same DSL
// `selectUpTo`/`applyToBound` machinery `felidar-savior` already uses.
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
