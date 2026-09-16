import type { CardDefinition, Effect } from '../../card';

// Real Forge (`res/cardsfolder/p/phoenix_down.txt`):
//   SVar:DBReturn:DB$ ChangeZone | Origin$ Graveyard | Destination$
//     Battlefield | ValidTgts$ Creature.cmcLE4+YouOwn | Tapped$ True
//   SVar:DBExile:DB$ ChangeZone | ValidTgts$ Skeleton,Spirit,Zombie |
//     Origin$ Battlefield | Destination$ Exile
// Confirmed via `forge-lookup.mjs` before migrating (both the real Forge
// script and XMage's `PhoenixDown.java`, which corroborates: mode 1 is a
// `cmcLE4`+`YouOwn` graveyard filter entering tapped, mode 2's
// `TargetPermanent` filter carries no owner restriction at all — any
// player's Skeleton/Spirit/Zombie is legal).
// MIGRATED (2026-09-16) off both `kind:'custom'` closures onto the
// declarative `move` Effect kind, using engine-core's now-real `maxCmc`
// (already existed, just unused here), `tapped` on a TARGETED move (a real
// bug fix this same pass — was previously only applied on the untargeted
// branch), and `move.subtype`'s widened `string[]` OR-match (built
// specifically for this card's own "Skeleton, Spirit, or Zombie" union).
export const phoenixDown: CardDefinition = {
  name: 'Phoenix Down',
  manaCost: '{W}',
  typeLine: 'Artifact',

  // {1}{W}, {T}, Exile this artifact: Choose one — the tap+self-exile are
  // both COSTS (paid before the ability resolves), not effects, so they
  // stay text on `activationCost` (same convention Paladin's Arms/
  // dragoon-s-lance already use for a tap/mana-only cost).
  activationCost: '{1}{W}, {T}, Exile this artifact',
  effects: [
    {
      kind: 'modal',
      modes: [
        {
          describe: 'return target creature card with mana value 4 or less from your graveyard to the battlefield tapped',
          // Formerly `// recognizer-exception: move-effect-structural` here
          // (that recognizer's own `owner:'you'` template used to always
          // mean "<type> YOU CONTROL," a control-based restriction that
          // never matched this mode's real "from YOUR graveyard" — a
          // zone-scoping clause, not a control suffix). CLOSED 2026-09-16:
          // `move-effect-structural.ts` gained a narrow, confirmed "from
          // your graveyard" template (plus a `maxCmc` qualifier and a
          // card-vs-permanent terminology fix) for exactly this real
          // combination — this mode's own SOURCE fact and its companion
          // Graveyard SINK fact are now both recognizer-provenanced. Marker
          // removed; no longer applicable.
          effects: [
            {
              kind: 'move',
              owner: 'you',
              from: 'Graveyard',
              to: 'Battlefield',
              qty: 1,
              validType: 'creature',
              maxCmc: 4,
              tapped: true,
              target: true,
            } satisfies Effect,
          ],
        },
        {
          // No owner restriction on the real `ValidTgts$
          // Skeleton,Spirit,Zombie` — any player's matching permanent is a
          // legal target, so `owner` is omitted (defaults to `'each'`).
          describe: 'exile target Skeleton, Spirit, or Zombie',
          effects: [
            {
              kind: 'move',
              from: 'Battlefield',
              to: 'Exile',
              qty: 1,
              subtype: ['Skeleton', 'Spirit', 'Zombie'],
              target: true,
            } satisfies Effect,
          ],
        },
      ],
    } satisfies Effect,
  ],
};
