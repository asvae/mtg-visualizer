import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const zackFair: CardDefinition = {
  name: 'Zack Fair',
  manaCost: '{W}',
  typeLine: 'Legendary Creature — Human Soldier',

  pt: [0, 1],

  // Real `K:etbCounter:P1P1:1` — semantically an ETB trigger (enters with a
  // +1/+1 counter already on it), modeled as a named `onEnter` trigger
  // rather than the top-level `effects` field so that field stays free for
  // this card's own activated ability below (same
  // trigger-for-ETB/effects-for-the-activated-ability split dragoon-s-lance/
  // paladin-s-arms/machinist-s-arsenal already use for their own Job select
  // ETB + separate Equip ability).
  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'putCounter', target: 'self', counterType: '+1/+1', amount: 1 } satisfies Effect],
    },
  ],

  // "{1}, Sacrifice Zack Fair: ..." — the sacrifice is part of the COST
  // (paid before the ability resolves), folded into `activationCost` text,
  // same convention phoenix-down's own "Exile this artifact" cost uses.
  activationCost: '{1}, Sacrifice Zack Fair',
  effects: [
    {
      kind: 'custom',
      describe:
        "target creature you control gains indestructible until end of turn; put Zack Fair's counters on that creature; attach an Equipment that was attached to Zack Fair to that creature",
      run: (ctx: EffectContext, actions: Actions) => {
        const pool = ctx.you.getCreaturesInPlay().filter((c) => c.getId() !== ctx.self.getId());
        if (pool.length === 0) return;
        const target = actions.chooseTarget(pool);
        const amount = ctx.self.getCounters('+1/+1');
        if (amount > 0) actions.putCounter(target, '+1/+1', amount);
        // "gains indestructible until end of turn" — no keyword-grant
        // Effect shape exists yet (same known, already-flagged gap
        // Moogles' Valor/Dion, Bahamut's Dominant/Restoration Magic all
        // hit) — real text only (see this effect's own `describe`), not
        // mechanically enforced.
        // "attach an Equipment that was attached to Zack Fair to that
        // creature" — `RealCard.attachedToId` (state.ts) only tracks the
        // EQUIPMENT's own forward link to its target, one-directionally;
        // nothing exposes a reverse "what's attached to THIS card" lookup
        // on the `Card` interface, so there is no way to find "an Equipment
        // that was attached to Zack Fair" from here — real text only, not
        // modeled.
      },
    } satisfies Effect,
  ],
};
