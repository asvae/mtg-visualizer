import type { CardDefinition, Effect } from '../../card';
import { applyToBound, equipTo, selectUpTo, you } from '../../combinator';

export const weaponsVendor: CardDefinition = {
  name: 'Weapons Vendor',
  manaCost: '{3}{W}',
  typeLine: 'Creature — Human Artificer',

  pt: [2, 2],

  triggers: [
    // Real 603.6b auto-fire (matching Cloud, Midgar Mercenary's/Jill,
    // Shiva's Dominant's own convention) — needed so an engine-piloted
    // `pilotResolveTop` fires this for real rather than requiring a
    // scenario to name it explicitly.
    { name: 'onEnter', on: 'enter', effects: [{ kind: 'drawCard' } satisfies Effect] },
    {
      // "At the beginning of combat on your turn, if you control an
      // Equipment, you may pay {1}. When you do, attach target Equipment
      // you control to target creature you control." — real conditional +
      // optional-payment + intervening-if shape; no cost-payment/`ActivationLimit`-
      // style machinery exists in this model (this model has no player-
      // decision engine anywhere — same simplification namazu-trader's own
      // "if you do" gate already documents: the payoff always happens once
      // a legal target exists).
      //
      // Migrated 2026-09-16 off a `kind:'custom'` closure onto the
      // combinator DSL (`equip` gained real `EachAction`/`ApplyToBound`
      // vocabulary the same day — see `combinator.ts`'s own header —
      // superseding the old "no declarative Effect kind" comment this used
      // to carry): nested `selectUpTo(..., 1, ...)` independently picks one
      // Equipment (`cardType:'artifact'` + `subtype:'Equipment'`, same
      // Equipment-⊂-Artifact narrowing `beatrix-loyal-general`'s/
      // `gilgamesh-master-at-arms`'s own migrations already use) and one
      // creature (bare `creaturesInPlay()`, no subtype narrowing — the real
      // printed text says "target creature," not a named subtype), then
      // `applyToBound` attaches the bound Equipment onto the bound creature
      // via `equipTo`. A no-op when either pool is empty (`SelectUpTo`/
      // `ApplyToBound`'s own already-documented tolerance), matching the
      // original closure's own early-return guard. Same real behavior, now
      // recognizer-readable data instead of an opaque closure.
      //
      // RESOLVED (2026-09-16, recognizer-lane triage): `equipProgram-effect-
      // structural.ts` gained a third confirmed equip-targeted template for
      // exactly this card's own literal, plainly-worded, independently-
      // targeted "attach target Equipment you control to target creature you
      // control" (equipmentTargeted:true + bare, non-subtype-narrowed
      // target/equipment pools, both owner:'you') — see that recognizer's
      // own module doc comment for the full 3-template vocabulary and why
      // `occ.equipmentPool.owner` is the real signal that keeps this
      // template from misfiring on `stolen-uniform`'s own structurally-
      // identical-but-textually-different shape. This card's own `equip`
      // source fact and both paired sink facts are now provenance-backed.
      name: 'onBeginCombat',
      effects: [
        {
          kind: 'program',
          describe: 'if you control an Equipment, you may pay {1}. When you do, attach target Equipment you control to target creature you control',
          program: selectUpTo(you.permanentsInPlay().filter('cardType', 'artifact').filter('subtype', 'Equipment'), 1, 'equipment', [
            selectUpTo(you.creaturesInPlay(), 1, 'creature', [applyToBound('equipment', 0, equipTo('creature', 0))]),
          ]),
        } satisfies Effect,
      ],
    },
  ],
};
