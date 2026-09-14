// Recognizer B (`PRD_AUTOMATED_AUTHORING.md` prototype, 2026-09-13): "a
// permanent (creature/artifact/enchantment/etc.) that enters the
// battlefield when cast in the normal way (no 'enters tapped,' no
// replacement-effect clause, no 'you may' conditionality)."
//
// Produces the exact two-fact shape already established, by hand, across
// dozens of migrated permanents in the real pool (verified directly —
// `ahriman`, `dwarven-castle-guard`, `cloudbound-moogle`, `ice-flan`,
// `adelbert-steiner`, `astrologian-s-planisphere`, `cargo-ship`, `summon-
// bahamut`):
//   - `{ event: 'cast', from: 'Hand', target: 'self' }`
//   - `{ event: 'entersBattlefield', to: 'Battlefield', controller: 'you',
//      subject: 'self', target: 'self' }`
// `value: 1` chosen directly (not the `-1` placeholder), same rationale as
// the instant/sorcery recognizer's own doc comment — `compute-weights.mjs`'s
// `sourceMagnitude` gives a bare zone fact with no token subject a flat
// magnitude of 1 regardless of card, so there's nothing trace-dependent to
// defer here either.
//
// **A plain "When/Whenever this creature enters, <effect>" triggered
// ability does NOT disqualify** — confirmed against the real pool:
// `cloudbound-moogle` ("When this creature enters, put a +1/+1 counter on
// target creature") and `ice-flan` ("When this creature enters, tap target
// artifact...") both still carry the full self-cast/self-enters pair
// alongside their own separate trigger-effect fact. The permanent still
// entered the battlefield completely normally; the ETB TRIGGER is a
// downstream consequence, not a modification of the entering event itself.
// This recognizer only ever declines for language describing the entering
// ITSELF as abnormal (tapped, with counters, as a copy, face down) — never
// for the mere presence of an ETB-triggered ability.
//
// **Real false-positive risk this recognizer actually hit while being
// built**: an early draft's deny regex used an unanchored `enters.*with` /
// `enters.*counter` (`.*` spanning arbitrary text), which wrongly declined
// EVERY Saga in the pool — a Saga's own reminder text ("As this Saga enters
// and after your draw step, add a lore counter...") contains both "enters"
// and "counter" in the same sentence, but they're unrelated clauses (CR
// 714.2c: despite the "As ~ enters" wording, a Saga's chapter ability is
// itself a TRIGGERED ability, not a replacement effect modifying how the
// permanent enters — the permanent enters completely normally; the lore
// counter is placed by a trigger that happens to fire ON that entry, same
// rules shape as any other ETB trigger). Confirmed directly against real
// hand-authored data: `summon-bahamut` (a Saga) DOES carry the plain
// self-cast/self-enters pair. Tightening the deny patterns to require
// "enters" IMMEDIATELY followed by "tapped"/"with"/etc. (no unbounded `.*`)
// fixed this without needing any Saga-specific carve-out — the regex was
// simply wrong, not the model.
//
// **A genuine, deliberate divergence from one existing hand-authored
// card**: `zack-fair` ("Zack Fair enters with a +1/+1 counter on it") IS
// currently hand-authored WITH the self-cast/self-enters pair in the real
// pool — but "enters with a counter" is CR 614.12's textbook replacement
// effect, which the task's own given definition explicitly excludes ("no
// replacement-effect clause"). This recognizer declines Zack Fair on
// purpose, per the letter of that instruction, even though it disagrees with
// today's existing agent judgment call for this one card. That's fine under
// the overlay model: a recognizer declining to add a fact never removes or
// contradicts an already-authored one — it just contributes nothing new
// there. Worth a human eyeballing whether Zack Fair's own hand-authored
// choice or this recognizer's stricter reading is the one to keep, but
// that's exactly the "separate rule-review lane" review this whole
// prototype is meant to feed, not something to silently resolve here.
//
// **Genuinely confirmed declines, matching today's existing hand-authored
// data exactly**: `shambling-cie-th` ("This creature enters tapped.") and
// `tonberry` ("This creature enters tapped with a stun counter on it.") both
// have an EMPTY/absent self-cast+self-enters pair in their real, current
// `synergy.json` — the existing agent(s) who authored these cards already
// made the same call this recognizer makes mechanically.
//
// **Scope correctness — self vs. other**: `torgal-a-fine-hound`'s own text
// ("Whenever you cast your first Human creature spell each turn, THAT
// creature enters with an additional +1/+1 counter...") is about a
// DIFFERENT creature's entrance, not Torgal's own — Torgal itself enters
// completely normally. Requiring the deny pattern's subject to be "this
// <type>" or the card's OWN name (never a bare "that creature"/"it") is what
// keeps this recognizer from wrongly declining Torgal.
//
// **Real overclaim bug, fixed 2026-09-13 — a transforming DFC's own BACK
// face never gets independently cast from hand or independently enters the
// battlefield (CR 712/711): it only exists via `transformPermanent`-ing an
// already-on-battlefield permanent (`saga.ts`'s own `transformPermanent` doc
// comment already respects this — "a caller must call it explicitly right
// after running the transform's own activated ability", never a fresh
// cast/enters pair). This recognizer previously had no way to tell it was
// looking at a back face at all (`RecognizerInput` carried only
// `typeLine`/`oracleText`), so it fired identically on both faces of every
// real transform DFC in the pool — confirmed a direct, exact-shape bug hit
// on 26 real cards (every FIN `layout:'transform'` card whose back face is
// itself permanent-typed — e.g. `jill-shiva-s-dominant-shiva-warden-of-ice`,
// `cecil-dark-knight-cecil-redeemed-paladin`), each with a spurious
// self-cast/self-enters fact pair asserted for a face that is never cast or
// entered on its own. Fixed by declining outright whenever the caller marks
// `input.isBackFace` — see that field's own doc comment (`types.ts`) for why
// this is safe (this recognizer's own `isPermanent` type gate already
// excludes every real non-transform use of `backFace` in the pool, so this
// flag never wrongly excludes a genuinely-independently-cast back face
// today), and why it's still a `kind:'scope'` decline (the default), not a
// `'mismatch'` — there's no pattern-vs-prose divergence here, just a face
// this recognizer's whole premise ("cast normally from hand") never applies
// to in the first place.
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { typeWordsSpan } from './type-line-span';

const RULE = 'permanent-enters-battlefield-normally' as const;

const PERMANENT_TYPE_WORDS = ['Creature', 'Artifact', 'Enchantment', 'Planeswalker', 'Battle'];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Self-referential subjects a real card uses for its OWN entrance: "this
 * <permanent type>" (the overwhelmingly common real phrasing) or the card's
 * own printed name (`zack-fair`'s own real shape — it names itself instead
 * of using "this creature"). Deliberately does NOT include bare pronouns
 * ("it", "that creature") — see this file's own module doc comment,
 * `torgal-a-fine-hound`'s "that creature" is exactly the case this excludes
 * on purpose. */
function selfSubjectAlternation(name: string): string {
  const typeAlt = PERMANENT_TYPE_WORDS.map((w) => `this ${w.toLowerCase()}`).join('|');
  return `(?:${typeAlt}|this permanent|${escapeRegExp(name)})`;
}

/** The entering-itself replacement-effect tail — "tapped", "with" (a
 * counter, most commonly, but any "enters with ..." qualifies per CR
 * 614.12), "as a copy", "face down". Anchored immediately after "enters"
 * (optionally "the battlefield" in between) — no unbounded `.*` — see this
 * file's own module doc comment for the real Saga false-positive this
 * fixes. */
function overrideRegex(name: string): RegExp {
  const subject = selfSubjectAlternation(name);
  return new RegExp(`\\b${subject} enters(?: the battlefield)? (tapped|with|as a copy|face[- ]down)\\b`, 'i');
}

/** "You may have this creature enter the battlefield tapped" — real,
 * well-known Forge/CR templating (a modal ETB choice), but NOT exercised by
 * any real card in the FIN sample this recognizer was checked against; kept
 * for real-vocabulary completeness, flagged here as untested against actual
 * data rather than silently assumed correct. */
const YOU_MAY_CONDITIONAL_RE = /\byou may have (?:this creature|it) enter the battlefield tapped\b/i;

export function recognizePermanentEntersBattlefieldNormally(input: RecognizerInput): RecognizerResult {
  if (input.isBackFace) {
    return {
      matched: false,
      reason: "this is a transforming DFC's own back face (CR 712/711) — it never gets independently cast from hand or independently enters the battlefield, only ever entering via an already-on-battlefield front face transforming into it",
    };
  }
  const primaryTypes = input.typeLine.split('—')[0]!.trim();
  const isPermanent = PERMANENT_TYPE_WORDS.some((w) => primaryTypes.includes(w));
  if (!isPermanent) {
    return { matched: false, reason: `typeLine "${input.typeLine}" has no recognized permanent type (or is Land-only, which is played, not cast)` };
  }
  if (overrideRegex(input.name).test(input.oracleText)) {
    return { matched: false, reason: 'oracle text describes a real replacement effect on its own entrance (tapped / with a counter / as a copy / face down)' };
  }
  if (YOU_MAY_CONDITIONAL_RE.test(input.oracleText)) {
    return { matched: false, reason: 'oracle text makes entering tapped a "you may" choice' };
  }

  const span = typeWordsSpan(input.typeLine);
  if (!span) return { matched: false, reason: `could not locate a real type word in typeLine "${input.typeLine}"` };
  const annotations = [{ target: 'typeLine' as const, start: span.start, end: span.end }] as const;

  const facts: RecognizedFact[] = [
    {
      role: 'source',
      fact: { event: 'cast', from: 'Hand', target: 'self', annotations: [...annotations] },
      provenance: { origin: 'parser', rule: RULE },
    },
    {
      role: 'source',
      fact: {
        event: 'entersBattlefield',
        to: 'Battlefield',
        controller: 'you',
        subject: 'self',
        target: 'self',
        annotations: [...annotations],
      },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];
  return { matched: true, facts };
}
