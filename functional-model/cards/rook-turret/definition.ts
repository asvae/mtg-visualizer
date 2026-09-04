import type { CardDefinition, Effect } from '../../card';

export const rookTurret: CardDefinition = {
  name: 'Rook Turret',
  manaCost: '{3}{U}',
  typeLine: 'Artifact Creature — Construct',

  pt: [3, 3],
  keywords: ['Flying'],

  // Real `SVar:TrigLoot:AB$ Discard | Defined$ You | Mode$ TgtChoose |
  // Cost$ Draw<1/You>` — a discard ability whose OWN cost is "draw a
  // card," i.e. net draw-then-discard (a real Forge "Loot" idiom). The
  // "you MAY... if you do" gating is the same documentary-only convention
  // every other card here uses (no player-decision engine anywhere in this
  // model — see `move`/`sacrifice`'s own `optional` field doc comments):
  // a legal draw/discard always happens once this trigger fires.
  triggers: [
    {
      name: 'onArtifactEnters',
      effects: [{ kind: 'drawCard', amount: 1 } satisfies Effect, { kind: 'discard', owner: 'you', qty: 1 } satisfies Effect],
    },
  ],
};
