import type { CardDefinition, Effect } from '../../card';

export const deliveryMoogle: CardDefinition = {
  name: 'Delivery Moogle',
  manaCost: '{3}{W}',
  typeLine: 'Creature — Moogle',

  keywords: ['Flying'],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          // "Search your library and/or graveyard for an artifact card with
          // mana value 2 or less, reveal it, and put it into your hand"
          // (real Forge dual-`Origin` shape, `Origin$ Library |
          // OriginAlternative$ Graveyard`) — MIGRATED (2026-09-15) off a
          // `kind:'custom'` closure onto the real declarative `move` kind,
          // now that `from` accepts `ZoneType[]` and a new `maxCmc` field
          // exists (both added this same pass — see `card.ts`'s own
          // `move` doc comments for the full real motivation/citation;
          // this was the one real card in the whole pool forcing both
          // additions, checked directly). ONE combined pool across BOTH
          // zones (never one pick per zone — CR 701.19 makes no
          // distinction between them once both are eligible), same real
          // primitive (`getCardsIn`) the old closure already used, now
          // expressed as plain data instead of an opaque closure (per
          // this pool's own "combinator/data-shaped, not raw closures"
          // authoring default) — no `custom`/`program` needed at all,
          // since `move`'s own existing declarative vocabulary (widened
          // this pass) already covers this shape exactly.
          //
          // `shuffleAfter: true` (2026-09-15) — the OLD closure never
          // modeled "then shuffle" at all (a real, silent omission, not a
          // deliberate decision — no comment ever justified dropping it).
          // Real CR 701.19 requires shuffling after a library search;
          // since this model has no "which zone did the chosen card
          // actually come from" granularity below the combined-pool level
          // (same ceiling every other library-search card in this pool
          // already lives with), this sets the same unconditional
          // `shuffleAfter` every single-zone library search in this pool
          // already uses (Cloudbound Moogle's own Plainscycling, e.g.) —
          // the closest real approximation of "if you search your library
          // this way, shuffle" this model can express.
          kind: 'move',
          owner: 'you',
          from: ['Library', 'Graveyard'],
          to: 'Hand',
          qty: 1,
          validType: 'artifact',
          maxCmc: 2,
          shuffleAfter: true,
        } satisfies Effect,
      ],
    },
  ],
};
