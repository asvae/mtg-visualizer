import type { CardDefinition, Effect, EffectContext } from '../../card';
import { flashback } from '../../flashback';

export const fromFatherToSon: CardDefinition = {
  name: 'From Father to Son',
  manaCost: '{1}{W}',
  typeLine: 'Sorcery',

  alternateCosts: [flashback('{4}{W}{W}{W}')],

  effects: [
    {
      // MIGRATED (2026-09-15, fin/16-25 pass) off a `kind:'custom'` closure
      // onto the real declarative `move` Effect — `to` is now genuinely
      // `Computed<ZoneType>` (`card.ts`, this same pass), so "put it into
      // your hand, or onto the battlefield instead if this spell was cast
      // from a graveyard" no longer needs `custom`'s own opaque escape
      // hatch: `ctx.castFrom` (the same real, scenario-supplied fact
      // `lifecycleAfter` in harness.ts already reads to decide
      // graveyard-vs-exile for the spell itself) is read directly by this
      // effect's own `to` closure.
      //
      // "Vehicle card" — CORRECTED 2026-09-15 (fin/16-25 pass, same day):
      // the doc comment this replaced claimed "no scenario-facing way to
      // populate [subtypes] for a Library card" — checked directly and
      // found WRONG: `state.ts`'s `GameState.addCard(owner, zone, opts)`
      // takes `Partial<Omit<RealCard,...>>` regardless of which `zone` it's
      // placed in, `opts.subtypes` included — a Library card can carry a
      // real `subtypes: ['Vehicle']` exactly the same way a Battlefield one
      // does. `subtype:'Vehicle'` (same field `cloud-midgar-mercenary`'s own
      // Equipment-tutor already uses for the untargeted `move` branch) is
      // the real, precise restriction — `validType:'artifact'` alone stays
      // too (Vehicle ⊂ Artifact, and `subtype`'s own real Forge behavior,
      // `card.ts`'s doc comment, narrows WITHIN whatever `validType` already
      // allows, never replaces it).
      kind: 'move',
      owner: 'you',
      from: 'Library',
      to: (ctx: EffectContext) => (ctx.castFrom === 'graveyard' ? 'Battlefield' : 'Hand'),
      qty: 1,
      validType: 'artifact',
      subtype: 'Vehicle',
      shuffleAfter: true,
    } satisfies Effect,
  ],
};
