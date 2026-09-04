import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const firionWildRoseWarrior: CardDefinition = {
  name: 'Firion, Wild Rose Warrior',
  manaCost: '{2}{R}',
  typeLine: 'Legendary Creature — Human Rebel Warrior',

  pt: [3, 3],

  // "Equipped creatures you control have haste" — an always-on continuous
  // grant to a live-matched group, same `staticAbilities` treatment ardyn-
  // the-usurper/the-fire-crystal already use (not a one-time
  // `grantKeywordAll` resolution).
  staticAbilities: ['Equipped creatures you control have haste.'],

  triggers: [
    {
      // "create a token that's a copy of [the entering Equipment], except
      // it has 'equip cost -2'... sacrifice at next upkeep" — the copy
      // target is the specific triggering permanent (Forge's own
      // `TriggeredCardLKICopy`), a real fact fixed at the moment of the
      // trigger, carried here via `triggerInput` the same way Kain's own
      // "that player"/"that much damage" and ninja-s-blades' own
      // `discardedCardManaValue` already are. The appended static ability
      // text ("equip abilities cost {2} less") has no way to attach to a
      // freshly created `TokenInfo` (no such field exists), and "sacrifice
      // at the beginning of the next upkeep" has no turn/phase tracking —
      // both real text only, not modeled.
      name: 'onEquipmentEnters',
      effects: [
        {
          kind: 'custom',
          describe:
            'create a token copy of the entering Equipment, except its equip abilities cost {2} less (not modeled); sacrifice that token at the beginning of the next upkeep (not modeled, no turn/phase tracking)',
          run: (ctx: EffectContext, actions: Actions) => {
            const name = (ctx.triggerInput?.equipmentName as string) ?? 'Equipment';
            actions.createToken(ctx.you, { name, manaCost: '0', types: ['Artifact', 'Equipment'], basePower: 0, baseToughness: 0 }, 1);
          },
        } satisfies Effect,
      ],
    },
  ],
};
