import type { CardDefinition, Effect } from '../../card';

export const matoyaArchonElder: CardDefinition = {
  name: 'Matoya, Archon Elder',
  manaCost: '{2}{U}',
  typeLine: 'Legendary Creature — Human Warlock',
  pt: [1, 4],

  // Real script has two separate triggered abilities (Mode$ Scry and
  // Mode$ Surveil, both executing the same TrigDraw) — the SCRY/SURVEIL
  // event itself is external (some OTHER effect performing it), the same
  // way Il Mheg Pixie's own "whenever this creature attacks" condition is
  // external to what this card's own effects need to model; only the
  // response (draw a card) is this card's own effect.
  triggers: [
    { name: 'onScry', effects: [{ kind: 'drawCard' } satisfies Effect] },
    { name: 'onSurveil', effects: [{ kind: 'drawCard' } satisfies Effect] },
  ],
};
