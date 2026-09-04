import type { CardDefinition, Effect } from '../../card';

// A transforming DFC (Enchantment // Creature) — same `backFace` shape
// sidequest-catch-a-fish-cooking-campsite/jecht-reluctant-guardian already
// establish: a second, independent `CardDefinition`, reached via
// `Scenario.face: 'back'`.
export const sidequestRaiseAChocobo: CardDefinition = {
  name: 'Sidequest: Raise a Chocobo',
  manaCost: '{1}{G}',
  typeLine: 'Enchantment',

  triggers: [
    {
      name: 'onEnter',
      effects: [
        // Real TokenScript$ g_2_2_bird_landfall — same inline token
        // call-the-mountain-chocobo/gysahl-greens already use (not in the
        // shared tokens.ts registry, off-limits to edit here). The
        // token's own granted landfall pump ability has no representable
        // field on `TokenInfo` — real printed text, lost the same way as
        // in those other cards.
        { kind: 'createToken', token: { name: 'Bird', manaCost: '0', types: ['Creature', 'Bird'], basePower: 2, baseToughness: 2 }, amount: 1 } satisfies Effect,
      ],
    },
    {
      name: 'onMainPhase',
      effects: [
        {
          // "At the beginning of your first main phase, if you control
          // four or more Birds, transform this enchantment." This model
          // has no conditional-trigger-firing mechanism (a scenario just
          // directly invokes a named trigger) and no "which face is
          // currently showing" state to flip (same gap jecht-reluctant-
          // guardian/sidequest-catch-a-fish's own front faces already
          // document) — `custom` with a genuine no-op `run`, kept purely
          // so the real condition/consequence still surfaces in
          // `synergyTags()` via its `describe`. `Black Chocobo`'s own
          // abilities are exercised directly via `Scenario.face: 'back'`.
          kind: 'custom',
          describe: 'if you control four or more Birds, transform this enchantment into Black Chocobo (no face-tracking state in this model)',
          run: () => {},
        } satisfies Effect,
      ],
    },
  ],

  backFace: {
    name: 'Black Chocobo',
    manaCost: '',
    typeLine: 'Creature — Bird',

    pt: [2, 2],

    triggers: [
      {
        name: 'onTransform',
        effects: [
          // "search your library for a land card, put it onto the
          // battlefield tapped, then shuffle" — same real, untestable gap
          // (no land-typed library filler in this harness) and same
          // dropped `tapped` field Prishe's Wanderings/Reach the Horizon
          // already document.
          { kind: 'move', owner: 'you', from: 'Library', to: 'Battlefield', qty: 1, validType: 'land' } satisfies Effect,
        ],
      },
      {
        name: 'onLandfall',
        effects: [{ kind: 'pumpAll', predicate: 'creatures-you-control', power: 1, toughness: 0, subtype: 'Bird' } satisfies Effect],
      },
    ],
  },
};
