import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'draws a card', trigger: 'onEnter' },
  { result: 'attaches your Equipment to a creature you control', trigger: 'onBeginCombat', you: { equipmentCount: 1, creaturesCount: 1 } },
  { result: 'no Equipment you control, nothing to attach', trigger: 'onBeginCombat', you: { creaturesCount: 1 } },
  // Weapons Vendor is itself a creature already on the battlefield for this
  // trigger scenario (no other creature set up), so it's a legal "target
  // creature you control" for its own attach — real text has no exclusion
  // of the source, so the Equipment attaches to Weapons Vendor itself here.
  { result: 'no other creature you control; attaches the Equipment to Weapons Vendor itself', trigger: 'onBeginCombat', you: { equipmentCount: 1 } },
];
