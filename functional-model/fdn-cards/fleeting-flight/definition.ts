import type { CardDefinition, Effect } from '../../card';

export const fleetingFlight: CardDefinition = {
  name: 'Fleeting Flight',
  manaCost: '{W}',
  typeLine: 'Instant',

  effects: [
    {
      kind: 'putCounterTarget',
      validType: 'creature',
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
      // Note: "Prevent all combat damage that would be dealt to it this turn" is a
      // CR 614.2 replacement effect that the engine doesn't yet model. No mechanism
      // exists to prevent target-specific combat damage (see ENGINE_GAPS.md gap #8).
      // This effect is modeled as inert text only.
      kind: 'custom',
      describe: 'prevent all combat damage that would be dealt to the target creature this turn',
      run: () => {
        // Placeholder: no implementation yet
      },
    } satisfies Effect,
  ],
};
