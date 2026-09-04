import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (beatrix_loyal_general.txt).
export const beatrixLoyalGeneral: CardDefinition = {
  name: 'Beatrix, Loyal General',
  manaCost: '{4}{W}{W}',
  typeLine: 'Legendary Creature — Human Soldier',

  pt: [4, 4],
  keywords: ['Vigilance'],

  triggers: [
    {
      // "you may attach any number of Equipment you control to target
      // creature you control" — real `DB$ Attach | Object$ Valid
      // Equipment.YouCtrl` with no `Amount$` (an UNBOUNDED batch, not one
      // chosen Equipment), so this needs `custom`: `equip`'s own
      // declarative shape (see card.ts's `Effect` union) has no batch
      // variant, only the single attach-to-a-chosen-target step every
      // other Equipment's own activationCost uses via `actions.equip`
      // directly (coral-sword/buster-sword, e.g.) — composing that SAME
      // real action across every Equipment on the battlefield is not a new
      // capability, just this effect's own real "any number" plurality.
      // "you may" is documentary only (no legal-but-declined engine exists
      // — see card.ts's own doc comment on `move`/`sacrifice`'s own
      // `optional` field for the same convention): the attach always
      // happens when a legal target/Equipment exists.
      name: 'onBeginCombat',
      effects: [
        {
          kind: 'custom',
          describe: 'you may attach any number of Equipment you control to target creature you control',
          run: (ctx: EffectContext, actions: Actions) => {
            const target = actions.chooseTarget(ctx.you.getCreaturesInPlay());
            if (!target) return;
            const equipment = ctx.you.getCardsIn('Battlefield').filter((c) => c.isArtifact() && c.hasSubtype('Equipment'));
            for (const e of equipment) actions.equip(e, target);
          },
        } satisfies Effect,
      ],
    },
  ],
};
