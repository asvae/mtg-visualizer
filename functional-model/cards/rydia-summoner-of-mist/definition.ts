import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (rydia_summoner_of_mist.txt): Landfall trigger + one
// activated ability ("Summon — {X}, {T}: ...") — the common single-ability
// shape (`activationCost`+`effects`), not `abilities` (that's only for 2+
// independent activated abilities).
export const rydiaSummonerOfMist: CardDefinition = {
  name: 'Rydia, Summoner of Mist',
  manaCost: '{R}{G}',
  typeLine: 'Legendary Creature — Human Shaman',

  pt: [1, 2],

  triggers: [
    {
      // "Landfall — Whenever a land you control enters, you may discard a
      // card. If you do, draw a card." Real `AB$ Draw | Cost$ Discard<1/Card>`
      // — the discard IS the draw's own cost, not two independent effects,
      // but this model has no "cost tied to an optional draw" shape; same
      // documentary-only "may... if you do" convention rook-turret's own
      // draw+discard ("Loot") pair already uses — a legal discard/draw
      // always happens once this trigger fires.
      name: 'onLandfall',
      effects: [{ kind: 'discard', owner: 'you', qty: 1 } satisfies Effect, { kind: 'drawCard' } satisfies Effect],
    },
  ],

  // "Summon — {X}, {T}: Return target Saga card with mana value X from your
  // graveyard to the battlefield with a finality counter on it. It gains
  // haste until end of turn. Activate only as a sorcery." `move`'s own
  // declarative `validType` has no Saga-subtype/cmc-match filter, and
  // putting a counter on the SPECIFIC card just returned (not a separately
  // re-chosen target) needs the same object reference threaded through —
  // `custom`, reading the real `ctx.xPaid` and calling `chooseTarget`/
  // `moveTo`/`putCounter`/`grantKeyword` on that one object, is the honest
  // shape (mirrors magitek-infantry's own named-card-search custom).
  // NOTE: no `PlayerState` field can seed a Saga-subtype graveyard card at
  // any mana value (every generic `graveyardCreatureCount` filler is a
  // bare `types: ['Creature']`, subtype-less) — same unseedable-real-card
  // gap summon-fenrir's own land-search comment documents, so only the
  // no-legal-target branch is scenario-testable.
  activationCost: '{X}, {T} (activate only as a sorcery)',
  effects: [
    {
      kind: 'custom',
      describe: 'return target Saga card with mana value X from your graveyard to the battlefield with a finality counter on it; it gains haste until end of turn',
      run: (ctx: EffectContext, actions: Actions) => {
        const x = ctx.xPaid ?? 0;
        const pool = ctx.you.getCardsIn('Graveyard').filter((c) => c.hasSubtype('Saga') && c.getCMC() === x);
        if (pool.length === 0) return;
        const target = actions.chooseTarget(pool);
        actions.moveTo(target, 'Battlefield');
        actions.putCounter(target, 'FINALITY', 1);
        actions.grantKeyword(target, 'Haste');
      },
    } satisfies Effect,
  ],
};
