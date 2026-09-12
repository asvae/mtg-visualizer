import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const retrieveTheEsper: CardDefinition = {
  name: 'Retrieve the Esper',
  manaCost: '{3}{U}',
  typeLine: 'Sorcery',

  // Flashback {5}{U}, then exile — real `AlternateCost`, not a second
  // effects branch.
  alternateCosts: [{ name: 'Flashback', cost: '{5}{U}', from: 'graveyard', thenExile: true }],

  // "Then IF this spell was cast from a graveyard, put two +1/+1 counters
  // on THAT token" — the counters target the token THIS effect just
  // created, which no two-entry `effects` array can express (nothing pipes
  // a prior effect's own result into the next one) — `custom`, chaining the
  // real `createToken`/`putCounter` actions against the same returned
  // token reference, is the honest shape, same pattern
  // aerith-gainsborough's own onDies effect already uses for a runtime-read
  // value. `ctx.castFrom` is the same real per-cast fact `lifecycleBefore`
  // (harness.ts) already sets, not guessed.
  effects: [
    {
      kind: 'custom',
      describe: 'creates a 3/3 blue Robot Warrior artifact creature token; if this spell was cast from a graveyard, put two +1/+1 counters on that token',
      run: (ctx: EffectContext, actions: Actions) => {
        const created = actions.createToken(ctx.you, TOKENS.u_3_3_robot_warrior, 1);
        if (ctx.castFrom === 'graveyard') {
          for (const token of created) actions.putCounter(token, '+1/+1', 2);
        }
      },
    } satisfies Effect,
  ],
};
