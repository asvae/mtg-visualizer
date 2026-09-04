import type { CardDefinition, Effect } from '../../card';

// Real script (terra_magical_adept_esper_terra.txt): a transforming DFC —
// front face has its OWN activated transform ability ("Trance"), same shape
// clive-ifrit-s-dominant-ifrit-warden-of-inferno already establishes (exile
// self, then return it, standing in for the real in-place `SetState`
// transform this model can't track).
//
// Real gap on the BACK face: Esper Terra's chapters I-III ("Create a token
// that's a copy of target nonlegendary enchantment you control...") need a
// real copy-a-permanent action. `interfaces.ts` declares `copyPermanent`,
// but it is NOT part of `card.ts`'s own `Actions` interface (nor
// `harness.ts`'s `loggingActions` implementation) — so no `custom` effect
// can actually call it (TypeScript has no `actions.copyPermanent` to call).
// Chapter IV ("Add {W}{W},{U}{U},{B}{B},{R}{R},{G}{G}. Exile Esper Terra,
// then return it...") needs mana production — an explicitly out-of-scope
// deliberate design boundary (no mana pool tracked anywhere). All four
// chapters are therefore omitted rather than partially modeled — same
// "no triggers at all rather than a partial, misleading representation"
// call clive-ifrit-s-dominant's own Ifrit, Warden of Inferno back face
// already makes. Flagged to the parent as a real gap (`copyPermanent` not
// wired into `Actions`), not invented around.
export const terraMagicalAdept: CardDefinition = {
  name: 'Terra, Magical Adept',
  manaCost: '{1}{R}{G}',
  typeLine: 'Legendary Creature — Human Wizard Warrior',

  pt: [4, 2],

  triggers: [
    {
      // "When Terra enters, mill five cards. Put up to one enchantment
      // milled this way into your hand." No `mill` Effect kind exists (and
      // `interfaces.ts`'s own `mill` helper, like `copyPermanent` above,
      // isn't wired into `Actions` either) — but the SAME real zone change
      // ("mill" = move the top N library cards to the graveyard, unchosen)
      // is exactly what the declarative `move` Effect already does
      // (Library -> Graveyard, no `target`). The second half needs the
      // SPECIFIC cards just milled (not a fresh graveyard-wide search,
      // which could wrongly grab an unrelated older graveyard card) and
      // `move`'s own `validType` has no 'enchantment' option — both reasons
      // this whole trigger is `custom`, chaining the real `actions.move`
      // return value into a follow-up `isEnchantment()` filter + `moveTo`.
      // NOTE: no `PlayerState` field can seed a typed (Enchantment)
      // LIBRARY card (every generic `libraryCount` filler is untyped) —
      // same unseedable-real-card gap summon-fenrir's own land-search
      // comment documents, so only the no-enchantment-milled branch is
      // scenario-testable.
      name: 'onEnter',
      effects: [
        {
          kind: 'custom',
          describe: 'mill five cards; put up to one enchantment milled this way into your hand',
          run: (ctx, actions) => {
            const milled = actions.move(ctx.you, 'Library', 'Graveyard', 5, 'any');
            const enchantment = milled.find((c) => c.isEnchantment());
            if (enchantment) actions.moveTo(enchantment, 'Hand');
          },
        } satisfies Effect,
      ],
    },
  ],

  activationCost: '{4}{R}{G}, {T} (activate only as a sorcery)',
  effects: [
    {
      kind: 'custom',
      describe: "exile Terra, then return it to the battlefield transformed under its owner's control",
      run: (ctx, actions) => {
        actions.moveTo(ctx.self, 'Exile');
        actions.moveTo(ctx.self, 'Battlefield');
      },
    } satisfies Effect,
  ],

  backFace: {
    name: 'Esper Terra',
    manaCost: '',
    typeLine: 'Legendary Enchantment Creature — Saga Wizard',

    pt: [6, 6],
    keywords: ['Flying'],
    // Chapters I-IV all real gaps — see this file's own header. No
    // `triggers` here rather than a partial, misleading representation.
  },
};
