import type { CardDefinition, Effect } from '../../card';

// Real Forge (giada_font_of_hope.txt): `K:ETBReplacement:Other:
// AddExtraCounter:...:Creature.Angel+YouCtrl+Other` — a CR 614 replacement
// on ANOTHER qualifying permanent's own ETB counter count, scaled by a live
// board count. `Trigger.on:'otherPermanentEnters'` only fires a NEW trigger
// on this card's own controller — it has no way to reach into and modify
// the ENTERING permanent's own replacement-effect ETB state (a genuinely
// different mechanism, CR 614.12-style, from a reactive trigger). The mana
// ability's own `RestrictValid$ Spell.Angel` ("spend this mana only to cast
// an Angel spell") is left undeclared (documentary-only, unenforced,
// same "no spendable mana pool" limitation every other mana ability`s
// restriction already carries — not itself a novel gap).
export const giadaFontOfHope: CardDefinition = {
  name: 'Giada, Font of Hope',
  manaCost: '{1}{W}',
  typeLine: 'Legendary Creature — Angel',
  pt: [2, 2],
  keywords: ['Flying', 'Vigilance'],

  abilities: [
    {
      name: 'tapForW',
      cost: '{T}',
      effects: [{ kind: 'addMana', color: 'W', amount: 1 } satisfies Effect],
    },
  ],

  missingSchemaFunctionality: [
    {
      clause: 'Each other Angel you control enters with an additional +1/+1 counter on it for each Angel you already control.',
      demand:
        'No CR 614.12-style replacement effect modifies ANOTHER qualifying permanent\'s own ETB counter count — `Trigger.on:\'otherPermanentEnters\'` only reacts after the fact, it can\'t change how many counters the entering permanent enters WITH.',
    },
  ],
};
