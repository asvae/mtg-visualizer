import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const sagesNouliths: CardDefinition = {
  name: "Sage's Nouliths",
  manaCost: '{1}{U}',
  typeLine: 'Artifact — Equipment',

  // The +1/+0 P/T bonus and "is a Cleric" type grant are now real,
  // executable machinery (ENGINE_GAPS.md gap #14, fully closed 2026-09-12),
  // same generalization dragoon-s-lance's/paladin-s-arms's/white-mage-s-
  // staff's own migrations established. The granted "Whenever this
  // creature attacks, untap target attacking creature" ability below stays
  // its own, unrelated (already-real) mechanism — see the `onEquippedAttacks`
  // trigger's own comment.
  staticAbilities: ['Equipped creature gets +1/+0 and is a Cleric in addition to its other types.'],

  continuousPTGrants: [{ power: 1, toughness: 0, includeSelf: false, equippedBySelf: true }],
  continuousTypeGrants: [{ types: ['Cleric'], includeSelf: false, equippedBySelf: true }],

  // Job select — same real ETB mechanic (create a 1/1 Hero token, attach
  // this to it) as dragoon-s-lance/machinist-s-arsenal/paladin-s-arms'
  // own onEnter trigger. `on: 'enter'` (2026-09-16, found while converting
  // this card's own scenario to a real engine-piloted trace) — WITHOUT
  // this, `engine.ts`'s own real auto-fire (`card.triggers?.find((t) =>
  // t.on === 'enter')`) never fires this trigger at all; only the OLD
  // declarative `harness.ts` scenario style's own name-fired `sequence`
  // masked that (it fires a named trigger directly, ignoring `on`
  // entirely). Its dragoon-s-lance/machinist-s-arsenal/paladin-s-arms
  // siblings share this SAME real gap (checked, not fixed here — none of
  // them have an engine-piloted scenario yet either, so it's currently
  // unobservable for them too; flagged for the definition lane to sweep).
  triggers: [
    {
      name: 'onEnter',
      on: 'enter',
      effects: [
        {
          kind: 'custom',
          describe: 'create a 1/1 colorless Hero creature token, then attach this to it',
          run: (ctx: EffectContext, actions: Actions) => {
            const [created] = actions.createToken(ctx.you, TOKENS.c_1_1_hero, 1);
            if (created) actions.equip(ctx.self, created);
          },
        } satisfies Effect,
      ],
    },
    // The granted "whenever this creature attacks, untap target attacking
    // creature" — granted TO the equipped creature by Sage's Nouliths' own
    // static ability. Real, executable auto-fire via `on: 'equippedAttacks'`
    // (closed 2026-09-16, card.ts's own `Trigger.on` doc comment — the SAME
    // primitive White Mage's Staff's own lifegain grant now uses too, closed
    // the same pass; previously this trigger fired only via a manual
    // `pilotFireTrigger` call in `scenarios.ts`, same "underlying event has
    // to actually happen first, THEN the trigger fires manually" gap that
    // file's own prior comment documented). `synergy.json`'s own
    // `event:'untap'` fact here is REAL, evidenced vocabulary (`event:'untap'`
    // promoted off `PARKED_ACTION_FNS` the same day by Magic Damper/fin-61's
    // own `untapTarget` Effect), with genuine `fn:'untap'` trace evidence
    // from this exact trigger firing, now for real off the engine's own
    // `declareAttackers` call (see `scenarios.ts`) — no `verify-synergy.mjs`
    // exemption needed for it, only for the sibling `pump`/`grantType`
    // static-broadcast facts below (still real gaps, no layer-7c pipeline).
    // `untapTarget`'s own declarative `validType: 'attacking'` pool is
    // genuinely "any attacking creature" (real printed text — no "equipped
    // creature" self-reference needed in the EFFECT at all, only in the
    // trigger CONDITION, which `on: 'equippedAttacks'` now covers), so this
    // card closes fully with zero new Effect vocabulary too.
    {
      name: 'onEquippedAttacks',
      on: 'equippedAttacks',
      effects: [{ kind: 'untapTarget', validType: 'attacking' } satisfies Effect],
    },
  ],

  // Hagneia — Equip {3}, a flavor name on the standard Equip ability.
  activationCost: '{3}',
  effects: [
    {
      kind: 'custom',
      describe: 'attach to target creature you control',
      run: (ctx: EffectContext, actions: Actions) => {
        const target = actions.chooseTarget(ctx.you.getCreaturesInPlay());
        if (target) actions.equip(ctx.self, target);
      },
    } satisfies Effect,
  ],
};
