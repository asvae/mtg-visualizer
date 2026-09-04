import type { CardDefinition } from '../../card';

// Real Forge: `T:Mode$ Attacks ... SVar:TrigDamage:DB$ DealDamage |
// Defined$ TriggeredDefendingPlayer | NumDmg$ X | SVar:X:Count$Valid
// Creature.YouCtrl+equipped` — "it deals damage equal to the number of
// EQUIPPED creatures you control to defending player" when Barret attacks.
// A real, confirmed gap: neither `interfaces.ts`'s `Card` nor `state.ts`'s
// `wrapCard` exposes ANY way to ask "is this card equipped" (Equipment's
// own `attachedToId` link lives only on the internal `RealCard`, with no
// `isEquipped()`/`getAttachedTo()` getter mirroring `isTapped()`'s recent
// addition) — so `Count$Valid Creature.YouCtrl+equipped` can't be computed
// by any `Computed<number>` function this model can write. The attack
// trigger (this card's entire distinguishing mechanic) is omitted for that
// reason; flagged to the parent session rather than approximated with an
// unrelated count. Base stats/keyword are still real and fully built.
export const barretWallace: CardDefinition = {
  name: 'Barret Wallace',
  manaCost: '{3}{R}',
  typeLine: 'Legendary Creature — Human Rebel',

  pt: [4, 4],
  keywords: ['Reach'],
};
