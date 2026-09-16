import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const machinistsArsenal: CardDefinition = {
  name: "Machinist's Arsenal",
  manaCost: '{4}{W}',
  typeLine: 'Artifact — Equipment',

  // Real X = Count$Valid Artifact.YouCtrl/Times.2 — a live artifact-count-
  // dependent P/T grant (layer 7c, recalculated off board state rather
  // than a fixed delta). CLOSED 2026-09-15 (fin/16-25 pass) via
  // `continuousPTGrants`'s new `scalePerType` shape (`card.ts`'s own doc
  // comment has the real Forge citation) — the same real `Count$Valid...
  // YouCtrl/Times.N` scaling mechanism `ptFormula.kind:
  // 'addPerEquipmentControlled'` already uses for a SELF-only CDA
  // (Adelbert Steiner), now real for a BROADCAST grant too. No possible
  // trace evidence either way (this card's own `scenarios.ts` is a plain
  // `harness.ts` Scenario[], same structural wall Dragoon's Lance's/
  // Paladin's Arms' own identically-shaped fixed-delta grants already hit
  // — `isEquippedPTGrantFact`, `scripts/verify-synergy.mjs`), but the
  // engine mechanism itself is now genuinely real and live-recalculated,
  // not just descriptive text.
  //
  // The "is an Artificer" TYPE-grant half is a DIFFERENT, independently
  // fixed clause (a bare subtype addition, not scaled by anything) — closed
  // via `continuousTypeGrants`, same mechanism the sibling cards' own "is a
  // Knight/Cleric/Wizard" grants use.
  continuousPTGrants: [{ scalePerType: { type: 'Artifact', power: 2, toughness: 2 }, includeSelf: false, equippedBySelf: true }],
  continuousTypeGrants: [{ types: ['Artificer'], includeSelf: false, equippedBySelf: true }],

  // Job select — same real ETB mechanic (create a Hero token, attach this
  // to it) as dragoon-s-lance's own onEnter trigger; independent of the
  // Machina Equip ability below, so both fit without a one-slot conflict.
  //
  // `on: 'enter'` (2026-09-16, definition-lane sweep — same real gap
  // sage-s-nouliths' own 2026-09-16 fix found and dragoon-s-lance/
  // paladin-s-arms share: without it, `engine.ts`'s real auto-fire never
  // fires this trigger, only the old declarative `harness.ts` name-fired
  // `sequence` masked that. Currently unobservable via trace (this card's
  // own `scenarios.ts` is still that older `sequence: ['onEnter', ...]`
  // shape, no engine-piloted trace) — same documented caveat, not fixed by
  // forcing a scenario rewrite here.
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
  ],

  // Machina — Equip {4}, a flavor name on the standard Equip ability.
  activationCost: '{4}',
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
