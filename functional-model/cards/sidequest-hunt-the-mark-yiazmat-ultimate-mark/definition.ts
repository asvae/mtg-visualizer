import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const sidequestHuntTheMark: CardDefinition = {
  name: 'Sidequest: Hunt the Mark',
  manaCost: '{3}{B}{B}',
  typeLine: 'Enchantment',

  triggers: [
    {
      name: 'onEnter',
      // "destroy up to one target creature" — TargetMin$0/TargetMax$1,
      // documentary `optional` (see card.ts's own `destroy` doc comment —
      // this is the exact Summon: Bahamut-shaped case it cites).
      effects: [{ kind: 'destroy', validType: 'creature', qty: 1, optional: true } satisfies Effect],
    },
    {
      // "if a creature died under an opponent's control this turn" — a
      // real CheckSVar condition this model tracks no "died this turn"
      // state for; a scenario firing this named trigger already stands in
      // for the condition having been met, same convention ultros-
      // obnoxious-octopus's own mana-threshold triggers use.
      name: 'onEndStep',
      effects: [
        { kind: 'createToken', token: TOKENS.c_a_treasure_sac, amount: 1 } satisfies Effect,
        {
          kind: 'custom',
          describe:
            "if you control three or more Treasures, transform this enchantment (represented as exile-then-return, mirroring jecht-reluctant-guardian-braska-s-final-aeon's own convention)",
          run: (ctx: EffectContext, actions: Actions) => {
            const treasureCount = ctx.you.getCardsIn('Battlefield').filter((c) => c.hasSubtype('Treasure')).length;
            if (treasureCount >= 3) {
              actions.moveTo(ctx.self, 'Exile');
              actions.moveTo(ctx.self, 'Battlefield');
            }
          },
        } satisfies Effect,
      ],
    },
  ],

  backFace: {
    name: 'Yiazmat, Ultimate Mark',
    manaCost: '',
    typeLine: 'Legendary Creature — Dragon',

    pt: [5, 6],

    activationCost: '{1}{B}, Sacrifice another creature or artifact',
    effects: [
      // Sac cost modeled as the first effect purely so the trace shows it
      // happening — same convention ahriman's own sac-cost activated
      // ability uses.
      { kind: 'sacrifice', owner: 'you', validType: 'creature-or-artifact', notSelf: true } satisfies Effect,
      { kind: 'grantKeywordSelf', keyword: 'Indestructible' } satisfies Effect,
      // "Tap it" — self, via the same pool-based `tapTarget` convention
      // shambling-cie-th's own onEnter uses: by the time this runs, the
      // just-sacrificed fodder creature is already off the battlefield
      // (state.ts's own real removal), so `owner: 'you'` finds exactly
      // self.
      { kind: 'tapTarget', validType: 'creature', owner: 'you' } satisfies Effect,
    ],
  },
};
