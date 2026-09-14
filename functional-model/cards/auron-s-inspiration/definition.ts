import type { CardDefinition, Effect, EffectContext, Actions, AuthoredFact } from '../../card';

export const auronSInspiration: CardDefinition = {
  name: "Auron's Inspiration",
  manaCost: '{2}{W}',
  typeLine: 'Instant',

  alternateCosts: [{ name: 'Flashback', cost: '{2}{W}{W}', from: 'graveyard', thenExile: true }],

  // Own annotation: `definition-annotations.json`, keyed `"effects"`.
  effects: [
    {
      // "Attacking creatures get +2/+0" is symmetric (ANY player's
      // attacking creatures, no +YouCtrl qualifier) AND depends on combat
      // state this model's EFFECT-RESOLUTION layer specifically can't see
      // (corrected 2026-09-11 — the earlier version of this comment claimed
      // "no attack-declaration step exists at all," which is stale: real
      // attacker state DOES exist, `engine.ts`'s own `GameEngine.attackers`,
      // set by `declareAttackers`/read by `resolveCombatDamage`, real code
      // other cards' own `runEngineScenarios` already pilot — aerith-
      // gainsborough's own combat scenario, e.g.). The gap is narrower and
      // structural: `card.ts`'s `Effect`/`EffectContext`/`Actions` surface
      // (what THIS function can see) is deliberately engine-agnostic — no
      // `GameEngine` reference reaches here, and neither `interfaces.ts`'s
      // `Card`/`Player` nor `pumpAll`'s own predicate union
      // ('creatures-you-control' only, and only YOUR creatures) has any
      // "is this creature currently attacking" read at all, for anyone's
      // creatures. Closing this for real means new interface surface
      // (`Card.isAttacking()` or similar) PLUS wiring `state.ts`'s
      // `wrapCard`/`loggingCard` to actually consult `engine.attackers`
      // (which today only `engine.ts` itself holds) PLUS a new `pumpAll`
      // predicate broadcasting across `ctx.you` AND `ctx.opponents` rather
      // than `ctx.you` alone — a real, cross-cutting engine extension no
      // other FIN card has ever needed, not a one-card `definition.ts` fix;
      // out of scope for this migration, left as an honest custom no-op
      // rather than fabricated. (Flashback, this card's OTHER real ability,
      // IS fully real now — see `alternateCosts` above and `engine.ts`'s own
      // `canCastSpell`/`castSpell`'s `alt` param, ENGINE_GAPS.md gap #7.)
      kind: 'custom',
      describe: 'attacking creatures get +2/+0 until end of turn (no live attacker state reaches the effect-resolution layer in this model — see comment above)',
      run: (_ctx: EffectContext, _actions: Actions) => {
        // Intentionally a no-op — see describe above.
      },
      // Tier 3 (`Effect.authoredFact`). The one real fact this ability
      // represents is real, honest, printed text (see this card's own
      // `definition-annotations.json`, keyed `"effects"`) even though `run`
      // itself is a documented no-op (see the long comment above `run`) — a
      // static/runtime read of `run`'s own body would correctly find NOTHING
      // (there is genuinely nothing to find, that's the whole documented
      // gap), so this fact can ONLY ever come from a human/agent who read
      // the real oracle text and the gap-explaining comment together.
      // Matches this card's own real `synergy.json` source fact
      // byte-for-byte (this card has no sink array entries at all). Not
      // wired into `apply-recognizers.mjs`/`synergy.json` generation. Own
      // annotation: `definition-annotations.json`, keyed
      // `"effects[0].authoredFact[0]"`.
      authoredFact: {
        role: 'source',
        event: 'pump',
        target: { types: { has: ['Creature'] }, attacking: true },
        value: 1,
      } satisfies AuthoredFact,
    } satisfies Effect,
  ],
};
