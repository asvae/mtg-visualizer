import type { CardDefinition, Effect } from '../../card';

// A transforming DFC (Enchantment // Vehicle) — same `backFace` shape
// jecht-reluctant-guardian-braska-s-final-aeon/sidequest-catch-a-fish-
// cooking-campsite already establish: a second, independent
// `CardDefinition`, reached via `Scenario.face: 'back'`.
export const sidequestCardCollection: CardDefinition = {
  name: 'Sidequest: Card Collection',
  manaCost: '{3}{U}',
  typeLine: 'Enchantment',

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'drawCard', amount: 3 } satisfies Effect, { kind: 'discard', owner: 'you', qty: 2 } satisfies Effect],
    },
    {
      // "Transform this enchantment" has no observable consequence in this
      // model — no card here tracks "which face is currently showing" as
      // state (same gap jecht's own front-face comment, and sidequest-
      // catch-a-fish-cooking-campsite's own onUpkeep comment, already
      // document); this face's own backFace abilities are instead
      // exercised directly via `Scenario.face: 'back'`. The "if eight or
      // more cards are in your graveyard" gate has no PlayerState field for
      // a generic (non-creature-specific) graveyard card count either, so
      // stays text-only, same convention every other unmodelable
      // intervening-if condition here uses.
      name: 'onEndStep',
      effects: [
        {
          kind: 'custom',
          describe: 'if eight or more cards are in your graveyard, transform this enchantment (transform itself not tracked as state)',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],

  backFace: {
    name: 'Magicked Card',
    manaCost: '',
    typeLine: 'Artifact — Vehicle',
    pt: [4, 4],
    keywords: ['Flying'],
    crewCost: 1,
  },
};
