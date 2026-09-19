/**
 * Deterministic Forge-JSON -> `CardDefinition` compiler — a real step of
 * the FDN authoring pipeline (promoted out of `scripts/experiments/`
 * 2026-09-19; widened again the same day, later still, to 25 of FDN's
 * first 50 real cards — the Cost$/activated-ability, Dig, generic
 * `non<Type>`, and Aura-keyword-grant/`Enchant:Creature` additions, closing
 * Squad Rallier and Twinblade Blessing): the structure a human/AI agent
 * would otherwise re-derive by hand from Oracle text is instead produced by
 * a fixed, rule-based translation table off real Forge's own card script
 * (converted to JSON by the sibling `forge-json-mapper` tool, still under
 * `scripts/experiments/` — see this file's own header note wherever it's
 * referenced). Mirrors how Forge's own `AbilityFactory.java` dispatches on
 * the `SP$`/`AB$`/`DB$`/`ST$`/`Mode$` value to one specific Java class — a
 * lookup, not a language-understanding problem.
 *
 * Covers every real Forge shape needed by the cards `fdn-1-50-cases.ts`
 * marks `blue` (25 of FDN's first 50 real cards by collector number — see
 * that file's own table for the full per-card list and the genuine gaps
 * still left, deliberately, uncovered — Valkyrie's Call/Crystal Barricade/
 * Herald of Eternal Dawn each have a real, deeper, still-open gap beyond
 * the 2026-09-19 additions above; see their own per-card comments in this
 * file). Every unhandled shape THROWS rather than guessing or silently
 * dropping — this is the compiler's real, load-bearing design principle,
 * not an experimental caveat: an unknown `Mode$`/`DB$`/param must be loud,
 * never approximated, since a silently-wrong `CardDefinition` would be
 * worse than an honest gap.
 */

import type { BoardStateCondition, CardDefinition, Effect, EffectOwner, Keyword, Trigger, TriggerCause } from '../../card';
import type { TokenInfo, ZoneType } from '../../interfaces';
import { anyPlayer, applyToBound, opponents, putCounter as putCounterAction, selectUpTo, you, type QueryChain } from '../../combinator';

// ---------------------------------------------------------------------------
// Forge JSON shape (whatever `forge-json-mapper` emits — Forge's own DSL,
// verbatim: pipe-delimited `Key$Value` params flattened into an object).
// ---------------------------------------------------------------------------

export interface ForgeJsonCard {
  Name: string;
  ManaCost?: string;
  Types?: string;
  PT?: string;
  K?: string[];
  T?: Record<string, string>[];
  A?: (string | Record<string, string>)[];
  S?: Record<string, string>[];
  R?: Record<string, string>[];
  SVar?: Record<string, Record<string, string> | string>;
  Oracle?: string;
  [key: string]: unknown;
}

/**
 * Real Forge token-script shape — the SAME `Name`/`ManaCost`/`Types`/`PT`/
 * `K` fields `ForgeJsonCard` already carries, off a SEPARATE file tree
 * (`res/tokenscripts/<id>.txt`, not `res/cardsfolder/`) that a card's own
 * `TokenScript$` param names by id, e.g. `w_3_3_knight` (Guarded Heir's
 * own real `w_3_3_knight.txt`). Deliberately its own narrower interface,
 * not `ForgeJsonCard` reused, since a token script's own `A:`/ability
 * lines (Food's real `{2},{T},Sacrifice: gain 3 life`) have no
 * `TokenInfo` field to land in at all — see `resolveTokenScript`'s own
 * doc comment.
 */
export interface ForgeTokenScript {
  Name: string;
  ManaCost?: string;
  Types?: string;
  PT?: string;
  K?: string[];
}

class UnsupportedForgeShape extends Error {
  constructor(what: string) {
    super(`[forge-json-compiler] unsupported (not yet in the translation table): ${what}`);
  }
}

// ---------------------------------------------------------------------------
// Literal-value translation tables. Each entry cites the real Forge source
// it comes from — none of these are invented conventions.
// ---------------------------------------------------------------------------

/**
 * Forge `CounterEnumType` -> this schema's counter-type string. Real source:
 * `forge-game/src/main/java/forge/game/card/CounterEnumType.java`, e.g.
 * `P1P1("+1/+1", "+1/+1", 96, 226, 23, CounterAiCategory.Positive)` — the
 * enum's own first ctor arg IS the display name, so this table is a
 * mechanical read of that file (only the entries this compiler needs are
 * transcribed; the full table would be generated from that .java directly).
 */
const COUNTER_TYPE_NAME: Record<string, string> = {
  P1P1: '+1/+1',
  M1M1: '-1/-1',
  LOYALTY: 'loyalty',
  /** Grappling Kraken's own real `CounterType$ Stun` — Forge's own `CounterEnumType.STUN` ctor arg is `"stun"` (lowercase), matching this schema's own real `'stun'` counterType string (already in live use pool-wide — see `Effect.counterType`'s own doc comment). */
  Stun: 'stun',
};

/** Small English spellout for a `describe` string's own "up to N" phrasing
 * (Felidar Savior's own real hand-authored text reads "up to two," not "up
 * to 2") — deliberately narrow (this compiler's own bounded-choice targets
 * are never more than a handful), falls back to the bare numeral past 10. */
function numberWord(n: number): string {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  return words[n] ?? String(n);
}

/**
 * Forge card types/supertypes, for splitting a flat `Types:` line at the
 * em dash. Real source: `forge-core/src/main/java/forge/card/CardType.java`
 * (`CoreType` / `Supertype` enums). Anything NOT in these two sets is a
 * subtype by definition in Forge itself — so this split is mechanical, not
 * a judgement call.
 */
const CORE_TYPES = new Set([
  'Artifact', 'Battle', 'Conspiracy', 'Creature', 'Dungeon', 'Emblem', 'Enchantment',
  'Instant', 'Kindred', 'Land', 'Phenomenon', 'Plane', 'Planeswalker', 'Scheme',
  'Sorcery', 'Tribal', 'Vanguard',
]);
const SUPERTYPES = new Set(['Basic', 'Legendary', 'Ongoing', 'Snow', 'World', 'Elite', 'Host']);

/**
 * Forge `ValidTgts$` -> this schema's `validType` union. Only the bare,
 * unrestricted type words map; anything carrying a real Forge restriction
 * clause (`Creature.YouCtrl`, `Creature.Other`, ...) throws, since those
 * are separate schema fields (`owner`, `notSelf`) this narrow table
 * doesn't yet cover.
 */
const VALID_TGTS_TYPE: Record<string, 'creature' | 'land' | 'artifact' | 'any'> = {
  Creature: 'creature',
  Land: 'land',
  Artifact: 'artifact',
  Permanent: 'any',
};

/**
 * Forge keyword STRINGS as they appear inside a `KW$` value -> this
 * schema's `Keyword` union. Distinct from `KEYWORD_NAME` below (a `K:`
 * line) only in that Forge spells some grants out as a full sentence
 * rather than a keyword word — e.g. Fleeting Flight's real
 * `KW$ Flying & Prevent all combat damage that would be dealt to CARDNAME.`
 * (`res/cardsfolder/f/fleeting_flight.txt`). `CARDNAME` is Forge's own
 * host-card placeholder token.
 */
const PUMP_KEYWORD_NAME: Record<string, Keyword> = {
  'Prevent all combat damage that would be dealt to CARDNAME.': 'CombatDamagePrevention',
};

/** `K:` line -> this schema's `Keyword` union. Identity where the spellings already agree; only what this card needs. */
const KEYWORD_NAME: Record<string, Keyword> = {
  Flying: 'Flying',
  Reach: 'Reach',
  Trample: 'Trample',
  Vigilance: 'Vigilance',
  Haste: 'Haste',
  Lifelink: 'Lifelink',
  Deathtouch: 'Deathtouch',
  Menace: 'Menace',
  'First Strike': 'FirstStrike',
  'Double Strike': 'DoubleStrike',
  Defender: 'Defender',
  Hexproof: 'Hexproof',
  Indestructible: 'Indestructible',
  Flash: 'Flash',
  Convoke: 'Convoke',
  /** Bare, no-payload keyword (Elementalist Adept's real `K:Prowess`) — real `Keyword` union member confirmed added by the 2026-09-18 schema-completeness pass (see that pass's own `functional-model/card.ts` doc comment). */
  Prowess: 'Prowess',
};

/**
 * Real Forge `K:<name>:<payload>` lines whose payload ISN'T a bare-keyword
 * grant at all — each expands to a DIFFERENT `CardDefinition`-level field
 * (`keywordCosts`/`costReduction`/`alternateCosts`), verified against real,
 * already-hand-authored FDN cards rather than guessed:
 *  - `Ward:PayLife<7>` — Sire of Seven Deaths' own real
 *    `keywords:['Ward',...], keywordCosts:[{keyword:'Ward',cost:'Pay 7
 *    life'}]` (`fdn-cards/sire-of-seven-deaths/definition.ts`).
 *  - `Affinity:Cat` — Claws Out's own real `costReduction:{perControlled:
 *    {amountPerMatch:1,subtype:'Cat'}}` (`fdn-cards/claws-out/
 *    definition.ts`) — NOT a `Keyword` at all, real Forge `Affinity`
 *    expands straight to a `ReduceCost` static (`CardFactoryUtil.java`
 *    ~3749-3766), same mechanism this schema's own `CostReduction
 *    .perControlled` doc comment already cites.
 *  - `Flashback:5 U U` — Inspiration from Beyond's own real
 *    `alternateCosts:[{name:'Flashback',cost:'{5}{U}{U}',from:'graveyard',
 *    thenExile:true}]` (`fdn-cards/inspiration-from-beyond/definition.ts`)
 *    — also NOT a `Keyword`; Flashback's real rule (`thenExile:true`) is
 *    unconditional, not read off the K: line at all.
 *  - `Kicker:2 W` — schema-completeness-confirmed real `Keyword` member
 *    WITH a `keywordCosts` payload (`fdn-cards/divine-resilience/
 *    definition.ts`'s own `keywords:['Kicker'], keywordCosts:[{keyword:
 *    'Kicker',cost:'{2}{W}'}]`) — unlike Ward/Affinity/Flashback, Kicker
 *    DOES also go in `keywords` as a bare member.
 */
function compileKeywordLines(raw: string[] | undefined): {
  keywords?: Keyword[];
  keywordCosts?: { keyword: Keyword; cost: string }[];
  costReduction?: { perControlled: { amountPerMatch: number; subtype: string } };
  alternateCosts?: { name: string; cost: string; from: 'graveyard' | 'exile'; thenExile?: boolean }[];
} {
  if (raw === undefined || raw.length === 0) return {};
  const keywords: Keyword[] = [];
  const keywordCosts: { keyword: Keyword; cost: string }[] = [];
  let costReduction: { perControlled: { amountPerMatch: number; subtype: string } } | undefined;
  const alternateCosts: { name: string; cost: string; from: 'graveyard' | 'exile'; thenExile?: boolean }[] = [];

  for (const line of raw) {
    // Hare Apparent's own real `K:A deck can have any number of cards named
    // CARDNAME.` — verified against `fdn-cards/hare-apparent/definition.ts`,
    // which represents this real printed clause with NO keyword/field at
    // all (a pure deckbuilding-legality rule, zero in-game effect this
    // schema's own gameplay vocabulary has any business modeling). Matched
    // by REGEX (not the bare literal "CARDNAME" placeholder token, which
    // this mapper's own `forge_json_mapper.py` leaves unexpanded) so it
    // still recognizes the real, host-name-substituted text every OTHER
    // real K: line already comes through as.
    if (/^A deck can have any number of cards named .+\.$/.test(line)) continue;

    const wardMatch = /^Ward:PayLife<(\d+)>$/.exec(line);
    if (wardMatch) {
      keywords.push('Ward');
      keywordCosts.push({ keyword: 'Ward', cost: `Pay ${wardMatch[1]} life` });
      continue;
    }
    const affinityMatch = /^Affinity:(.+)$/.exec(line);
    if (affinityMatch) {
      if (costReduction !== undefined) throw new UnsupportedForgeShape(`multiple Affinity K: lines on one card`);
      costReduction = { perControlled: { amountPerMatch: 1, subtype: affinityMatch[1]! } };
      continue;
    }
    const flashbackMatch = /^Flashback:(.+)$/.exec(line);
    if (flashbackMatch) {
      alternateCosts.push({ name: 'Flashback', cost: compileManaCost(flashbackMatch[1]), from: 'graveyard', thenExile: true });
      continue;
    }
    const kickerMatch = /^Kicker:(.+)$/.exec(line);
    if (kickerMatch) {
      keywords.push('Kicker');
      keywordCosts.push({ keyword: 'Kicker', cost: compileManaCost(kickerMatch[1]) });
      continue;
    }

    const mapped = KEYWORD_NAME[line];
    if (mapped === undefined) throw new UnsupportedForgeShape(`K: line "${line}"`);
    keywords.push(mapped);
  }

  return {
    ...(keywords.length > 0 ? { keywords } : {}),
    ...(keywordCosts.length > 0 ? { keywordCosts } : {}),
    ...(costReduction !== undefined ? { costReduction } : {}),
    ...(alternateCosts.length > 0 ? { alternateCosts } : {}),
  };
}

/**
 * Real Forge `K:Enchant:Creature` — a real Aura-legality keyword whose
 * payload isn't a bare-keyword grant at all (same family as `Ward`/
 * `Affinity`/`Flashback`/`Kicker` above), pulled OUT of the `K:` line array
 * BEFORE `compileKeywordLines` ever sees it: unlike those four, this one
 * doesn't expand to a `CardDefinition`-level field at all — it expands to a
 * whole synthesized `onEnter` TRIGGER (see `enchantCreatureAttachTrigger`
 * below), something `compileKeywordLines`'s own return shape has no slot
 * for. Only the real `Creature` payload is modeled (every real Aura in this
 * 50-card slice needing `Enchant:` targets a creature) — anything else
 * throws.
 */
function extractEnchantCreatureKLine(raw: string[] | undefined): { enchantsCreature: boolean; rest: string[] } {
  if (raw === undefined) return { enchantsCreature: false, rest: [] };
  let enchantsCreature = false;
  const rest: string[] = [];
  for (const line of raw) {
    const match = /^Enchant:(.+)$/.exec(line);
    if (match === null) {
      rest.push(line);
      continue;
    }
    if (enchantsCreature) throw new UnsupportedForgeShape('multiple K:Enchant: lines on one card');
    if (match[1] !== 'Creature') throw new UnsupportedForgeShape(`K:Enchant:${match[1]} (only Enchant:Creature is modeled)`);
    enchantsCreature = true;
  }
  return { enchantsCreature, rest };
}

/**
 * `K:Enchant:Creature` -> the real ETB "attach to whatever creature this
 * Aura's own cast targeted" custom effect every already-hand-authored real
 * Aura in this pool uses verbatim — Twinblade Blessing's own
 * `fdn-cards/twinblade-blessing/definition.ts` and Sleep Magic's own
 * `cards/sleep-magic/definition.ts` (identical closure body, identical
 * `describe` string). Reproduced here EXACTLY rather than re-derived: real
 * Forge's own `Enchant:Creature` payload carries no separate params of its
 * own to read — the entire real behavior ("this Aura attaches to whatever
 * creature its own cast targeted") is identical on every Aura that has it,
 * so this is a real, deterministic 1:1 translation, not new invented logic.
 */
function enchantCreatureAttachTrigger(): Trigger {
  return {
    name: 'onEnter',
    cause: { on: 'enter' },
    effects: [
      {
        kind: 'custom',
        describe: 'attaches to enchanted creature',
        run: (ctx, actions) => {
          const pool = [ctx.you, ...ctx.opponents].flatMap((p) => p.getCardsIn('Battlefield')).filter((c) => c.isCreature());
          let target: (typeof pool)[number] | undefined;
          while (target === undefined && ctx.declaredTargets && ctx.declaredTargets.length > 0) {
            const next = ctx.declaredTargets.shift()!;
            if (pool.some((c) => c.getId() === next.getId())) target = next;
            // else: this declared target is no longer a legal creature (608.2b) — dropped, not replaced.
          }
          if (!target) target = actions.chooseTarget(pool, ctx.preferTarget);
          if (target) actions.equip(ctx.self, target);
        },
      } satisfies Effect,
    ],
  };
}

/**
 * Forge `S:` static-ability line — narrow translation, only the single real
 * shape this pool's own Aura-keyword-grant cluster needs: `Mode$ Continuous
 * | Affected$ Creature.EnchantedBy | AddKeyword$ <kw>` (Twinblade Blessing's
 * own real "Enchanted creature has double strike," `StaticAbilityContinuous
 * .java`'s own real `AddKeyword$` param) -> this schema's
 * `continuousKeywordGrants` `equippedBySelf: true` shape — the SAME real
 * shape Twinblade Blessing's/Sleep Magic's own already-hand-authored
 * `fdn-cards`/`cards` definitions already use for the identical real
 * `Affected$ Creature.EnchantedBy` recipient (an Aura's own `attachedToId`
 * link reuses the SAME `equippedBySelf` machinery Equipment does — see
 * `ContinuousGrantTargeting.equippedBySelf`'s own doc comment). Any OTHER
 * `Affected$`/`Mode$` (Crystal Barricade's own real `Affected$ You` — a
 * PLAYER-level grant no field anywhere in this schema targets, matching
 * that card's own already-hand-authored `missingSchemaFunctionality` entry)
 * throws, honestly — not a shape this narrow table recognizes yet.
 */
function compileStaticAbilityKeywordGrant(s: Record<string, string>): Keyword[] {
  if (s['Mode'] !== 'Continuous') throw new UnsupportedForgeShape(`S: Mode$ ${s['Mode'] ?? '(absent)'} (only Continuous is modeled)`);
  if (s['Affected'] !== 'Creature.EnchantedBy') throw new UnsupportedForgeShape(`S: Affected$ ${s['Affected'] ?? '(absent)'} (only Creature.EnchantedBy maps to a real continuousKeywordGrants recipient)`);
  const addKeyword = s['AddKeyword'];
  if (addKeyword === undefined) throw new UnsupportedForgeShape('S: Mode$ Continuous | Affected$ Creature.EnchantedBy with no AddKeyword$');
  // Same `" & "` multi-keyword separator `Pump | KW$` already establishes
  // (`PumpEffect.java:183`) — `StaticAbilityContinuous`'s own `AddKeyword$`
  // is parsed identically (`AbilityUtils`'s shared keyword-list split).
  return addKeyword.split(' & ').map((raw) => {
    const mapped = KEYWORD_NAME[raw];
    if (mapped === undefined) throw new UnsupportedForgeShape(`S: AddKeyword$ component "${raw}"`);
    return mapped;
  });
}

// ---------------------------------------------------------------------------
// Top-level field rules
// ---------------------------------------------------------------------------

/** Forge `ManaCost: "2 W W"` -> `"{2}{W}{W}"` (Forge stores the cost space-delimited, symbol per token). */
function compileManaCost(raw: string | undefined): string {
  if (raw === undefined || raw === 'no cost') return '';
  return raw
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => `{${t}}`)
    .join('');
}

/** Forge `Types: "Creature Angel"` -> `"Creature — Angel"` via the CardType.java core/super/sub split. */
function compileTypeLine(raw: string | undefined): string {
  if (raw === undefined) throw new UnsupportedForgeShape('card with no `Types:` line');
  const tokens = raw.split(/\s+/).filter((t) => t.length > 0);
  const left: string[] = [];
  const right: string[] = [];
  for (const token of tokens) {
    if (SUPERTYPES.has(token) || CORE_TYPES.has(token)) left.push(token);
    else right.push(token);
  }
  return right.length > 0 ? `${left.join(' ')} — ${right.join(' ')}` : left.join(' ');
}

/** Forge `PT: "3/3"` -> `[3, 3]`. Anything non-numeric (a real `*` CDA) is out of this narrow table's scope. */
function compilePT(raw: string | undefined): [number, number] | undefined {
  if (raw === undefined) return undefined;
  const parts = raw.split('/');
  if (parts.length !== 2) throw new UnsupportedForgeShape(`PT "${raw}"`);
  const [p, t] = parts as [string, string];
  if (!/^-?\d+$/.test(p) || !/^-?\d+$/.test(t)) throw new UnsupportedForgeShape(`non-numeric PT "${raw}" (a real CDA — needs \`ptFormula\`)`);
  return [Number(p), Number(t)];
}

/**
 * `Defined$You`/`Defined$Opponent` -> this schema's `EffectOwner` — the
 * SAME real Forge `getTargetPlayersWithDuplicates`-backed player-group
 * vocabulary `discard`'s/`loseLife`'s own doc comments already cite (see
 * `card.ts`'s own `drawCard.owner` doc comment for the full real-Forge
 * citation). No `'each'` case needed by any real card in this pool.
 */
function compileEffectOwnerDefined(defined: string | undefined): EffectOwner {
  if (defined === 'You') return 'you';
  if (defined === 'Opponent') return 'opponents';
  throw new UnsupportedForgeShape(`Defined$ ${defined ?? '(absent)'} (only \`You\`/\`Opponent\` map to a real EffectOwner)`);
}

/**
 * Module-level scratch, set once per `compileForgeCard` call (reset after)
 * — the one deliberate impurity in this otherwise-pure translation table.
 * A token script lives in a SEPARATE Forge file tree
 * (`res/tokenscripts/<id>.txt`) from the card script this module otherwise
 * only ever reads (`res/cardsfolder/`), so resolving `TokenScript$ <id>`
 * needs a caller-supplied lookup table rather than this module doing its
 * own filesystem reads (kept out of this file entirely, same "IO stays in
 * the harness/runner, not the compiler" split `run-experiment.ts`'s own CLI-runner
 * header already establishes) — threading a second parameter through
 * EVERY function in the `resolveAbilityChain`/`compileAbilityEffects`
 * call graph for one narrow lookup was judged worse than one scoped,
 * documented module-level variable.
 */
let currentTokenScripts: Record<string, ForgeTokenScript> = {};

/**
 * `TokenScript$ w_3_3_knight` -> a real `TokenInfo` — reads the SAME
 * `Name`/`ManaCost`/`Types`/`PT`/`K` fields a card script has, off the
 * caller-supplied `currentTokenScripts` lookup (see that variable's own
 * doc comment). Two judgment calls, both cross-checked against real
 * already-hand-authored FDN cards rather than guessed:
 *  - Name: a trailing literal `" Token"` suffix is stripped (Guarded
 *    Heir's own real `w_3_3_knight.txt`'s `Name:Knight Token` ->
 *    `name:'Knight'`, `fdn-cards/guarded-heir/definition.ts`) — but ONLY
 *    when actually present (Kiora's own real `scion_of_the_deep.txt`'s
 *    `Name:Scion of the Deep` has no such suffix and keeps its full name
 *    verbatim, `fdn-cards/kiora-the-rising-tide/definition.ts`).
 *  - Missing `PT:` (a noncreature token, e.g. `c_a_food_sac.txt`'s own
 *    Food token) -> `basePower:0, baseToughness:0` — `TokenInfo`'s own
 *    two P/T fields are REQUIRED numbers, and the real, already-authored
 *    `functional-model/tokens.ts`'s own `c_a_food_sac` entry uses this
 *    exact `0,0` convention for the identical real token.
 * A token's own real ability lines (Food's `A:AB$ GainLife | ...`) have
 * no field on `TokenInfo` to land in at all and are dropped — NOT a new
 * gap this compiler introduces: the real, already-authored `tokens.ts`
 * registry drops the identical real ability for the identical real token.
 */
function resolveTokenScript(id: string): TokenInfo {
  const script = currentTokenScripts[id];
  if (script === undefined) throw new UnsupportedForgeShape(`TokenScript$ ${id} (no token script supplied for this id)`);
  const name = script.Name.endsWith(' Token') ? script.Name.slice(0, -' Token'.length) : script.Name;
  // Real pool convention (`fdn-cards/`, checked directly): a costless
  // token's own `TokenInfo.manaCost` is `'0'` (23 real occurrences), not
  // `''` (2 real, minority outliers) — `compileManaCost` itself stays
  // generic (an absent `ManaCost:` line is genuinely `''` for a normal
  // CARD, e.g. a Land), so the `'0'` convention is applied here, at the
  // token-specific call site, not inside the shared helper.
  const compiledManaCost = compileManaCost(script.ManaCost);
  const manaCost = compiledManaCost === '' ? '0' : compiledManaCost;
  const types = compileTypeLineWords(script.Types);
  const pt = compilePT(script.PT) ?? [0, 0];
  const keywords = script.K !== undefined && script.K.length > 0 ? script.K.map((k) => {
    const mapped = KEYWORD_NAME[k];
    if (mapped === undefined) throw new UnsupportedForgeShape(`token K: line "${k}" on TokenScript$ ${id}`);
    return mapped;
  }) : undefined;
  return { name, manaCost, types, basePower: pt[0], baseToughness: pt[1], ...(keywords !== undefined ? { keywords } : {}) };
}

/** `Types: "Creature Knight"` -> `['Creature', 'Knight']` — a token's own `types` field is a plain word array (`TokenInfo.types`), unlike a real card's own em-dash-formatted `typeLine`. */
function compileTypeLineWords(raw: string | undefined): string[] {
  if (raw === undefined) throw new UnsupportedForgeShape('token with no Types:');
  return raw.split(/\s+/).filter((t) => t.length > 0);
}

// ---------------------------------------------------------------------------
// `Execute$` -> `SVar` indirection, then `DB$` -> `Effect` dispatch
// ---------------------------------------------------------------------------

/**
 * Target context threaded DOWN a `SubAbility$` chain, so a chained ability
 * whose own scope is `Defined$ Targeted` can resolve WHAT was targeted.
 * Real Forge does exactly this: a sub-ability is an `AbilitySub` hung off
 * its parent `SpellAbility`, and `Defined$ Targeted` resolves against the
 * parent's own `TargetRestrictions` (`AbilityFactory.getAbility`'s
 * `spellAbility.setSubAbility(getSubAbility(...))`, AbilityFactory.java:237)
 * — NOT a second, independently-chosen target.
 */
interface ChainContext {
  /** `validType` of whatever the ROOT ability of this chain targeted, if it targeted at all. */
  targetedValidType?: 'creature' | 'land' | 'artifact' | 'any';
  /**
   * `owner` restriction (Forge's own `YouCtrl`/`OppCtrl` suffix) of that
   * SAME root targeting — threaded alongside `targetedValidType` so a
   * chained ability inheriting `Defined$ Targeted` reuses the identical
   * candidate pool, not just its bare type (Grappling Kraken's own real
   * `DB$ Tap | ValidTgts$ Creature.OppCtrl`, chained into `DB$ PutCounter |
   * Defined$ Targeted` — both effects independently restricted to
   * opponent-controlled creatures, matching `fdn-cards/grappling-kraken/
   * definition.ts`'s own real `owner:'opponents'` on BOTH its `tapTarget`
   * and `putCounterTarget` effects).
   */
  owner?: EffectOwner;
}

/**
 * Real Forge structure: neither a `T:` line nor an `A:` line inlines its
 * chained effects — they name an SVar (`Execute$ TrigDraw`,
 * `SubAbility$ DBPump`) holding a `DB$` ability. `Execute$` and
 * `SubAbility$` are the SAME underlying mechanism, verified in real Forge
 * source: both land on `AbilityFactory.getAbility(state, svarName,
 * sVarHolder)` (Trigger.java:626 for `Execute`, AbilityFactory.java:359's
 * `getSubAbility` for `SubAbility`), which throws if the SVar is missing.
 * They differ only in context (trigger's root vs. an ability's chained
 * continuation), so this one walker serves both.
 */
function resolveAbilityChain(card: ForgeJsonCard, svarName: string, context: ChainContext = {}): Effect[] {
  const svars = card.SVar ?? {};
  const effects: Effect[] = [];
  let cursor: string | undefined = svarName;
  const seen = new Set<string>();
  // Mutable running context — the FIRST ability in the chain to declare its
  // own `ValidTgts$` becomes the "parent" a later `Defined$ Targeted` link
  // inherits from (Grappling Kraken's own real `DB$ Tap | ValidTgts$
  // Creature.OppCtrl` chained into `DB$ PutCounter | Defined$ Targeted` —
  // Tap is the parent, PutCounter is the inheritor). Never overwritten once
  // set, since only ONE real ability per chain in this pool ever declares a
  // fresh `ValidTgts$` this way.
  let ctx: ChainContext = { ...context };
  while (cursor !== undefined) {
    if (seen.has(cursor)) throw new UnsupportedForgeShape(`cyclic SubAbility$ chain at SVar "${cursor}"`);
    seen.add(cursor);
    const svar: Record<string, string> | string | undefined = svars[cursor];
    if (svar === undefined) throw new UnsupportedForgeShape(`Execute$/SubAbility$ names SVar "${cursor}" which does not exist`);
    if (typeof svar === 'string') throw new UnsupportedForgeShape(`SVar "${cursor}" is a plain-value SVar (calculation), not an ability`);
    if (ctx.targetedValidType === undefined) ctx = { ...ctx, ...contextFromValidTgts(svar['ValidTgts']) };
    effects.push(...compileAbilityEffects(svar, ctx));
    cursor = svar['SubAbility'];
  }
  return effects;
}

/** `ValidTgts$ Creature` -> `'creature'`, throwing on any restriction clause. */
function compileValidTgts(raw: string): 'creature' | 'land' | 'artifact' | 'any' {
  const mapped = VALID_TGTS_TYPE[raw];
  if (mapped === undefined) throw new UnsupportedForgeShape(`ValidTgts$ ${raw}`);
  return mapped;
}

/**
 * `ValidTgts$ Creature.OppCtrl` -> `{validType:'creature', owner:'opponents'}`
 * — the OWNER/EXCLUSION-aware sibling of `compileValidTgts` above (which
 * only ever handled a completely bare type word). Only a SINGLE Forge
 * restriction clause is recognized per call (comma-separated OR-unions,
 * e.g. Joust Through's real `Creature.attacking,Creature.blocking`, throw —
 * genuinely unrepresentable, no `validType`/filter combination for
 * "attacking or blocking" exists on any real `Effect` this pool needs).
 */
function compileValidTgtsExtended(raw: string): { validType: 'creature' | 'land' | 'artifact' | 'any'; owner?: EffectOwner; notSelf?: boolean } {
  if (raw.includes(',')) throw new UnsupportedForgeShape(`ValidTgts$ ${raw} (comma OR-union not representable)`);
  const [typeWord, ...rest] = raw.split('.');
  const validType = VALID_TGTS_TYPE[typeWord!];
  if (validType === undefined) throw new UnsupportedForgeShape(`ValidTgts$ ${raw}`);
  if (rest.length === 0) return { validType };
  let owner: EffectOwner | undefined;
  let notSelf = false;
  for (const modifier of rest.join('.').split('+')) {
    if (modifier === 'YouCtrl') owner = 'you';
    else if (modifier === 'OppCtrl') owner = 'opponents';
    else if (modifier === 'Other' || modifier === 'StrictlyOther') notSelf = true;
    else throw new UnsupportedForgeShape(`ValidTgts$ ${raw} (unrecognized restriction "${modifier}")`);
  }
  return { validType, ...(owner !== undefined ? { owner } : {}), ...(notSelf ? { notSelf } : {}) };
}

/**
 * Builds a `ChainContext` from an ability's own `ValidTgts$`, but ONLY
 * when its leading type word is one of the four bare types
 * `VALID_TGTS_TYPE` (and therefore `compileValidTgtsExtended`) actually
 * understands. A `ValidTgts$` naming some OTHER domain entirely — Refute's
 * own real `SP$ Counter | ValidTgts$ Card` (a spell/card being countered,
 * not a creature/land/artifact/permanent) — is deliberately left
 * UNRESOLVED here rather than thrown: this function's only job is
 * threading INHERITABLE chain context for a later `Defined$ Targeted`
 * link, not validating every ability's own `ValidTgts$` param (each
 * `compileAbilityEffects` case already does that itself, e.g. `Counter`'s
 * own case reads `TargetType$`, never this context) — no real
 * capability/information is silently dropped by skipping it here.
 */
function contextFromValidTgts(validTgts: string | undefined): ChainContext {
  if (validTgts === undefined) return {};
  const typeWord = validTgts.split('.')[0]!;
  if (!(typeWord in VALID_TGTS_TYPE)) return {};
  const own = compileValidTgtsExtended(validTgts);
  return { targetedValidType: own.validType, ...(own.owner !== undefined ? { owner: own.owner } : {}) };
}

/** Forge's own literal `ZoneType` strings (`Battlefield`/`Graveyard`/`Hand`/`Library`/`Exile`/`Stack`/`Command`) — same set `interfaces.ts`'s own `ZoneType` union carries, checked directly rather than re-declared. */
const ZONE_TYPES: Record<string, ZoneType> = {
  Battlefield: 'Battlefield',
  Graveyard: 'Graveyard',
  Hand: 'Hand',
  Library: 'Library',
  Exile: 'Exile',
  Stack: 'Stack',
  Command: 'Command',
};
function compileZoneType(raw: string | undefined, paramName: string): ZoneType {
  if (raw === undefined) throw new UnsupportedForgeShape(`missing ${paramName}$`);
  const mapped = ZONE_TYPES[raw];
  if (mapped === undefined) throw new UnsupportedForgeShape(`${paramName}$ ${raw} (not a real Forge zone)`);
  return mapped;
}

/**
 * Forge `ChangeType$`/`ValidCards$` real card-filter clause — the
 * comma-UNION-aware sibling of `compileValidTgtsExtended` (unlike a
 * `ValidTgts$` single chosen target, an untargeted batch move/counter-all
 * genuinely allows an OR-list of card TYPE words, e.g. Inspiration from
 * Beyond's own real `ChangeType$ Instant.YouOwn,Sorcery.YouOwn`). A type
 * word outside `VALID_TGTS_TYPE`'s bare creature/land/artifact/permanent
 * set (Instant/Sorcery/Equipment/...) becomes a `subtype` entry instead —
 * same "no card-TYPE-only filter beyond `validType`'s own four options"
 * gap `move.subtype`'s own doc comment already names for Cloud, Midgar
 * Mercenary's real "search for an Equipment card."
 */
function compileChangeType(raw: string): { validType: 'creature' | 'land' | 'artifact' | 'any'; subtype?: string | string[]; owner?: EffectOwner; maxCmc?: number } {
  const segments = raw.split(',');
  let validType: 'creature' | 'land' | 'artifact' | 'any' | undefined;
  const subtypes: string[] = [];
  let owner: EffectOwner | undefined;
  let maxCmc: number | undefined;
  for (const segment of segments) {
    const [typeWord, ...rest] = segment.split('.');
    const bare = VALID_TGTS_TYPE[typeWord!];
    if (bare !== undefined) {
      if (validType !== undefined && validType !== bare) throw new UnsupportedForgeShape(`ChangeType$ ${raw} (mixed bare types across OR segments)`);
      validType = bare;
    } else {
      subtypes.push(typeWord!);
      validType = validType ?? 'any';
    }
    for (const modifier of rest.join('.').split('+').filter((m) => m.length > 0)) {
      if (modifier === 'YouOwn' || modifier === 'YouCtrl') {
        if (owner !== undefined && owner !== 'you') throw new UnsupportedForgeShape(`ChangeType$ ${raw} (conflicting owner modifiers)`);
        owner = 'you';
      } else if (modifier === 'OppOwn' || modifier === 'OppCtrl') {
        if (owner !== undefined && owner !== 'opponents') throw new UnsupportedForgeShape(`ChangeType$ ${raw} (conflicting owner modifiers)`);
        owner = 'opponents';
      } else {
        const cmcMatch = /^cmcLE(\d+)$/.exec(modifier);
        if (cmcMatch) maxCmc = Number(cmcMatch[1]);
        else throw new UnsupportedForgeShape(`ChangeType$ ${raw} (unrecognized restriction "${modifier}")`);
      }
    }
  }
  if (validType === undefined) throw new UnsupportedForgeShape(`ChangeType$ ${raw}`);
  return {
    validType,
    ...(subtypes.length === 1 ? { subtype: subtypes[0]! } : subtypes.length > 1 ? { subtype: subtypes } : {}),
    ...(owner !== undefined ? { owner } : {}),
    ...(maxCmc !== undefined ? { maxCmc } : {}),
  };
}

/**
 * Forge ability -> our `Effect`s. Dispatches on the ability-type param's
 * VALUE exactly the way `AbilityFactory.getAbility` does (`DB$ Draw` ->
 * `DrawEffect.java`). `SP$`/`AB$`/`DB$` are the same api-name key under
 * different ability types.
 *
 * Returns an ARRAY, not one `Effect`: the mapping is genuinely 1:N in at
 * least one real case — Forge's `DB$ Pump | KW$ A & B` is ONE ability
 * granting several keywords, which this schema models as one
 * `grantKeywordTarget` effect per keyword.
 */
function compileAbilityEffects(ability: Record<string, string>, context: ChainContext = {}): Effect[] {
  const api = ability['DB'] ?? ability['SP'] ?? ability['AB'];
  if (api === undefined) throw new UnsupportedForgeShape(`ability with no SP$/AB$/DB$ key: ${JSON.stringify(ability)}`);

  switch (api) {
    case 'PutCounter': {
      const counterTypeRaw = ability['CounterType'];
      if (counterTypeRaw === undefined) throw new UnsupportedForgeShape('PutCounter with no CounterType$');
      const counterType = COUNTER_TYPE_NAME[counterTypeRaw];
      if (counterType === undefined) throw new UnsupportedForgeShape(`CounterType$ ${counterTypeRaw}`);
      // Forge's own `CountersPutEffect` default: `getParamOrDefault("CounterNum", "1")`
      // (forge-game/.../ability/effects/CountersPutEffect.java:97).
      const amount = Number(ability['CounterNum'] ?? '1');
      const defined = ability['Defined'];
      const validTgts = ability['ValidTgts'];
      // "each of up to N chosen targets" (Felidar Savior's own real
      // `TargetMin$0 | TargetMax$2`) — a real, literal, numeric Forge param
      // pair (not ambiguous text), so it gets a real mechanical rule here:
      // wrap the same per-target `putCounter` action `combinator.ts`'s own
      // `selectUpTo`/`applyToBound` program DSL already models by hand on
      // `fdn-cards/felidar-savior/definition.ts` (one `applyToBound` call
      // per index, `index: 0..max-1`). `TargetMin$` must be exactly `'0'`
      // — `selectUpTo` itself has no separate min (its own semantics ARE
      // "as many as available, up to max, never fewer required"), so any
      // other `TargetMin$` is a genuinely different, mandatory-minimum
      // shape this DSL doesn't model and must still throw.
      if (ability['TargetMax'] !== undefined) {
        const targetMin = ability['TargetMin'];
        if (targetMin !== '0') throw new UnsupportedForgeShape(`PutCounter | TargetMin$ ${targetMin ?? '(absent)'} | TargetMax$ ${ability['TargetMax']} (selectUpTo only models an implicit min of 0)`);
        const max = Number(ability['TargetMax']);
        if (!Number.isInteger(max) || max < 1) throw new UnsupportedForgeShape(`PutCounter | TargetMax$ ${ability['TargetMax']} (not a positive integer)`);
        if (validTgts === undefined) throw new UnsupportedForgeShape('PutCounter | TargetMax$ with no ValidTgts$');
        const own = compileValidTgtsExtended(validTgts);
        if (own.validType !== 'creature') throw new UnsupportedForgeShape(`PutCounter | TargetMax$ | ValidTgts$ ${validTgts} (selectUpTo's only real Query.source today is creaturesInPlay)`);
        const base: QueryChain = own.owner === 'you' ? you.creaturesInPlay() : own.owner === 'opponents' ? opponents.creaturesInPlay() : anyPlayer.creaturesInPlay();
        const query = own.notSelf ? base.filter('excludeSelf') : base;
        const then = Array.from({ length: max }, (_, i) => applyToBound('target', i, putCounterAction(counterType, amount)));
        const ownerPhrase = own.owner === 'you' ? ' you control' : own.owner === 'opponents' ? ' your opponents control' : '';
        const describe = `put a ${counterType} counter on each of up to ${numberWord(max)}${own.notSelf ? ' other' : ''} target creature${max === 1 ? '' : 's'}${ownerPhrase}`;
        return [{ kind: 'program', describe, program: selectUpTo(query, max, 'target', then) } satisfies Effect];
      }
      // Real `Defined$`/`ValidTgts$` fork on Forge's ONE PutCounter ability,
      // mirrored 1:1 by this schema's `putCounter.target` union.
      if (defined === 'Self') return [{ kind: 'putCounter', target: 'self', counterType, amount }];
      // `Defined$ Targeted` — reuses whatever the PARENT ability in this
      // SAME chain already targeted (Grappling Kraken's own real `DB$ Tap |
      // ValidTgts$ Creature.OppCtrl` -> chained `DB$ PutCounter | Defined$
      // Targeted`) — modeled as the separate `putCounterTarget` kind (NOT
      // the unified `putCounter.target` object), matching
      // `fdn-cards/grappling-kraken/definition.ts`'s own real
      // `{kind:'putCounterTarget', validType:'creature', counterType:
      // 'stun', amount:1, owner:'opponents'}`.
      if (defined === 'Targeted') {
        const inherited = context.targetedValidType;
        if (inherited === undefined) throw new UnsupportedForgeShape('PutCounter | Defined$ Targeted with no targeting parent ability in the chain');
        return [{ kind: 'putCounterTarget', validType: inherited, counterType, amount, ...(context.owner !== undefined ? { owner: context.owner } : {}) }];
      }
      if (validTgts !== undefined) {
        if (defined !== undefined) throw new UnsupportedForgeShape(`PutCounter | Defined$ ${defined} | ValidTgts$ ${validTgts} (both scope params at once)`);
        // Real pool convention (`fdn-cards/`, checked directly): a DIRECT
        // `ValidTgts$` chosen-target PutCounter is `putCounterTarget`
        // (12 real occurrences), matching the `Defined$ Targeted` branch
        // immediately above — NOT the unified `putCounter.target:{chosen:
        // true}` shape (only 2 real occurrences), which this compiler used
        // to emit here as the minority form.
        const own = compileValidTgtsExtended(validTgts);
        return [{ kind: 'putCounterTarget', validType: own.validType, counterType, amount, ...(own.owner !== undefined ? { owner: own.owner } : {}) }];
      }
      throw new UnsupportedForgeShape(`PutCounter | Defined$ ${defined ?? '(absent)'}`);
    }
    case 'Discard': {
      const owner = compileEffectOwnerDefined(ability['Defined']);
      const qty = Number(ability['NumCards'] ?? '1');
      return [{ kind: 'discard', owner, qty }];
    }
    case 'LoseLife': {
      const owner = compileEffectOwnerDefined(ability['Defined']);
      const amount = Number(ability['LifeAmount'] ?? (() => { throw new UnsupportedForgeShape('LoseLife with no LifeAmount$'); })());
      return [{ kind: 'loseLife', owner, amount }];
    }
    case 'GainLife': {
      // `gainLife` has no `owner` field at all (always implicitly "you") —
      // real Forge `Defined$` on this ability is only ever `You` across
      // this pool (Restoration Magic/Arbiter of Woe/Joust Through), so
      // anything else is a genuinely unrepresentable "someone else gains
      // life" shape.
      const defined = ability['Defined'];
      if (defined !== undefined && defined !== 'You') throw new UnsupportedForgeShape(`GainLife | Defined$ ${defined} (gainLife has no owner field — only the implicit "you" is representable)`);
      const amount = Number(ability['LifeAmount'] ?? (() => { throw new UnsupportedForgeShape('GainLife with no LifeAmount$'); })());
      return [{ kind: 'gainLife', amount }];
    }
    case 'Tap': {
      const validTgts = ability['ValidTgts'];
      if (validTgts === undefined) throw new UnsupportedForgeShape('Tap with no ValidTgts$');
      const own = compileValidTgtsExtended(validTgts);
      return [{ kind: 'tapTarget', validType: own.validType, ...(own.owner !== undefined ? { owner: own.owner } : {}) }];
    }
    case 'Surveil': {
      const qty = Number(ability['Amount'] ?? (() => { throw new UnsupportedForgeShape('Surveil with no Amount$'); })());
      return [{ kind: 'surveil', qty }];
    }
    case 'Mill': {
      const owner = compileEffectOwnerDefined(ability['Defined']);
      const amount = Number(ability['NumCards'] ?? (() => { throw new UnsupportedForgeShape('Mill with no NumCards$'); })());
      return [{ kind: 'mill', owner, amount }];
    }
    case 'Dig': {
      // Squad Rallier's own real `AB$ Dig | Cost$ 2 W | DigNum$ 4 |
      // Optional$ True | ForceRevealToController$ True | ChangeNum$ 1 |
      // ChangeValid$ Creature.powerLE2 | DestinationZone$ Hand |
      // DestinationZone2$ Library | LibraryPosition$ -1 | RestRandomOrder$
      // True` — the ONLY real `Dig` shape this narrow table models (`dig`'s
      // own hardcoded hand/library-bottom resolution has no other zone
      // pair to represent). `ForceRevealToController$`/`RestRandomOrder$`
      // are consciously dropped as harmless-to-drop cosmetic/reveal-only
      // flags — same "Hidden$/Mandatory$ dropped" precedent `ChangeZone`'s
      // own case above already establishes.
      const digNumRaw = ability['DigNum'];
      if (digNumRaw === undefined) throw new UnsupportedForgeShape('Dig with no DigNum$');
      const qty = Number(digNumRaw);
      if (!Number.isInteger(qty) || qty < 1) throw new UnsupportedForgeShape(`Dig | DigNum$ ${digNumRaw} (not a positive integer)`);
      // Real Forge default (absent `ChangeNum$`): `DigEffect.java`'s own
      // `getParamOrDefault("ChangeNum", "1")` (line 42).
      const changeNumRaw = ability['ChangeNum'];
      const take = changeNumRaw !== undefined ? Number(changeNumRaw) : 1;
      if (!Number.isInteger(take) || take < 1) throw new UnsupportedForgeShape(`Dig | ChangeNum$ ${changeNumRaw} (only a fixed positive integer is modeled — All/Any/a formula amount is out of scope)`);
      // Real Forge defaults (`DigEffect.java`, `resolve()`): absent
      // `DestinationZone$`/`DestinationZone2$`/`LibraryPosition$` default
      // to exactly Hand / Library / -1 (bottom) — the ONE real shape
      // `dig`'s own hardcoded resolution models, so anything else throws.
      const destinationZone = ability['DestinationZone'] ?? 'Hand';
      const destinationZone2 = ability['DestinationZone2'] ?? 'Library';
      const libraryPosition = ability['LibraryPosition'] ?? '-1';
      if (destinationZone !== 'Hand') throw new UnsupportedForgeShape(`Dig | DestinationZone$ ${destinationZone} (only the hand default is modeled)`);
      if (destinationZone2 !== 'Library') throw new UnsupportedForgeShape(`Dig | DestinationZone2$ ${destinationZone2} (only the library default is modeled)`);
      if (libraryPosition !== '-1') throw new UnsupportedForgeShape(`Dig | LibraryPosition$ ${libraryPosition} (only the bottom-of-library default is modeled)`);
      const changeValid = ability['ChangeValid'];
      let validType: 'creature' | 'artifact' | undefined;
      let powerLE: number | undefined;
      if (changeValid !== undefined) {
        const [typeWord, ...rest] = changeValid.split('.');
        if (typeWord === 'Creature') validType = 'creature';
        else if (typeWord === 'Artifact') validType = 'artifact';
        else throw new UnsupportedForgeShape(`Dig | ChangeValid$ ${changeValid} (unrecognized type word)`);
        for (const modifier of rest.join('.').split('+').filter((m) => m.length > 0)) {
          // Real Forge `CardProperty.java`'s own generic `power<comparator><N>`
          // shape (`property.startsWith("power")`) — only `LE` (`<=`) is
          // modeled, matching `dig.powerLE`'s own doc comment.
          const powerMatch = /^powerLE(\d+)$/.exec(modifier);
          if (powerMatch) powerLE = Number(powerMatch[1]);
          else throw new UnsupportedForgeShape(`Dig | ChangeValid$ ${changeValid} (unrecognized restriction "${modifier}")`);
        }
      }
      const optional = ability['Optional'] === 'True';
      return [{
        kind: 'dig', qty, take,
        ...(validType !== undefined ? { validType } : {}),
        ...(powerLE !== undefined ? { powerLE } : {}),
        ...(optional ? { optional: true } : {}),
      } satisfies Effect];
    }
    case 'Counter': {
      // `CounterEffect` — log-only, no real target reference to read back
      // (see that `kind`'s own doc comment). `TargetType$ Spell` is the
      // only real value this pool needs (Refute's own real "Counter target
      // spell") — anything else has no entry in this narrow phrase table.
      const targetType = ability['TargetType'];
      const describe = targetType === 'Spell' ? 'target spell' : undefined;
      if (describe === undefined) throw new UnsupportedForgeShape(`Counter | TargetType$ ${targetType ?? '(absent)'}`);
      return [{ kind: 'counter', describe }];
    }
    case 'Token': {
      const tokenScript = ability['TokenScript'];
      if (tokenScript === undefined) throw new UnsupportedForgeShape('Token with no TokenScript$');
      const token = resolveTokenScript(tokenScript);
      const amountRaw = ability['TokenAmount'];
      if (amountRaw !== undefined && !/^\d+$/.test(amountRaw)) throw new UnsupportedForgeShape(`Token | TokenAmount$ ${amountRaw} (a dynamic/formula amount is out of scope)`);
      const amount = amountRaw !== undefined ? Number(amountRaw) : 1;
      return [{ kind: 'createToken', token, amount }];
    }
    case 'ChangeZone': {
      // Real Forge params this table does NOT model at all — a "top OR
      // bottom of library, owner's choice" alternate destination
      // (Uncharted Voyage's own real `AlternativeDecider$ TargetedOwner |
      // DestinationAlternative$ Library | LibraryPositionAlternative$ -1`)
      // is a genuinely different, richer mechanism than a single fixed
      // `to` — asserted OUT explicitly so this case can't silently
      // collapse it into a plain, WRONG single-destination move (caught
      // by cross-checking this compiler's own compiled output against
      // `fdn-cards/uncharted-voyage/definition.ts`, which stays a
      // `kind:'custom'` for exactly this reason).
      // `Hidden$`/`Mandatory$` are deliberately NOT in this blocklist —
      // both real, harmless-to-drop flags Inspiration from Beyond's own
      // real `DB$ ChangeZone | ... | Mandatory$ True | Hidden$ True` needs
      // (matching that card's own already-hand-authored `move` effect,
      // which carries no field for either and is still correct — this
      // move is unconditional either way, `Mandatory$ True` doesn't add
      // an "optional" branch the way a genuinely different mechanism
      // would).
      for (const unhandled of ['AlternativeDecider', 'DestinationAlternative', 'LibraryPositionAlternative']) {
        if (ability[unhandled] !== undefined) throw new UnsupportedForgeShape(`ChangeZone | ${unhandled}$ ${ability[unhandled]} (not modeled — would otherwise silently collapse into a plain single-destination move)`);
      }
      const validTgts = ability['ValidTgts'];
      const changeType = ability['ChangeType'];
      if (validTgts !== undefined && changeType !== undefined) throw new UnsupportedForgeShape('ChangeZone | both ValidTgts$ and ChangeType$ set (unrecognized combination)');
      const from = compileZoneType(ability['Origin'], 'Origin');
      const to = compileZoneType(ability['Destination'], 'Destination');
      if (validTgts !== undefined) {
        // A player-CHOSEN target move (Bigfin Bouncer's own real "return
        // target creature an opponent controls to its owner's hand").
        const own = compileValidTgtsExtended(validTgts);
        return [{ kind: 'move', from, to, qty: 1, validType: own.validType, target: true, ...(own.owner !== undefined ? { owner: own.owner } : {}) }];
      }
      if (changeType !== undefined) {
        // An UNCHOSEN, library/graveyard-search-style move (Inspiration
        // from Beyond's own real "return an instant or sorcery card from
        // your graveyard to your hand").
        const own = compileChangeType(changeType);
        const qtyRaw = ability['ChangeNum'];
        const qty = qtyRaw !== undefined ? Number(qtyRaw) : 1;
        return [{
          kind: 'move', from, to, qty, validType: own.validType, target: true,
          ...(own.owner !== undefined ? { owner: own.owner } : {}),
          ...(own.subtype !== undefined ? { subtype: own.subtype } : {}),
          ...(own.maxCmc !== undefined ? { maxCmc: own.maxCmc } : {}),
        }];
      }
      throw new UnsupportedForgeShape('ChangeZone with neither ValidTgts$ nor ChangeType$');
    }
    case 'ChangeZoneAll': {
      // Forge's own real UNTARGETED batch move ("return ALL matching cards")
      // — `qty:100` is this schema's own established "pool exhaustion"
      // sentinel for an unbounded "all" (see `fdn-cards/raise-the-past/
      // definition.ts`'s own real, identical `qty:100`), not a literal
      // count read off the Forge script (`ChangeZoneAll` has no
      // `ChangeNum$` at all — the WHOLE qualifying pool always moves).
      const changeType = ability['ChangeType'];
      if (changeType === undefined) throw new UnsupportedForgeShape('ChangeZoneAll with no ChangeType$');
      const from = compileZoneType(ability['Origin'], 'Origin');
      const to = compileZoneType(ability['Destination'], 'Destination');
      const own = compileChangeType(changeType);
      return [{
        kind: 'move', from, to, qty: 100, validType: own.validType,
        ...(own.owner !== undefined ? { owner: own.owner } : {}),
        ...(own.subtype !== undefined ? { subtype: own.subtype } : {}),
        ...(own.maxCmc !== undefined ? { maxCmc: own.maxCmc } : {}),
      }];
    }
    case 'Draw': {
      // Forge's own `DrawEffect` default: `sa.hasParam("NumCards") ? ... : 1`
      // (forge-game/.../ability/effects/DrawEffect.java:65).
      const amount = Number(ability['NumCards'] ?? '1');
      const defined = ability['Defined'] ?? ability['NumCardsDefined'];
      if (defined !== undefined && defined !== 'You') throw new UnsupportedForgeShape(`Draw | Defined$ ${defined}`);
      return [{ kind: 'drawCard', amount }];
    }
    case 'Pump': {
      // Only the keyword-granting half of Pump is in this narrow table;
      // its P/T half (`NumAtt$`/`NumDef$`) is a different schema kind.
      for (const ptParam of ['NumAtt', 'NumDef'] as const) {
        if (ability[ptParam] !== undefined) throw new UnsupportedForgeShape(`Pump | ${ptParam}$ (P/T pump — needs the pump/pumpTarget kinds, out of scope)`);
      }
      const kw = ability['KW'];
      if (kw === undefined) throw new UnsupportedForgeShape('Pump with neither KW$ nor NumAtt$/NumDef$');
      // Forge's own split separator, verbatim: `keywords.addAll(Arrays.asList(
      // sa.getParam("KW").split(" & ")))` (PumpEffect.java:183).
      const keywords = kw.split(' & ').map((raw) => {
        const mapped = PUMP_KEYWORD_NAME[raw] ?? KEYWORD_NAME[raw];
        if (mapped === undefined) throw new UnsupportedForgeShape(`Pump | KW$ component "${raw}"`);
        return mapped;
      });
      // Forge's real duration default for Pump: anything that isn't
      // `Duration$ Permanent` is removed at end of turn (PumpEffect.java:94,
      // `if (!"Permanent".equals(duration) && !perpetual)`) — so an ABSENT
      // `Duration$`, as here, genuinely means until-end-of-turn.
      const duration = ability['Duration'];
      if (duration !== undefined) throw new UnsupportedForgeShape(`Pump | Duration$ ${duration} (only the absent/until-EOT default is modeled)`);
      const defined = ability['Defined'];
      const validTgts = ability['ValidTgts'];
      let validType: 'creature' | 'any';
      if (defined === 'Targeted') {
        // `Defined$ Targeted` == "whatever the PARENT ability targeted".
        const inherited = context.targetedValidType;
        if (inherited === undefined) throw new UnsupportedForgeShape('Pump | Defined$ Targeted with no targeting parent ability in the chain');
        if (inherited !== 'creature' && inherited !== 'any') throw new UnsupportedForgeShape(`Pump | Defined$ Targeted inheriting validType "${inherited}" (grantKeywordTarget models only creature/any)`);
        validType = inherited;
      } else if (defined === undefined && validTgts !== undefined) {
        const own = compileValidTgts(validTgts);
        if (own !== 'creature' && own !== 'any') throw new UnsupportedForgeShape(`Pump | ValidTgts$ ${validTgts} (grantKeywordTarget models only creature/any)`);
        validType = own;
      } else {
        throw new UnsupportedForgeShape(`Pump | Defined$ ${defined ?? '(absent)'} (only \`Targeted\` / a bare ValidTgts$ are modeled)`);
      }
      return keywords.map((keyword) => ({ kind: 'grantKeywordTarget', keyword, validType, untilEndOfTurn: true }));
    }
    case 'PumpAll': {
      // `PumpAllEffect`'s own real P/T-only board broadcast (Dauntless
      // Veteran's own "creatures you control get +1/+1 until end of
      // turn," Claws Out's identical "+2/+2" shape) — the KW$-granting
      // half of `PumpAll` (Bahamut, Warden of Light's own "gain flying")
      // is NOT modeled by this narrow table, same "only what this pool's
      // OWN cards need" scope as `Pump` above.
      const kw = ability['KW'];
      if (kw !== undefined) throw new UnsupportedForgeShape('PumpAll | KW$ (keyword-granting PumpAll — out of scope, only the P/T broadcast is modeled)');
      const numAtt = ability['NumAtt'];
      const numDef = ability['NumDef'];
      if (numAtt === undefined || numDef === undefined) throw new UnsupportedForgeShape('PumpAll with missing NumAtt$/NumDef$ (only a matched +N/+N broadcast is modeled)');
      const power = compileSignedPumpDelta(numAtt);
      const toughness = compileSignedPumpDelta(numDef);
      const duration = ability['Duration'];
      if (duration !== undefined) throw new UnsupportedForgeShape(`PumpAll | Duration$ ${duration} (only the absent/until-EOT default is modeled)`);
      const validCards = ability['ValidCards'];
      if (validCards === undefined) throw new UnsupportedForgeShape('PumpAll with no ValidCards$');
      const own = compileValidTgtsExtended(validCards);
      if (own.validType !== 'creature' || own.owner !== 'you') throw new UnsupportedForgeShape(`PumpAll | ValidCards$ ${validCards} (only \`Creature.YouCtrl\` maps to predicate:'creatures-you-control')`);
      return [{ kind: 'pumpAll', predicate: 'creatures-you-control', power, toughness, untilEndOfTurn: true, ...(own.notSelf ? { notSelf: true } : {}) }];
    }
    default:
      throw new UnsupportedForgeShape(`ability api "${api}"`);
  }
}

/** Forge's own real `"+N"`/`"-N"` `NumAtt$`/`NumDef$` string -> a signed number. Only this pool's own matched `+N/+N` shape is needed — an asymmetric or non-numeric delta is out of scope. */
function compileSignedPumpDelta(raw: string): number {
  const match = /^([+-])(\d+)$/.exec(raw);
  if (!match) throw new UnsupportedForgeShape(`NumAtt$/NumDef$ ${raw} (only a signed integer literal is modeled)`);
  return match[1] === '-' ? -Number(match[2]) : Number(match[2]);
}

// ---------------------------------------------------------------------------
// `T:` line -> `Trigger`
// ---------------------------------------------------------------------------

/**
 * Deterministic `Trigger.name`. Forge's own `T:` line carries NO name at
 * all (its only handle is `Execute$`, which names the EFFECT SVar, not the
 * cause), so any name here is minted by this compiler from the `Mode$` —
 * see `.claude/agent-memory/schema/topics/
 * forge-json-compiler-fdn-1-50-coverage-2026-09-19.md` for the full
 * writeup; this minted name is one of the two real, expected divergences
 * from a hand-authored definition's own human-picked trigger name (never a
 * bug to "fix" — see this file's own top-level header).
 */
function triggerNameFromMode(mode: string): string {
  return `on${mode}`;
}

/**
 * `TriggerZones$ Battlefield` is deliberately consumed-and-dropped, not a
 * field: battlefield-only is structural in this schema (a `Trigger` on a
 * permanent), and Forge's ABSENCE of `TriggerZones$` means all zones — so
 * `Battlefield` is the representable case and anything else is not.
 */
function assertBattlefieldZonesOnly(t: Record<string, string>): void {
  const zones = t['TriggerZones'];
  if (zones !== undefined && zones !== 'Battlefield') throw new UnsupportedForgeShape(`TriggerZones$ ${zones} (non-battlefield trigger zone is unrepresentable)`);
}

/**
 * Throws loudly if `t` carries any key OUTSIDE `consumed` — a safety net
 * for the newer `Mode$` branches below (NOT retrofitted onto the
 * pre-existing `LifeGained`/`CounterAdded(Once)` cases above, to avoid
 * re-auditing/risking a regression on the two cards already compiling
 * against them). Real motivator: Cat Collector's own real `Mode$
 * LifeGained | FirstTime$ True | PlayerTurn$ True` — without an assert
 * like this, a translation table that only reads the params it EXPECTS
 * would silently drop `FirstTime$`/`PlayerTurn$` instead of recognizing
 * them, exactly the "silent drop" this whole compiler's design stance
 * (`UnsupportedForgeShape` on anything unhandled) exists to prevent.
 */
function assertNoOtherParams(t: Record<string, string>, consumed: Set<string>): void {
  for (const key of Object.keys(t)) {
    if (!consumed.has(key)) throw new UnsupportedForgeShape(`unrecognized T: line param "${key}$ ${t[key]}"`);
  }
}

/**
 * `FirstTime$ True` (+ optionally `PlayerTurn$ True`) -> `activationLimit:
 * 1` — real Forge per-turn-reset outcome, verified against TWO already
 * hand-authored real cards that both need it: Cat Collector's own
 * `LifeGained | FirstTime$ True | PlayerTurn$ True` ("...for the first
 * time during each of YOUR turns," `fdn-cards/cat-collector/
 * definition.ts`'s own real `activationLimit: 1` + citing comment) and
 * Vanguard Seraph's own `LifeGained | FirstTime$ True` alone, no
 * `PlayerTurn$` at all ("...for the first time each turn," ANY turn, not
 * just yours). The real printed distinction between the two (whose turn
 * counts) has no separate field on `TriggerCause` to land in — both
 * collapse to the identical `activationLimit: 1`, matching Cat Collector's
 * own already-accepted precedent rather than inventing a new field for a
 * distinction this schema doesn't yet draw.
 */
function firstTimeActivationLimit(t: Record<string, string>): { activationLimit: 1 } | Record<string, never> {
  return t['FirstTime'] === 'True' ? { activationLimit: 1 } : {};
}

function compileTrigger(card: ForgeJsonCard, t: Record<string, string>): Trigger {
  const mode = t['Mode'];
  if (mode === undefined) throw new UnsupportedForgeShape('T: line with no Mode$');
  const execute = t['Execute'];
  if (execute === undefined) throw new UnsupportedForgeShape(`Mode$ ${mode} with no Execute$ (an immediate/static trigger)`);
  assertBattlefieldZonesOnly(t);

  let cause: TriggerCause;
  switch (mode) {
    case 'LifeGained': {
      // `ValidPlayer$ You` is part of this schema's `'lifeGained'` value's own
      // meaning (audited 2026-09-19), NOT a separate param — so any other
      // ValidPlayer$ is a genuinely different, unrepresentable occasion.
      const validPlayer = t['ValidPlayer'];
      if (validPlayer !== 'You') throw new UnsupportedForgeShape(`Mode$ LifeGained | ValidPlayer$ ${validPlayer ?? '(absent)'} (only \`You\` maps to on:'lifeGained')`);
      const firstTime = t['FirstTime'];
      const playerTurn = t['PlayerTurn'];
      if (playerTurn !== undefined && playerTurn !== 'True') throw new UnsupportedForgeShape(`Mode$ LifeGained | PlayerTurn$ ${playerTurn}`);
      if (playerTurn === 'True' && firstTime !== 'True') throw new UnsupportedForgeShape('Mode$ LifeGained | PlayerTurn$ True with no FirstTime$ True (unrecognized combination)');
      cause = { on: 'lifeGained', ...firstTimeActivationLimit(t) };
      break;
    }
    case 'ChangesZone': {
      const validCard = t['ValidCard'];
      if (validCard === undefined) throw new UnsupportedForgeShape('Mode$ ChangesZone with no ValidCard$');
      const origin = t['Origin'];
      const destination = t['Destination'];
      const checkSVar = t['CheckSVar'];
      let condition: BoardStateCondition | undefined;
      if (checkSVar !== undefined) {
        // Only Raid's own real `CheckSVar$ RaidTest` (paired with
        // `SVar:RaidTest:Count$AttackersDeclared`) is recognized — Skyship
        // Buccaneer's own real "Raid — When this creature enters, if you
        // attacked this turn, draw a card."
        const svar = card.SVar?.[checkSVar];
        const svarCount = svar !== undefined && typeof svar === 'object' ? (svar as Record<string, string>)['Count'] : undefined;
        if (checkSVar !== 'RaidTest' || svarCount !== 'AttackersDeclared') throw new UnsupportedForgeShape(`Mode$ ChangesZone | CheckSVar$ ${checkSVar} (unrecognized condition SVar)`);
        condition = { kind: 'attackedThisTurn' };
      }
      if (validCard === 'Card.Self' || validCard.startsWith('Card.Self+')) {
        // A bare `Card.Self` restriction beyond the plain zone-change
        // itself (Sun-Blessed Healer's own real `Card.Self+kicked`, "if it
        // was kicked") is a genuinely different, unrepresentable gate —
        // this schema's `on:'enter'`/`'dies'` have no such qualifier, so
        // it's thrown explicitly rather than silently ignored (would
        // otherwise misreport the trigger as an unconditional ETB/dies).
        if (validCard !== 'Card.Self') throw new UnsupportedForgeShape(`Mode$ ChangesZone | ValidCard$ ${validCard} (a self zone-change with an extra qualifier beyond plain Card.Self is unrepresentable)`);
        if (destination === 'Battlefield' && (origin === 'Any' || origin === 'Battlefield')) {
          cause = { on: 'enter', ...(condition !== undefined ? { condition } : {}) };
        } else if (destination === 'Graveyard' && origin === 'Battlefield') {
          cause = { on: 'dies', ...(condition !== undefined ? { condition } : {}) };
        } else {
          throw new UnsupportedForgeShape(`Mode$ ChangesZone | Origin$ ${origin ?? '(absent)'} | Destination$ ${destination ?? '(absent)'} | ValidCard$ Card.Self (unrecognized self zone-change)`);
        }
        assertNoOtherParams(t, new Set(['Mode', 'Origin', 'Destination', 'ValidCard', 'Execute', 'TriggerZones', 'TriggerDescription', 'CheckSVar']));
      } else if (destination === 'Battlefield') {
        // A board-wide "some OTHER qualifying permanent ENTERED" watch
        // (Grappling Kraken's own real Landfall, `ValidCard$
        // Land.YouCtrl`).
        const [typeWord, ...rest] = validCard.split('.');
        const isLand = typeWord === 'Land';
        if (!isLand && typeWord !== 'Creature' && typeWord !== 'Permanent') throw new UnsupportedForgeShape(`Mode$ ChangesZone | ValidCard$ ${validCard} (unrecognized other-permanent-watch type)`);
        let sameController = false;
        for (const modifier of rest.join('.').split('+').filter((m) => m.length > 0)) {
          if (modifier === 'YouCtrl') sameController = true;
          else throw new UnsupportedForgeShape(`Mode$ ChangesZone | ValidCard$ ${validCard} (unrecognized restriction "${modifier}")`);
        }
        cause = { on: 'otherPermanentEnters', otherPermanentEntersMatch: { ...(isLand ? { isLand: true } : {}), ...(sameController ? { sameController: true } : {}) } };
        assertNoOtherParams(t, new Set(['Mode', 'Origin', 'Destination', 'ValidCard', 'Execute', 'TriggerZones', 'TriggerDescription']));
      } else if (destination === 'Graveyard' && origin === 'Battlefield') {
        // A board-wide "some OTHER qualifying creature DIED" watch
        // (Valkyrie's Call's own real `ValidCard$
        // Creature.!token+nonAngel+YouCtrl` — the `nonAngel` subtype
        // exclusion maps to `otherCreatureDiesMatch.excludeSubtype`, Forge's
        // own GENERIC `non<Type>` restriction word, real source:
        // `CardStateProperty.java`'s own `property.startsWith("non")` branch
        // — matches ANY type/subtype word appended after the literal `non`
        // prefix, not a fixed enum of special-cased words. Valkyrie's Call
        // itself still throws further down its own chain, honestly — its
        // `Execute$` names a `ChangeZone | Defined$ TriggeredCard |
        // WithCountersType$ ... | StaticEffect$ ...` ability this compiler
        // has no case for at all, a genuinely separate, deeper gap from the
        // one this `nonAngel` fix closes).
        const [typeWord, ...rest] = validCard.split('.');
        if (typeWord !== 'Creature') throw new UnsupportedForgeShape(`Mode$ ChangesZone | Destination$ Graveyard | ValidCard$ ${validCard} (only a Creature other-dies watch is modeled)`);
        let nonToken = false;
        let sameController = false;
        let excludeSubtype: string | undefined;
        for (const modifier of rest.join('.').split('+').filter((m) => m.length > 0)) {
          const nonTypeMatch = /^non([A-Z][A-Za-z]*)$/.exec(modifier);
          if (modifier === '!token') nonToken = true;
          else if (modifier === 'YouCtrl') sameController = true;
          else if (nonTypeMatch) {
            if (excludeSubtype !== undefined) throw new UnsupportedForgeShape(`Mode$ ChangesZone | ValidCard$ ${validCard} (multiple non<Type> exclusions not modeled)`);
            excludeSubtype = nonTypeMatch[1];
          } else throw new UnsupportedForgeShape(`Mode$ ChangesZone | ValidCard$ ${validCard} (unrecognized restriction "${modifier}")`);
        }
        cause = {
          on: 'otherCreatureDies',
          otherCreatureDiesMatch: {
            ...(nonToken ? { nonToken: true } : {}),
            ...(sameController ? { sameController: true } : {}),
            ...(excludeSubtype !== undefined ? { excludeSubtype } : {}),
          },
        };
        assertNoOtherParams(t, new Set(['Mode', 'Origin', 'Destination', 'ValidCard', 'Execute', 'TriggerZones', 'TriggerDescription']));
      } else {
        throw new UnsupportedForgeShape(`Mode$ ChangesZone | Origin$ ${origin ?? '(absent)'} | Destination$ ${destination ?? '(absent)'} | ValidCard$ ${validCard} (unrecognized zone-change)`);
      }
      break;
    }
    case 'Attacks': {
      const validCard = t['ValidCard'];
      if (validCard !== 'Card.Self' && validCard !== 'Creature.Self') throw new UnsupportedForgeShape(`Mode$ Attacks | ValidCard$ ${validCard ?? '(absent)'} (only self-attacks is modeled)`);
      const threshold = t['Threshold'];
      let condition: BoardStateCondition | undefined;
      if (threshold !== undefined) {
        if (threshold !== 'True') throw new UnsupportedForgeShape(`Mode$ Attacks | Threshold$ ${threshold}`);
        // Real Threshold template — always "7 or more cards in your own
        // graveyard" (Kiora, the Rising Tide's own real "Threshold —
        // Whenever NICKNAME attacks, if there are seven or more cards in
        // your graveyard, ...").
        condition = { kind: 'graveyardCountAtLeast', min: 7 };
      }
      cause = { on: 'attacks', ...(condition !== undefined ? { condition } : {}) };
      assertNoOtherParams(t, new Set(['Mode', 'ValidCard', 'Execute', 'TriggerZones', 'TriggerDescription', 'Threshold', 'OptionalDecider']));
      break;
    }
    case 'AttackersDeclared': {
      const validAttackers = t['ValidAttackers'];
      if (validAttackers !== 'Creature') throw new UnsupportedForgeShape(`Mode$ AttackersDeclared | ValidAttackers$ ${validAttackers ?? '(absent)'}`);
      const attackingPlayer = t['AttackingPlayer'];
      if (attackingPlayer !== 'You') throw new UnsupportedForgeShape(`Mode$ AttackersDeclared | AttackingPlayer$ ${attackingPlayer ?? '(absent)'}`);
      const amountRaw = t['ValidAttackersAmount'];
      // Real Forge default (absent `ValidAttackersAmount$`) is `GE1` — "at
      // least one," the same `attackersDeclaredMinCount`-omitted meaning
      // this schema's own field already carries.
      let attackersDeclaredMinCount: number | undefined;
      if (amountRaw !== undefined) {
        const geMatch = /^GE(\d+)$/.exec(amountRaw);
        if (!geMatch) throw new UnsupportedForgeShape(`Mode$ AttackersDeclared | ValidAttackersAmount$ ${amountRaw} (only an "at least N" GEn threshold is modeled)`);
        const n = Number(geMatch[1]);
        if (n !== 1) attackersDeclaredMinCount = n;
      }
      cause = { on: 'attackersDeclared', ...(attackersDeclaredMinCount !== undefined ? { attackersDeclaredMinCount } : {}) };
      assertNoOtherParams(t, new Set(['Mode', 'ValidAttackers', 'ValidAttackersAmount', 'AttackingPlayer', 'Execute', 'TriggerZones', 'TriggerDescription']));
      break;
    }
    case 'Drawn': {
      const validCard = t['ValidCard'];
      if (validCard !== 'Card.YouCtrl') throw new UnsupportedForgeShape(`Mode$ Drawn | ValidCard$ ${validCard ?? '(absent)'} (only \`Card.YouCtrl\` maps to on:'drawNthCardThisTurn')`);
      const numberRaw = t['Number'];
      const drawNthCardThisTurnNumber = numberRaw !== undefined ? Number(numberRaw) : undefined;
      cause = { on: 'drawNthCardThisTurn', ...(drawNthCardThisTurnNumber !== undefined ? { drawNthCardThisTurnNumber } : {}) };
      assertNoOtherParams(t, new Set(['Mode', 'ValidCard', 'Number', 'Execute', 'TriggerZones', 'TriggerDescription']));
      break;
    }
    case 'CounterAdded':
    case 'CounterAddedOnce': {
      // Self-only scope is baked into this schema's `'counterAdded'` value.
      const validCard = t['ValidCard'];
      if (validCard !== 'Card.Self') throw new UnsupportedForgeShape(`Mode$ ${mode} | ValidCard$ ${validCard ?? '(absent)'} (only \`Card.Self\` maps to on:'counterAdded')`);
      const counterAddedMatch: { counterType?: string; source?: 'you' } = {};
      const counterTypeRaw = t['CounterType'];
      if (counterTypeRaw !== undefined) {
        const counterType = COUNTER_TYPE_NAME[counterTypeRaw];
        if (counterType === undefined) throw new UnsupportedForgeShape(`CounterType$ ${counterTypeRaw}`);
        counterAddedMatch.counterType = counterType;
      }
      const validSource = t['ValidSource'];
      if (validSource !== undefined) {
        if (validSource !== 'You') throw new UnsupportedForgeShape(`ValidSource$ ${validSource} (schema models only \`You\`)`);
        counterAddedMatch.source = 'you';
      }
      cause = { on: 'counterAdded', counterAddedMatch };
      const activationLimit = t['ActivationLimit'];
      if (activationLimit !== undefined) cause = { ...cause, activationLimit: Number(activationLimit) };
      break;
    }
    default:
      throw new UnsupportedForgeShape(`Mode$ ${mode}`);
  }

  return { name: triggerNameFromMode(mode), cause, effects: resolveAbilityChain(card, execute) };
}

// ---------------------------------------------------------------------------
// `A:` line -> `CardDefinition.effects` + `abilityType`
// ---------------------------------------------------------------------------

interface CompiledRootAbility {
  abilityType: 'spell' | 'activated';
  effects: Effect[];
  /** Only present for `abilityType: 'activated'` (a real `AB$` root ability's own `Cost$`) — see `compileActivationCost`'s own doc comment. */
  activationCost?: string;
}

/**
 * Forge `AB$ ... | Cost$ 2 W` -> this schema's free-text `activationCost`
 * display string (`CardDefinition.activationCost`'s own doc comment —
 * Warren Elder's own real `"{3}{W}"`). Real Forge `Cost$` is a SUPERSET of
 * `ManaCost$`'s own space-delimited-symbol format — it can ALSO carry
 * non-mana components (`T`, `Sac<1/CARDNAME>`, `Discard<1/Card>`, ...,
 * `forge-game/src/main/java/forge/game/cost/Cost.java`'s own tokenizer) —
 * so this can't just reuse `compileManaCost`'s blind brace-wrap (that
 * function is only ever fed a REAL `ManaCost:` line, never a richer
 * `Cost$`). Every token is verified to actually BE a mana symbol
 * (a plain integer, or a real `WUBRGC`/`X` pip) before folding it into a
 * matching `{...}` symbol — Squad Rallier's own real `Cost$ 2 W` is
 * mana-only (`res/cardsfolder/s/squad_rallier.txt`); no real FDN 1-50 card
 * needs a non-mana `AB$` cost component yet, so anything else throws.
 */
function compileActivationCost(raw: string): string {
  const tokens = raw.split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) throw new UnsupportedForgeShape('Cost$ (empty)');
  for (const token of tokens) {
    if (!/^(\d+|[WUBRGCX])$/.test(token)) throw new UnsupportedForgeShape(`Cost$ ${raw} (non-mana cost component "${token}" not yet modeled)`);
  }
  return tokens.map((t) => `{${t}}`).join('');
}

/**
 * An `A:` line is the card's OWN root ability, not a trigger — so it
 * compiles to `CardDefinition.effects`, with `abilityType` read straight
 * off Forge's own ability-type prefix (`AbilityRecordType`: `SP` = Spell,
 * `AB` = Ability/activated, `DB` = SubAbility, `ST` = StaticAbility —
 * AbilityFactory.java:70-73). `DB`/`ST` at root are categorically not this
 * field's business (see `CardDefinition.abilityType`'s own doc comment).
 * `AB$` (activated) additionally needs a real `Cost$` (Squad Rallier's own
 * real `{2}{W}` activation cost) — see `compileActivationCost`.
 */
function compileRootAbility(card: ForgeJsonCard, line: string | Record<string, string>): CompiledRootAbility {
  if (typeof line === 'string') throw new UnsupportedForgeShape(`\`A:\` line that did not parse into params: "${line}"`);
  const isActivated = line['AB'] !== undefined;
  if (!isActivated && line['SP'] === undefined) throw new UnsupportedForgeShape(`\`A:\` line with no SP$/AB$ key: ${JSON.stringify(line)}`);
  const context = contextFromValidTgts(line['ValidTgts']);
  const effects = compileAbilityEffects(line, context);
  const sub = line['SubAbility'];
  if (sub !== undefined) effects.push(...resolveAbilityChain(card, sub, context));
  if (isActivated) {
    const cost = line['Cost'];
    if (cost === undefined) throw new UnsupportedForgeShape('AB$ with no Cost$');
    return { abilityType: 'activated', effects, activationCost: compileActivationCost(cost) };
  }
  return { abilityType: 'spell', effects };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * `tokenScripts` — real Forge `res/tokenscripts/<id>.txt` bodies, keyed by
 * id, for any real `TokenScript$ <id>` this card's own `Token` ability
 * needs to resolve (see `resolveTokenScript`'s own doc comment for why
 * this is a caller-supplied lookup rather than a filesystem read done by
 * this module itself). Omit for a card with no `Token` ability at all.
 *
 * The returned `CardDefinition` always carries `provenance:
 * 'forge-json-compiler'` (2026-09-19) — see that field's own doc comment on
 * `CardDefinition` (`card.ts`) for what it's for: `validate-card-
 * definition.mjs`'s gate reads it to skip the `justification.json`
 * coverage-manifest requirement for a card authored this way. Set HERE
 * (the one real place a `CardDefinition` is ever produced FROM Forge JSON)
 * rather than in `write-fdn-definition.ts`, so anything else that ever
 * calls `compileForgeCard` directly (this file's own test corpus, a future
 * consumer) gets a correctly-marked object too, not just the on-disk
 * `fdn-cards/<slug>/definition.ts` writer.
 */
export function compileForgeCard(card: ForgeJsonCard, tokenScripts: Record<string, ForgeTokenScript> = {}): CardDefinition {
  // `R:` (replacement effects) stays a blanket out-of-scope throw — no
  // shape in this pool's own `R:` cluster (Crystal Barricade's own
  // "prevent all noncombat damage that would be dealt to other creatures
  // you control," Herald of Eternal Dawn's own GameLoss/GameWin
  // `Layer$ CantHappen` pair) has any real field on this schema to land in
  // at all, verified against both cards' own already-hand-authored
  // `missingSchemaFunctionality` entries (Crystal Barricade) / lack of any
  // representation whatsoever (Herald of Eternal Dawn) — see this
  // compiler's own 2026-09-19 coverage-push memory writeup for the full
  // per-card investigation trail.
  const rLines = card.R;
  if (Array.isArray(rLines) && rLines.length > 0) throw new UnsupportedForgeShape(`\`R:\` line(s) present (${rLines.length}) — out of this compiler's scope`);

  currentTokenScripts = tokenScripts;
  try {
    const pt = compilePT(card.PT);
    const { enchantsCreature, rest: kLines } = extractEnchantCreatureKLine(card.K);
    const keywordFields = compileKeywordLines(kLines);
    const explicitTriggers = (card.T ?? []).map((t) => compileTrigger(card, t));
    const triggers = enchantsCreature ? [...explicitTriggers, enchantCreatureAttachTrigger()] : explicitTriggers;

    // `S:` (static abilities) — only the single real `Mode$ Continuous |
    // Affected$ Creature.EnchantedBy | AddKeyword$ ...` shape is recognized
    // (see `compileStaticAbilityKeywordGrant`'s own doc comment); anything
    // else (Crystal Barricade's own real `Affected$ You`) throws.
    const sLines = card.S ?? [];
    const continuousKeywordGrants = sLines.map((s) => ({
      keywords: compileStaticAbilityKeywordGrant(s),
      includeSelf: false,
      equippedBySelf: true,
    }));

    const aLines = card.A ?? [];
    if (aLines.length > 1) throw new UnsupportedForgeShape(`${aLines.length} \`A:\` lines (needs the \`abilities[]\` multi-ability branch — out of scope)`);
    const root = aLines.length === 1 ? compileRootAbility(card, aLines[0]!) : undefined;

    return {
      name: card.Name,
      provenance: 'forge-json-compiler',
      manaCost: compileManaCost(card.ManaCost),
      typeLine: compileTypeLine(card.Types),
      ...(pt !== undefined ? { pt } : {}),
      ...(root !== undefined ? { abilityType: root.abilityType } : {}),
      ...keywordFields,
      ...(root !== undefined ? { effects: root.effects } : {}),
      ...(root !== undefined && root.activationCost !== undefined ? { activationCost: root.activationCost } : {}),
      ...(triggers.length > 0 ? { triggers } : {}),
      ...(continuousKeywordGrants.length > 0 ? { continuousKeywordGrants } : {}),
    };
  } finally {
    currentTokenScripts = {};
  }
}
