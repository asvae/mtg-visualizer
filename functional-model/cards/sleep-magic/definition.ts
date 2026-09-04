import type { CardDefinition, Effect } from '../../card';

export const sleepMagic: CardDefinition = {
  name: 'Sleep Magic',
  manaCost: '{U}',
  typeLine: 'Enchantment — Aura',

  // "Enchant creature" / "doesn't untap during its controller's untap
  // step" are real continuous facts, not resolvable effects — text only,
  // same treatment every other Aura-attach restriction/continuous lock
  // here gets.
  staticAbilities: ["Enchant creature", "Enchanted creature doesn't untap during its controller's untap step."],

  triggers: [
    {
      // "When this Aura enters, tap enchanted creature" — this model has
      // no separate "which creature did this Aura's own cast target"
      // tracking distinct from a fresh `chooseTarget` pool pick (Auras have
      // no dedicated attach-state here), so `tapTarget`'s own pool pick
      // stands in for "the enchanted creature," same simplification every
      // other targeted-on-ETP trigger in this batch uses.
      name: 'onEnter',
      effects: [{ kind: 'tapTarget', validType: 'creature' } satisfies Effect],
    },
    {
      // "When enchanted creature is dealt damage, sacrifice this Aura" —
      // `sacrifice`'s own declarative shape has no "self-only" target
      // option (only `notSelf`, which EXCLUDES self), so this approximates
      // "sacrifice THIS Aura" as "sacrifice an enchantment you control,"
      // correct whenever this Aura is the only enchantment on the
      // battlefield (true in every scenario below).
      name: 'onEnchantedDealtDamage',
      effects: [{ kind: 'sacrifice', owner: 'you', validType: 'enchantment', qty: 1 } satisfies Effect],
    },
  ],
};
