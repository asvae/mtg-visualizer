import type { CardDefinition, Effect } from '../../card';

export const chandraFlameshaper: CardDefinition = {
  name: 'Chandra, Flameshaper',
  manaCost: '{5}{R}{R}',
  typeLine: 'Legendary Planeswalker — Chandra',

  missingSchemaFunctionality: [
    {
      clause: 'Exile the top three cards of your library. Choose one. You may play that card this turn.',
      demand:
        'No "impulse draw" primitive exists: exiling a fixed number of library cards face up and letting the controller choose one to be playable from exile for a limited time has no declarative `move`/`custom`-adjacent shape today — `move`\'s own `qty`/`target` fields move cards between named zones, they don\'t grant a temporary "may play from exile this turn" permission.',
    },
    {
      clause:
        'Create a token that\'s a copy of target creature you control, except it has haste and "At the beginning of the end step, sacrifice this token."',
      demand:
        'No "copy a permanent, with overrides" mechanic exists anywhere in this schema (same already-tracked gray-tier engine gap `abyssal-harvester` also needs) — `createToken` only ever builds a fixed `TokenInfo`, never a copy of a chosen target plus an added keyword and an added self-sacrifice trigger.',
    },
    {
      clause: 'Chandra deals 8 damage divided as you choose among any number of target creatures and/or planeswalkers.',
      demand:
        'No "divided damage among a chosen number of targets" primitive exists — `dealDamageTarget` only ever hits a SINGLE targeted creature (no planeswalker option, no player-chosen division of a damage total across more than one target).',
    },
  ],

  abilities: [
    {
      name: '+2',
      cost: 'Loyalty: +2',
      effects: [
        { kind: 'addMana', color: 'R', amount: 3 } satisfies Effect,
        {
          kind: 'custom',
          describe: 'exile the top three cards of your library, choose one, you may play that card this turn (see missingSchemaFunctionality[0])',
          run: () => {},
        } satisfies Effect,
      ],
    },
    {
      name: '+1',
      cost: 'Loyalty: +1',
      effects: [
        {
          kind: 'custom',
          describe:
            'create a token that\'s a copy of target creature you control, except it has haste and "At the beginning of the end step, sacrifice this token" (see missingSchemaFunctionality[1])',
          run: () => {},
        } satisfies Effect,
      ],
    },
    {
      name: '-4',
      cost: 'Loyalty: -4',
      effects: [
        {
          kind: 'custom',
          describe: 'Chandra deals 8 damage divided as you choose among any number of target creatures and/or planeswalkers (see missingSchemaFunctionality[2])',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
