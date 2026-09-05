import type { CardDefinition, Effect } from '../../card';

export const championsOfThePerfect: CardDefinition = {
  name: 'Champions of the Perfect',
  manaCost: '{3}{G}',
  typeLine: 'Creature — Elf Warrior',
  pt: [6, 6],

  // Additional-cast-cost (exile a beholden Elf) and its paired
  // leaves-the-battlefield return are chained: neither is independently
  // testable without the other, and this model has NO additional-cost
  // engine at all (only `activationCost`, for activated abilities) and no
  // way to remember "the specific card THIS spell exiled" for a later
  // trigger to reference — both stay documentary text together.
  staticAbilities: [
    'As an additional cost to cast this spell, behold an Elf and exile it.',
    'When this creature leaves the battlefield, return the exiled card to its owner\'s hand.',
  ],

  triggers: [
    {
      name: 'onCastCreatureSpell',
      effects: [{ kind: 'drawCard', amount: 1 } satisfies Effect],
    },
  ],
};
