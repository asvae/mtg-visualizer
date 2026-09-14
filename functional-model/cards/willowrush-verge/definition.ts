import type { CardDefinition } from '../../card';

export const willowrushVerge: CardDefinition = {
  name: 'Willowrush Verge',
  manaCost: '',
  typeLine: 'Land',

  // Both mana abilities are now real, structured `manaAbilities` entries.
  // The first (`{T}: Add {U}.`) is an ordinary payable source; the second's
  // real `activationCondition` (Forge `IsPresent$ Forest.YouCtrl,
  // Island.YouCtrl`) is honestly typed but deliberately unenforced (no
  // general `IsPresent$`-string evaluator exists in this engine) — same
  // "first qualifying entry wins" behavior `mana.ts`'s `payableManaAbility`
  // already documents, so this land is still only ever recognized as a `U`
  // source, never `G`.
  manaAbilities: [{ colors: ['U'] }, { colors: ['G'], activationCondition: 'Activate only if you control a Forest or an Island.' }],
};
