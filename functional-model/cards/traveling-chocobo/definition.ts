import type { CardDefinition } from '../../card';

// The first two real abilities are continuous static permissions (`S:Mode$
// Continuous`) — nothing here is a resolvable step (no `DB$`/`AB$` anywhere
// in the real script), so they stay `staticAbilities` text, same shape as
// adelbert-steiner's own non-CDA lines. The third (`S:Mode$ Panharmonicon`)
// is now real (ENGINE_GAPS.md gap #13, closed 2026-09-12) — see
// `triggerDoubling` below.
export const travelingChocobo: CardDefinition = {
  name: 'Traveling Chocobo',
  manaCost: '{2}{G}',
  typeLine: 'Creature — Bird',

  pt: [3, 2],

  staticAbilities: ['You may look at the top card of your library any time.', 'You may play lands and cast Bird spells from the top of your library.'],

  // Real "Panharmonicon effect" (ENGINE_GAPS.md gap #13) — "If a land or
  // Bird you control entering the battlefield causes a triggered ability of
  // a permanent you control to trigger, that ability triggers an additional
  // time." Applies to ANY permanent the SAME controller owns (not just
  // Chocobo himself — `anyPermanentYouControl`), gated to a `causedBy:
  // 'entersBattlefield'` firing whose entering permanent is a land OR has
  // the Bird subtype (`entersMatch`, an OR list — either one qualifies).
  triggerDoubling: [{ scope: 'anyPermanentYouControl', causedBy: 'entersBattlefield', entersMatch: [{ isLand: true }, { subtype: 'Bird' }] }],
};
