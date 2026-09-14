import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (airship_crash.txt): "Destroy target artifact, enchantment,
// or creature with flying" — a real 3-way disjunctive target predicate
// (`ValidTgts$ Artifact,Enchantment,Creature.withFlying`). Was previously
// skipped for lacking `Card.hasKeyword()` — that's now real (state.ts's
// own `wrapCard` exposes it off `RealCard.keywords`). But the declarative
// `destroy` Effect kind's own `validType` union
// ('permanent'|'creature'|'land') still has no shape for "type A OR type B
// OR (type C with a keyword)" — 'permanent' would wrongly include a plain
// nonflying creature or a land, and no combination of the existing
// variants expresses the real disjunction at all. Every underlying
// primitive this needs DOES exist though (`isArtifact`/`isEnchantment`/
// `hasKeyword('Flying')`/`chooseTarget`/`destroy`), so this is built as a
// precise `custom` effect over the real unrestricted battlefield pool
// (same shape ultros-obnoxious-octopus's own two-players-in-one-pool
// `custom` already uses) rather than an invented mechanic or a
// mismatched-validType approximation.
//
// Cycling {2} (ENGINE_GAPS.md gap #23, closed 2026-09-14) is now a real,
// structured, engine-piloted activated ability — a genuine 602.1
// activation FROM HAND, cost = {2} + discard this card itself
// (`engine.ts`'s `costRequiresDiscardSelf`), resolving to a plain
// `drawCard`. Modeled via the NAMED `abilities` array (not the top-level
// `activationCost`/`effects` pair) specifically because this card's own
// top-level `effects` is already spoken for — that's the Instant's own
// CAST effect (the destroy-target `custom` below), a genuinely different
// resolution than Cycling's. See cloudbound-moogle/definition.ts's own
// comment for the full mechanism (TypeCycling's own search variant, not
// needed here — Airship Crash's real printed Cycling has no search).
export const airshipCrash: CardDefinition = {
  name: 'Airship Crash',
  manaCost: '{2}{G}',
  typeLine: 'Instant',

  abilities: [{ name: 'cycling', cost: '{2}, Discard this card', effects: [{ kind: 'drawCard' } satisfies Effect] }],

  effects: [
    {
      kind: 'custom',
      describe: 'destroy target artifact, enchantment, or creature with flying',
      run: (ctx: EffectContext, actions: Actions) => {
        const pool = [ctx.you, ...ctx.opponents]
          .flatMap((p) => p.getCardsIn('Battlefield'))
          .filter((c) => c.isArtifact() || c.isEnchantment() || (c.isCreature() && c.hasKeyword('Flying')));
        if (pool.length === 0) return;
        actions.destroy(actions.chooseTarget(pool));
      },
    } satisfies Effect,
  ],
};
