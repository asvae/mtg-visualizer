import type { CardDefinition, Effect, EffectContext, Actions } from '../../card';
import { TOKENS } from '../../tokens.ts';

export const dragoonsLance: CardDefinition = {
  name: "Dragoon's Lance",
  manaCost: '{1}{W}',
  typeLine: 'Artifact — Equipment',

  // "Equipped creature gets +1/+0 and is a Knight in addition to its other
  // types" / "During your turn, equipped creature has flying" — ALL THREE
  // real, executable machinery now (ENGINE_GAPS.md gap #14, fully closed
  // 2026-09-12): the Flying clause was already real via
  // `continuousKeywordGrants`'s `equippedBySelf` mode; the +1/+0 P/T bonus
  // and "is a Knight" type grant are now the SAME real, query-time
  // mechanism generalized to two new sibling fields
  // (`continuousPTGrants`/`continuousTypeGrants`, `card.ts`) — a fixed
  // delta and a creature-subtype broadcast, both re-checked live against
  // whatever creature `RealCard.attachedToId` currently names, exactly
  // like the Flying grant already was. Real Forge citation (dragoons_lance.
  // txt, ../mtg-forge): all three clauses are ONE `S:Mode$ Continuous |
  // Affected$ Creature.EquippedBy | AddPower$ 1 | AddType$ Knight |
  // Description$ ...` static ability plus a second `AddKeyword$ Flying |
  // Condition$ PlayerTurn` one — this engine models them as three
  // independent grant fields rather than one combined ability, since
  // `state.ts`'s own layer split (P/T vs. type vs. keyword) already keeps
  // them in separate read paths (`effectivePT`/`effectiveSubtypes`/
  // `effectiveKeywords`) regardless of how Forge's own single ability
  // groups them.
  staticAbilities: ['Equipped creature gets +1/+0 and is a Knight in addition to its other types.'],

  continuousKeywordGrants: [{ keywords: ['Flying'], includeSelf: false, equippedBySelf: true, onlyDuringYourTurn: true }],
  continuousPTGrants: [{ power: 1, toughness: 0, includeSelf: false, equippedBySelf: true }],
  continuousTypeGrants: [{ types: ['Knight'], includeSelf: false, equippedBySelf: true }],

  // Job select — "When this Equipment enters, create a 1/1 colorless Hero
  // creature token, then attach this to it." A real ETB trigger (Forge's
  // own K:Job select keyword expands to exactly this), not the card's
  // Equip ability below — the two are independent abilities, so both fit
  // without the one-activated-ability-slot conflict crystal-fragments-
  // summon-alexander's own comment documents.
  //
  // `on: 'enter'` (2026-09-16, definition-lane sweep off sage-s-nouliths'
  // own identical fix, itself found 2026-09-16 converting THAT card's
  // scenario to a real engine-piloted trace) — WITHOUT this, `engine.ts`'s
  // own real auto-fire (`card.triggers?.find((t) => t.on === 'enter')`)
  // never fires this trigger at all; only the OLD declarative `harness.ts`
  // scenario style's own name-fired `sequence` masked that (it fires a
  // named trigger directly, ignoring `on` entirely — see this card's own
  // `scenarios.ts`, still that older shape: `sequence: ['onEnter', ...]`,
  // so this fix is currently unobservable via trace here too, same
  // structural wall sage-s-nouliths' own comment documents — not fixed by
  // rewriting this scenario, since no engine-piloted trace exists for this
  // card yet).
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

  // Gae Bolg — Equip {4}, a flavor name on the standard Equip ability, not
  // a second card-specific mechanic. Same attach-to-a-chosen-creature shape
  // as ninja-s-blades' own Equip {2}.
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
