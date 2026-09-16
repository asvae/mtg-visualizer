import type { CardDefinition, Effect } from '../../card';

export const rookTurret: CardDefinition = {
  name: 'Rook Turret',
  manaCost: '{3}{U}',
  typeLine: 'Artifact Creature — Construct',

  pt: [3, 3],
  keywords: ['Flying'],

  // Real `SVar:TrigLoot:AB$ Discard | Defined$ You | Mode$ TgtChoose |
  // Cost$ Draw<1/You>` — a discard ability whose OWN cost is "draw a
  // card," i.e. net draw-then-discard (a real Forge "Loot" idiom). `optional:
  // true` (2026-09-16 — `drawCard`'s own field, newly built off this exact
  // card's recognizer-side gap, see `card.ts`'s own `optional` doc comment
  // on `kind:'drawCard'`) is documentary-only, same convention `destroy`'s/
  // `move`'s/`sacrifice`'s own `optional` fields already carry: no
  // player-decision engine exists here, so a legal draw/discard still
  // always happens once this trigger fires — `optional: true` now lets
  // `drawCard-effect-structural.ts`'s own recognizer tell this "you MAY
  // draw" apart from an unconditional draw instead of declining it.
  triggers: [
    {
      name: 'onArtifactEnters',
      effects: [{ kind: 'drawCard', amount: 1, optional: true } satisfies Effect, { kind: 'discard', owner: 'you', qty: 1 } satisfies Effect],
    },
  ],
};
