import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const promptoArgentum: CardDefinition = {
  name: 'Prompto Argentum',
  manaCost: '{1}{R}',
  typeLine: 'Legendary Creature — Human Scout',

  pt: [2, 2],
  keywords: ['Haste'],

  triggers: [
    {
      // "Selfie Shot — Whenever you cast a noncreature spell, if at least
      // four mana was spent to cast it, create a Treasure token." The
      // mana-spent->=4 condition is a real fixed fact about the triggering
      // cast (`ValidSAonCard$ Spell.ManaSpent GE4`) — a scenario choosing to
      // fire this named trigger is asserting that condition held, same as
      // every other conditional named trigger in this batch (no separate
      // condition-check machinery exists here).
      name: 'onNoncreatureSpellCast4Mana',
      effects: [{ kind: 'createToken', token: TOKENS.c_a_treasure_sac, amount: 1 } satisfies Effect],
    },
  ],
};
