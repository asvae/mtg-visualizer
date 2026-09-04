import type { CardDefinition, Effect } from '../../card';

export const blazingBomb: CardDefinition = {
  name: 'Blazing Bomb',
  manaCost: '{R}',
  typeLine: 'Creature — Elemental',

  pt: [1, 1],

  // Real trigger condition ("if at least four mana was spent to cast it")
  // isn't hooked up to any generic "a spell was cast" event this model
  // fires automatically — same shape every other named trigger here uses
  // (Minwu's own onLifeGained, e.g.): a scenario picks this trigger
  // directly, standing in for "the condition was already met."
  triggers: [
    {
      name: 'onExpensiveNoncreatureSpellCast',
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    },
  ],

  // "Blow Up — {T}, Sacrifice this creature: It deals damage equal to its
  // power to target creature. Activate only as a sorcery." The sacrifice
  // is part of the ACTIVATION COST (paid before the ability resolves, same
  // as Zack Fair's own `{1}, Sacrifice Zack Fair`) — not modeled as a
  // resolvable effect, only as descriptive cost text.
  activationCost: '{T}, Sacrifice Blazing Bomb (activate only as a sorcery)',
  effects: [
    // `Sacrificed$CardPower` — real Forge LKI reading the just-sacrificed
    // creature's own power. `ctx.self` stays a valid, readable object here
    // (this model doesn't actually move `self` on cost payment), so its
    // own `getNetPower()` is the same real number.
    { kind: 'dealDamageTarget', amount: (ctx) => ctx.self.getNetPower() } satisfies Effect,
  ],
};
