import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const magitekArmor: CardDefinition = {
  name: 'Magitek Armor',
  manaCost: '{3}{W}',
  typeLine: 'Artifact — Vehicle',

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'createToken', token: TOKENS.c_1_1_hero, amount: 1 } satisfies Effect],
    },
  ],

  // Real "Crew 1" — CardDefinition's own dedicated `crewCost` field (see
  // card.ts's own doc comment: taps creatures with total power >= N,
  // distinct from a mana `activationCost`). harness.ts's own lifecycle
  // logic only branches on `activationCost` being present (not
  // `crewCost`), so `activationCost` is ALSO set here, purely as a
  // descriptive label to get the correct "activate" lifecycle (skip cast/
  // enters — the Vehicle is already on the battlefield when it's crewed) —
  // both fields are set because they answer different questions (the
  // structured N for `crewCost`, the lifecycle-shape trigger for
  // `activationCost`), not because one is redundant.
  crewCost: 1,
  activationCost: 'Crew 1 (tap creatures with total power 1 or more)',
  effects: [{ kind: 'animate', target: 'self', types: ['Artifact', 'Creature'] } satisfies Effect],
};
