import { isZoneFact } from '../../functional-model/synergy';
import type { Fact, TypeConstraint } from '../../functional-model/synergy';

// Raw constraint/detail fields off a `Fact`, verbatim — for the Facts tab
// table's rightmost column (app/pages/app/card/[set]/[number].vue).
//
// This used to be a hand-maintained ALLOWLIST (`CONDITION_KEYS`) naming
// every field worth showing — it silently dropped `subject` the moment the
// schema grew a fact carrying one (the-gold-saucer's Treasure
// `entersBattlefield`/battlefield-presence facts, `subject:
// {token:"c_a_treasure_sac"}`). A first pass inverted this to a blanket
// exclusion of `{value, role, sourceText}` — too BLUNT the other
// direction: `describeFact` (functional-model/synergy.ts) already folds
// several OTHER fields into its own label text on MOST branches — e.g.
// `{"zone":"Battlefield","controller":"you","types":{"has":["Artifact"]}}`
// renders as "artifact permanents you control on the battlefield," which
// already fully encodes `zone`/`controller`/`types`; showing that same
// JSON verbatim here is pure noise, not new information.
//
// The real rule: hide a field only when THIS fact's own `describeFact`
// branch actually folds it into the label — genuinely branch-dependent,
// verified against the live function (not assumed), and cross-checked
// against every real fact currently on disk (`functional-model/cards/*/
// synergy.json`) before landing:
//
//  - `zone` is always folded (every zone-fact branch renders "...on the
//    battlefield" / "in your <zone>"). Always hidden.
//  - `controller` is always folded for a zone fact (`describeSide`, or an
//    explicit "you control"/"an opponent controls" either way) and for
//    event facts whose branch is `lifegain`/`addMana`/`dies` (`describeSide`
//    again, or — `dies` with `target: 'self'` — omitted from the label
//    entirely, but that's always the plain 'you' case in practice: no real
//    fact on disk pairs `target:'self'` with `controller:'opp'`). EVERY
//    OTHER named branch (`putCounter`, `drawCard(s)`, `entersBattlefield`,
//    `playLand`, `activateAbility`, `coinFlip`) never reads `controller` at
//    all — confirmed via 3 real corpus facts (ice-flan,
//    omega-heartless-evolution, ultros-obnoxious-octopus) that put counters
//    on an OPPONENT's creature (`controller:'opp'`) with no other way to
//    see that once `controller` got blanket-hidden. For those branches,
//    `controller:'you'` (the same unstated-by-convention default
//    `describeFact`'s own doc comment establishes) is still treated as
//    trivial and hidden, but `controller:'opp'` — real, otherwise-invisible
//    information — stays visible.
//  - `types.has`/`types.hasAny` and `cmc` (as a whole) are folded on a zone
//    fact, or an EVENT fact whose `event` string ISN'T one of
//    `describeFact`'s named branches (i.e. it falls through to the generic
//    `` `${qualifier}${event}` `` case) — but NOT on a named branch's own
//    hand-written phrase (confirmed via 2 real corpus facts, loporrit-scout
//    and woodland-weavemaster, both `entersBattlefield` with a real
//    `types.has` filter that "enters the battlefield" never states).
//    `types.not` is never folded anywhere, regardless of branch — kept
//    visible always.
//  - `counterType` is folded only on `putCounter` ("<counterType> counters").
//  - `event` itself is always hidden — either paraphrased into a
//    hand-written phrase, or (the generic fallback) shown verbatim in the
//    label either way, so the raw key is redundant regardless of branch.
//  - `subject: 'self'` is trivial/tautological (every self-referencing fact
//    has it) and hidden; any OTHER `subject` value (e.g. `{token:
//    "c_a_treasure_sac"}`) is real information, never folded into any
//    label at all, and always shown.
//
// KNOWN DUPLICATION RISK, accepted deliberately: this necessarily mirrors
// (a small, explicit slice of) `describeFact`'s own branch dispatch — kept
// as explicit, commented lists below, not inferred. If `describeFact`
// gains a new named branch without a matching update here, the ONLY
// failure mode is this column showing a field a HAIR too generously (that
// event falls through to the "not a named branch" treatment) — never the
// reverse (silently hiding real information forever, the original
// `CONDITION_KEYS` bug). A cleaner long-term fix would have `describeFact`
// itself return which fields it consumed alongside the label, so this
// never has to be mirrored by hand at all — flagged, not implemented here
// (an engine-schema/API change, out of this page's own lane).
const ALWAYS_HIDDEN = new Set([
  'value', // shown via the row's own `ValueBar` column
  'role', // shown via the row's own source/sink icon
  'sourceText', // shown as the row's own `title` tooltip
  'id', // bookkeeping key, not meaningful to a reader
  'highlight', // repeats a substring of `sourceText`, already in the tooltip
]);

/** Event names whose `describeFact` branch renders a hand-written phrase
 * that reads NOTHING off `types`/`cmc` (unlike the generic fallback, which
 * folds both in via its shared `qualifier`). Mirrors the literal `if (event
 * === '...')` list in `describeFact` — keep in sync by hand. */
const EVENTS_WITH_HAND_WRITTEN_LABEL = new Set([
  'lifegain',
  'dies',
  'putCounter',
  'drawCard',
  'drawCards',
  'entersBattlefield',
  'playLand',
  'activateAbility',
  'addMana',
  'coinFlip',
]);

/** Event names whose hand-written branch folds `fact.controller` into the
 * label regardless of its value ('you' or 'opp' both get spelled out, via
 * `describeSide` or an explicit you/opp check). Every OTHER named branch
 * never mentions `controller` at all — for those, only the trivial 'you'
 * default gets hidden below (see `factConditions` itself). */
const EVENTS_ALWAYS_CONSUMING_CONTROLLER = new Set(['lifegain', 'addMana', 'dies']);

/** `constraintBits` (functional-model/synergy.ts) only ever folds
 * `types.has`/`types.hasAny` into a label — `types.not` is never rendered
 * anywhere, so it's real information this column should keep surfacing. */
function typesRemainder(types: TypeConstraint | undefined): TypeConstraint | undefined {
  if (!types?.not) return undefined;
  return { not: types.not };
}

/** Extracted as a plain, dependency-free-of-Vue function (rather than kept
 * inline in the page component) so it gets real unit coverage — see
 * `factConditions.test.ts` — instead of relying on visual/manual QA to
 * catch a dropped or over-shown field. */
export function factConditions(fact: Fact): string {
  const event = 'event' in fact ? fact.event : undefined;
  const isNamedEventBranch = event !== undefined && EVENTS_WITH_HAND_WRITTEN_LABEL.has(event);
  // Whether THIS fact's label folds in `cmc` and `types.has`/`.hasAny` at
  // all — true for every zone fact, and for an event fact whose `event`
  // isn't one of `describeFact`'s named branches (i.e. it falls through to
  // the generic `${qualifier}${event}` case).
  const constraintsFolded = isZoneFact(fact) || !isNamedEventBranch;

  const obj: Record<string, unknown> = {};
  for (const [key, rawValue] of Object.entries(fact as unknown as Record<string, unknown>)) {
    if (rawValue === undefined || ALWAYS_HIDDEN.has(key)) continue;

    if (key === 'event') continue; // always paraphrased (or, on the fallback branch, shown verbatim) in the label itself either way
    if (key === 'zone') continue; // every zone-fact branch always folds this in ("...on the battlefield" / "in your <zone>")
    if (key === 'subject' && rawValue === 'self') continue; // trivial/tautological — every self-referencing fact has it

    if (key === 'controller') {
      if (isZoneFact(fact)) continue; // always folded (describeSide, or an explicit "you control"/"an opponent controls")
      if (event !== undefined && EVENTS_ALWAYS_CONSUMING_CONTROLLER.has(event)) continue;
      if (rawValue === 'you') continue; // the unstated default `describeFact`'s own doc comment establishes, even on a branch that never literally reads this field
      // `controller: 'opp'` on a branch that never mentions it at all
      // (putCounter, drawCard(s), entersBattlefield, playLand,
      // activateAbility, coinFlip) is real, otherwise-invisible
      // information — stays visible.
    }

    if (key === 'types') {
      if (constraintsFolded) {
        const remainder = typesRemainder(rawValue as TypeConstraint);
        if (remainder) obj.types = remainder;
        continue;
      }
      // a named branch's own hand-written label never reads `types` at all — show it verbatim (falls through below)
    }

    if (key === 'cmc' && constraintsFolded) continue; // whole object always folded in as one "mana value X-Y" bit whenever present

    if (key === 'counterType' && event === 'putCounter') continue; // "<counterType> counters"

    obj[key] = rawValue;
  }
  return Object.keys(obj).length ? JSON.stringify(obj) : '—';
}
