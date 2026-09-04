import type { CardDefinition } from '../../card';

export const cargoShip: CardDefinition = {
  name: 'Cargo Ship',
  manaCost: '{1}{U}',
  typeLine: 'Artifact — Vehicle',

  // Real printed base P/T — a Vehicle carries one even though it isn't a
  // creature (and so doesn't match `typesFromTypeLine`'s Creature check)
  // until crewed.
  pt: [2, 3],
  keywords: ['Flying', 'Vigilance'],
  // Real `Crew 1` — `CardDefinition.crewCost` exists exactly for this case
  // (card.ts's own doc comment: "Phantom Train has none printed ... but the
  // field exists for the general case"); no crewing/animate-into-a-creature
  // machinery actually consumes it yet, so this is a real, structured fact
  // with no resolvable behavior in this model, same class of gap the
  // mana ability below already accepts.
  crewCost: 1,

  // "{T}: Add {C}. Spend this mana only to cast an artifact spell or
  // activate an ability of an artifact source." — a real mana ability; no
  // Effect kind (nor any action in interfaces.ts) models mana production
  // anywhere in this system (same deliberate boundary sidequest-catch-a-fish's
  // own "Cooking Campsite" back face already documents for its own {T}: Add
  // {W}) — genuinely out of scope, kept as text only.
  staticAbilities: ['{T}: Add {C}. Spend this mana only to cast an artifact spell or activate an ability of an artifact source.'],
};
