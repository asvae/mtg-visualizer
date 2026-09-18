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
  // equal to..." clause.
  keywords: ['Ward'],

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
