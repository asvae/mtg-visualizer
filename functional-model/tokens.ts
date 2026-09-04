import type { TokenInfo } from './interfaces';

// Real BLB token data — hand-derived from this app's own Scryfall-backed
// `POOL_TOKEN_REGISTRY` (server/api/card/[set]/[number].ts), NOT invented.
// That registry exists to resolve TokenScript$ ids (Forge's own naming for
// its token templates) against real printed tokens on BLB's dedicated token
// sheet (Scryfall `set:tblb`) for the card page's Interactions panel — this
// file reshapes the SAME entries into interfaces.ts's `TokenInfo` shape so
// generated code can call `createToken(you, TOKENS.w_1_1_rabbit)` against
// something real instead of a bare string id.
//
// A hand transcription, not an import, because POOL_TOKEN_REGISTRY's own
// file relies on Nitro/H3's auto-imported `defineEventHandler`/
// `getRouterParam` at its top level — real only inside a running Nuxt
// server, not importable from a plain script or `tsc --noEmit`. If
// POOL_TOKEN_REGISTRY gains/loses/renames a BLB token entry, this file needs
// a matching manual update (see the keys below against that registry's own
// `w_*`/`u_*`/`b_*`/`g_*`/`ur_*`/bare-name keys).
//
// power/toughness: parsed off each TokenScript id's OWN naming convention
// (`<colorletters>_<power>_<toughness>_<subtype>[_keyword]` — Forge's real,
// consistent scheme for its token ids, e.g. `u_1_1_fish` = blue 1/1 Fish,
// `w_0_4_wall_defender` = white 0/4 Wall with defender), not the registry's
// `name` field — most of BLB's own entries there are a bare "<Subtype>
// token" with no printed P/T in the string at all (only the two Cat entries
// happen to spell out "1/1" in their `name`). A noncreature token (Food,
// Sword, Cragflame) has no P/T component in its id, matching real Forge's
// own Card.getBasePower()/getBaseToughness() returning a real `int` (0, not
// null/undefined) for a noncreature permanent.
//
// manaCost: BLB's own tokens are all 0-mana-cost objects (created by an
// ability, never cast) — `'0'` is TokenInfo(String)'s own real default for
// an unspecified cost (TokenInfo.java's string-constructor branch), not a
// value invented for this file.
export const TOKENS: Record<string, TokenInfo> = {
  w_1_1_cat: { name: 'Cat', manaCost: '0', types: ['Creature', 'Cat'], basePower: 1, baseToughness: 1 },
  w_1_1_cat_lifelink: { name: 'Cat', manaCost: '0', types: ['Creature', 'Cat'], basePower: 1, baseToughness: 1 },
  w_1_1_rabbit: { name: 'Rabbit', manaCost: '0', types: ['Creature', 'Rabbit'], basePower: 1, baseToughness: 1 },
  c_a_food_sac: { name: 'Food', manaCost: '0', types: ['Artifact', 'Food'], basePower: 0, baseToughness: 0 },
  // Not BLB-specific (Treasure is reused across many sets' own token sheets,
  // so it never made it into the BLB-scoped POOL_TOKEN_REGISTRY this file
  // otherwise transcribes) — added directly since Beza, the Bounding
  // Spring's own Forge script creates it via this exact TokenScript$ id.
  c_a_treasure_sac: { name: 'Treasure', manaCost: '0', types: ['Artifact', 'Treasure'], basePower: 0, baseToughness: 0 },
  u_1_1_fish: { name: 'Fish', manaCost: '0', types: ['Creature', 'Fish'], basePower: 1, baseToughness: 1 },
  ur_1_1_otter_prowess: { name: 'Otter', manaCost: '0', types: ['Creature', 'Otter'], basePower: 1, baseToughness: 1 },
  w_0_4_wall_defender: { name: 'Wall', manaCost: '0', types: ['Creature', 'Wall'], basePower: 0, baseToughness: 4 },
  sword: { name: 'Sword', manaCost: '0', types: ['Artifact', 'Equipment'], basePower: 0, baseToughness: 0 },
  g_1_1_squirrel: { name: 'Squirrel', manaCost: '0', types: ['Creature', 'Squirrel'], basePower: 1, baseToughness: 1 },
  b_1_1_bat_flying: { name: 'Bat', manaCost: '0', types: ['Creature', 'Bat'], basePower: 1, baseToughness: 1 },
  cragflame: { name: 'Cragflame', manaCost: '0', types: ['Legendary', 'Artifact', 'Equipment'], basePower: 0, baseToughness: 0 },
  b_1_1_rat_relentless: { name: 'Rat', manaCost: '0', types: ['Creature', 'Rat'], basePower: 1, baseToughness: 1 },
  // Not BLB — FIN's own token (The Final Days' Flashback SP$ Token), added
  // ad hoc to cover that one card. Matches synergy-model/data/registries.json's
  // own `horror-1` entry (2/2 black Horror) and forgeTranslate.ts's
  // TOKEN_SCRIPT_MAP (`b_2_2_horror: 'horror-1'`).
  b_2_2_horror: { name: 'Horror', manaCost: '0', types: ['Creature', 'Horror'], basePower: 2, baseToughness: 2 },
};
