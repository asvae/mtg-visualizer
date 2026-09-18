import type { CardDefinition, Effect } from '../../card';

export const zulAshurLichLord: CardDefinition = {
  name: 'Zul Ashur, Lich Lord',
  manaCost: '{1}{B}',
  typeLine: 'Legendary Creature — Zombie Warlock',
  pt: [2, 2],

  // Real "Ward—Pay 2 life." `Ward` in this model's `Keyword` union is a
  // bare literal with no cost payload — recognized-but-inert (the specific
  // cost isn't tracked, no counterspell-trigger machinery exists to
  // enforce it), same established convention raubahn-bull-of-ala-mhigo's
  // own definition.ts already documents for an identical "Ward—Pay life
  // equal to..." clause. Also declared via `staticAbilities` below (added
  // 2026-09-18, sire-of-seven-deaths' own sweep) so this specific
  // non-default-cost gap is a real, gate-visible `reasons` entry, not only
  // a comment — this card was already `purple` for the unrelated MayPlay
  // gap below, so this had no VISIBLE effect on its status before now, but
  // would have silently gone unrecorded if that other gap were ever
  // closed first.
  keywords: ['Ward'],
  staticAbilities: ['Ward—Pay 2 life. (the "pay 2 life" cost specifically — not the base Ward keyword fact, already tracked above)'],

  abilities: [
    {
      name: 'castFromGraveyard',
      cost: '{T}',
      effects: [
        {
          // Real Forge: `AB$ Effect | Cost$ T | ... | MayPlay$ True |
          // AffectedZone$ Graveyard` — a temporary, standing "you may cast
          // this specific card from your graveyard this turn" PERMISSION
          // grant. `interfaces.ts`'s own `play()` is a real, but narrower,
          // primitive tied specifically to `EffectContext.topLibraryCard`/
          // the library-top special action (see that function's own doc
          // comment) — not a generic MayPlay grant. No mechanism anywhere
          // in this engine defers "you may cast this card later this turn,
          // on demand" (a real stack-interaction + mana-payment decision
          // deferred to a LATER point in the turn). GENUINE CAPACITY GAP —
          // documented no-op placeholder, not folded into `play()`.
          kind: 'custom',
          describe:
            'you may cast target Zombie creature card from your graveyard this turn (no MayPlay/standing-permission mechanic exists anywhere in this engine)',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
