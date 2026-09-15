import type { CardDefinition } from '../../card';
import { basicLandcycling } from '../../cycling';

export const hillGigas: CardDefinition = {
  name: 'Hill Gigas',
  manaCost: '{4}{R}{R}',
  typeLine: 'Creature — Giant',

  pt: [5, 4],
  keywords: ['Trample', 'Haste'],
  // Mountaincycling {2} (2026-09-15, real gap closed — `cycling.ts`'s own
  // `basicLandcycling` factory) — the same real, structured, engine-
  // piloted `abilities` shape `cloudbound-moogle`/`ice-flan`/`balamb-t-
  // rexaur`/`malboro` already use for their own basic Landcycling (a real
  // 602.1 activation FROM HAND, cost = {2} + discard this card itself,
  // resolving to a real library search). This card's own former comment
  // claiming "no `CardDefinition` field fits it" was STALE, not a genuine
  // limitation — those 4 sibling cards already prove the exact same shape
  // fits; `staticAbilities` free text removed, `scenarios.ts` now exercises
  // this ability for real (see that file's own comment).
  abilities: [basicLandcycling('Mountain', '{2}')],
};
