import type { CardDefinition, Effect } from '../../card';

export const lightningArmyOfOne: CardDefinition = {
  name: 'Lightning, Army of One',
  manaCost: '{1}{R}{W}',
  typeLine: 'Legendary Creature — Human Soldier',

  pt: [3, 2],
  keywords: ['FirstStrike', 'Trample', 'Lifelink'],

  triggers: [
    {
      // "Stagger — until your next turn, if a source would deal damage to
      // that player or a permanent that player controls, it deals double
      // that damage instead." A real continuous REPLACEMENT effect created
      // BY a trigger — explicitly out of scope (no replacement-effect
      // machinery anywhere in this model, see the parent's own
      // STILL-DEFERRED gap list). Unlike Trance Kuja's own Flare Star
      // (a plain static ability, no trigger involved), this one genuinely
      // fires off a real event (combat damage to a player) this model DOES
      // track — so it gets a real named trigger, just with nothing
      // mutable to pair it with (the doubling itself has no state to
      // change here) — a `custom` no-op, same shape jill-shiva-s-dominant-
      // shiva-warden-of-ice's own unblockable-grant already establishes.
      // Flagged as a gap in the batch report.
      name: 'onDealsCombatDamageToPlayer',
      effects: [
        {
          kind: 'custom',
          describe: "Stagger — until your next turn, if a source would deal damage to that player or a permanent that player controls, it deals double that damage instead",
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
