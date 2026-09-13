// Recognizer A (`PRD_AUTOMATED_AUTHORING.md` prototype, 2026-09-13): "an
// instant or sorcery whose text implies it resolves and goes to its owner's
// graveyard in the normal way (CR 608.2m/`SBA` housekeeping — a resolved
// instant/sorcery with no other instruction is put into its owner's
// graveyard), no exile/return-to-hand/etc. override clause on the card."
//
// Produces the exact two-fact shape already established, by hand, across
// EVERY migrated instant/sorcery in the real pool (verified directly, not
// assumed — `battle-menu`, `ahriman`-style siblings for the permanent
// recognizer, and here specifically `auron-s-inspiration`, `dreams-of-
// laguna`, `syncopate`, `moogles-valor`, `slash-of-light`, `ice-magic`,
// `eject`, `restoration-magic`, `swallowed-by-leviathan`, `you-re-not-alone`,
// `magic-damper`, `stolen-uniform`, `combat-tutorial`, `relm-s-sketching`,
// `memories-returning`, `the-crystal-s-chosen`, `travel-the-overworld`,
// `retrieve-the-esper`, `from-father-to-son` all carry this exact pair):
//   - `{ event: 'cast', from: 'Hand', target: 'self', value: 1 }`
//   - `{ to: 'Graveyard', controller: 'you', subject: 'self', value: 1 }`
// (no `event` key on the graveyard fact — matches `battle-menu`'s own real
// shape; the movement is fully described by `to` alone, same as any other
// zone-presence fact). `value: 1` on both, not the `-1` "pending
// compute-weights.mjs" placeholder some hand-authored instances still carry
// — a recognizer can pick the real number directly: `scripts/
// compute-weights.mjs`'s own `sourceMagnitude` gives a bare zone fact with
// no token subject a flat magnitude of 1 regardless of card, so there is no
// real trace-dependent number here to defer; baking `1` in up front instead
// of a `-1` sentinel is a real, if small, improvement a recognizer can offer
// for free (no separate compute-weights pass needed just to resolve these
// two facts specifically).
//
// **False-positive risk this recognizer actually hit while being built**
// (see this prototype's own writeup, not just this comment): a first-draft
// deny-list declined ANY card whose oracle text mentioned "exile" or
// "flashback" ANYWHERE — which would have wrongly declined every real
// Flashback/"cast from a graveyard" card in the pool (`auron-s-inspiration`,
// `dreams-of-laguna`, `retrieve-the-esper`, `from-father-to-son`, ...) even
// though their OWN normal cast-from-hand resolution still goes to the
// graveyard exactly like any other instant/sorcery — the exile-ish language
// only ever describes an ALTERNATE cast mode or a bonus conditional on
// having been cast that way, never an override of the normal case. Checked
// against the real pool's own existing hand-authored facts (every one of
// those cards DOES carry the plain self-graveyard fact) before narrowing the
// deny-list to genuinely self-referential override language instead of a
// blind keyword scan. `syncopate` is the sharper version of the same trap:
// "exile it instead of putting it into its owner's graveyard" refers to the
// COUNTERED SPELL ("that spell"), not Syncopate itself — a blind "exile"
// scan would have declined it for the wrong reason entirely; requiring the
// override to name "this card"/"this spell" (or the card's own name)
// specifically avoids that particular false negative, though pronoun-
// antecedent resolution in general ("it" referring back to THIS card
// specifically, in some hypothetical future wording) is a real, acknowledged
// blind spot this narrow textual match cannot resolve — a known limitation
// for a future "rule review" pass to sharpen if a real card ever needs it,
// not something worth over-engineering into a regex now.
import type { RecognizedFact, RecognizerInput, RecognizerResult } from './types';
import { typeWordsSpan } from './type-line-span';

const RULE = 'instant-sorcery-resolves-to-graveyard' as const;

/** CR 715.3d — an Adventure instant/sorcery is exiled instead of going to
 * its owner's graveyard when it resolves (so its permanent half can be cast
 * later from exile). A pure typeLine/subtype check, not a text pattern —
 * every real Adventure instant/sorcery in the pool (`Faith & Grief`,
 * `Overture`, `Mage Siege`, `Reactor Raid`, `Lasting Fayth` — all five real
 * FIN Town//Adventure cards) prints "Adventure" as a literal subtype after
 * the em dash, so this is a zero-false-positive-risk structural exclusion,
 * confirmed the real corpus's own hand-authored facts never assert a
 * self-graveyard fact for any of these five back faces. */
function isAdventure(typeLine: string): boolean {
  return typeLine.split('—')[1]?.includes('Adventure') ?? false;
}

/** Genuinely self-referential override language — see this file's own
 * module doc comment for why a blind "exile"/"flashback" keyword scan is
 * the wrong shape here. Only `ultima` in the real sample this recognizer
 * was checked against actually trips this ("End the turn. (Exile all spells
 * and abilities from the stack, including this card...)") — a real,
 * genuinely self-referential override (CR 500.7's "end the turn" rules
 * effect really does exile the card that caused it), even though the
 * existing hand-authored `ultima/synergy.json` currently still asserts the
 * plain self-graveyard fact anyway (see this prototype's own writeup: a
 * likely-latent gap in that specific hand-authored card, not something this
 * recognizer should replicate). */
const SELF_OVERRIDE_RE = /\b(?:including|exile|shuffle) this (?:card|spell)\b/i;

export function recognizeInstantSorceryResolvesToGraveyard(input: RecognizerInput): RecognizerResult {
  const primaryType = input.typeLine.split('—')[0]!.trim();
  if (!/^(Instant|Sorcery)\b/.test(primaryType)) {
    return { matched: false, reason: `typeLine "${input.typeLine}" is not an Instant/Sorcery` };
  }
  if (isAdventure(input.typeLine)) {
    return { matched: false, reason: 'Adventure instant/sorcery — CR 715.3d exiles it instead of the graveyard on resolution' };
  }
  if (SELF_OVERRIDE_RE.test(input.oracleText)) {
    return { matched: false, reason: 'oracle text names a self-referential exile/shuffle override' };
  }

  const span = typeWordsSpan(input.typeLine);
  if (!span) return { matched: false, reason: `could not locate a real type word in typeLine "${input.typeLine}"` };
  const annotations = [{ target: 'typeLine' as const, start: span.start, end: span.end }] as const;

  const facts: RecognizedFact[] = [
    {
      role: 'source',
      fact: { event: 'cast', from: 'Hand', target: 'self', value: 1, annotations: [...annotations] },
      provenance: { origin: 'parser', rule: RULE },
    },
    {
      role: 'source',
      fact: { to: 'Graveyard', controller: 'you', subject: 'self', value: 1, annotations: [...annotations] },
      provenance: { origin: 'parser', rule: RULE },
    },
  ];
  return { matched: true, facts };
}
