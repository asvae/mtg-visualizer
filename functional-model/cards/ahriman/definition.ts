import type { CardDefinition, Effect } from '../../card';

export const ahriman: CardDefinition = {
  name: 'Ahriman',
  manaCost: '{2}{B}',
  typeLine: 'Creature — Eye Horror',

  pt: [2, 2],
  keywords: ['Flying', 'Deathtouch'],

  // {3}, Sacrifice another creature or artifact: Draw a card. The
  // sacrifice is part of the activation COST (real Forge
  // `Cost$ 3 Sac<1/Creature.Other;Artifact.Other/...>`), modeled as the
  // FIRST effect below purely so the trace shows it happening — same
  // convention phantom-train's own sacrifice-cost Vehicle ability uses.
  activationCost: '{3}, Sacrifice another creature or artifact',
  effects: [
    { kind: 'sacrifice', owner: 'you', validType: 'creature-or-artifact', notSelf: true } satisfies Effect,
    { kind: 'drawCard' } satisfies Effect,
  ],
};
