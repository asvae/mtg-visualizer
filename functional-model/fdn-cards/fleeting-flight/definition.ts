import type { CardDefinition, Effect } from '../../card';

export const fleetingFlight: CardDefinition = {
  name: 'Fleeting Flight',
  manaCost: '{W}',
  typeLine: 'Instant',
  // Real Forge `A:SP$ PutCounter | ...` (res/cardsfolder/f/fleeting_flight.txt)
  // — an Instant's own cast ability, made explicit (2026-09-19, even later
  // still) rather than left implicit off `activationCost`'s own absence.
  abilityType: 'spell',

  effects: [
    {
      // Real Forge `A:SP$ PutCounter | ValidTgts$ Creature | CounterType$
      // P1P1 | CounterNum$ 1` — the unified `putCounter` kind's own
      // chosen-target branch (`card.ts`'s `PutCounterChosenTarget`, added
      // 2026-09-19, even later still), mirroring Forge's real ONE
      // `PutCounter` ability directly instead of the pre-existing, separate
      // `putCounterTarget` kind (still real, still used elsewhere — see
      // that kind's own doc comment).
      kind: 'putCounter',
      target: { chosen: true, validType: 'creature' },
      counterType: '+1/+1',
      amount: 1,
    } satisfies Effect,
    {
      kind: 'grantKeywordTarget',
      keyword: 'Flying',
      validType: 'creature',
      untilEndOfTurn: true,
    } satisfies Effect,
    {
      kind: 'grantKeywordTarget',
      keyword: 'CombatDamagePrevention',
      validType: 'creature',
      untilEndOfTurn: true,
    } satisfies Effect,
  ],
};
