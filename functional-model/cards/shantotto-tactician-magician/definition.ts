import type { CardDefinition, Effect } from '../../card';

// Real script (shantotto_tactician_magician.txt): `SVar:X:TriggeredCard$CastTotalManaSpent`
// — the real mana spent on the triggering spell, fixed once at trigger time
// (603.3b/603.4), same `triggerInput` convention kain-traitorous-dragoon's
// own custom effect and vincent-valentine's own "dyingCreaturePower" already
// use for a trigger-fixed variable amount.
export const shantottoTacticianMagician: CardDefinition = {
  name: 'Shantotto, Tactician Magician',
  manaCost: '{1}{U}{R}',
  typeLine: 'Legendary Creature — Dwarf Wizard',

  pt: [0, 4],

  triggers: [
    {
      name: 'onCastNoncreatureSpell',
      effects: [
        { kind: 'pumpSelf', power: (ctx) => (ctx.triggerInput?.manaSpent as number) ?? 0, toughness: 0 } satisfies Effect,
        { kind: 'drawCard', amount: (ctx) => (((ctx.triggerInput?.manaSpent as number) ?? 0) >= 4 ? 1 : 0) } satisfies Effect,
      ],
    },
  ],
};
