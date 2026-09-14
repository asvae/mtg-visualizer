import type { CardDefinition, Effect } from '../../card';

export const gRahaTia: CardDefinition = {
  name: "G'raha Tia",
  manaCost: '{4}{W}',
  typeLine: 'Legendary Creature — Cat Archer',

  keywords: ['Reach'],

  // "The Allagan Eye ... triggers only once each turn" — real Forge's own
  // `ActivationLimit$ 1` (`res/cardsfolder/g/graha_tia.txt`:
  // `T:Mode$ ChangesZoneAll | ... | Execute$ TrigDraw | ActivationLimit$ 1 |
  // TriggerDescription$ The Allagan Eye — ...`), now real here too —
  // `triggers.ts`'s shared `fireTrigger` chokepoint enforces this via
  // `state.ts`'s `triggerActivationsThisTurn` (reset every real Cleanup,
  // `turn.ts`), not a fabricated guard. See `scenarios.ts` for a real
  // engine-piloted demonstration of the cap itself (a SECOND other-
  // permanent death the same turn draws no second card).
  triggers: [
    {
      name: 'onOtherPermanentsDie',
      effects: [{ kind: 'drawCard' } satisfies Effect],
      activationLimit: 1,
    },
  ],
};
