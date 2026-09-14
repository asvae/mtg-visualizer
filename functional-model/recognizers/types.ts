// Shared shapes for the `PRD_AUTOMATED_AUTHORING.md` recognizer-library
// prototype (2026-09-13) — see that PRD's "Design" section for the
// provenance rationale this mirrors. Deliberately its own small module, not
// folded into `synergy.ts`: a recognizer's OWN input/output contract is
// narrower than anything `synergy.ts` already exports, and keeping it
// separate means this whole prototype can be deleted/reworked later without
// touching the real matching engine at all.
import type { AnnotationRef, Fact, FactProvenance } from '../synergy';

/**
 * One real card FACE's worth of the only two things a recognizer is allowed
 * to look at: its own printed type line and its own printed oracle text body
 * (never live game state, never another face's text — see each recognizer's
 * own doc comment for why cross-face leakage is a real false-positive risk,
 * not a hypothetical one). `name` is carried through only so a recognizer can
 * check for the card's own name appearing as the grammatical subject of a
 * clause (Zack Fair's "Zack Fair enters with a +1/+1 counter on it," as
 * opposed to "This creature enters ...") — never used as a match target
 * itself.
 */
export interface RecognizerInput {
  name: string;
  typeLine: string;
  /** This face's own oracle text body. Empty string for a face with no
   * printed ability text at all (a vanilla creature) — never `undefined`,
   * so a recognizer never has to null-check before running a regex. */
  oracleText: string;
  /**
   * True when this face is `CardDefinition.backFace` (`card.ts`'s own doc
   * comment: "a transforming DFC's back face") — set by the caller
   * (`apply-recognizers.mjs`'s own `faces` array construction, mirrored by
   * `recognizers.test.ts`'s own `faceOf` helper) from its own already-tracked
   * `face: 'front' | 'back'`, never derived independently here.
   *
   * **Confirmed NOT a universal "this face is never independently cast"
   * signal** (2026-09-13, direct pool scan for the
   * `permanent-enters-battlefield-normally` overclaim bug below) — `card.ts`'s
   * doc comment notwithstanding, `backFace` is also reused, deliberately and
   * documented as such, for a handful of real Adventure-layout cards
   * (`thranduil-sindarin-liege-silvan-rally`'s own module doc comment: "the
   * REAL cast order/timing is reversed from a transform DFC"), whose own
   * back face (the Adventure spell) genuinely IS cast independently from
   * hand. Only safe to gate a recognizer on this flag when that recognizer
   * ALSO independently confirms the face is permanent-typed first (every
   * real Adventure back face in this pool is `Instant`/`Sorcery`, never a
   * permanent type, so the two checks never actually conflict today — but a
   * recognizer relying on `isBackFace` alone, with no type gate of its own,
   * would be wrong to assume it always means "entered via transform, never
   * cast"). See `permanent-enters-battlefield-normally.ts`'s own use of this
   * flag for the one recognizer that currently needs it.
   */
  isBackFace?: boolean;
}

/** Which finite catalog entry produced a fact — see `types.ts`'s own module
 * doc comment. Widen this union, never invent a differently-shaped
 * provenance object, when a third recognizer is added — the whole point is
 * one small enum a future "rule review" pass (PRD's own parked idea) can
 * enumerate exhaustively. */
export type RecognizerId =
  | 'instant-sorcery-resolves-to-graveyard'
  | 'permanent-enters-battlefield-normally'
  | 'destroy-effect-structural'
  | 'drawCard-effect-structural'
  | 'saga-lore-and-sacrifice-structural'
  | 'dies-trigger-structural'
  | 'lifegain-trigger-structural'
  | 'dealDamage-effect-structural'
  | 'putCounter-broadcast-structural'
  | 'attacks-trigger-structural'
  | 'putCounterTarget-effect-structural'
  | 'addMana-effect-structural';

/**
 * `FactProvenance` itself is now DEFINED on `Fact` (`synergy.ts`, wired in
 * 2026-09-13 by `scripts/apply-recognizers.mjs` — this prototype's own
 * "real pipeline" follow-up) rather than owned by this file — see that
 * interface's own doc comment for the full rationale (same "rides alongside
 * a Fact, never forks its vocabulary" precedent this file's own doc comment
 * used to describe here). Re-exported via the `import type` above so every
 * recognizer file keeps importing it from this one small module rather than
 * reaching into `synergy.ts` directly for what is, from a recognizer's own
 * point of view, plain provenance plumbing — same treatment `toLineOffset`
 * already gets below.
 */
export type { FactProvenance };

/** One fact a recognizer decided to claim, bundled with its provenance —
 * `role` kept alongside rather than folded into `fact` since both real
 * recognizers below only ever produce `'source'` facts (see each one's own
 * doc comment on why a sink-shaped claim never applies to this boilerplate),
 * but `Fact.role` itself is the on-disk-omitted field (`SynergyFile`'s own
 * `Omit<Fact, 'role'>` — role is implied by which array a fact sits in), so
 * a `RecognizedFact`'s own `fact` mirrors that same omission. */
export interface RecognizedFact {
  role: 'source' | 'sink';
  fact: Omit<Fact, 'role'>;
  provenance: FactProvenance;
}

/**
 * A recognizer's own verdict — `matched: false` always carries a real
 * `reason` (never a bare boolean) precisely so a future "rule review" pass,
 * or just a human staring at a declined card, can tell WHY without having to
 * re-run the regex by hand. Conservative by construction (see
 * `PRD_AUTOMATED_AUTHORING.md`'s Design section): every recognizer below
 * defaults to declining and only matches when it's positively sure, never
 * the reverse.
 *
 * **`kind` (2026-09-13, `apply-recognizers.mjs`'s own hard-fail-on-mismatch
 * pass)** — lets the CALLER, not just a human reading `reason`'s prose,
 * branch on WHY a decline happened. Two real, genuinely different reasons:
 *   - `'scope'` (the default, used whenever `kind` is omitted — every
 *     existing text-only recognizer (A/B) and every OTHER decline path in the
 *     structural recognizers (C/D/E) stays here, unchanged): no structural
 *     basis to even build a pattern at all — a non-literal `Computed<...>`
 *     field, an `owner`-restricted effect, a value with no confirmed
 *     template, a `custom`-effect wall, etc. Correct, silent, permanent — a
 *     recognizer that will never have anything to say about this card, not
 *     a bug.
 *   - `'mismatch'`: a pattern WAS successfully built from the card's own
 *     structured data, but checking it against that face's REAL oracle text
 *     found either zero matches or 2+ ambiguous matches. This means the
 *     recognizer's own model of "what this effect should read like in
 *     English" diverged from what the card actually prints — either a real
 *     recognizer bug, or a real, legitimate case where the structured
 *     `Effect` is a narrower/wider approximation of the card's real prose
 *     (see `destroy-effect-structural.ts`/`drawCard-effect-structural.ts`'s
 *     own module doc comments for real, confirmed examples of each). Only
 *     the specific "built a pattern, `oracleText.matchAll` found 0 or 2+
 *     matches" decline paths in those two recognizers return this — nothing
 *     else does. `apply-recognizers.mjs` hard-fails the whole run on any
 *     unresolved `'mismatch'` (see that script's own header), unless a
 *     per-card `// recognizer-exception: <rule>` marker in the card's own
 *     `definition.ts` explicitly suppresses that specific card+rule pair.
 */
export type RecognizerResult =
  | { matched: true; facts: RecognizedFact[] }
  | { matched: false; reason: string; kind?: 'scope' | 'mismatch' };

/** Builds one line-relative `AnnotationRef` from an absolute `[start, end)`
 * character offset into a face's own oracle text — thin re-export of
 * `synergy.ts`'s own `toLineOffset` (see that function's own doc comment for
 * why it's exported specifically for this prototype) so every recognizer
 * imports it from one place instead of reaching into `synergy.ts` directly
 * for what is, from a recognizer's point of view, plain annotation
 * plumbing. */
export { toLineOffset } from '../synergy';
