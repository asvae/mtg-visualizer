import type { CardDefinition, Effect } from '../../card';

// Real script (ultimecia_time_sorceress_ultimecia_omnipotent.txt): a
// transforming DFC, same `SetState | Mode$ Transform` shape (exile-then-
// return standing in for it) serah-farron/terra-magical-adept already use.
export const ultimeciaTimeSorceress: CardDefinition = {
  name: 'Ultimecia, Time Sorceress',
  manaCost: '{3}{U}{B}',
  typeLine: 'Legendary Creature — Human Warlock',

  pt: [4, 5],

  triggers: [
    { name: 'onEnterOrAttacks', effects: [{ kind: 'surveil', qty: 2 } satisfies Effect] },
    {
      // "At the beginning of your end step, you may pay {4}{U}{U}{B}{B}
      // and exile eight cards from your graveyard. If you do, transform
      // NICKNAME." The mana payment is documentary-only text (same
      // convention every activation-cost mana string already gets — no
      // field anywhere tracks a mana pool); exiling eight graveyard cards
      // is a real, observable zone change, modeled with the declarative
      // batch `move`. The transform itself is the same exile-then-return
      // approximation this file's own header describes.
      name: 'onEndStep',
      effects: [
        { kind: 'move', owner: 'you', from: 'Graveyard', to: 'Exile', qty: 8, validType: 'any' } satisfies Effect,
        {
          kind: 'custom',
          describe: 'pay {4}{U}{U}{B}{B}; transform Ultimecia into Ultimecia, Omnipotent',
          run: (ctx, actions) => {
            actions.moveTo(ctx.self, 'Exile');
            actions.moveTo(ctx.self, 'Battlefield');
          },
        } satisfies Effect,
      ],
    },
  ],

  backFace: {
    name: 'Ultimecia, Omnipotent',
    manaCost: '',
    typeLine: 'Legendary Creature — Nightmare Warlock',

    pt: [7, 7],
    keywords: ['Menace'],
    // "Time Compression — When this creature transforms into CARDNAME,
    // take an extra turn after this one." No `Effect` kind exists anywhere
    // for "take an extra turn" (`interfaces.ts` has no such action either,
    // real or convenience) — genuinely out of scope. No `triggers` here
    // rather than a fabricated workaround; flagged to the parent as a gap.
  },
};
