import type { CardDefinition, Effect } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const zidaneTantalusThief: CardDefinition = {
  name: 'Zidane, Tantalus Thief',
  manaCost: '{3}{R}{W}',
  typeLine: 'Legendary Creature — Human Mutant Scout',

  pt: [3, 3],

  triggers: [
    {
      // "When Zidane enters, gain control of target creature an opponent
      // controls until end of turn. Untap that creature. It gains lifelink
      // and haste until end of turn." No declarative Effect kind wraps
      // `gainControl` (real `Actions.gainControl` exists and IS wired —
      // just no `Effect` variant dispatches to it yet), so this is
      // `custom`, calling the real actions directly. "Until end of turn"
      // is the same permanent-within-scenario simplification `grantKeyword`
      // and `gainControl` themselves already document.
      name: 'onEnter',
      effects: [
        {
          kind: 'custom',
          describe: 'gain control of target creature an opponent controls until end of turn; untap it; it gains lifelink and haste until end of turn',
          run: (ctx, actions) => {
            const pool = ctx.opponents.flatMap((o) => o.getCreaturesInPlay());
            if (pool.length === 0) return;
            const target = actions.chooseTarget(pool);
            actions.gainControl(ctx.you, target);
            actions.untap(target);
            actions.grantKeyword(target, 'Lifelink');
            actions.grantKeyword(target, 'Haste');
          },
        } satisfies Effect,
      ],
    },
    {
      name: 'onOpponentGainsControlFromYou',
      effects: [{ kind: 'createToken', token: TOKENS.c_a_treasure_sac, amount: 1 } satisfies Effect],
    },
  ],
};
