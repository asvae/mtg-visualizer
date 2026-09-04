import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const raubahnBullOfAlaMhigo: CardDefinition = {
  name: 'Raubahn, Bull of Ala Mhigo',
  manaCost: '{1}{R}',
  typeLine: 'Legendary Creature — Human Warrior',

  pt: [2, 2],
  // Real "Ward—Pay life equal to Raubahn's power" — only the recognized
  // keyword fact is tracked (see card.ts's own Keyword doc comment: Ward is
  // recognized-but-inert here, no counterspell-trigger machinery exists to
  // actually enforce the life payment).
  keywords: ['Ward'],

  triggers: [
    {
      name: 'onAttack',
      effects: [
        {
          // "Attach up to one target Equipment you control to target
          // attacking creature" — same `equip` gap dragoon-s-lance/thief-s-
          // knife/weapons-vendor's own comments already document (no
          // declarative `equip` Effect kind exists); `custom` calling the
          // real `actions.equip` is the established shape. "Target attacking
          // creature" approximated as any creature you control (no
          // attack-state is tracked anywhere in this model — same
          // approximation weapons-vendor's own onBeginCombat effect makes
          // for "target creature you control").
          kind: 'custom',
          describe: 'attach up to one target Equipment you control to target attacking creature',
          run: (ctx: EffectContext, actions: Actions) => {
            const equipment = ctx.you.getCardsIn('Battlefield').filter((c) => c.hasSubtype('Equipment'));
            if (equipment.length === 0) return;
            const chosenEquipment = actions.chooseTarget(equipment);
            const creatures = ctx.you.getCreaturesInPlay();
            if (creatures.length === 0) return;
            const chosenCreature = actions.chooseTarget(creatures);
            actions.equip(chosenEquipment, chosenCreature);
          },
        } satisfies Effect,
      ],
    },
  ],
};
