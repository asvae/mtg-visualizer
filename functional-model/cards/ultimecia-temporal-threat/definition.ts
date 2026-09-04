import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (ultimecia_temporal_threat.txt).
export const ultimeciaTemporalThreat: CardDefinition = {
  name: 'Ultimecia, Temporal Threat',
  manaCost: '{4}{U}{U}',
  typeLine: 'Legendary Creature — Human Warlock',

  pt: [4, 4],

  triggers: [
    {
      // "tap all creatures your opponents control" — real `DB$ TapAll`, a
      // genuine board-wide batch with no player choice at all; `tapTarget`'s
      // own declarative shape only ever picks ONE chosen target (see
      // card.ts's own doc comment: `TapEffect`/`TapAllEffect` are two real,
      // distinct Forge classes, and only the single-target one has a
      // declarative Effect kind here) — `custom` composing the real
      // `actions.tap` over every opponent creature instead, same
      // "no new capability, just an unbuilt declarative shape" reasoning
      // sephiroth-planet-s-heir's own opponents' -2/-2 custom effect uses
      // for the identical gap.
      name: 'onEnter',
      effects: [
        {
          kind: 'custom',
          describe: 'tap all creatures your opponents control',
          run: (ctx: EffectContext, actions: Actions) => {
            for (const opp of ctx.opponents) for (const creature of opp.getCreaturesInPlay()) actions.tap(creature);
          },
        } satisfies Effect,
      ],
    },
    {
      name: 'onDealsCombatDamage',
      effects: [{ kind: 'drawCard' } satisfies Effect],
    },
  ],
};
