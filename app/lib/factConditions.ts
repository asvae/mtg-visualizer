import { isEventFact, isZoneFact, zoneMovementName } from '../../functional-model/synergy';
import type { Constraints, Fact, NumConstraint, Side, TypeConstraint, ZoneFact } from '../../functional-model/synergy';

// Human-readable "who/what" notes for the Facts tab's rightmost column
// (app/pages/app/card/[set]/[number].vue) — companion to a fact's own
// bare-category LABEL (`describeFact`, functional-model/synergy.ts).
//
// Design context (2026-09-10): `describeFact` used to fold a fact's
// controller/recipient/type-constraint data into its own label text on a
// PER-BRANCH basis (e.g. "opponent's battlefield presence", "either
// player's nonland permanent dying") — this file's old version had to
// hand-mirror exactly which branch folded which field, so it wouldn't
// either repeat information already in the label or silently drop real
// information a branch never mentioned. That was flagged as a standing
// "known duplication risk": drift the moment `describeFact` grew a new
// branch this file didn't know about.
//
// `describeFact` was reworked (same task) to always render a bare category
// name only ("Battlefield presence", "Dying", "Damage", ...) — no branch
// folds controller/recipient/type-constraint data into the label anymore,
// at all. That removes the duplication risk at its root: this file no
// longer needs to know anything about `describeFact`'s own branches. It
// just uniformly turns every side/recipient/constraint field a fact
// actually carries into a short, readable phrase — same treatment
// regardless of zone/event/branch — except fields shown elsewhere on the
// row already (`value`/`role`/`sourceText`), bookkeeping (`id`), a
// tooltip-only substring (`highlight`), and the multi-face grouping hint
// (`face` — already visible as this tab's own "Main card"/"Other
// faces/functions" sub-header). A fact that's genuinely tautologically
// self-referencing (`subject`/`target` literally `'self'` — see
// `isSelfReferencing` below, exported for the card page's own header
// annotation — a self-baseline fact with no textual anchor of its own gets
// linked to the card's NAME in the page header instead, same
// underline+hover treatment as any other annotated fact; see the card
// page's `headerFaceFacts`) still gets a controller phrase, just the
// literal word "self" rather than "yours"/"other" (an omitted `controller` —
// the either-player default — is never shown here at all, see
// `controllerPhrase` below) — a real, separately-authored `controller` side
// was never set here.
//
// Never emits raw JSON — every field this column shows gets its own
// hand-written phrase, joined by " · " (e.g. "yours · nonland
// permanent"). Falls back to a plain, still-JSON-free `key: value` phrase
// (see `formatUnknown`) for any field this file genuinely doesn't know
// about yet, so a future schema addition still surfaces here automatically
// (same lesson the old hand-maintained `CONDITION_KEYS` allowlist bug
// taught: prefer "show unless I know it's redundant" over "hide unless I
// know it's needed").

/**
 * A fact whose `subject` (zone fact) or `subject`/`target` (event fact) is
 * literally `'self'` is tautologically about the caster's own side — same
 * reading `functional-model/synergy.ts`'s own `effectiveController` already
 * relies on for MATCHING. Showing "yours" here would misleadingly imply a
 * real, separately-authored `controller` side; the phrase renders the
 * literal word "self" instead (a source fact about its OWN battlefield
 * presence, a card dying to its own delayed-sacrifice trigger, etc.) — real,
 * side-bearing facts (an unconstrained sink "wants a permanent you
 * control", a dies/putCounter fact with a real non-self `target`) are
 * unaffected, they never set `subject`/`target` to `'self'` in the first
 * place. Exported: the card page's own header annotation (`headerFaceFacts`)
 * needs the same self-referencing test to decide which facts get linked to
 * the card's NAME instead of a real oracle-text span.
 */
export function isSelfReferencing(fact: Fact): boolean {
  if (fact.subject === 'self') return true;
  return isEventFact(fact) && fact.target === 'self';
}

// `'opp'` renders as the bare word "other" — not "opponent's" — per
// 2026-09-10 correction: this phrase is strictly about WHOSE side a fact
// concerns (yours vs. the other side), not a claim about an "opponent" as
// a separate concept. Kept as a separate function from `recipientPhrase`
// below — the two can appear on the SAME fact (Summon: Bahamut's Mega
// Flare: `controller:'you', recipient:'opp'` → "yours · to others") and
// need to read as two distinct halves of one sentence, not two copies of
// the same phrase, even though both now avoid the word "opponent".
//
// `controller` (like `recipient` below) is omitted from the notes column
// entirely when absent (an "either player" fact says nothing distinguishing
// here) — no "either player's" placeholder — see the `fact.controller`
// truthy-guard at the call site below, which is why this function only ever
// takes a real `Side`, never `undefined`.
function controllerPhrase(side: Side): string {
  return side === 'you' ? 'yours' : 'other';
}

/** `recipient` (damage's own "who does this go to") is omitted from the
 * notes column entirely when absent (an "either player" fact says nothing
 * distinguishing here) — see the `fact.recipient` truthy-guard at the call
 * site below, which is why this function never needs an undefined/blank
 * case of its own. */
function recipientPhrase(side: Side): string {
  return side === 'you' ? 'to you' : 'to others';
}

/**
 * Small, card-owned mirror of a slice of `constraintBits`
 * (functional-model/synergy.ts) — deliberately NOT imported from there.
 * `.claude/contracts/card-schema.md` already flags this file's existing
 * `describeFact`(-adjacent)/`isZoneFact` import as a standing violation of
 * the engine/card boundary ("engine-owned label-templating logic ...
 * imported ... by the card page") and explicitly asks future work not to
 * deepen it ("don't add more engine-owned functions to that import going
 * forward"). Duplicating this one small, stable has/hasAny/not phrase
 * exactly here (rather than exporting and importing the engine's own
 * copy) keeps that boundary from growing one function wider, at the cost
 * of the two staying independently maintained — the same trade
 * `describeFact`'s own doc comment already accepts elsewhere for the
 * reverse reason (that file declining to import a card-owned helper).
 */
function typeBits(types: TypeConstraint | undefined): string[] {
  if (!types) return [];
  const bits: string[] = [];
  if (types.has) bits.push(types.has.join(' ').toLowerCase());
  if (types.hasAny) bits.push(`(${types.hasAny.join('/')})`);
  if (types.not) bits.push(types.not.map((t) => `non${t.toLowerCase()}`).join(' '));
  return bits;
}

function numText(n: NumConstraint): string {
  if (n.eq !== undefined) return `${n.eq}`;
  if (n.min !== undefined && n.max !== undefined) return `${n.min}-${n.max}`;
  if (n.min !== undefined) return `${n.min}+`;
  if (n.max !== undefined) return `up to ${n.max}`;
  return '';
}

/** Every fixed-vocabulary `Constraints` field (functional-model/synergy.ts)
 * as short phrases. `noun` names what the constrained thing actually IS
 * ("permanent"/"card"/"spell"/...) so a bare `not`/`has` bit reads as
 * "nonland permanent," not a dangling adjective — the concrete case this
 * was built against (Summon: Bahamut's `target:{types:{not:['Land']}}}`
 * → "nonland permanent", not bare "nonland"). */
function constraintPhrases(c: Constraints, noun: string): string[] {
  const bits: string[] = [];
  const types = typeBits(c.types);
  if (types.length) bits.push(`${types.join(' ')} ${noun}`);
  if (c.cmc) bits.push(`mana value ${numText(c.cmc)}`);
  if (c.power) bits.push(`power ${numText(c.power)}`);
  if (c.toughness) bits.push(`toughness ${numText(c.toughness)}`);
  if (c.amount) bits.push(`amount ${numText(c.amount)}`);
  if (c.name) bits.push(`named ${c.name.eq}`);
  return bits;
}

/** Zone-appropriate plural noun for a zone fact's own top-level type
 * constraint — kept as a tiny local copy of `synergy.ts`'s own
 * (unexported) `ZONE_NOUN`, same "small deliberate duplicate rather than
 * growing the engine import" trade as `typeBits` above. */
const ZONE_NOUN: Record<string, string> = {
  Battlefield: 'permanents',
  Graveyard: 'cards',
  Hand: 'cards',
  Library: 'cards',
  Exile: 'cards',
  Stack: 'spells',
};

/** Mirrors `functional-model/synergy.ts`'s own (unexported) `effectiveZone`
 * — same small-stable-duplicate trade as `ZONE_NOUN`/`typeBits` above,
 * since engine doesn't export it. "The zone this fact is actually about,"
 * regardless of whether it's a sink's (or a pre-2026-09-11-rework source's)
 * plain `zone`, or a rework-shaped source's own `to`. */
function effectiveZone(fact: ZoneFact): string | undefined {
  return fact.zone ?? fact.to;
}

/**
 * A SOURCE zone-change fact's own `from` origin, surfaced in this column
 * ONLY when it adds real information beyond what `describeFact`'s own label
 * already conveys via `zoneMovementName`/`ZONE_MOVEMENT_NAMES`
 * (functional-model/synergy.ts, 2026-09-11 rework) — e.g. "dies" already
 * means battlefield→graveyard regardless of cause (CR 700.4, see that
 * table's own doc comment), so repeating "from battlefield" here would be
 * pure noise; a real declared origin on a movement that ISN'T named yet
 * (the bare "<zone> presence" fallback label says nothing about where it
 * came from) is genuinely new information, so that case shows it. Never
 * surfaces the destination (`to`) itself — that's always either baked into
 * the named movement or identical to the zone the fallback label already
 * names, so it's redundant either way (also why `to`/`from` are both in
 * `HANDLED_OR_LABEL_KEYS` below rather than falling through to
 * `formatUnknown`). Returns nothing at all for a SINK fact (never has
 * `to`/`from` — a plain state check, not a movement, per `ZoneFact`'s own
 * doc comment) or a legacy bare-`zone` SOURCE fact (no `to`/`from` set at
 * all — not yet migrated; still-unmigrated cards render exactly as before).
 */
function movementOriginPhrase(fact: ZoneFact): string | undefined {
  if (fact.role !== 'source') return undefined;
  if (fact.to === undefined && fact.from === undefined) return undefined;
  const to = effectiveZone(fact);
  if (!to || zoneMovementName(fact.from, to)) return undefined;
  return fact.from ? `from ${fact.from.toLowerCase()}` : undefined;
}

/** Every field this function explicitly renders above (or deliberately
 * omits — `zone`/`event` construct the label itself; `value`/`role`/
 * `face`/`annotations` are shown/used elsewhere, not in this column) —
 * used only to find genuinely UNHANDLED fields below, not as an allowlist
 * gating what gets shown. `annotations` (`AnnotationRef[]`, required since
 * 2026-09-11) is positional oracle-text-pointer metadata, not a
 * human-facing condition — omitting it here is the same treatment the now-
 * removed `sourceText`/`id`/`highlight` got before they were dropped from
 * `Fact` entirely; without this entry every fact leaks a garbled
 * `annotations: 0 [object Object]` bit into the notes column via the
 * generic fallback loop below (confirmed live, a real regression from the
 * annotations-required rework, fixed here rather than left for a future
 * task). */
const HANDLED_OR_LABEL_KEYS = new Set([
  'zone',
  'to',
  'from',
  'zoneFrom',
  'zoneTo',
  'event',
  'value',
  'role',
  'face',
  'annotations',
  'controller',
  'recipient',
  'subject',
  'target',
  'types',
  'cmc',
  'power',
  'toughness',
  'amount',
  'name',
  'counterType',
  'color',
  'colors',
  'tapped',
  'oncePerTurn',
]);

/** Best-effort, still-never-raw-JSON rendering for a field this file
 * doesn't know about yet (a future `Fact`/`Constraints` addition) — same
 * "show unless known-redundant" principle the rest of this file follows,
 * just without a hand-written phrase for it yet. A nested object still
 * gets flattened key-by-key rather than `JSON.stringify`d wholesale, so
 * even this fallback never puts a literal `{`/`}` in front of a reader. */
function formatUnknown(key: string, value: unknown): string {
  if (typeof value === 'boolean') return value ? key : `not ${key}`;
  if (value === null || typeof value !== 'object') return `${key}: ${value}`;
  const entries = Object.entries(value as Record<string, unknown>)
    .map(([k, v]) => `${k} ${Array.isArray(v) ? v.join('/') : v}`)
    .join(', ');
  return `${key}: ${entries}`;
}

/** Extracted as a plain, dependency-free-of-Vue function (rather than kept
 * inline in the page component) so it gets real unit coverage — see
 * `factConditions.test.ts` — instead of relying on visual/manual QA to
 * catch a dropped or over-shown field. */
export function factConditions(fact: Fact): string {
  const bits: string[] = [];

  if (isSelfReferencing(fact)) {
    bits.push('self');
  } else if (fact.controller) {
    bits.push(controllerPhrase(fact.controller));
  }
  if (isEventFact(fact) && fact.recipient) bits.push(recipientPhrase(fact.recipient));

  if (isZoneFact(fact)) {
    const originPhrase = movementOriginPhrase(fact);
    if (originPhrase) bits.push(originPhrase);
  }

  if (fact.subject && fact.subject !== 'self') bits.push(`token: ${fact.subject.token}`);

  bits.push(...constraintPhrases(fact, isZoneFact(fact) ? (ZONE_NOUN[effectiveZone(fact) ?? ''] ?? 'permanents') : 'permanents'));

  if (isEventFact(fact) && fact.target && typeof fact.target === 'object') {
    bits.push(...constraintPhrases(fact.target, 'permanent'));
  }

  if (isEventFact(fact)) {
    // `counterType` (e.g. "+1/+1", "LORE", "stun") used to fold into the
    // `putCounter` label itself ("<counterType> counters"); overridden
    // 2026-09-10 to match every other qualifier on this fact — the label
    // is now bare "counters" in every case, so this renders here for
    // `putCounter` too, same as any other event that happens to carry one.
    if (fact.counterType) bits.push(`${fact.counterType} counters`);
    if (fact.colors) {
      const colorBits = typeBits(fact.colors);
      if (colorBits.length) bits.push(`${colorBits.join(' ')} mana`);
    } else if (fact.color) {
      bits.push(`${fact.color} mana`);
    }
    if (fact.tapped !== undefined) bits.push(fact.tapped ? 'tapped' : 'untapped');
    if (fact.oncePerTurn) bits.push('once per turn');
  }

  for (const [key, value] of Object.entries(fact as unknown as Record<string, unknown>)) {
    if (value === undefined || HANDLED_OR_LABEL_KEYS.has(key)) continue;
    bits.push(formatUnknown(key, value));
  }

  return bits.length ? bits.join(' · ') : '—';
}
