// New recognizer (2026-09-16, fin/26-50 pass, closing Slash of Light's own
// remaining unprovenanced facts) — structural, `dealDamageTarget`'s own
// direct sibling of `dealDamage-effect-structural.ts` (same "amount plays
// no role in what the Fact actually claims" reasoning — see that file's own
// module doc comment, not repeated here — plus the same tier-2
// `probeComputedNumber` "scales with X" sink pairing for a non-literal
// `amount`) and of `pumpTarget-effect-structural.ts`/`grantKeywordTarget-
// effect-structural.ts` (same single-CHOSEN-target shape, same narrow-
// source/whole-clause-sink annotation split, same "one real repeated
// clause/occurrence per effect, claimed left-to-right" tolerance for a
// Tiered/Choose-one card whose own modes repeat the identical verb
// template with only the literal amount differing).
//
// **Real, whole-pool check (originally 6 real `kind:'dealDamageTarget'`
// cards, now 5 — slash-of-light migrated off this Effect kind entirely
// 2026-09-16, see its own note below) done first**:
//   - **`owner` omitted (4 of 5 remaining, plus slash-of-light's own now-
//     historical entry below)**: `blazing-bomb`
//     ("It deals damage equal to its power to target creature" — `amount`
//     is `ctx.self.getNetPower()`, a real closure with NO recognized
//     `runtime-dependency-probe.ts` collection root, so its own tier-2 sink
//     honestly declines — same as `dealDamage-effect-structural.ts`'s own
//     Emperor of Palamecia decline), `light-of-judgment` ("Light of
//     Judgment deals 6 damage to target creature. Destroy up to one
//     Equipment attached to that creature." — the SECOND sentence's own
//     "destroy...attached to THAT creature" is a real, separately-flagged
//     unmodelable gap, already documented on that card's own `definition.ts`
//     — irrelevant to this recognizer, which only ever reads the FIRST
//     sentence's own clause), `slash-of-light` — **STALE as of 2026-09-16,
//     kept for history**: this card used to be `kind:'dealDamageTarget'`
//     with an opaque `Computed` amount ("...deals damage equal to the
//     number of creatures you control plus the number of Equipment you
//     control to target creature" — `amount` summed TWO collection roots,
//     one narrowed by a `.filter(c => c.hasSubtype('Equipment'))` callback
//     `runtime-dependency-probe.ts`'s own `classifyTrace` deliberately never
//     reads, classifying as a compound "creatures you control + permanents
//     you control" tag with no matching `BUCKET_TO_SINK` entry, so BOTH
//     magnitude-driving sinks honestly stayed unrecognized; only the SOURCE
//     fact and the "wants a target creature present" SINK were asserted
//     here). It has since migrated off `kind:'dealDamageTarget'` entirely
//     onto `kind:'program'`/`AddValue` (this recognizer no longer matches
//     it at all — `effects.length === 0`); its own real two-summed-term gap
//     is now closed for real, as genuine inspectable data instead of an
//     opaque closure, by `dealDamageEachMagnitude-effect-structural.ts`, see
//     that file's own module doc comment), `suplex` ("Suplex deals 3 damage to target creature. If
//     that creature would die this turn, exile it instead." — same
//     "second sentence out of scope" shape as Light of Judgment, this one
//     without even needing its own exception marker since nothing here
//     claims anything about the second sentence at all), `thunder-magic`
//     (Tiered, 3 modes — "Thunder Magic deals 2/4/8 damage to target
//     creature," 3 real, textually DISTINCT clauses differing only in the
//     literal amount — same "each effect claims its own left-to-right
//     unclaimed occurrence" matching this recognizer uses generally, not a
//     special case just for this card).
//   - **`owner:'opponents'` (1 of 6)**: `summon-esper-ramuh` chapter I
//     ("This creature deals damage equal to the number of noncreature,
//     nonland cards in your graveyard to target creature AN OPPONENT
//     CONTROLS" — `amount` is `ctx.you.getCardsIn('Graveyard').filter(...)`,
//     classifies as "cards in your graveyard," no matching `BUCKET_TO_SINK`
//     entry either — same honest tier-2 decline, source+sink still
//     asserted).
//   - **`owner:'opponents'` + `tapped:true` (1, new 2026-09-16)**:
//     `summon-primal-garuda` chapter I, Aerial Blast — "This creature deals
//     4 damage to target TAPPED creature an opponent controls," a literal
//     `amount:4` (no tier-2 sink needed at all). Migrated off a bespoke
//     `kind:'custom'` closure the same day `dealDamageTarget`'s own
//     `tapped` field was added (`card.ts`) — previously the ONLY thing
//     blocking this card off this Effect kind entirely was the missing
//     tapped-filter; now a real, closed 6th subject-phrase combination
//     (`subjectCandidate`, below): "target tapped creature an opponent
//     controls." Both the source fact's own `target.tapped` and the
//     paired sink's own top-level `tapped` (a `Constraints`-shaped field,
//     not nested — same convention every other sink already uses) get set
//     when `effect.tapped` is true, mirroring this card's own real,
//     already-hand-authored fact shape exactly (confirmed via
//     `apply-recognizers.mjs` retagging it in place, no new fact needed).
//
// **Fact shape convention** — same `controller` semantics `dealDamage-
// effect-structural.ts` already establishes for the bare `event:'damage'`
// kind (`controller` = the DOER, always `'you'` — see `synergy.ts`'s own
// `Fact.controller` doc comment on why an event-shaped `damage` fact reads
// this way, unlike `pump`/`grantKeyword`'s own target-controller reading):
// the SOURCE fact is always `{event:'damage', controller:'you',
// target:{types:{has:['Creature']}}, targeted:true}` regardless of `owner`
// — an `owner:'opponents'` restriction is expressed ONLY via the paired
// SINK's own `controller:'opp'` (never nested inside `target`, which has no
// `controller` sub-field at all — `synergy.ts`'s own `Constraints`
// interface). This matches `summon-esper-ramuh`'s own former hand-authored
// sink (`{zone:'Battlefield', controller:'opp'}`, no `types` at all — a
// real, honest pre-existing gap this recognizer's own sink now closes with
// `types:{has:['Creature']}` added).
import type { Effect } from '../card';
import type { RecognizedFact, RecognizerResult } from './types';
import { toLineOffset } from './types';
import { allEffects, effectSourceMap, triggeredByOf, type StructuralRecognizerInput } from './structural-effects';
import { probeComputedNumber } from './runtime-dependency-probe';

export type { StructuralRecognizerInput };

const RULE = 'dealDamageTarget-effect-structural' as const;

type DealDamageTargetEffect = Extract<Effect, { kind: 'dealDamageTarget' }>;

function isDealDamageTargetEffect(e: Effect): e is DealDamageTargetEffect {
  return e.kind === 'dealDamageTarget';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The real, closed subject phrase — `undefined` for any `owner`/`tapped`
 * combination without a confirmed real card (see module doc comment: only
 * `undefined`/`'each'` and `'opponents'` are confirmed for `owner`; only
 * `owner:'opponents'` has a confirmed `tapped:true` combination — Summon:
 * Primal Garuda's own real "target TAPPED creature an opponent controls,"
 * the sole real whole-pool user of `tapped` on this Effect kind, 2026-09-16
 * — widen the `tapped` branch below the day a second real combination
 * (e.g. a bare "target tapped creature," no owner restriction) shows up). */
function subjectCandidate(owner: DealDamageTargetEffect['owner'], tapped: boolean | undefined): string | undefined {
  if (tapped) {
    if (owner === 'opponents') return 'target tapped creature an opponent controls';
    return undefined;
  }
  if (owner === undefined || owner === 'each') return 'target creature';
  if (owner === 'opponents') return 'target creature an opponent controls';
  return undefined;
}

const PERMANENT_TYPE_WORDS = ['Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle'];

/** Same self-referential-GRAMMATICAL-subject alternation `dealDamage-
 * effect-structural.ts`'s own copy establishes (which itself mirrors
 * `dies-trigger-structural.ts`'s own original) — "this <permanent type>"/
 * "this permanent"/the card's own printed name or short pre-comma form,
 * deliberately excluding bare "it". Not to be confused with `subject`
 * above, which is the DIRECT OBJECT of "to" (who's being hit), a wholly
 * different real slot in the same clause.
 *
 * **Widening added 2026-09-16** (`verify-text-coverage.mjs` flagged
 * `summon-esper-ramuh`'s own "This creature" as sitting just outside this
 * recognizer's own SOURCE annotation) — real, confirmed forms across this
 * recognizer's own whole-pool check (see module doc comment): Light of
 * Judgment's/Suplex's/Thunder Magic's own printed names ("Light of
 * Judgment deals...", "Suplex deals...", "Thunder Magic deals..." x3,
 * identical subject repeated per mode), Summon: Esper Ramuh's own "This
 * creature". Blazing Bomb uses bare "It" instead — genuinely NOT covered,
 * same as `dealDamage-effect-structural.ts`'s own Vivi Ornitier/Emperor of
 * Palamecia declines; its own annotation correctly keeps starting at
 * "deals" (and isn't flagged by `verify-text-coverage.mjs` either,
 * confirming this is a real non-issue there, not a theoretical one). */
function selfSubjectAlternation(name: string): string {
  const typeAlt = PERMANENT_TYPE_WORDS.map((w) => `this ${w.toLowerCase()}`).join('|');
  const shortName = name.split(',')[0]!.trim();
  const nameAlt = shortName !== name ? `${escapeRegExp(name)}|${escapeRegExp(shortName)}` : escapeRegExp(name);
  return `(?:${typeAlt}|this permanent|${nameAlt})`;
}

/** Same small, closed bucket->sink map `dealDamage-effect-structural.ts`
 * already establishes for its own tier-2 pairing — reused verbatim (not
 * duplicated by accident: both recognizers independently need the exact
 * same `runtime-dependency-probe.ts` bucket vocabulary, so sharing the map
 * would be the DRY move, but neither file imports the other's private
 * const today — a real, minor, cosmetic duplication, not a behavioral
 * risk, since `probeComputedNumber`'s own tag vocabulary is the single
 * source of truth either file reads). */
const BUCKET_TO_SINK: Record<string, { to: 'Battlefield'; controller: 'you'; types?: { has: string[] } }> = {
  'permanents you control': { to: 'Battlefield', controller: 'you' },
  'creatures you control': { to: 'Battlefield', controller: 'you', types: { has: ['Creature'] } },
  'lands you control': { to: 'Battlefield', controller: 'you', types: { has: ['Land'] } },
};

export function recognizeDealDamageTargetEffectStructural(input: StructuralRecognizerInput): RecognizerResult {
  const effects = allEffects(input).map((o) => o.effect).filter(isDealDamageTargetEffect);
  if (effects.length === 0) {
    return { matched: false, reason: "no kind:'dealDamageTarget' Effect on this face" };
  }
  // `Fact.triggeredBy` (2026-09-16, causal-links "widen populate" pass) —
  // see `dealDamage-effect-structural.ts`'s own identical comment.
  const effectSource = effectSourceMap(input);

  const facts: RecognizedFact[] = [];
  const claimed = new Set<number>();

  for (const effect of effects) {
    const triggeredBy = triggeredByOf(effectSource.get(effect));
    const subject = subjectCandidate(effect.owner, effect.tapped);
    if (!subject) {
      return {
        matched: false,
        reason: `a dealDamageTarget effect on this face has owner:${JSON.stringify(effect.owner)}/tapped:${JSON.stringify(effect.tapped)} — no confirmed real Fact shape yet`,
      };
    }

    // Narrow group 1 ("deals ... damage", now optionally preceded by the
    // effect's own grammatical subject — see `selfSubjectAlternation`'s own
    // doc comment) for the SOURCE annotation, whole match ("deals ...
    // damage ... to <subject>") for the SINK — same split `pumpTarget-
    // effect-structural.ts`/`grantKeywordTarget-effect-structural.ts`
    // already establish for their own analogous kinds.
    const selfSubject = selfSubjectAlternation(input.name);
    const pattern = new RegExp(`\\b((?:${selfSubject}\\s+)?deals\\b[^\\n]*?\\bdamage)\\b[^\\n]*?\\b(to ${escapeRegExp(subject)})\\b`, 'id');
    const global = new RegExp(pattern.source, pattern.flags + 'g');
    const matches = [...input.oracleText.matchAll(global)] as (RegExpMatchArray & { indices: Array<[number, number]> })[];
    const unclaimed = matches.find((m) => !claimed.has(m.index!));
    if (!unclaimed) {
      return {
        matched: false,
        kind: 'mismatch',
        reason: `no unclaimed "deals ... damage ... to ${subject}" clause found in oracle text "${input.oracleText}" (${matches.length} total match(es), all already claimed by an earlier effect on this face)`,
      };
    }
    claimed.add(unclaimed.index!);

    const fullStart = unclaimed.index!;
    const fullEnd = fullStart + unclaimed[0]!.length;
    const [dealsStart, dealsEnd] = unclaimed.indices[1]!;
    const sourceAnnotation = toLineOffset(input.oracleText, dealsStart, dealsEnd);
    const sinkAnnotation = toLineOffset(input.oracleText, fullStart, fullEnd);
    if (!sourceAnnotation || !sinkAnnotation) {
      return { matched: false, reason: `matched span [${fullStart},${fullEnd}) did not resolve to a single real oracle-text line` };
    }

    facts.push({
      role: 'source',
      fact: {
        event: 'damage',
        controller: 'you',
        target: { types: { has: ['Creature'] }, ...(effect.tapped ? { tapped: true as const } : {}) },
        targeted: true,
        annotations: [sourceAnnotation],
        ...(triggeredBy ? { triggeredBy } : {}),
      },
      provenance: { origin: 'parser', rule: RULE },
    });
    facts.push({
      role: 'sink',
      fact: {
        to: 'Battlefield',
        ...(effect.owner === 'opponents' ? { controller: 'opp' as const } : {}),
        types: { has: ['Creature'] },
        ...(effect.tapped ? { tapped: true as const } : {}),
        annotations: [sinkAnnotation],
      },
      provenance: { origin: 'parser', rule: RULE },
    });

    if (typeof effect.amount === 'function') {
      const result = probeComputedNumber(effect.amount);
      if (result.classified) {
        const bucketKey = result.tag.replace(/^scales with /, '');
        const sink = BUCKET_TO_SINK[bucketKey];
        if (sink) {
          facts.push({
            role: 'sink',
            fact: { ...sink, annotations: [sinkAnnotation] },
            provenance: { origin: 'parser', rule: RULE },
          });
        }
        // An unrecognized (possibly compound) bucket — e.g. Slash of
        // Light's own "creatures you control + permanents you control," or
        // Summon: Esper Ramuh's own "cards in your graveyard" — is a real,
        // honest tier-2 non-match, same restraint `dealDamage-effect-
        // structural.ts`'s own `BUCKET_TO_SINK` already documents. Not an
        // error; the SOURCE fact and the recipient SINK above are still
        // asserted regardless.
      }
    }
  }

  return { matched: true, facts };
}
