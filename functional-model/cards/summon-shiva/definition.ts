import type { CardDefinition, Effect, EffectContext } from '../../card';

// Real 714.3a/b Saga chapters modeled as named `triggers`, same
// simplification summon-bahamut/summon-primal-garuda/etc. already
// establish (turn-based-action precision traded for reusing the existing
// multi-trigger mechanism). Real Forge script (shiva.txt-style
// K:Chapter:3:DBTap,DBTap,DBDraw) — chapters I and II both point at the
// SAME real ability (Heavenly Strike), the ability repeats, not a typo,
// same shared-SVar shape summon-bahamut's own chapters I/II already
// establish for a different pair of abilities.
export const summonShiva: CardDefinition = {
  name: 'Summon: Shiva',
  manaCost: '{3}{U}{U}',
  typeLine: 'Enchantment Creature — Saga Elemental',

  pt: [4, 5],

  triggers: [
    {
      // Heavenly Strike — "Tap target creature an opponent controls. Put
      // a stun counter on it." Real, controller-restricted target (an
      // OPPONENT'S creature, `ValidTgts$ Creature.OppCtrl`) — same `owner`
      // field Ice Flan's own ETB uses for the identical real shape
      // (tap-then-stun a chosen target). Two separate declarative
      // effects rather than one `custom`: `tapTarget`'s and
      // `putCounterTarget`'s pools are identical (opponents' creatures,
      // nothing moves zones in between), so `chooseTarget`'s own
      // deterministic pool-candidate rule lands both on the same chosen
      // creature, same reasoning Ice Flan's own definition.ts documents
      // for its own tap+stun pair.
      name: 'chapterI',
      effects: [
        { kind: 'tapTarget', validType: 'creature', owner: 'opponents' } satisfies Effect,
        { kind: 'putCounterTarget', validType: 'creature', counterType: 'stun', amount: 1, owner: 'opponents' } satisfies Effect,
      ],
    },
    {
      name: 'chapterII',
      effects: [
        { kind: 'tapTarget', validType: 'creature', owner: 'opponents' } satisfies Effect,
        { kind: 'putCounterTarget', validType: 'creature', counterType: 'stun', amount: 1, owner: 'opponents' } satisfies Effect,
      ],
    },
    {
      // Diamond Dust — "Draw a card for each tapped creature your
      // opponents control." `Card.isTapped()` genuinely exists
      // (interfaces.ts's own real mirror of `RealCard.tapped`, state.ts) —
      // an earlier version of this file's own comment wrongly claimed no
      // tapped-state read was exposed anywhere in this model (the same
      // stale claim summon-primal-garuda's own definition.ts already
      // corrected on an unrelated card/effect). Real, live-counted here
      // via `drawCard`'s own `Computed<number>` amount — not a no-op.
      name: 'chapterIII',
      effects: [
        {
          kind: 'drawCard',
          amount: (ctx: EffectContext) => ctx.opponents.flatMap((p) => p.getCreaturesInPlay()).filter((c) => c.isTapped()).length,
        } satisfies Effect,
      ],
    },
  ],
};
