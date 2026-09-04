import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const fromFatherToSon: CardDefinition = {
  name: 'From Father to Son',
  manaCost: '{1}{W}',
  typeLine: 'Sorcery',

  alternateCosts: [{ name: 'Flashback', cost: '{4}{W}{W}{W}', from: 'graveyard', thenExile: true }],

  effects: [
    {
      // Destination depends on `castFrom` (Hand -> Hand, graveyard/
      // Flashback -> Battlefield directly) — the declarative `move` kind
      // has one fixed `to`, no branch on how the card itself was cast, so
      // this genuinely needs `custom`'s access to `ctx.castFrom` (the same
      // real, scenario-supplied fact `lifecycleAfter` in harness.ts already
      // reads to decide graveyard-vs-exile for the spell itself).
      //
      // "Vehicle card" — no Vehicle-subtype tracking exists on a generic
      // library card (state.ts's RealCard has a bare `subtypes` string
      // array with no scenario-facing way to populate it for a Library
      // card), so narrowed to `isArtifact()` as the closest honest match —
      // same "Equipment ⊂ Artifact" narrowing cloud-midgar-mercenary's own
      // comment already documents for its own search effect (a Vehicle is
      // always an Artifact too). "Then shuffle" has no observable
      // consequence anything downstream reads, so it's not modeled.
      kind: 'custom',
      describe:
        'search your library for a Vehicle card and put it into your hand, or onto the battlefield instead if this spell was cast from a graveyard; then shuffle',
      run: (ctx: EffectContext, actions: Actions) => {
        const pool = ctx.you.getCardsIn('Library').filter((c) => c.isArtifact());
        if (pool.length === 0) return;
        const target = actions.chooseTarget(pool);
        actions.moveTo(target, ctx.castFrom === 'graveyard' ? 'Battlefield' : 'Hand');
      },
    } satisfies Effect,
  ],
};
