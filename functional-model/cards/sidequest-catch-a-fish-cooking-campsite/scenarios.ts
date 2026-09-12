import type { Scenario } from '../../harness';

// One continuous real playthrough (2026-09-12, unified-Fact-model migration
// — "try a single scenario before concluding 2 are needed" standing rule),
// replacing the old 4 flat scenarios below (kept only as a comment for the
// no-op branches they used to cover — see the tail note): a real cast (no
// `trigger`/`ability`/`activationCost` set on the OPENING move, so
// `lifecycleBefore`/`lifecycleAfter` log genuine `cast`/`enters` lines for
// the front face's own baseline facts), then the front face's own real
// upkeep dig/reveal/Food-token trigger, then the back face's own real
// activated ability — same "single scenario, sequence across both faces"
// shape jill-shiva-s-dominant-shiva-warden-of-ice/dion-bahamut-s-dominant
// established, just via harness.ts's lighter `sequence` (no turn passage or
// Saga-chapter timing is needed here, so the heavier engine-trace.ts pilot
// those two cards use would be unwarranted machinery for this card).
//
// `libraryCount: 1, libraryArtifactCount: 1` keeps the single library card
// UNAMBIGUOUSLY the "top card" the upkeep trigger reads (no ordering
// question between an artifact-typed and a plain filler card to worry
// about) — same reasoning the old flat scenario below already used.
// `creaturesCount: 2` seeds real, pre-existing creatures for the back
// face's own "each creature you control" broadcast to land on.
//
// No separate scenario for "top card is neither artifact nor creature" or
// "empty library" (the old flat scenarios' own no-op branches) — per the
// user's own framing this pass ("I'm not checking scenarios, only facts"),
// these documented a `custom` effect's own conditional branches rather than
// backing any additional Fact, and the real oracle-text conditionality is
// already spelled out in `definition.ts`'s own comment/`describe` string.
export const scenarios: Scenario[] = [
  {
    result:
      "casts and enters; upkeep trigger reveals the library-top artifact, puts it into hand, creates a Food token (transforms into Cooking Campsite — not itself tracked as state, see definition.ts); the back face's own activated ability then puts a +1/+1 counter on each of your creatures",
    you: { libraryCount: 1, libraryArtifactCount: 1, creaturesCount: 2 },
    sequence: ['onUpkeep', { face: 'back', activate: true }],
  },
];
