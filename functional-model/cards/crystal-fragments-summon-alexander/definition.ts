import type { CardDefinition, Effect } from '../../card';
import { opponents, sequence, tap } from '../../combinator';

// A transforming DFC Equipment // Saga — same shape as jecht-reluctant-
// guardian-braska-s-final-aeon's own front/back split: `backFace` is a
// second independent CardDefinition, the Saga's chapter abilities become
// that face's own `triggers` named chapterI/II/III (same 714.3a/b
// turn-based-action-modeled-as-trigger simplification documented there).
//
// Crystal Fragments prints TWO activated abilities (plain Equip {1}, and
// the {5}{W}{W} sorcery-speed transform) but CardDefinition only has one
// `activationCost`/`effects` slot for a permanent's own activated ability —
// same one-slot constraint ninja-s-blades/definition.ts already lives with for
// a single Equip ability. The transform is the one worth modeling as real
// effects (it's what actually moves the object toward `backFace`); plain
// Equip {1} is left as static text, same treatment Ninja's Blades gives its
// own Job-select mechanic.
export const crystalFragmentsSummonAlexander: CardDefinition = {
  name: 'Crystal Fragments',
  manaCost: '{W}',
  typeLine: 'Artifact — Equipment',

  // "Equipped creature gets +1/+1." — now real, executable machinery
  // (ENGINE_GAPS.md gap #14's own follow-up, fully closed 2026-09-12):
  // `continuousPTGrants` (`card.ts`'s new sibling field to
  // `continuousKeywordGrants`), read live by `state.ts`'s `effectivePT`
  // against whatever creature `RealCard.attachedToId` currently names —
  // same real, query-time mechanism dragoon-s-lance's own equipped-Flying
  // grant already established, generalized to a fixed P/T delta. This is
  // the ONE card in this shape's own migration batch whose scenario is a
  // real `engine-trace.ts` pilot (see scenarios.ts), so its own `pump`
  // fact now gets REAL trace evidence (a genuine `read:getNetPower` line
  // showing the equipped creature's P/T before and after attachment) —
  // unlike its siblings (Dragoon's Lance/Machinist's Arsenal/Paladin's
  // Arms/White Mage's Staff/Sage's Nouliths), whose plain `harness.ts`
  // Scenario[] style structurally cannot inject that read.
  staticAbilities: ['Equipped creature gets +1/+1.', 'Equip {1}'],

  continuousPTGrants: [{ power: 1, toughness: 1, includeSelf: false, equippedBySelf: true }],

  activationCost: '{5}{W}{W}',
  effects: [
    {
      // MIGRATED (2026-09-14) off a `kind:'custom'` closure onto the real
      // `combinator.ts` AST — a plain `Sequence` of two fixed, self-targeted
      // `moveSelf` steps, no Query/Filter/Branch needed at all (see
      // `combinator.ts`'s own header for why this shape deliberately stays
      // "Sequence only" rather than being forced into a Query/Filter shape
      // it doesn't need).
      //
      // Authored via `combinator.ts`'s own fluent builder layer (2026-09-14
      // follow-up — SAME AST as before, just not a raw nested object
      // literal).
      kind: 'program',
      describe: "exile this Equipment, then return it to the battlefield transformed under its owner's control (activate only as a sorcery)",
      program: sequence('Exile', 'Battlefield'),
    } satisfies Effect,
  ],

  backFace: {
    name: 'Summon: Alexander',
    manaCost: '',
    typeLine: 'Enchantment Creature — Saga Construct',
    // Real printed 4/3 (Scryfall card_faces[1].power/toughness) — omitted
    // before this pass, which would have silently defaulted this creature
    // face to a fake 1/1 via state.ts's own addCard (see card.ts's own `pt`
    // doc comment for that exact documented gap).
    pt: [4, 3],
    keywords: ['Flying'],
    triggers: [
      {
        name: 'chapterI',
        effects: [
          // A whole-turn, all-damage prevention shield (ENGINE_GAPS.md gap
          // #8, closed) — real Forge citation,
          // `res/cardsfolder/c/crystal_fragments_summon_alexander.txt`'s own
          // shipped script: `SVar:RPrevent:Event$ DamageDone | Prevent$ True
          // | ActiveZones$ Command | ValidTarget$ Creature.YouCtrl` (a real
          // per-object `ReplacementEffect`, general machinery this engine
          // doesn't have — see `state.dealDamage`'s own doc comment). Modeled
          // as a real `grantKeywordAll` grant of the `'DamagePrevention'`
          // keyword (card.ts's own approximation, same shape `'Unblockable'`
          // already establishes), `untilEndOfTurn: true` for real 514.2
          // Cleanup expiry — reuses the EXISTING until-end-of-turn
          // keyword-grant machinery (`state.grantKeyword`/
          // `clearUntilEndOfTurnKeywordGrants`), not a new mechanism. No
          // longer a no-op `run: () => {}`.
          { kind: 'grantKeywordAll', predicate: 'creatures-you-control', keyword: 'DamagePrevention', untilEndOfTurn: true } satisfies Effect,
        ],
      },
      {
        name: 'chapterII',
        effects: [
          // Same real shield as chapter I — Forge's own script fires the
          // identical `DBDefend` sub-ability for both chapters (`K:Chapter:
          // 3:DBDefend,DBDefend,DBSubdue`).
          { kind: 'grantKeywordAll', predicate: 'creatures-you-control', keyword: 'DamagePrevention', untilEndOfTurn: true } satisfies Effect,
        ],
      },
      {
        name: 'chapterIII',
        effects: [
          {
            // MIGRATED (2026-09-14) off a `kind:'custom'` closure onto the
            // real `combinator.ts` AST — a plain `Each` (`tap`) over an
            // unfiltered `creaturesInPlay(opponents)` `Query`.
            kind: 'program',
            describe: 'tap all creatures your opponents control',
            program: opponents.creaturesInPlay().each(tap()),
          } satisfies Effect,
        ],
      },
    ],
  },
};
