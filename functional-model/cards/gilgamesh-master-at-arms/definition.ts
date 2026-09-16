import type { CardDefinition, Effect } from '../../card';
import { applyToBound, equipTo, selectUpTo, you } from '../../combinator';

// "Whenever Gilgamesh enters or attacks, look at the top six cards of your
// library. You may put any number of Equipment cards from among them onto
// the battlefield. Put the rest on the bottom..." — real Forge's own
// `DigEffect`, but this model's own `dig` Effect (card.ts) hardcodes its
// destination to HAND (see state.ts's own `GameState.dig`: "moves up to
// `take` ... to hand"), so it can't send matches to the Battlefield —
// `move`'s own batch (untargeted) shape is used instead (`validType:
// 'artifact'`, Equipment ⊂ Artifact, same narrowing cloud-midgar-
// mercenary's own search already uses). This drops the real "only within
// the top six" windowing (`move` matches anywhere in the library, not a
// bounded look) — same "no real order/window fidelity" caveat state.ts's
// own header already accepts elsewhere. "Put the rest on the bottom in a
// random order" has no observable consequence in this model.
function equipmentTutorEffects(): Effect[] {
  return [
    { kind: 'move', owner: 'you', from: 'Library', to: 'Battlefield', qty: 6, validType: 'artifact' } satisfies Effect,
    {
      // "you may attach one of them to a Samurai you control" — `equip`
      // has no declarative Effect kind anywhere in this model (ninja-s-
      // blades' own comment). Migrated 2026-09-16 off a `kind:'custom'`
      // closure onto the combinator DSL: nested `selectUpTo(..., 1, ...)`
      // picks one Equipment (`cardType:'artifact'`, same Equipment-⊂-
      // Artifact narrowing the `move` step above already makes) and one
      // Samurai (`subtype:'Samurai'`) — same deterministic "first legal
      // pick" convention `actions.chooseTarget` already uses pool-wide when
      // there's no real player-choice model — then `applyToBound` attaches
      // the bound Equipment onto the bound Samurai via `equipTo`. A no-op
      // when either pool is empty (a `SelectUpTo` binds fewer than `max`
      // items when its pool exhausts, and `ApplyToBound`/`equipTo` are both
      // already-documented no-ops when their own bound index has nothing at
      // it), matching the original closure's own early-return guard. Same
      // real behavior, now recognizer-readable data instead of an opaque
      // closure.
      kind: 'program',
      describe: 'if one or more Equipment entered this way, you may attach one of them to a Samurai you control',
      program: selectUpTo(you.permanentsInPlay().filter('cardType', 'artifact'), 1, 'equipment', [
        selectUpTo(you.creaturesInPlay().filter('subtype', 'Samurai'), 1, 'samurai', [applyToBound('equipment', 0, equipTo('samurai', 0))]),
      ]),
    } satisfies Effect,
  ];
}

export const gilgameshMasterAtArms: CardDefinition = {
  name: 'Gilgamesh, Master-at-Arms',
  manaCost: '{4}{R}{R}',
  typeLine: 'Legendary Creature — Human Samurai',

  pt: [6, 6],

  triggers: [
    { name: 'onEnter', on: 'enter', effects: equipmentTutorEffects() },
    { name: 'onAttack', effects: equipmentTutorEffects() },
  ],
};
