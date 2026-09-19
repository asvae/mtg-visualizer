/**
 * Shared per-card case table for the `forge-json-compiler` FDN
 * authoring-pipeline tool's FDN 1-50 coverage push (2026-09-19) —
 * Foundations' first 50 real cards by
 * Scryfall collector number (`data/fdn/fdn_scryfall.json`), the same corpus
 * this project's own live `functional-model/fdn-cards/` authoring pipeline
 * covers (every one of these 50 has a real, already-hand-authored
 * `fdn-cards/<slug>/definition.ts` to cross-check against).
 *
 * Extracted OUT of `fdn-1-50.test.ts` (2026-09-19, same day) so a second,
 * non-test consumer — `server/utils/forgeJsonCompiler.ts`'s card-page
 * "Forge Compiler" tab allowlist — can read the same table without pulling
 * `vitest` into a server-runtime import graph. `fdn-1-50.test.ts` itself now
 * just imports `CASES`/`TOKEN_SCRIPT_IDS` from here rather than declaring
 * them inline; this file carries no test-framework dependency of its own.
 *
 * `TOKEN_SCRIPT_IDS` (below `CASES`) is every real `res/tokenscripts/<id>.txt`
 * id this specific 50-card slice's `Token`/`ChangeZoneAll` effects reference
 * (via each card's own `SVar` `TokenScript$<id>`) — both consumers need the
 * identical list since `compileForgeCard`'s 2nd param requires the caller to
 * pre-resolve every token id a card's Forge JSON names, or it throws
 * `UnsupportedForgeShape` for that card even though it's otherwise in the
 * compiling `blue` set above (Cat Collector, Guarded Heir, ... all need at
 * least one of these).
 *
 * **Per-card status is a 2-state scheme (2026-09-19, later still — user
 * correction: whether a compiled card structurally matches the existing,
 * separately-authored `fdn-cards/<slug>/definition.ts` pipeline file was
 * NEVER the real question this tool is answering, and is dropped as
 * a scored dimension entirely).** The only real question: did
 * `compileForgeCard` turn this card's real Forge JSON into a schema-valid
 * `CardDefinition` at all?
 *  - `gray` — not attempted, OR `compileForgeCard` threw
 *    `UnsupportedForgeShape` (both collapse to "nothing usable yet").
 *  - `blue` — compiled clean, no throw. (This project's own shared
 *    status-color vocabulary reserves `green`/`yellow` for a HUMAN-
 *    reviewed verdict elsewhere, e.g. `pipeline-status.ts`'s FDN gate —
 *    not reused here; a compile-or-not fact needs no review overlay.)
 *
 * `structuralDiff` against each card's real `fdn-cards/<slug>/
 * definition.ts` reference is KEPT in `fdn-1-50.test.ts`/this tool's
 * other consumers as genuinely useful DIAGNOSTIC tooling (it already
 * caught one real compiler bug this way — Uncharted Voyage's silently-
 * dropped `AlternativeDecider$` — see the topic memory writeup) — it's
 * just no longer a SCORED/gating dimension: a real, understood divergence
 * from the pipeline's own independently-authored file (different
 * `Trigger` shape generation, a different-but-equally-valid schema choice
 * for the same Forge ability, ...) never demotes a card off `blue`.
 *
 * A future compiler change that flips ANY status below (breaks a `blue`
 * back to `gray`, or vice versa) must update this table —
 * `fdn-1-50.test.ts`'s own coverage-summary-count assertion is what forces
 * that update to be conscious, not silently missed.
 */
export type CompileStatus = 'gray' | 'blue';

export interface CaseEntry {
  cn: number;
  name: string;
  /** `forge-json-mapper/output/<slug>.json` filename stem. */
  slug: string;
  /** `fdn-cards/<dirSlug>/definition.ts` directory + its named export. */
  dirSlug: string;
  exportName: string;
  status: CompileStatus;
}

// FDN's first 50 real cards by collector number (1, 2, 3, ..., skipping the
// numbers this checked-in 150-card `fdn_scryfall.json` subset doesn't carry
// at all — 9, 11, 42, 49, 52 — same "real selection, real gaps" shape the
// pool's own `data/fdn/fdn_scryfall.json` has).
export const CASES: CaseEntry[] = [
  { cn: 1, name: 'Sire of Seven Deaths', slug: 'sire_of_seven_deaths', dirSlug: 'sire-of-seven-deaths', exportName: 'sireOfSevenDeaths', status: 'blue' },
  { cn: 2, name: 'Arahbo, the First Fang', slug: 'arahbo_the_first_fang', dirSlug: 'arahbo-the-first-fang', exportName: 'arahboTheFirstFang', status: 'gray' },
  { cn: 3, name: 'Armasaur Guide', slug: 'armasaur_guide', dirSlug: 'armasaur-guide', exportName: 'armasaurGuide', status: 'blue' },
  { cn: 4, name: 'Cat Collector', slug: 'cat_collector', dirSlug: 'cat-collector', exportName: 'catCollector', status: 'blue' },
  { cn: 5, name: 'Celestial Armor', slug: 'celestial_armor', dirSlug: 'celestial-armor', exportName: 'celestialArmor', status: 'gray' },
  { cn: 6, name: 'Claws Out', slug: 'claws_out', dirSlug: 'claws-out', exportName: 'clawsOut', status: 'blue' },
  { cn: 7, name: 'Crystal Barricade', slug: 'crystal_barricade', dirSlug: 'crystal-barricade', exportName: 'crystalBarricade', status: 'gray' },
  { cn: 8, name: 'Dauntless Veteran', slug: 'dauntless_veteran', dirSlug: 'dauntless-veteran', exportName: 'dauntlessVeteran', status: 'blue' },
  { cn: 10, name: 'Divine Resilience', slug: 'divine_resilience', dirSlug: 'divine-resilience', exportName: 'divineResilience', status: 'gray' },
  { cn: 12, name: 'Felidar Savior', slug: 'felidar_savior', dirSlug: 'felidar-savior', exportName: 'felidarSavior', status: 'blue' },
  { cn: 13, name: 'Fleeting Flight', slug: 'fleeting_flight', dirSlug: 'fleeting-flight', exportName: 'fleetingFlight', status: 'blue' },
  { cn: 14, name: 'Guarded Heir', slug: 'guarded_heir', dirSlug: 'guarded-heir', exportName: 'guardedHeir', status: 'blue' },
  { cn: 15, name: 'Hare Apparent', slug: 'hare_apparent', dirSlug: 'hare-apparent', exportName: 'hareApparent', status: 'gray' },
  { cn: 16, name: 'Helpful Hunter', slug: 'helpful_hunter', dirSlug: 'helpful-hunter', exportName: 'helpfulHunter', status: 'blue' },
  { cn: 17, name: 'Herald of Eternal Dawn', slug: 'herald_of_eternal_dawn', dirSlug: 'herald-of-eternal-dawn', exportName: 'heraldOfEternalDawn', status: 'gray' },
  { cn: 18, name: 'Inspiring Paladin', slug: 'inspiring_paladin', dirSlug: 'inspiring-paladin', exportName: 'inspiringPaladin', status: 'gray' },
  { cn: 19, name: 'Joust Through', slug: 'joust_through', dirSlug: 'joust-through', exportName: 'joustThrough', status: 'gray' },
  { cn: 20, name: 'Luminous Rebuke', slug: 'luminous_rebuke', dirSlug: 'luminous-rebuke', exportName: 'luminousRebuke', status: 'gray' },
  { cn: 21, name: 'Prideful Parent', slug: 'prideful_parent', dirSlug: 'prideful-parent', exportName: 'pridefulParent', status: 'blue' },
  { cn: 22, name: 'Raise the Past', slug: 'raise_the_past', dirSlug: 'raise-the-past', exportName: 'raiseThePast', status: 'blue' },
  { cn: 23, name: 'Skyknight Squire', slug: 'skyknight_squire', dirSlug: 'skyknight-squire', exportName: 'skyknightSquire', status: 'gray' },
  { cn: 24, name: 'Squad Rallier', slug: 'squad_rallier', dirSlug: 'squad-rallier', exportName: 'squadRallier', status: 'blue' },
  { cn: 25, name: 'Sun-Blessed Healer', slug: 'sun_blessed_healer', dirSlug: 'sun-blessed-healer', exportName: 'sunBlessedHealer', status: 'gray' },
  { cn: 26, name: 'Twinblade Blessing', slug: 'twinblade_blessing', dirSlug: 'twinblade-blessing', exportName: 'twinbladeBlessing', status: 'blue' },
  { cn: 27, name: "Valkyrie's Call", slug: 'valkyries_call', dirSlug: 'valkyrie-s-call', exportName: 'valkyriesCall', status: 'gray' },
  { cn: 28, name: 'Vanguard Seraph', slug: 'vanguard_seraph', dirSlug: 'vanguard-seraph', exportName: 'vanguardSeraph', status: 'blue' },
  { cn: 29, name: 'Arcane Epiphany', slug: 'arcane_epiphany', dirSlug: 'arcane-epiphany', exportName: 'arcaneEpiphany', status: 'gray' },
  { cn: 30, name: 'Archmage of Runes', slug: 'archmage_of_runes', dirSlug: 'archmage-of-runes', exportName: 'archmageOfRunes', status: 'gray' },
  { cn: 31, name: 'Bigfin Bouncer', slug: 'bigfin_bouncer', dirSlug: 'bigfin-bouncer', exportName: 'bigfinBouncer', status: 'blue' },
  { cn: 32, name: 'Cephalid Inkmage', slug: 'cephalid_inkmage', dirSlug: 'cephalid-inkmage', exportName: 'cephalidInkmage', status: 'gray' },
  { cn: 33, name: 'Clinquant Skymage', slug: 'clinquant_skymage', dirSlug: 'clinquant-skymage', exportName: 'clinquantSkymage', status: 'blue' },
  { cn: 34, name: 'Curator of Destinies', slug: 'curator_of_destinies', dirSlug: 'curator-of-destinies', exportName: 'curatorOfDestinies', status: 'gray' },
  { cn: 35, name: 'Drake Hatcher', slug: 'drake_hatcher', dirSlug: 'drake-hatcher', exportName: 'drakeHatcher', status: 'gray' },
  { cn: 36, name: 'Elementalist Adept', slug: 'elementalist_adept', dirSlug: 'elementalist-adept', exportName: 'elementalistAdept', status: 'blue' },
  { cn: 37, name: 'Erudite Wizard', slug: 'erudite_wizard', dirSlug: 'erudite-wizard', exportName: 'eruditeWizard', status: 'blue' },
  { cn: 38, name: 'Faebloom Trick', slug: 'faebloom_trick', dirSlug: 'faebloom-trick', exportName: 'faebloomTrick', status: 'gray' },
  { cn: 39, name: 'Grappling Kraken', slug: 'grappling_kraken', dirSlug: 'grappling-kraken', exportName: 'grapplingKraken', status: 'blue' },
  { cn: 40, name: 'High Fae Trickster', slug: 'high_fae_trickster', dirSlug: 'high-fae-trickster', exportName: 'highFaeTrickster', status: 'gray' },
  { cn: 41, name: 'Homunculus Horde', slug: 'homunculus_horde', dirSlug: 'homunculus-horde', exportName: 'homunculusHorde', status: 'gray' },
  { cn: 43, name: 'Inspiration from Beyond', slug: 'inspiration_from_beyond', dirSlug: 'inspiration-from-beyond', exportName: 'inspirationFromBeyond', status: 'blue' },
  { cn: 44, name: 'Kaito, Cunning Infiltrator', slug: 'kaito_cunning_infiltrator', dirSlug: 'kaito-cunning-infiltrator', exportName: 'kaitoCunningInfiltrator', status: 'gray' },
  { cn: 45, name: 'Kiora, the Rising Tide', slug: 'kiora_the_rising_tide', dirSlug: 'kiora-the-rising-tide', exportName: 'kioraTheRisingTide', status: 'blue' },
  { cn: 46, name: 'Lunar Insight', slug: 'lunar_insight', dirSlug: 'lunar-insight', exportName: 'lunarInsight', status: 'blue' },
  // The real `fdn-cards/mischievous-mystic/definition.ts` used to export a
  // typo'd `mischiefousMystic` — fixed to `mischievousMystic` as a real
  // side effect of this file being replaced with the compiler's own output
  // (2026-09-19, FDN 1-50 file-replacement pass — see
  // `.claude/agent-memory/schema/topics/
  // forge-json-compiler-fdn-1-50-file-replacement-2026-09-19.md`).
  { cn: 47, name: 'Mischievous Mystic', slug: 'mischievous_mystic', dirSlug: 'mischievous-mystic', exportName: 'mischievousMystic', status: 'blue' },
  { cn: 48, name: 'Refute', slug: 'refute', dirSlug: 'refute', exportName: 'refute', status: 'blue' },
  { cn: 50, name: 'Skyship Buccaneer', slug: 'skyship_buccaneer', dirSlug: 'skyship-buccaneer', exportName: 'skyshipBuccaneer', status: 'blue' },
  { cn: 51, name: 'Sphinx of Forgotten Lore', slug: 'sphinx_of_forgotten_lore', dirSlug: 'sphinx-of-forgotten-lore', exportName: 'sphinxOfForgottenLore', status: 'gray' },
  { cn: 53, name: 'Uncharted Voyage', slug: 'uncharted_voyage', dirSlug: 'uncharted-voyage', exportName: 'unchartedVoyage', status: 'gray' },
  { cn: 54, name: 'Abyssal Harvester', slug: 'abyssal_harvester', dirSlug: 'abyssal-harvester', exportName: 'abyssalHarvester', status: 'gray' },
  { cn: 55, name: 'Arbiter of Woe', slug: 'arbiter_of_woe', dirSlug: 'arbiter-of-woe', exportName: 'arbiterOfWoe', status: 'gray' },
];

// Real Forge `res/tokenscripts/<id>.txt` ids this 50-card slice's `Token`
// effects reference (`SVar.<X>.TokenScript`) — see this file's own header.
// Both `fdn-1-50.test.ts` and `server/utils/forgeJsonCompiler.ts` load this
// exact list via `load-token-scripts.ts`'s `loadTokenScripts`.
export const TOKEN_SCRIPT_IDS = ['c_a_food_sac', 'w_3_3_knight', 'w_1_1_rabbit', 'w_1_1_cat', 'u_1_1_faerie_flying', 'scion_of_the_deep'];
