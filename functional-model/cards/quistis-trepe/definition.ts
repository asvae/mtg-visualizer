import type { CardDefinition, Effect } from '../../card';

// Real Forge script (../mtg-forge/forge-gui/res/cardsfolder/q/
// quistis_trepe.txt): `T:Mode$ ChangesZone | Origin$ Any | Destination$
// Battlefield | ValidCard$ Card.Self | Execute$ TrigPlay | ...`, `SVar:
// TrigPlay:DB$ Play | TgtZone$ Graveyard | ValidTgts$ Instant,Sorcery |
// ValidSA$ Spell | ... | ManaConversion$ AnyType->AnyType | Optional$ True |
// ReplaceGraveyard$ Exile | AILogic$ ReplaySpell`. Oracle (data/fin/
// fin_scryfall.json, fin/66, matches): "Blue Magic — When Quistis Trepe
// enters, you may cast target instant or sorcery card from a graveyard,
// and mana of any type can be spent to cast that spell. If that spell
// would be put into a graveyard, exile it instead." "Blue Magic" is an
// ABILITY WORD here (no `K:` line in the real script, no separate rules
// meaning of its own), not a real keyword ability — same "not every
// printed capitalized phrase is `CardDefinition.keywords`" treatment
// Rydia, Summoner of Mist's own "Landfall —" and Seifer Almasy's own "Fire
// Cross —" already get (neither is declared as a keyword either).
//
// The real ETB IS a genuine, structured trigger (`on: 'enter'`, same
// convention `cloud-midgar-mercenary`/`dragoon-s-wyvern` already
// establish) — but its own EFFECT ("cast TARGET instant or sorcery card
// FROM A GRAVEYARD," an arbitrary, player-chosen OTHER card, not this
// permanent's own alternate-cost self-cast) hits the exact same wall
// `seifer-almasy/definition.ts`'s own Fire Cross clause already documents
// and declines for the identical real reason: "no Actions member anywhere
// (this model's `Actions` interface, card.ts) can resolve/'cast' an
// arbitrary chosen CardDefinition" — `interfaces.ts`'s own `play()` isn't
// threaded through `Actions` at all (`Actions.play` — the ONE existing
// cast-adjacent primitive — only ever dispatches on the CALLER-SUPPLIED
// `ctx.topLibraryCard`/`declaredTarget`-shaped "the card IS this specific
// known object," `engine.ts`'s own `playFromLibraryTop`; there's still no
// generalized "resolve THIS arbitrary chosen `CardDefinition` right now"
// primitive an effect could call for a player-chosen graveyard card).
// `noctis-prince-of-lucis/definition.ts`'s own near-identical "cast
// artifact spells from your graveyard" static permission independently
// confirms this is a real, repeated gap in this pool, not a one-off. The
// "mana of any type can be spent to cast that spell" (`ManaConversion$
// AnyType->AnyType`) and "exile instead of graveyard" (`ReplaceGraveyard$
// Exile`) clauses are real too, but both only ever matter for PAYING/
// resolving that same uncastable arbitrary spell — moot once the cast
// itself can't happen. Kept as a `custom` no-op purely so `synergyTags()`
// still sees the real text, same "described but not executed" treatment
// Seifer Almasy's and Noctis's own clauses already get.
export const quistisTrepe: CardDefinition = {
  name: 'Quistis Trepe',
  manaCost: '{2}{U}',
  typeLine: 'Legendary Creature — Human Wizard',

  pt: [2, 2],

  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'custom',
          describe:
            'Blue Magic — when this enters, you may cast target instant or sorcery card from a graveyard, and mana of any type can be spent to cast that spell; if that spell would be put into a graveyard, exile it instead — not mechanically enforced, no action anywhere in this model can resolve an arbitrary chosen other card',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],
};
