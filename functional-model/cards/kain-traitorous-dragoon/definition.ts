import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const kainTraitorousDragoon: CardDefinition = {
  name: 'Kain, Traitorous Dragoon',
  manaCost: '{2}{B}',
  typeLine: 'Legendary Creature — Human Knight',

  staticAbilities: ['Jump — during your turn, Kain has flying.'],

  triggers: [
    {
      name: 'onDealsDamage',
      effects: [
        {
          kind: 'custom',
          describe:
            'combat damage to a player: that player gains control of Kain; if they do, you draw that many cards, create that many tapped Treasure tokens, then lose that much life (all three bound to the SAME fixed damage amount, fixed once when the trigger fires)',
          run: (ctx: EffectContext, actions: Actions) => {
            // Fixed ONCE, read three times below — the real
            // synergy-model `:=`/`=` binding (SCHEMA.md) turns out to need
            // no new schema machinery in real TS: it's just a local
            // variable. `triggerInput` is how a scenario supplies the
            // trigger's own variable info (who was hit, how much), the
            // same way `castFrom`/`mode` supply other per-run decisions.
            const damagedPlayer = ctx.opponents[(ctx.triggerInput?.damagedPlayerIndex as number) ?? 0];
            const damageDealt = (ctx.triggerInput?.damageAmount as number) ?? 0;
            if (!damagedPlayer) return;
            actions.gainControl(damagedPlayer, ctx.self);
            // ConditionDefined$Remembered|ConditionPresent$Card|ConditionCompare$GE1 —
            // real Forge gates the payoff on the control change having
            // actually stuck, not literally on damage amount; damageDealt
            // >= 1 is a reasonable stand-in since the trigger only fires on
            // real combat damage in the first place.
            if (damageDealt >= 1) {
              for (let i = 0; i < damageDealt; i++) ctx.you.drawCard();
              actions.createToken(ctx.you, TOKENS.c_a_treasure_sac, damageDealt, { tapped: true });
              ctx.you.loseLife(damageDealt);
            }
          },
        } satisfies Effect,
      ],
    },
  ],
};
