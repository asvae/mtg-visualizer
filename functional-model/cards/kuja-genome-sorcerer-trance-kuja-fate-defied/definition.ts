import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const kujaGenomeSorcerer: CardDefinition = {
  name: 'Kuja, Genome Sorcerer',
  manaCost: '{2}{B}{R}',
  typeLine: 'Legendary Creature — Human Mutant Wizard',

  pt: [3, 4],

  triggers: [
    {
      // "Create a tapped 0/1 black Wizard creature token with 'Whenever
      // you cast a noncreature spell, this token deals 1 damage to each
      // opponent.' Then if you control four or more Wizards, transform
      // Kuja." The created token's own granted ability text has no
      // representation anywhere in this model (`TokenInfo` carries no
      // ability/trigger field, only `keywords` — see card.ts's own header
      // on "no mechanism to grant a brand-new triggered ability," same gap
      // this token's own intrinsic ability hits) — the token's real name/
      // color/P/T/tapped-state are still faithfully created. The
      // conditional transform (a real threshold gate, same shape kuja's
      // own real `ConditionPresent$/ConditionCompare$ GE4` uses) has no
      // declarative gate anywhere in this model either, so it's a `custom`
      // alongside the token creation.
      name: 'onEndStep',
      effects: [
        { kind: 'createToken', token: { name: 'Wizard', manaCost: '0', types: ['Creature', 'Wizard'], basePower: 0, baseToughness: 1 }, amount: 1, tapped: true } satisfies Effect,
        {
          kind: 'custom',
          describe: 'if you control four or more Wizards, transform Kuja',
          run: (ctx: EffectContext, actions: Actions) => {
            const wizardCount = ctx.you.getCreaturesInPlay().filter((c) => c.hasSubtype('Wizard')).length;
            if (wizardCount < 4) return;
            actions.moveTo(ctx.self, 'Exile');
            actions.moveTo(ctx.self, 'Battlefield');
          },
        } satisfies Effect,
      ],
    },
  ],

  backFace: {
    name: 'Trance Kuja, Fate Defied',
    manaCost: '',
    typeLine: 'Legendary Creature — Avatar Wizard',

    pt: [4, 6],

    // "Flare Star — If a Wizard you control would deal damage to a
    // permanent or player, it deals double that damage instead." A real
    // continuous REPLACEMENT effect — explicitly out of scope (no
    // replacement-effect machinery anywhere in this model, see the
    // parent's own STILL-DEFERRED gap list) — kept as inert, real printed
    // text via `staticAbilities` rather than a `custom` effect with
    // nothing to actually run (this is continuous, not a resolvable step,
    // so it has no trigger/cast moment to attach a `custom` to at all).
    staticAbilities: ['Flare Star — If a Wizard you control would deal damage to a permanent or player, it deals double that damage instead.'],
  },
};
