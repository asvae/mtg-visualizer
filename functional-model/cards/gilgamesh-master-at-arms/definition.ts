import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

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
      // blades' own comment), so `custom`, reading the real battlefield
      // for an Equipment and a Samurai and attaching the first of each —
      // real actions only, narrowly scoped.
      kind: 'custom',
      describe: 'if one or more Equipment entered this way, you may attach one of them to a Samurai you control',
      run: (ctx: EffectContext, actions: Actions) => {
        // `isArtifact()`, not `hasSubtype('Equipment')` — same Equipment ⊂
        // Artifact narrowing the `move` step above already made (a
        // scenario's own `libraryArtifactCount` filler is a generic
        // Artifact with no Equipment subtype seeded on it), kept
        // consistent between both steps.
        const equipment = ctx.you.getCardsIn('Battlefield').filter((c) => c.isArtifact());
        const samurai = ctx.you.getCreaturesInPlay().filter((c) => c.hasSubtype('Samurai'));
        if (equipment.length === 0 || samurai.length === 0) return;
        actions.equip(equipment[0]!, samurai[0]!);
      },
    } satisfies Effect,
  ];
}

export const gilgameshMasterAtArms: CardDefinition = {
  name: 'Gilgamesh, Master-at-Arms',
  manaCost: '{4}{R}{R}',
  typeLine: 'Legendary Creature — Human Samurai',

  pt: [6, 6],

  triggers: [
    { name: 'onEnter', effects: equipmentTutorEffects() },
    { name: 'onAttack', effects: equipmentTutorEffects() },
  ],
};
