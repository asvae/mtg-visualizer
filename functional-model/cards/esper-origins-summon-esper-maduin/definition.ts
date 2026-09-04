import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// A transforming DFC whose FRONT face is a Sorcery with Flashback and whose
// BACK face is a Saga — same `backFace` shape jecht-reluctant-guardian-
// braska-s-final-aeon's own front/back split already establishes, chapter
// abilities modeled as that face's own `triggers` (same 714.3a/b
// turn-based-action-as-trigger simplification documented there).
export const esperOriginsSummonEsperMaduin: CardDefinition = {
  name: 'Esper Origins',
  manaCost: '{1}{G}',
  typeLine: 'Sorcery',

  alternateCosts: [{ name: 'Flashback', cost: '{3}{G}', from: 'graveyard', thenExile: true }],

  effects: [
    { kind: 'surveil', qty: 2 } satisfies Effect,
    { kind: 'gainLife', amount: 2 } satisfies Effect,
    {
      // "If this spell was cast from a graveyard, exile it, then put it
      // onto the battlefield transformed under its owner's control with a
      // finality counter on it" — same self-only exile-then-return shape
      // jecht-reluctant-guardian's own front face uses, gated on the real
      // `ctx.castFrom` fact (same gate nibelheim-aflame's own Flashback
      // check already uses). NOTE: this card is an Instant/Sorcery, so
      // harness.ts's own `lifecycleAfter` unconditionally moves `self` to
      // Exile AFTER these effects run (real Flashback's own `thenExile`) —
      // it runs a SECOND time after this effect's own `moveTo(Battlefield)`,
      // so the scenario's final tracked zone ends up Exile, not Battlefield,
      // even though the full sequence (exile -> enters battlefield -> move
      // to exile) is genuinely logged. A known harness limitation for a
      // sorcery that tries to end up somewhere other than its own
      // post-resolution zone, not something this card's own definition can
      // route around.
      kind: 'custom',
      describe: "if this spell was cast from a graveyard, exile it, then put it onto the battlefield transformed under its owner's control with a finality counter on it",
      run: (ctx: EffectContext, actions: Actions) => {
        if (ctx.castFrom !== 'graveyard') return;
        actions.moveTo(ctx.self, 'Exile');
        actions.moveTo(ctx.self, 'Battlefield');
        actions.putCounter(ctx.self, 'finality', 1);
      },
    } satisfies Effect,
  ],

  backFace: {
    name: 'Summon: Esper Maduin',
    manaCost: '',
    typeLine: 'Enchantment Creature — Saga Elemental',
    pt: [4, 4],
    triggers: [
      {
        name: 'chapterI',
        effects: [
          // "Reveal the top card of your library. If it's a permanent
          // card, put it into your hand." `dig`'s own `validType` union has
          // no "permanent" predicate (only 'artifact'/'any' — same gap
          // commune-with-beavers documents) — 'any' is the closest fit but
          // over-broadens (a real nonpermanent top card would also be taken
          // here, which the printed text excludes).
          { kind: 'dig', qty: 1, take: 1, validType: 'any' } satisfies Effect,
        ],
      },
      {
        name: 'chapterII',
        effects: [
          {
            // "Add {G}{G}" — a real mana ability; no Effect kind (nor any
            // action in interfaces.ts) models mana production anywhere in
            // this system, same deliberate boundary white-auracite/cargo-
            // ship already document. No-op custom purely so synergyTags()
            // still records the real text.
            kind: 'custom',
            describe: 'add {G}{G}',
            run: () => {},
          } satisfies Effect,
        ],
      },
      {
        name: 'chapterIII',
        effects: [
          { kind: 'pumpAll', predicate: 'creatures-you-control', power: 2, toughness: 2, notSelf: true } satisfies Effect,
          { kind: 'grantKeywordAll', predicate: 'creatures-you-control', keyword: 'Trample', notSelf: true } satisfies Effect,
        ],
      },
    ],
  },
};
