import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const sinSpirasPunishment: CardDefinition = {
  name: "Sin, Spira's Punishment",
  manaCost: '{4}{B}{G}{U}',
  typeLine: 'Legendary Creature — Leviathan Avatar',

  pt: [7, 7],
  keywords: ['Flying'],

  triggers: [
    {
      // Real Forge fires this from TWO separate triggers (ChangesZone-enters
      // AND Attacks) that share the same SVar payload — one named Trigger
      // here covers both real events, same convention
      // sephiroth-fabled-soldier-sephiroth-one-winged-angel's own
      // 'onEnterOrAttacks' already established.
      name: 'onEnterOrAttacks',
      effects: [
        {
          kind: 'custom',
          describe:
            "exile a permanent card from your graveyard at random, then create a tapped token that's a copy of that card — if the exiled card is a land card, repeat this process (real `DB$ Repeat`, forge-model's sin_spiras_punishment.txt line 8-11)",
          run: (ctx: EffectContext, actions: Actions) => {
            // "At random" — same deterministic-first-candidate simplification
            // `chooseTarget` already carries everywhere else in this model
            // (no real RNG exists here).
            let keepGoing = true;
            while (keepGoing) {
              const pool = ctx.you.getCardsIn('Graveyard').filter((c) => c.isCreature() || c.isArtifact() || c.isEnchantment() || c.isLand());
              if (pool.length === 0) break;
              const chosen = actions.chooseTarget(pool);
              actions.moveTo(chosen, 'Exile');
              const copy = actions.copyPermanent(chosen, ctx.you);
              actions.tap(copy);
              keepGoing = chosen.isLand();
            }
          },
        } satisfies Effect,
      ],
    },
  ],
};
