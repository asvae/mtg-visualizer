import type { CardDefinition, Effect } from '../../card';

// "Choco-Comet deals X damage to any target." — TWO real, independent
// gaps block this half of the card entirely:
//  1. `SVar:X:Count$xPaid` — the amount of {X} mana actually paid for this
//     spell. No field anywhere on `EffectContext` (self/you/opponents/
//     castFrom/mode/triggerInput) carries an X-spell's own paid amount, so
//     no `Computed<number>` function can produce this card's own damage
//     total at all — not a targeting nuance, a genuinely unknown amount.
//  2. `ValidTgts$ Any` — "any target" (a player OR a creature/planeswalker,
//     player's own choice). `dealDamage` only targets a GROUP of players
//     (`EffectOwner`, not one chosen one) and `dealDamageTarget` only
//     targets a single creature — no Effect kind covers a single CHOSEN
//     target that could be either.
// Both flagged to the parent session. The damage half of this card is
// entirely omitted rather than guessed at; the token-creation half (a real,
// unconditional SubAbility, independent of X) is fully built below.
export const chocoComet: CardDefinition = {
  name: 'Choco-Comet',
  manaCost: '{X}{R}{R}',
  typeLine: 'Sorcery',

  effects: [
    // Real TokenScript$ g_2_2_bird_landfall — same inline token (and same
    // lost-ability caveat) as call-the-mountain-chocobo/definition.ts.
    { kind: 'createToken', token: { name: 'Bird', manaCost: '0', types: ['Creature', 'Bird'], basePower: 2, baseToughness: 2 }, amount: 1 } satisfies Effect,
  ],
};
