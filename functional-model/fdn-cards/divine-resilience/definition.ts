import type { CardDefinition, Effect } from '../../card';

export const divineResilience: CardDefinition = {
  name: 'Divine Resilience',
  manaCost: '{W}',
  typeLine: 'Instant',
  keywords: ['Kicker'],

  // Kicker {2}{W} — modeled using `modal` mechanism (mode 0 = not kicked, mode 1 = kicked),
  // same convention chocobo-kick/vayne-s-treachery use. Mode 0 targets one creature,
  // mode 1 targets any number.
  effects: [
    {
      kind: 'modal',
      modes: [
        {
          describe: 'Target creature you control gains indestructible until end of turn.',
          effects: [
            {
              kind: 'grantKeywordTarget',
              keyword: 'Indestructible',
              validType: 'creature',
              owner: 'you',
              untilEndOfTurn: true,
            } satisfies Effect,
          ],
        },
        {
          describe: 'If this spell was kicked, any number of target creatures you control gain indestructible until end of turn instead.',
          effects: [
            {
              kind: 'custom',
              describe: 'any number of target creatures you control gain indestructible until end of turn',
              run: (ctx) => {
                // This effect would be triggered only if the spell was kicked
                // In practice, the scenario would select this mode (mode 1) to indicate kicker was paid
                // and would select the targets. The grantKeyword effect would then apply to all chosen targets.
                // For now, this is modeled as a placeholder since grantKeywordTarget doesn't support
                // "any number" of targets yet.
              },
            } satisfies Effect,
          ],
        },
      ],
    } satisfies Effect,
  ],
};
