import type { CardDefinition, Effect, EffectContext } from '../../card';

// Real script (deadly_embrace.txt): "Destroy target creature an opponent
// controls. Then draw a card for each creature that died this turn" — the
// destroy is plain declarative `destroy` (owner: 'opponents' for the real
// `ValidTgts$ Creature.OppCtrl` restriction, same fix `dealDamageTarget`'s
// own doc comment already documents). The real `SVar:X:Count$
// ThisTurnEntered_Graveyard_from_Battlefield_Creature` has no equivalent
// anywhere in this model — no per-turn event history is tracked at all
// (state.ts's own header rules out anything beyond real zone/counter/
// control mutation). Approximated instead as the creature-card count
// across EVERY graveyard at the moment this second effect reads it — since
// effects resolve in order, that count already includes the creature this
// same spell just destroyed (matching Forge's real SubAbility ordering),
// plus whatever a scenario's own `graveyardCreatureCount` seeds as
// "already died" for test purposes (a fresh scenario has no prior turn to
// distinguish from "this turn" anyway) — same "count now, not literally
// this-turn" approximation summon-esper-ramuh's/cloud-of-darkness's own
// graveyard-count `Computed` functions already use for an identical
// per-turn-history gap.
export const deadlyEmbrace: CardDefinition = {
  name: 'Deadly Embrace',
  manaCost: '{3}{B}{B}',
  typeLine: 'Sorcery',

  effects: [
    { kind: 'destroy', validType: 'creature', owner: 'opponents', qty: 1 } satisfies Effect,
    {
      kind: 'drawCard',
      amount: (ctx: EffectContext) => [...ctx.you.getCardsIn('Graveyard'), ...ctx.opponents.flatMap((p) => p.getCardsIn('Graveyard'))].filter((c) => c.isCreature()).length,
    } satisfies Effect,
  ],
};
