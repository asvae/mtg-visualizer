// A small, honest, deterministic per-card "engine support" crossref for
// FDN's authoring pipeline — genuinely different from the pipeline's own
// gray/purple/blue `pipeline-status.json` axis (`pipeline-status.ts`), which
// answers "does the schema fully REPRESENT this card's printed text." A
// card can have ZERO `missingSchemaFunctionality` gaps (fully represented)
// while still using a keyword/trigger/effect the schema recognizes but the
// real engine doesn't actually enforce/trigger at runtime — Ward is the
// confirmed real case this registry is seeded with: `card.ts`'s own
// `Keyword` union includes `'Ward'` (recognized, typed, gate-representable)
// but `functional-model/keywords/registry.ts`'s own catalog entry for it
// says plainly: "nothing in the engine enforces or triggers it yet."
//
// Also genuinely different from `functional-model/engine-status.ts`'s own
// 29-gap dashboard, which is coarse/subsystem-level (whole rules areas
// parsed out of `ENGINE_GAPS.md`'s numbered list, e.g. "Combat: blockers,
// damage, first/double strike, trample") — not fine-grained enough to
// answer "is `Keyword: 'Ward'` ITSELF engine-verified" for one specific
// card. This registry is the finer grain: a sparse, organically-growing
// set of real per-card-detectable gaps, seeded honestly small (one real
// entry today) and meant to grow as more are found — same "grow over time,
// never pre-seed the whole space" posture `engine-status.ts`'s own header
// already establishes for its own axis (see
// `.claude/contracts/engine-status-schema.md`).
//
// Deliberately NOT a new status color — `pipeline-status.ts`'s own
// gray/purple/blue/yellow/green/re-review axis is untouched by this file.
// `engineSupport` is a wholly separate, additive field wired into
// `PipelineStatusFile` by `pipeline-status.ts` itself (see that file for
// the wiring — this module only owns the registry + the pure classifier).
import type { CardDefinition } from './card';
import { triggerCondition, triggerOn } from './card';

export interface EngineSupportGapEntry {
  /** Stable, kebab-case identity — never reused for a different gap once
   * a real `pipeline-status.json` has recorded it (mirrors every other
   * axis's own `key`/`id` stability convention in this pool). */
  id: string;
  /** Real, specific, human-readable description of the gap — names the
   * exact recognized-but-unenforced construct and cites its own source
   * (never a vague "engine incomplete" placeholder). */
  description: string;
  /** Real, deterministic per-card check — reads only the given
   * `CardDefinition` (and, when present, its `backFace`), never any I/O or
   * external state. */
  matches: (definition: CardDefinition) => boolean;
  /** `ENGINE_GAPS.md`'s own numbered-gap reference, when this entry is
   * already tracked there under a broader/coarser umbrella. Left unset
   * (never guessed at a number) when no such numbered entry exists yet —
   * Ward's own gap is tracked only in `functional-model/keywords/
   * registry.ts`'s per-keyword `gapNote`, not as its own numbered
   * `ENGINE_GAPS.md` entry, as of this writing. */
  gapRef?: number;
}

/**
 * Real, current catalog — grows on demand as more real per-card engine-
 * support gaps are found, same discipline `sink-model`'s own catalog and
 * `engine-status.ts`'s own gap list already follow. Never a hypothetical/
 * speculative entry — each one must cite a real, checked source (a code
 * comment, `ENGINE_GAPS.md`, or `keywords/registry.ts`'s own `gapNote`).
 */
export const ENGINE_SUPPORT_REGISTRY: EngineSupportGapEntry[] = [
  {
    id: 'ward-not-enforced',
    description:
      "Ward is recognized/typed (card.ts's own Keyword union includes 'Ward') but nothing in state.ts enforces or triggers it yet — functional-model/keywords/registry.ts's own \"ward\" entry says so directly: \"Recognized only as a Keyword string-union member (card.ts) — same missing targeting-legality/triggered-cost machinery as Hexproof... nothing in the engine enforces or triggers it yet.\"",
    matches: (def) => (def.keywords ?? []).includes('Ward') || (def.backFace?.keywords ?? []).includes('Ward'),
  },
  {
    // 2026-09-18, FDN schema-completeness pass (card.ts's own Keyword union
    // gained 'Kicker'/'Prowess'/'CantBlock', BoardStateCondition, and
    // Trigger.on:'otherPermanentEnters' the same pass — see each field's own
    // doc comment for the full real-card cluster).
    id: 'kicker-not-enforced',
    description:
      "Kicker is recognized/typed (card.ts's own Keyword union includes 'Kicker', added 2026-09-18) but no payment-tracking or modal-gating-on-payment mechanism exists anywhere in this engine — a kicked/not-kicked branch still has to be modeled via the pre-existing modal/ctx.mode mechanism with no real enforcement that ctx.mode was only set to the kicked branch because the kicker cost was actually paid.",
    matches: (def) => (def.keywords ?? []).includes('Kicker') || (def.backFace?.keywords ?? []).includes('Kicker'),
  },
  {
    id: 'prowess-not-enforced',
    description:
      "Prowess is recognized/typed (card.ts's own Keyword union includes 'Prowess', added 2026-09-18) but its own auto-fire hook (\"whenever you cast a noncreature spell, this creature gets +1/+1 until end of turn\") needs a real Trigger.on:'castNoncreatureSpell' auto-fire dispatch that exists nowhere in this engine for ANY card, granted or native — ENGINE_GAPS.md's own trigger-doubling writeup already tracks this as a genuinely bigger, still wholly-unbuilt trigger family (17+ real FIN cards share it), not a numbered gap of its own.",
    matches: (def) => (def.keywords ?? []).includes('Prowess') || (def.backFace?.keywords ?? []).includes('Prowess'),
  },
  {
    id: 'cant-block-not-enforced',
    description:
      "CantBlock is recognized/typed (card.ts's own Keyword union includes 'CantBlock', added 2026-09-18) but engine.ts's own canBlock/declareBlockers (509.1) never check it on a proposed blocker — real enforcement would need the same real chokepoint that already checks 'Unblockable' on the ATTACKER side to also check this keyword on the BLOCKER side.",
    matches: (def) => (def.keywords ?? []).includes('CantBlock') || (def.backFace?.keywords ?? []).includes('CantBlock'),
  },
  {
    id: 'board-state-condition-not-enforced',
    description:
      "card.ts's own BoardStateCondition (added 2026-09-18) is declaratively real on Trigger.condition/ContinuousGrantTargeting.condition (the Threshold/Raid/counter-count-gate FDN cluster — crypt-feaster, midnight-snack, gutless-plunderer, billowing-shriekmass, cephalid-inkmage, skyknight-squire) but resolveCard/qualifiesForContinuousGrant never check it — resolveCard has no live GameState parameter to evaluate a graveyard/counter count against, and 'attackedThisTurn' needs real per-turn combat-history tracking this engine doesn't have at all (checked: interfaces.ts's own Player has no such method).",
    matches: (def) => hasBoardStateCondition(def) || (def.backFace ? hasBoardStateCondition(def.backFace) : false),
  },
  {
    id: 'other-permanent-enters-trigger-not-enforced',
    description:
      "Trigger.on:'otherPermanentEnters' (added 2026-09-18 — arahbo-the-first-fang/skyknight-squire's own \"whenever another [qualifying permanent] you control enters\" gap) is declaratively real but engine.ts dispatches no board-wide \"any permanent just entered\" sweep for it — every other real 'on' auto-fire value in this union only ever watches the permanent's OWN entrance/event, never a board-wide watch for OTHER permanents.",
    matches: (def) => hasOtherPermanentEntersTrigger(def) || (def.backFace ? hasOtherPermanentEntersTrigger(def.backFace) : false),
  },
  {
    // 2026-09-18, later still — FDN trigger-dispatch-cluster pass. Ten new
    // real, closed, Forge-cited Trigger.on values (see card.ts's own doc
    // comment on the `on` field for the full per-value citation trail) —
    // bundled as ONE registry entry (rather than ten near-identical ones)
    // since every one shares the exact same underlying reasoning: no
    // engine.ts call site dispatches ANY of them yet, same Ward pattern as
    // 'otherPermanentEnters' above.
    id: 'fdn-trigger-cluster-not-enforced',
    description:
      "Trigger.on values 'lifeGained'/'dies'/'otherCreatureDies'/'attackersDeclared'/'drawNthCardThisTurn'/'castNoncreatureSpell'/'castInstantOrSorcery'/'dealsCombatDamageToPlayer'/'creatureYouControlDealsCombatDamageToPlayer'/'opponentLifeLost' (all added 2026-09-18, later still) are each declaratively real (see card.ts's own doc comment on Trigger.on for the full real-card/Forge-citation trail per value) but engine.ts dispatches none of them yet — no LifeGained/ChangesZone-to-Graveyard/AttackersDeclared/Drawn/SpellCast/DamageDone/LifeLost auto-fire sweep exists anywhere in this engine today, for any card.",
    matches: (def) => hasFdnTriggerClusterOnValue(def) || (def.backFace ? hasFdnTriggerClusterOnValue(def.backFace) : false),
  },
  {
    id: 'spell-cost-reduction-card-type-gate-not-enforced',
    description:
      "SpellCostReductionGrant.cardTypes (added 2026-09-18, later still — archmage-of-runes's own card-type-gated \"Instant and sorcery spells you cast cost {1} less\") is declaratively real but state.ts's own activeSpellCostDiscount only ever checks grant.colors.some(...) — a cardTypes-only grant (colors: []) currently contributes ZERO real discount, a stronger \"always a no-op today\" case than the usual Ward pattern.",
    matches: (def) => hasSpellCostReductionCardTypeGate(def) || (def.backFace ? hasSpellCostReductionCardTypeGate(def.backFace) : false),
  },
  {
    // 2026-09-19, sink-model pass (schema agent) — closes the real gap
    // sink-model/catalog/families/counters.ts's own header comment flagged
    // (its prior citation of this as an ENGINE_GAPS.md entry was checked and
    // found wrong — no such entry ever existed there; corrected in that
    // file's own comment alongside this registry entry, not tracked as a
    // NEW ENGINE_GAPS.md numbered entry either, same "sparse registry entry,
    // no gapRef" posture every other FDN-pass Trigger.on addition above
    // already takes).
    id: 'counter-added-trigger-not-enforced',
    description:
      "Trigger.on:'counterAdded' + counterAddedMatch.counterType (added 2026-09-19 — Exemplar of Light's own real \"Whenever you put one or more +1/+1 counters on this creature, draw a card\" second ability, res/cardsfolder/e/exemplar_of_light.txt) is declaratively real but engine.ts dispatches no real Forge TriggerCounterAdded/TriggerCounterAddedOnce-equivalent sweep for it — same Ward pattern as every other Trigger.on value in this registry.",
    matches: (def) => hasCounterAddedTrigger(def) || (def.backFace ? hasCounterAddedTrigger(def.backFace) : false),
  },
];

/** Shared by `board-state-condition-not-enforced` — true if any trigger or
 * continuous grant on this ONE face declares a `BoardStateCondition`. */
function hasBoardStateCondition(def: CardDefinition): boolean {
  if ((def.triggers ?? []).some((t) => triggerCondition(t))) return true;
  const grantArrays = [def.continuousKeywordGrants, def.continuousPTGrants, def.continuousTypeGrants];
  return grantArrays.some((grants) => (grants ?? []).some((g) => g.condition));
}

/** Shared by `other-permanent-enters-trigger-not-enforced` — true if any
 * trigger on this ONE face uses the new watch-trigger `on` value. */
function hasOtherPermanentEntersTrigger(def: CardDefinition): boolean {
  return (def.triggers ?? []).some((t) => triggerOn(t) === 'otherPermanentEnters');
}

/** Shared by `fdn-trigger-cluster-not-enforced` — true if any trigger on
 * this ONE face uses one of the ten new (2026-09-18, later still) `on`
 * values, none of which `engine.ts` dispatches yet. */
const FDN_TRIGGER_CLUSTER_ON_VALUES = new Set<string>([
  'lifeGained',
  'dies',
  'otherCreatureDies',
  'attackersDeclared',
  'drawNthCardThisTurn',
  'castNoncreatureSpell',
  'castInstantOrSorcery',
  'dealsCombatDamageToPlayer',
  'creatureYouControlDealsCombatDamageToPlayer',
  'opponentLifeLost',
]);
function hasFdnTriggerClusterOnValue(def: CardDefinition): boolean {
  return (def.triggers ?? []).some((t) => {
    const on = triggerOn(t);
    return typeof on === 'string' && FDN_TRIGGER_CLUSTER_ON_VALUES.has(on);
  });
}

/** Shared by `spell-cost-reduction-card-type-gate-not-enforced` — true if
 * any `spellCostReductionGrants` entry on this ONE face declares a
 * non-empty `cardTypes`. */
function hasSpellCostReductionCardTypeGate(def: CardDefinition): boolean {
  return (def.spellCostReductionGrants ?? []).some((g) => (g.cardTypes ?? []).length > 0);
}

/** Shared by `counter-added-trigger-not-enforced` — true if any trigger on
 * this ONE face uses the new (2026-09-19) `on: 'counterAdded'` value. */
function hasCounterAddedTrigger(def: CardDefinition): boolean {
  return (def.triggers ?? []).some((t) => triggerOn(t) === 'counterAdded');
}

/**
 * Pure, deterministic per-card classifier — `'off'` iff at least one real
 * registry entry matches this `CardDefinition` (checking both its front
 * face and, when present, its `backFace`, since each entry's own `matches`
 * already checks both directly). `'on'` means "no currently-tracked engine-
 * support gap found," NOT "engine-verified clean" — this registry is
 * sparse and organically-growing (see this file's own header), so `'on'`
 * is honestly "nothing tracked yet," same posture `engine-status.ts`'s own
 * gray/purple/blue baseline already takes toward its own sparse index.
 */
export function computeEngineSupport(definition: CardDefinition): 'on' | 'off' {
  return ENGINE_SUPPORT_REGISTRY.some((entry) => entry.matches(definition)) ? 'off' : 'on';
}
