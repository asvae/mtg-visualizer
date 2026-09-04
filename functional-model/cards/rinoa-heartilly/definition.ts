import type { CardDefinition, Effect, EffectContext } from '../../card';

export const rinoaHeartilly: CardDefinition = {
  name: 'Rinoa Heartilly',
  manaCost: '{3}{G}{W}',
  typeLine: 'Legendary Creature — Human Rebel Warlock',

  pt: [4, 4],

  triggers: [
    {
      name: 'onEnter',
      // "Create Angelo, a legendary 1/1 green and white Dog creature
      // token" — `Legendary` folded into `types` alongside the core types
      // (state.ts's own `createToken` strips only Creature/Artifact/
      // Enchantment/Land into `subtypes`, so `Legendary` lands there too —
      // the same convention harness.ts's own `subtypesFromTypeLine` already
      // uses for every non-token card's own supertype). `TokenInfo` tracks
      // no color field, so "green and white" is lost — same documentary-
      // loss class as every other token this model creates.
      effects: [{ kind: 'createToken', token: { name: 'Angelo', manaCost: '0', types: ['Legendary', 'Creature', 'Dog'], basePower: 1, baseToughness: 1 }, amount: 1 } satisfies Effect],
    },
    {
      // "Angelo Cannon — another target creature you control gets +1/+1
      // until end of turn for each creature you control." `pumpTarget` has
      // no `notSelf` field (unlike `pumpAll`), so "another" relies on
      // `self` always being the LAST creature pushed onto the battlefield
      // array in a trigger scenario (harness.ts's own `setupPlayer` runs
      // before `self` is added) — same real, general model limitation
      // gladiolus-amicitia's own Landfall trigger already documents.
      name: 'onAttacks',
      effects: [
        {
          kind: 'pumpTarget',
          power: (ctx: EffectContext) => ctx.you.getCreaturesInPlay().length,
          toughness: (ctx: EffectContext) => ctx.you.getCreaturesInPlay().length,
          owner: 'you',
        } satisfies Effect,
      ],
    },
  ],
};
