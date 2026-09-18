import type { CardDefinition, Effect } from '../../card';

export const archmageOfRunes: CardDefinition = {
  name: 'Archmage of Runes',
  manaCost: '{3}{U}{U}',
  typeLine: 'Creature — Giant Wizard',
  pt: [3, 6],

  missingSchemaFunctionality: [
    {
      clause: 'Instant and sorcery spells you cast cost {1} less to cast.',
      demand:
        '`SpellCostReductionGrant` (this permanent\'s own broadcast cost-reduction shape) only ever gates on `colors: string[]` — no card-TYPE-gated variant exists (Instant/Sorcery, as opposed to a color), so a flat, unconditional type-gated discount onto every future instant/sorcery the controller casts can\'t be declared today.',
    },
  ],

  triggers: [
    {
      name: 'onInstantOrSorceryCast',
      effects: [
        {
          kind: 'drawCard',
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
