import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

function damageAll(amount: number): Effect {
  // "deals N damage to each creature" — no Effect kind covers a board-wide
  // damage sweep to every creature regardless of controller (`dealDamage`
  // only targets a GROUP OF PLAYERS, `dealDamageTarget` only a single
  // chosen creature) — `custom`, looping the real battlefield pool and
  // calling the real `dealDamage` action per creature, same shape summon-
  // leviathan's own chapterI batch-bounce loop already uses for "no
  // matching declarative kind, real actions, narrow scope."
  return {
    kind: 'custom',
    describe: `deals ${amount} damage to each creature`,
    run: (ctx: EffectContext, actions: Actions) => {
      const all = [...ctx.you.getCreaturesInPlay(), ...ctx.opponents.flatMap((p) => p.getCreaturesInPlay())];
      for (const creature of all) actions.dealDamage(ctx.self, creature, amount);
    },
  };
}

// "Tiered" (choose one additional cost) maps directly onto the real
// "choose one —" `modal` shape battle-menu's own Charm already uses — each
// tier is a real, mutually exclusive branch, same as a modal spell's own
// modes. "Tiered" itself isn't a recognized `Keyword` (not a real,
// resolution-affecting keyword like Flying/Lifelink), so it stays
// implicit in each mode's own `describe` rather than added to `keywords`.
export const fireMagic: CardDefinition = {
  name: 'Fire Magic',
  manaCost: '{R}',
  typeLine: 'Instant',

  effects: [
    {
      kind: 'modal',
      modes: [
        { describe: 'Fire — {0} — Fire Magic deals 1 damage to each creature.', effects: [damageAll(1)] },
        { describe: 'Fira — {2} — Fire Magic deals 2 damage to each creature.', effects: [damageAll(2)] },
        { describe: 'Firaga — {5} — Fire Magic deals 3 damage to each creature.', effects: [damageAll(3)] },
      ],
    } satisfies Effect,
  ],
};
