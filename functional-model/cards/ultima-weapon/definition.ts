import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (ultima_weapon.txt): "Whenever equipped creature attacks,
// destroy target creature an opponent controls" — the granted "equipped
// creature attacks" trigger is modeled as if it were Ultima Weapon's OWN
// trigger, same real source simplification sage-s-nouliths' own
// `onEquippedAttacks` trigger already establishes (the real attacker is
// whichever creature is equipped, not this permanent).
export const ultimaWeapon: CardDefinition = {
  name: 'Ultima Weapon',
  manaCost: '{7}',
  typeLine: 'Legendary Artifact — Equipment',

  staticAbilities: ['Equipped creature gets +7/+7.'],

  triggers: [
    {
      name: 'onEquippedAttacks',
      effects: [{ kind: 'destroy', validType: 'creature', owner: 'opponents', qty: 1 } satisfies Effect],
    },
  ],

  activationCost: 'Equip {7}',
  effects: [
    {
      kind: 'custom',
      describe: 'attach to target creature you control',
      run: (ctx: EffectContext, actions: Actions) => {
        const target = actions.chooseTarget(ctx.you.getCreaturesInPlay());
        if (target) actions.equip(ctx.self, target);
      },
    } satisfies Effect,
  ],
};
