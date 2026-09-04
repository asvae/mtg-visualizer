import type { Scenario } from '../../harness';
import { sidequestPlayBlitzball } from './definition';

export const scenarios: Scenario[] = [
  { result: 'target creature you control gets +2/+0 until end of turn', trigger: 'onBeginCombat', you: { creaturesCount: 1 } },
  { result: 'attaches to a creature you control (transform + turn-damage condition not tracked by this engine)', trigger: 'onEndCombat', you: { creaturesCount: 1 } },
  {
    result: 'equips to a creature you control',
    face: 'back',
    you: { creaturesCount: 1 },
    setupNote: "World Champion, Celestial Weapon's own Equip {3} ability (card.activationCost)",
  },
];
