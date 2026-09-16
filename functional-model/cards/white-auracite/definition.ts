import type { CardDefinition, Effect } from '../../card';

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
        // Real Oblivion Ring shape: "exile target nonland permanent an
        // opponent controls until this artifact leaves the battlefield."
        // `move`'s own targeted branch DOES have a real `nonLand` field
        // (added for Jill, Shiva's Dominant/Eject's own identical real
        // vocabulary — this file's own former comment predated that
        // addition and was stale) — migrated off `custom` to this
        // declarative shape 2026-09-16 (fin/26-50 pass), same real
        // `owner:'opponents'` restriction `move-effect-structural.ts` was
        // extended in the same pass to cover. The "until this leaves the
        // battlefield" return condition still has no tracked linkage
        // anywhere in this model (no card built so far returns an exiled
        // permanent on its own leaving play — checked the rest of the pool:
        // champions-of-the-perfect/y-shtola-rhul/zenos-yae-galvus-shinryu-
        // transcendent-rival have the identical real mechanic and are
        // equally unmodeled, so this is a genuine pool-wide engine gap, not
        // a one-card oversight) — real text only, not modeled.
        { kind: 'move', owner: 'opponents', from: 'Battlefield', to: 'Exile', qty: 1, validType: 'any', nonLand: true, target: true } satisfies Effect,
      ],
    },
  ],

  // "{T}: Add {W}." — a real, structured `manaAbilities` entry, genuinely
  // payable via `mana.ts`'s `canAfford`/`payMana` (no mana POOL modeled
  // anywhere in this system either way).
  manaAbilities: [{ colors: ['W'] }],
};
