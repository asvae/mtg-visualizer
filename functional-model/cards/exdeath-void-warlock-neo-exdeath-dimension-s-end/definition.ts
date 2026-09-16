import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const exdeathVoidWarlock: CardDefinition = {
  name: 'Exdeath, Void Warlock',
  manaCost: '{1}{B}{G}',
  typeLine: 'Legendary Creature — Spirit Warlock',

  pt: [3, 3],

  triggers: [
    { name: 'onEnter', on: 'enter', effects: [{ kind: 'gainLife', amount: 3 } satisfies Effect] },
    {
      name: 'onEndStep',
      effects: [
        {
          kind: 'custom',
          describe: 'if there are six or more permanent cards in your graveyard, transform Exdeath',
          run: (ctx: EffectContext, actions: Actions) => {
            const permanentsInGraveyard = ctx.you.getCardsIn('Graveyard').filter((c) => c.isCreature() || c.isArtifact() || c.isEnchantment() || c.isLand()).length;
            if (permanentsInGraveyard >= 6) {
              actions.moveTo(ctx.self, 'Exile');
              actions.moveTo(ctx.self, 'Battlefield');
            }
          },
        } satisfies Effect,
      ],
    },
  ],

  backFace: {
    name: "Neo Exdeath, Dimension's End",
    manaCost: '',
    typeLine: 'Legendary Creature — Spirit Avatar',

    // Real printed power is a live CDA ("Neo Exdeath's power is equal to
    // the number of permanent cards in your graveyard") — now real,
    // executable `ptFormula.kind:'setToGraveyardPermanentCount'`
    // (2026-09-16, static-ability audit follow-up — see `card.ts`'s own
    // doc comment for the real Forge citation). `pt: [0, 3]` keeps the real
    // fixed printed toughness; power's own printed base is now genuinely
    // overridden live by the CDA (same "toughness stays whatever `pt` says"
    // scoping `setToCreaturesControlled` already establishes).
    pt: [0, 3],
    keywords: ['Trample'],
    staticAbilities: ["Neo Exdeath's power is equal to the number of permanent cards in your graveyard."],
    ptFormula: { kind: 'setToGraveyardPermanentCount' },
  },
};
