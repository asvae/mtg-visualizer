import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const exdeathVoidWarlock: CardDefinition = {
  name: 'Exdeath, Void Warlock',
  manaCost: '{1}{B}{G}',
  typeLine: 'Legendary Creature — Spirit Warlock',

  pt: [3, 3],

  triggers: [
    { name: 'onEnter', effects: [{ kind: 'gainLife', amount: 3 } satisfies Effect] },
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
    // the number of permanent cards in your graveyard") — neither built
    // `ptFormula` variant fits it (`addPerEquipmentControlled` counts
    // Equipment, `setToCreaturesControlled` counts creatures you control;
    // neither counts graveyard permanents), so this genuinely can't be
    // live-recalculated here. `pt: [0, 3]` keeps the real fixed printed
    // toughness but the power stays a STATIC 0 (not dynamic) — a real,
    // flagged gap, not a hidden approximation; see `staticAbilities` below
    // for the real text.
    pt: [0, 3],
    keywords: ['Trample'],
    staticAbilities: [
      "Neo Exdeath's power is equal to the number of permanent cards in your graveyard. (Not live-computed — no ptFormula variant matches this CDA; power stays a static 0 here.)",
    ],
  },
};
