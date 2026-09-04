import type { CardDefinition, Effect } from '../../card';

// Real script (pupu_ufo.txt): Artifact Creature Construct Alien, Flying,
// with two independent activated abilities.
export const pupuUfo: CardDefinition = {
  name: 'PuPu UFO',
  manaCost: '{2}',
  typeLine: 'Artifact Creature — Construct Alien',

  pt: [0, 4],
  keywords: ['Flying'],

  abilities: [
    {
      // "You may put a land card from your hand onto the battlefield" —
      // real `Optional$ You`, documentary only (`move`'s own `optional`
      // field), same convention `move`'s own doc comment describes: no
      // player-decision engine exists here, so a legal land still gets put
      // onto the battlefield. No land-typed `PlayerState` hand filler
      // exists in this model (only `handCount`, generic untyped cards —
      // same real, untestable gap reach-the-horizon/gladiolus-amicitia's
      // own comments already document for a library-side land search).
      name: 'landDrop',
      cost: '{T}',
      effects: [{ kind: 'move', owner: 'you', from: 'Hand', to: 'Battlefield', qty: 1, validType: 'land', optional: true } satisfies Effect],
    },
    {
      // "Until end of turn, this creature's base power becomes equal to
      // the number of Towns you control." A real `AB$ Animate | Power$ X`
      // — a ONE-SHOT, temporary set from an ACTIVATED ability, not a
      // permanent CDA (`ptFormula` is fixed on the card definition itself
      // and always-on — snow-villiers' own real `CharacteristicDefining$
      // True` case — not something an ability effect can turn on
      // temporarily). No Effect kind anywhere sets a temporary P/T value
      // (only `pumpTarget`/`pumpSelf`'s fixed DELTAS, or the permanent
      // CDA) — real gap, kept as an honest no-op `custom` with the real
      // text carried via `describe`.
      name: 'becomePowerOfTowns',
      cost: '{3}',
      effects: [
        {
          kind: 'custom',
          describe: "until end of turn, this creature's base power becomes equal to the number of Towns you control (no temporary/until-end-of-turn set-power Effect shape exists here)",
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
