import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';

// Real script (relentless_x_atm092.txt): Artifact Creature Robot Spider.
// "This creature can't be blocked except by three or more creatures" is a
// real `MinMaxBlocker` static restriction — no combat/blocking-legality
// step exists anywhere in this model (see state.ts's own header: no
// state-based actions, no attack/block step), so it's real text only,
// same treatment every other unbuildable combat-restriction static
// ability gets.
//
// "{8}: Return this card from your graveyard to the battlefield tapped
// with a finality counter on it" is a real `ActivationZone$ Graveyard`
// activated ability — usable while the card is IN the graveyard, not on
// the battlefield. `harness.ts`'s own `selfZone` rule always starts `self`
// on the Battlefield for ANY `abilities`/`activationCost` scenario (there
// is no `activationZone` field anywhere on `CardDefinition`/`Scenario` to
// say otherwise) — a real, structural gap, not something this card
// invents around. The resulting STATE (tapped, with a finality counter) is
// still real and modeled directly via `putCounter`/`actions.tap`; only the
// "this card genuinely started the resolution in the graveyard" half of
// the real effect isn't separately represented — the scenario's own
// `result` says so explicitly rather than silently pretending it is.
export const relentlessXAtm092: CardDefinition = {
  name: 'Relentless X-ATM092',
  manaCost: '{6}',
  typeLine: 'Artifact Creature — Robot Spider',

  pt: [6, 5],
  staticAbilities: ["This creature can't be blocked except by three or more creatures."],

  abilities: [
    {
      name: 'returnFromGraveyard',
      cost: '{8} (activated only while this card is in your graveyard)',
      effects: [
        { kind: 'putCounter', target: 'self', counterType: 'finality', amount: 1 } satisfies Effect,
        {
          kind: 'custom',
          describe: 'tap this card as it returns to the battlefield',
          run: (ctx: EffectContext, actions: Actions) => actions.tap(ctx.self),
        } satisfies Effect,
      ],
    },
  ],
};
