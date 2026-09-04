import type { CardDefinition, Effect } from '../../card';

// Real script (summon_fat_chocobo.txt): `K:Chapter:4:DBWark,DBKerplunk,DBKerplunk,DBKerplunk`
// — a 4-chapter Saga where chapter I is unique and chapters II/III/IV all
// repeat the SAME SVar. Modeled as four named triggers (chapterI..chapterIV,
// same convention jecht-reluctant-guardian-braska-s-final-aeon's own backFace
// uses for a Saga's chapters), even though II/III/IV are literal duplicates
// of each other.
export const summonFatChocobo: CardDefinition = {
  name: 'Summon: Fat Chocobo',
  manaCost: '{4}{G}',
  typeLine: 'Enchantment Creature — Saga Bird',

  pt: [4, 4],

  triggers: [
    {
      name: 'chapterI',
      effects: [
        {
          // Real `TokenScript$ g_2_2_bird_landfall` — same inline token
          // shape call-the-mountain-chocobo/gysahl-greens/choco-comet
          // already use for this exact real token. Its own granted
          // triggered ability ("gets +1/+0 until end of turn whenever a
          // land you control enters") has no representable field on
          // `TokenInfo` (name/manaCost/types/basePower/baseToughness/
          // keywords only, no per-token ability text) — token identity and
          // base stats are real, that one granted sub-ability is lost the
          // same way every other token's own granted ability is lost here.
          kind: 'createToken',
          token: { name: 'Bird', manaCost: '0', types: ['Creature', 'Bird'], basePower: 2, baseToughness: 2 },
          amount: 1,
        } satisfies Effect,
      ],
    },
    {
      // "Kerplunk — Creatures you control gain trample until end of turn."
      // Real `DB$ PumpAll | ValidCards$ Creature.YouCtrl | KW$ Trample` — a
      // pure keyword grant with no P/T component, so `grantKeywordAll` (not
      // `pumpAll`, which has no keyword field) is the correct declarative
      // fit.
      name: 'chapterII',
      effects: [{ kind: 'grantKeywordAll', predicate: 'creatures-you-control', keyword: 'Trample' } satisfies Effect],
    },
    {
      name: 'chapterIII',
      effects: [{ kind: 'grantKeywordAll', predicate: 'creatures-you-control', keyword: 'Trample' } satisfies Effect],
    },
    {
      name: 'chapterIV',
      effects: [{ kind: 'grantKeywordAll', predicate: 'creatures-you-control', keyword: 'Trample' } satisfies Effect],
    },
  ],
};
