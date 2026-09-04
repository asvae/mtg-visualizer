import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const stolenUniform: CardDefinition = {
  name: 'Stolen Uniform',
  manaCost: '{U}',
  typeLine: 'Instant',

  // Two independent targets (a creature you control AND an Equipment,
  // which can belong to anyone), then chained gainControl+equip against
  // the SAME chosen Equipment — no single declarative Effect kind covers
  // "gain control of one chosen permanent, then attach it to a different
  // chosen permanent," so `custom`, built entirely out of existing
  // `chooseTarget`/`gainControl`/`equip` actions. The delayed "when you
  // lose control of that Equipment this turn... unattach it" trigger has
  // no `unattach`/detach action anywhere in this model (`equip` only ever
  // attaches) — left undocumented in code beyond `describe`, same
  // "genuinely out of scope" treatment sidequest-catch-a-fish-cooking-
  // campsite's own mana-ability comment gives a different unreachable
  // mechanic.
  effects: [
    {
      kind: 'custom',
      describe:
        "choose target creature you control and target Equipment; gain control of that Equipment until end of turn and attach it to the chosen creature (the end-of-turn unattach delayed trigger isn't modeled — no unattach/detach action exists in this engine)",
      run: (ctx: EffectContext, actions: Actions) => {
        const creatureTarget = actions.chooseTarget(ctx.you.getCreaturesInPlay());
        const equipmentPool = [...ctx.you.getCardsIn('Battlefield'), ...ctx.opponents.flatMap((p) => p.getCardsIn('Battlefield'))].filter((c) =>
          c.hasSubtype('Equipment')
        );
        const equipmentTarget = actions.chooseTarget(equipmentPool);
        if (!equipmentTarget) return;
        actions.gainControl(ctx.you, equipmentTarget);
        if (creatureTarget) actions.equip(equipmentTarget, creatureTarget);
      },
    } satisfies Effect,
  ],
};
