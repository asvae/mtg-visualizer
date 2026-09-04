import type { CardDefinition, Effect } from '../../card';

export const summonEsperRamuh: CardDefinition = {
  name: 'Summon: Esper Ramuh',
  manaCost: '{2}{R}{R}',
  typeLine: 'Enchantment Creature — Saga Wizard',

  pt: [3, 3],

  triggers: [
    {
      name: 'chapterI',
      effects: [
        {
          // Real `SVar:X:Count$ValidGraveyard Card.nonCreature+nonLand+YouOwn`
          // — a genuine live count, read via `Computed`, same shape
          // Beza's own "if an opponent has more life" reference case.
          kind: 'dealDamageTarget',
          amount: (ctx) => ctx.you.getCardsIn('Graveyard').filter((c) => !c.isCreature() && !c.isLand()).length,
          owner: 'opponents',
        } satisfies Effect,
      ],
    },
    {
      name: 'chapterII',
      effects: [{ kind: 'pumpAll', predicate: 'creatures-you-control', power: 1, toughness: 0, subtype: 'Wizard' } satisfies Effect],
    },
    {
      name: 'chapterIII',
      effects: [{ kind: 'pumpAll', predicate: 'creatures-you-control', power: 1, toughness: 0, subtype: 'Wizard' } satisfies Effect],
    },
  ],
};
