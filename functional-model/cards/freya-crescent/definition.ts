import type { CardDefinition } from '../../card';

// "Jump — During your turn, Freya Crescent has flying." — real Forge
// implements this as a CONDITIONAL static grant (`S:Mode$ Continuous |
// Condition$ PlayerTurn | AddKeyword$ Flying`), not a base `K:` line —
// same "Jump" shape card.ts's own `staticAbilities` doc comment already
// cites Kain, Traitorous Dragoon for (a granted static buff, not an
// always-on keyword), so this is text, not `keywords: ['Flying']`.
//
// "{T}: Add {R}. Spend this mana only to cast an Equipment spell or
// activate an equip ability." — real Forge citation:
// `res/cardsfolder/f/freya_crescent.txt` (`A:AB$ Mana | Cost$ T |
// Produced$ R | RestrictValid$ Spell.Equipment,Activated.Equip`). Now a
// real, structured `manaAbilities` entry (2026-09-14, ENGINE_GAPS.md gap
// #5) — upgraded from being omitted ENTIRELY (this comment used to say so)
// to genuinely present, typed data; its own real `restriction` stays
// honestly UNENFORCED, same reasoning Cargo Ship's own identically-shaped
// restricted mana ability already documents in full (no spendable
// mana-pool mechanism exists anywhere in this engine to check what a
// tapped source's mana later gets spent on).
export const freyaCrescent: CardDefinition = {
  name: 'Freya Crescent',
  manaCost: '{R}',
  typeLine: 'Legendary Creature — Rat Knight',

  pt: [1, 1],
  staticAbilities: ['Jump — During your turn, Freya Crescent has flying.'],
  manaAbilities: [{ colors: ['R'], restriction: 'Spend this mana only to cast an Equipment spell or activate an equip ability.' }],
};
