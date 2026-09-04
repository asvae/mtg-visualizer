import type { CardDefinition, Effect } from '../../card';

export const communeWithBeavers: CardDefinition = {
  name: 'Commune with Beavers',
  manaCost: '{G}',
  typeLine: 'Sorcery',

  effects: [
    {
      // `dig`'s own `validType` union (`'artifact' | 'any'`) has no combined
      // "artifact, creature, or land" predicate — 'artifact' alone would be
      // too narrow (excludes real creature/land hits), 'any' is the closest
      // available fit but over-broadens (a noncreature/nonland/nonartifact
      // card would also qualify here, which the real printed text excludes).
      // Documented simplification, same class as gilgamesh-master-at-arms'
      // own accepted "no real order/window fidelity" gap.
      kind: 'dig',
      qty: 3,
      take: 1,
      validType: 'any',
      optional: true,
    } satisfies Effect,
  ],
};
