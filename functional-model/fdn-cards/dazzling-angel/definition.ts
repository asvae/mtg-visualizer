import type { CardDefinition, Effect } from '../../card';

export const dazzlingAngel: CardDefinition = {
  name: 'Dazzling Angel',
  manaCost: '{2}{W}',
  typeLine: 'Creature — Angel',
  pt: [2, 3],
  keywords: ['Flying'],

  // Whenever another creature you control enters, you gain 1 life.
  // Note: Trigger condition "whenever ANOTHER creature you control enters" requires
  // an unbuilt trigger variant (no `on` value supports firing for other cards matching
  // a subtype/condition — see ENGINE_GAPS.md). Modeled as a named trigger for manual
  // scenario invocation until that gap closes.
  triggers: [
    {
      name: 'onOtherCreatureEnter',
      effects: [
        {
          kind: 'gainLife',
          amount: 1,
        } satisfies Effect,
      ],
    },
  ],
};
