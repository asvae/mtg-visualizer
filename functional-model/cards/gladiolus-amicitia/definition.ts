import type { CardDefinition, Effect } from '../../card';

export const gladiolusAmicitia: CardDefinition = {
  name: 'Gladiolus Amicitia',
  manaCost: '{4}{R}{G}',
  typeLine: 'Legendary Creature — Human Warrior',

  pt: [6, 6],

  triggers: [
    {
      // "Search your library for a land card, put it onto the battlefield
      // tapped, then shuffle" — an unchosen search (601.2c, no stack
      // targeting), same `move` shape reach-the-horizon/prishe-s-
      // wanderings/sidequest-raise-a-chocobo already use for this exact
      // real Forge idiom. `move` has no `tapped` field (only `createToken`
      // does) so "tapped"/"then shuffle" are lost, same documentary-loss
      // class those cards already flag. No `PlayerState` field seeds a
      // land-typed library filler either (same real, untestable gap those
      // cards' own comments document) — this code is honest even though no
      // scenario below can make it actually find a match.
      name: 'onEnter',
      effects: [{ kind: 'move', owner: 'you', from: 'Library', to: 'Battlefield', qty: 1, validType: 'land' } satisfies Effect],
    },
    {
      // Landfall — "another target creature you control gets +2/+2 and
      // gains trample until end of turn." Two separate targeted effects
      // (`pumpTarget` has no P/T-plus-keyword combined shape) resolving
      // against the SAME deterministic candidate pool land on the same
      // creature in practice. Neither `pumpTarget` nor `grantKeywordTarget`
      // carries a `notSelf` field (unlike `pumpAll`/`putCounterAll`), so
      // "another" relies on `self` always being the LAST creature pushed
      // onto the battlefield array in a trigger scenario (harness.ts's own
      // `setupPlayer` runs before `self` is added) — a real, general
      // limitation of this model, not something this card works around.
      name: 'onLandfall',
      effects: [
        { kind: 'pumpTarget', power: 2, toughness: 2, owner: 'you' } satisfies Effect,
        { kind: 'grantKeywordTarget', keyword: 'Trample', owner: 'you' } satisfies Effect,
      ],
    },
  ],
};
