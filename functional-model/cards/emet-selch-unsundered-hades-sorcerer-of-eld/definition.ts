import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const emetSelchUnsundered: CardDefinition = {
  name: 'Emet-Selch, Unsundered',
  manaCost: '{1}{U}{B}',
  typeLine: 'Legendary Creature — Elder Wizard',

  pt: [2, 4],
  keywords: ['Vigilance'],

  triggers: [
    // Real script has TWO separate `T:` lines (SpellCast/ChangesZone for
    // ETB, Attacks for attacking) both pointing at the same "draw, then
    // discard" — modeled as two independently-named triggers with
    // identical effects, same shape Namazu Trader's own ETB-vs-attack pair
    // already established.
    { name: 'onEnter', effects: [{ kind: 'drawCard' } satisfies Effect, { kind: 'discard', owner: 'you', qty: 1 } satisfies Effect] },
    { name: 'onAttacks', effects: [{ kind: 'drawCard' } satisfies Effect, { kind: 'discard', owner: 'you', qty: 1 } satisfies Effect] },
    {
      name: 'onUpkeep',
      effects: [
        {
          kind: 'custom',
          describe: 'if there are fourteen or more cards in your graveyard, you may transform Emet-Selch',
          run: (ctx: EffectContext, actions: Actions) => {
            if (ctx.you.getCardsIn('Graveyard').length >= 14) {
              actions.moveTo(ctx.self, 'Exile');
              actions.moveTo(ctx.self, 'Battlefield');
            }
          },
        } satisfies Effect,
      ],
    },
  ],

  backFace: {
    name: 'Hades, Sorcerer of Eld',
    manaCost: '',
    typeLine: 'Legendary Creature — Avatar',

    pt: [6, 6],
    keywords: ['Vigilance'],

    // "you may play cards from your graveyard" is a static permission; the
    // graveyard->exile replacement is real replacement-effect machinery
    // (explicitly out of scope — this batch's own deferred-gaps list).
    staticAbilities: [
      'Echo of the Lost — During your turn, you may play cards from your graveyard.',
      'If a card or token would be put into your graveyard from anywhere, exile it instead.',
    ],
  },
};
