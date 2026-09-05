import type { CardDefinition, Effect } from '../../card';

export const tyvarThePummeler: CardDefinition = {
  name: 'Tyvar, the Pummeler',
  manaCost: '{1}{G}{G}',
  typeLine: 'Legendary Creature — Elf Warrior',
  pt: [3, 3],

  // Two independent activated abilities — `abilities`, not the single
  // activationCost+effects shape (see CardDefinition's own doc comment).
  abilities: [
    {
      name: 'indestructible',
      // Real cost is "Tap another untapped creature you control" — no
      // creature-tap-as-cost tracking exists (this model's costs are
      // documentary text, same as every other activationCost), the real
      // consequence (Tyvar becoming indestructible) is what's modeled.
      cost: 'Tap another untapped creature you control',
      effects: [{ kind: 'grantKeywordSelf', keyword: 'Indestructible' } satisfies Effect],
    },
    {
      name: 'pump',
      cost: '{3}{G}{G}',
      effects: [
        {
          kind: 'pumpAll',
          predicate: 'creatures-you-control',
          power: (ctx) => Math.max(0, ...ctx.you.getCreaturesInPlay().map((c) => c.getNetPower())),
          toughness: (ctx) => Math.max(0, ...ctx.you.getCreaturesInPlay().map((c) => c.getNetPower())),
        } satisfies Effect,
      ],
    },
  ],
};
