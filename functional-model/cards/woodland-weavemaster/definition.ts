import type { CardDefinition, Effect } from '../../card';

export const woodlandWeavemaster: CardDefinition = {
  name: 'Woodland Weavemaster',
  manaCost: '{1}{G}',
  typeLine: 'Creature — Elf Druid',
  pt: [1, 2],
  keywords: ['Vigilance'],

  triggers: [
    {
      name: 'onOtherElfEnters',
      effects: [{ kind: 'pumpSelf', power: 1, toughness: 1 } satisfies Effect],
    },
  ],

  // Real Forge citation: `res/cardsfolder/w/woodland_weavemaster.txt`
  // (`A:AB$ Mana | Cost$ T | Produced$ Any | Amount$ X | RestrictValid$
  // Spell.Elf,Activated.Elf`, `SVar:X:Count$CardPower`) — now a real,
  // structured `manaAbilities` entry (2026-09-14, ENGINE_GAPS.md gap #5),
  // genuinely typed (`variableAmount: {kind:'selfPower'}` mirrors Forge's
  // own `Count$CardPower` formula, distinct from Elvish Archdruid's
  // `Count$Valid <Subtype>.YouCtrl` board-count shape) rather than opaque
  // free text. Deliberately NOT wired into `mana.ts`'s `canAfford`/
  // `payMana` this pass (real, named, flagged debt — see `ManaAbility
  // .variableAmount`'s own doc comment: neither function takes a live
  // controller/board reference to re-derive a variable amount from at
  // payment time), doubly so alongside its own real `restriction`
  // ("Spend this mana only to cast Elf spells and activate abilities of
  // Elf sources," also honestly unenforced, same reasoning Cargo Ship's
  // own restricted ability documents).
  manaAbilities: [
    {
      colors: ['W', 'U', 'B', 'R', 'G'],
      variableAmount: { kind: 'selfPower' },
      restriction: 'Spend this mana only to cast Elf spells and activate abilities of Elf sources.',
    },
  ],
};
