import type { CardDefinition } from '../../card';

export const cavernOfSouls: CardDefinition = {
  name: 'Cavern of Souls',
  manaCost: '',
  typeLine: 'Land',

  // "As this land enters, choose a creature type" has no state anywhere to
  // remember the chosen type across future activations (no per-permanent
  // "chosen type" field on RealCard) — a real, separate, still-open gap
  // (ENGINE_GAPS.md's own "Non-basic mana sources" entry), stays static
  // text. The first mana ability (`{T}: Add {C}.`) is now a real, ordinary
  // `manaAbilities` entry; the second (`{T}: Add one mana of any color.
  // Spend this mana only to cast a creature spell of the chosen type...`)
  // is real, typed, but deliberately UNPAYABLE — its own `restriction`
  // (real Forge `RestrictValid$ Spell.Creature+ChosenType`) is honestly
  // present, never enforced (no spendable mana-pool mechanism exists to
  // check it against, `mana.ts`'s own header).
  staticAbilities: ['As this land enters, choose a creature type.'],
  manaAbilities: [
    { colors: ['C'] },
    { colors: ['W', 'U', 'B', 'R', 'G'], restriction: "Spend this mana only to cast a creature spell of the chosen type, and that spell can't be countered." },
  ],
};
