import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const stolenUniform: CardDefinition = {
  name: 'Stolen Uniform',
  manaCost: '{U}',
  typeLine: 'Instant',

  // Two independent targets (a creature you control AND an Equipment,
  // which can belong to anyone), then chained gainControl+equip against
  // the SAME chosen Equipment — no single declarative Effect kind covers
  // "gain control of one chosen permanent, then attach it to a different
  // chosen permanent," so `custom`, built entirely out of existing
  // `chooseTarget`/`gainControl`/`equip` actions — both real, mechanically
  // wired (`state.ts`'s `RealPlayer.gainControl`/`RealCard.attachedToId`
  // mutation via `interfaces.ts`'s real `gainControl`/`equip` signatures)
  // and, as of this migration, both real, matchable `Fact` vocabulary too
  // (`event:'gainControl'` promoted 2026-09-12 for Stiltzkin, Moogle
  // Merchant/fin-34; `event:'equip'` promoted the same day for THIS card,
  // scripts/verify-synergy.mjs's own `producedEvents` — previously parked).
  // `gainControl`'s own "until end of turn" is a REAL CR duration (the
  // fact's own `untilEndOfTurn: true`, purely documentary) but this engine
  // has no control-reversion mechanism at all — `state.ts`'s `gainControl`
  // is a one-way, permanent-within-scenario reassignment (same
  // simplification zidane-tantalus-thief's/unexpected-request's own
  // identical "until end of turn" gainControl effects already document).
  // The delayed "when you lose control of that Equipment this turn...
  // unattach it" trigger has no `unattach`/detach action anywhere in this
  // model (`equip` only ever attaches, never detaches) AND no delayed-
  // trigger-on-control-loss mechanism exists (`turn.ts`'s only delayed-
  // trigger scheduling is `delayUntil`, keyed on phase/step boundaries, not
  // on a `gainControl` event) — genuinely unmodeled, left undocumented in
  // code beyond `describe` and this comment, same "genuinely out of scope"
  // treatment sidequest-catch-a-fish-cooking-campsite's own mana-ability
  // comment gives a different unreachable mechanic.
  effects: [
    {
      kind: 'custom',
      describe:
        "choose target creature you control and target Equipment; gain control of that Equipment until end of turn and attach it to the chosen creature (the end-of-turn control-revert and unattach delayed trigger aren't modeled — no such mechanism exists in this engine)",
      run: (ctx: EffectContext, actions: Actions) => {
        const creatureTarget = actions.chooseTarget(ctx.you.getCreaturesInPlay());
        const equipmentPool = [...ctx.you.getCardsIn('Battlefield'), ...ctx.opponents.flatMap((p) => p.getCardsIn('Battlefield'))].filter((c) =>
          c.hasSubtype('Equipment')
        );
        const equipmentTarget = actions.chooseTarget(equipmentPool);
        if (!equipmentTarget) return;
        actions.gainControl(ctx.you, equipmentTarget);
        if (creatureTarget) actions.equip(equipmentTarget, creatureTarget);
      },
    } satisfies Effect,
  ],
};
