import type { CardDefinition } from '../../card';

// All three real abilities are continuous static permissions/replacement-
// style rules (`S:Mode$ Continuous`/`S:Mode$ Panharmonicon`) — nothing here
// is a resolvable step (no `DB$`/`AB$` anywhere in the real script), so the
// whole card is `staticAbilities` text, same shape as adelbert-steiner's own
// non-CDA lines.
export const travelingChocobo: CardDefinition = {
  name: 'Traveling Chocobo',
  manaCost: '{2}{G}',
  typeLine: 'Creature — Bird',

  pt: [3, 2],

  staticAbilities: [
    'You may look at the top card of your library any time.',
    'You may play lands and cast Bird spells from the top of your library.',
    'If a land or Bird you control entering the battlefield causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time.',
  ],
};
