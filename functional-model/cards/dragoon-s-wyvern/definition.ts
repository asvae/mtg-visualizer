import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const dragoonsWyvern: CardDefinition = {
  name: "Dragoon's Wyvern",
  manaCost: '{2}{U}',
  typeLine: 'Creature — Drake',

  pt: [2, 1],
  keywords: ['Flying'],

  triggers: [
    // Real 603.6b auto-fire (matching weapons-vendor's/Cloud, Midgar
    // Mercenary's own convention) — `on: 'enter'` is what `resolveTop`
    // actually checks to auto-fire an ETB from a real cast; `name` alone
    // (the manual-fire identifier `pilotFireTrigger`/`resolveCard` use) does
    // not trigger this.
    {
      name: 'onEnter',
      on: 'enter',
      effects: [{ kind: 'createToken', token: TOKENS.c_1_1_hero, amount: 1 } satisfies Effect],
    },
  ],
};
