import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const coralSword: CardDefinition = {
  name: 'Coral Sword',
  manaCost: '{R}',
  typeLine: 'Artifact — Equipment',

  keywords: ['Flash'],
  // "Equipped creature gets +1/+0" — a continuous static ability, not a
  // resolvable effect (no ptFormula shape fits an equipment's own grant to
  // whatever it's attached to either) — real text, same convention every
  // other always-on continuous ability in this batch uses.
  staticAbilities: ['Equipped creature gets +1/+0.'],

  triggers: [
    {
      // `DB$ Attach` has no declarative Effect kind (see ninja-s-blades'
      // own comment — every equip anywhere in this repo goes through
      // `custom` calling the real `actions.equip`); the "gains first
      // strike until end of turn" half of the SAME ability IS declarative
      // (`grantKeywordTarget`), split out as its own effect so `custom`
      // stays narrowly scoped to just the attach step. `chooseTarget`'s
      // own deterministic "always pick pool[0]" behavior means both
      // effects land on the SAME creature, matching Forge's real
      // `Defined$ Targeted` (the second effect targeting whatever the
      // first one attached to).
      name: 'onEnter',
      effects: [
        {
          kind: 'custom',
          describe: 'attach to target creature you control',
          run: (ctx: EffectContext, actions: Actions) => {
            const target = actions.chooseTarget(ctx.you.getCreaturesInPlay());
            if (target) actions.equip(ctx.self, target);
          },
        } satisfies Effect,
        { kind: 'grantKeywordTarget', keyword: 'FirstStrike', validType: 'creature' } satisfies Effect,
      ],
    },
  ],

  // Equip {1} — an activated ability on the Equipment itself, same
  // activationCost/effects shape as ninja-s-blades' own Equip {2}.
  activationCost: 'Equip {1}',
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
