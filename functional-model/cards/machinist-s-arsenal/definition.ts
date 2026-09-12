import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const machinistsArsenal: CardDefinition = {
  name: "Machinist's Arsenal",
  manaCost: '{4}{W}',
  typeLine: 'Artifact — Equipment',

  // Real X = Count$Valid Artifact.YouCtrl/Times.2 — a live artifact-count-
  // dependent P/T grant (layer 7c, but recalculated off board state rather
  // than a fixed delta), same "no live-recalculated CDA machinery" gap
  // gaelicat/adelbert-steiner's own comments already document; kept as
  // real text. UNLIKE dragoon-s-lance/paladin-s-arms/crystal-fragments/
  // white-mage-s-staff/sage-s-nouliths' own identical-SHAPED "+N/+N" clause
  // (now real via `continuousPTGrants`, ENGINE_GAPS.md gap #14 fully
  // closed 2026-09-12), THIS card's own bonus is genuinely VARIABLE (scales
  // with the controller's own artifact count), not a fixed delta —
  // `continuousPTGrants` is deliberately a plain `{power, toughness}` NUMBER
  // pair (see `card.ts`'s own doc comment), so it structurally cannot
  // represent this clause; stays real `staticAbilities` text only, a real,
  // separate, still-open gap (same class as Gaelicat's/Magitek Infantry's
  // own threshold-CDA gaps, NOT closed by this pass). The per-artifact-count
  // SCALING factor is deliberately left unrepresented in the pump fact's own
  // shape — same "bare event, no numeric sub-fields" treatment
  // adelbert-steiner's own live-recalculated per-equipment-count pump
  // already established.
  //
  // The "is an Artificer" TYPE-grant half is a DIFFERENT, independently
  // fixed clause (a bare subtype addition, not scaled by anything) — closed
  // for real below via `continuousTypeGrants`, same mechanism the sibling
  // cards' own "is a Knight/Cleric/Wizard" grants now use.
  staticAbilities: ['Equipped creature gets +2/+2 for each artifact you control and is an Artificer in addition to its other types.'],

  continuousTypeGrants: [{ types: ['Artificer'], includeSelf: false, equippedBySelf: true }],

  // Job select — same real ETB mechanic (create a Hero token, attach this
  // to it) as dragoon-s-lance's own onEnter trigger; independent of the
  // Machina Equip ability below, so both fit without a one-slot conflict.
  triggers: [
    {
      name: 'onEnter',
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
