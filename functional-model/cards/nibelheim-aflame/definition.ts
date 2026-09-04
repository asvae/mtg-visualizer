import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const nibelheimAflame: CardDefinition = {
  name: 'Nibelheim Aflame',
  manaCost: '{2}{R}{R}',
  typeLine: 'Sorcery',

  alternateCosts: [{ name: 'Flashback', cost: '{5}{R}{R}', from: 'graveyard', thenExile: true }],

  effects: [
    {
      // "Choose target creature you control. It deals damage equal to its
      // power to each other creature" — no declarative Effect kind can
      // express "damage sourced from a runtime-CHOSEN target's own power,"
      // since a later effect has no way to read an earlier effect's chosen
      // target. `custom`, picking the target then reading its real
      // `getNetPower()` before looping `dealDamage` over every other
      // creature, is the honest shape — same "read a chosen target's own
      // live stat" pattern relm-s-sketching's own copy effect already
      // establishes.
      kind: 'custom',
      describe: 'choose target creature you control; it deals damage equal to its power to each other creature',
      run: (ctx: EffectContext, actions: Actions) => {
        const pool = ctx.you.getCreaturesInPlay();
        if (pool.length === 0) return;
        const source = actions.chooseTarget(pool);
        const power = source.getNetPower();
        const others = [...ctx.you.getCreaturesInPlay(), ...ctx.opponents.flatMap((p) => p.getCreaturesInPlay())].filter((c) => c.getId() !== source.getId());
        for (const other of others) actions.dealDamage(source, other, power);
      },
    } satisfies Effect,
    // "If this spell was cast from a graveyard, discard your hand and draw
    // four cards" — real `ctx.castFrom` (a fixed, scenario-supplied fact,
    // same field `lifecycleAfter` in harness.ts reads for the spell's own
    // post-resolution zone) gates both via `Computed`. "Discard your hand"
    // reads the real live hand size off `ctx.you` rather than guessing a
    // fixed number.
    { kind: 'discard', owner: 'you', qty: (ctx: EffectContext) => (ctx.castFrom === 'graveyard' ? ctx.you.getCardsIn('Hand').length : 0) } satisfies Effect,
    { kind: 'drawCard', amount: (ctx: EffectContext) => (ctx.castFrom === 'graveyard' ? 4 : 0) } satisfies Effect,
  ],
};
