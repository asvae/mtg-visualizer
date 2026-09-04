import type { CardDefinition, Effect } from '../../card';

export const blitzballShot: CardDefinition = {
  name: 'Blitzball Shot',
  manaCost: '{1}{G}',
  typeLine: 'Instant',

  // Both effects target — `chooseTarget`'s deterministic "always pick
  // pool[0]" behavior means both land on the SAME creature (the pool
  // composition doesn't change between the two calls), same convention
  // coral-sword's own split pump/keyword-grant pair already establishes.
  effects: [
    { kind: 'pumpTarget', power: 3, toughness: 3 } satisfies Effect,
    { kind: 'grantKeywordTarget', keyword: 'Trample', validType: 'creature' } satisfies Effect,
  ],
};
