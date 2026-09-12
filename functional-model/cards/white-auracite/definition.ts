import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

export const whiteAuracite: CardDefinition = {
  name: 'White Auracite',
  manaCost: '{2}{W}{W}',
  typeLine: 'Artifact',

  triggers: [
    {
      // Real 603.6b auto-fire (matching weapons-vendor's/cloud-midgar-
      // mercenary's own convention) — needed so an engine-piloted
      // `pilotResolveTop` fires this for real (added 2026-09-12 alongside
      // this card's migration to the unified Fact/annotations model, so
      // the baseline self-cast/self-enters facts have real trace evidence),
      // rather than requiring a scenario to name it explicitly.
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          // Real Oblivion Ring shape: "exile target nonland permanent an
          // opponent controls until this artifact leaves the battlefield."
          // `move`'s own targeted branch has no "nonland" validType (only
          // 'creature'|'artifact'|'any'), so `custom`, filtering the real
          // opponent battlefield pool by `!isLand()`, is the honest shape.
          // The "until this leaves the battlefield" return condition has no
          // tracked linkage anywhere in this model (no card built so far
          // returns an exiled permanent on its own leaving play — checked
          // the rest of the pool while migrating this card's own facts:
          // champions-of-the-perfect/y-shtola-rhul/zenos-yae-galvus-shinryu-
          // transcendent-rival have the identical real mechanic and are
          // equally unmodeled, so this is a genuine pool-wide engine gap,
          // not a one-card oversight) — real text only, not modeled.
          kind: 'custom',
          describe: 'exile target nonland permanent an opponent controls until this artifact leaves the battlefield',
          run: (ctx: EffectContext, actions: Actions) => {
            const pool = ctx.opponents.flatMap((p) => p.getCardsIn('Battlefield')).filter((c) => !c.isLand());
            if (pool.length > 0) actions.moveTo(actions.chooseTarget(pool, ctx.preferTarget), 'Exile');
          },
        } satisfies Effect,
      ],
    },
  ],

  // "{T}: Add {W}." — a real mana ability; no Effect kind (nor any action
  // in interfaces.ts) models mana production anywhere in this system (same
  // deliberate boundary sidequest-catch-a-fish's own "Cooking Campsite"
  // back face already documents) — genuinely out of scope, kept as text.
  staticAbilities: ['{T}: Add {W}.'],
};
