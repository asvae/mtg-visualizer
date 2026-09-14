// Fact-parity checker (`functional-model/PRD_AUTOMATED_AUTHORING.md`) —
// verifies every real, distinct card behavior this session's
// `cards/<slug>/definition-annotations.json` pass already confirmed (one
// entry per real container with genuinely distinct printed text: `triggers
// []`, `abilities[]`, top-level `effects`, `ptFormula`, modal `modes[]`,
// each optionally `backFace.`-prefixed for a DFC's second face) ends up
// represented by SOME real `Fact` — recognizer-derived (`synergy.json`
// fact with `provenance`) or explicitly agent-authored (a `synergy.json`
// fact with no `provenance`, OR a tier-3 `authoredFact`/`authoredFacts`
// entry in `definition.ts`, per PRD_AUTOMATED_AUTHORING.md's "3-tier
// waterfall"/"Tier-3 elimination" sections) — never silently missing.
// Read-only: never writes to any `synergy.json`/`definition.ts`.
//
// Usage: npx vite-node functional-model/scripts/check-fact-parity.mjs
//
// --- Two granularities, container-level AND per-effect (2026-09-14 refinement) ---
//
// A CONTAINER (a `triggers[i]`/`abilities[i]`/top-level `effects`/modal
// `modes[j]`) can hold MORE THAN ONE real `Effect` object — a container-only
// check ("does >=1 fact overlap this container's span at all") would
// silently report a container "covered" even when only 1 of its, say, 3
// real effects has a corresponding fact and the other 2 have none — exactly
// the kind of gap this whole task exists to catch, at too coarse a
// granularity to catch it. So this script checks BOTH:
//   - Container-level (original design): does >=1 fact overlap this
//     container's own resolved span, of ANY kind? Kept for continuity/
//     comparison — this is what a card-level "is this ability represented
//     at all" summary would show.
//   - Per-EFFECT (this refinement): walks each container down to its own
//     real `Effect` objects (`triggers[i].effects`/`abilities[i].effects`/
//     top-level `effects`/a modal mode's own `effects` — ONE level, NOT
//     recursing into a nested `modal`'s own modes again, since those are
//     already separately enumerated as their own `effects[i].modes[j]`
//     containers — a `kind:'modal'` entry itself is a pure dispatch
//     wrapper with no independent behavior of its own, excluded from the
//     leaf list here on purpose, not silently double-counted). For EACH
//     leaf effect, checks whether a fact of the RIGHT KIND (not just any
//     fact) overlaps the container's span — see "Effect-kind
//     classification" below for exactly how much precision this can
//     support given the data actually available.
//
// --- Correspondence method (why this, and its known limits) ---
//
// `definition-annotations.json`'s own `{highlight, line}` entries resolve to
// a real `AnnotationRef` via the SAME `computeFactAnnotations` (synergy.ts)
// the production annotation pipeline (`compute-annotations.mjs`) already
// uses — no independent re-derivation of the matching logic. A container (or
// a leaf effect within it) is "covered" when some real fact (in
// `synergy.json`, or — fallback — a tier-3 `authoredFact`/`authoredFacts`
// entry in `definition.ts`) has an `annotations` entry that OVERLAPS the
// container's own resolved span on the same face + target-kind (+ line, for
// an 'oracle' target). Overlap, not exact equality: verified against real
// data first (summon-bahamut) — a container's own span is usually the WHOLE
// printed line/clause (`triggers[0]`/`[1]` resolve to
// oracle:line1:[0,51)), while an individual fact typically anchors a
// narrower sub-phrase nested inside it (its own `destroy` fact anchors
// oracle:line1:[8,50), fully contained within the container's span) — exact-
// equality matching would have produced false "gap" verdicts on every one of
// these real, correctly-covered containers.
//
// Enumeration source for CONTAINERS is deliberately `definition-
// annotations.json`'s OWN keys — filtered to the 5 base container shapes
// named in PRD_AUTOMATED_AUTHORING.md (`triggers[i]`/`abilities[i]`/
// `effects`/`ptFormula`/`effects[i].modes[i]`, each optionally
// `backFace.`-prefixed), plus one real 6th shape this pool's own annotation
// pass actually produced that ISN'T in that literal list —
// `triggerDoubling[i]` (cloud-midgar-mercenary's own granted continuous
// ability, real printed text) — counted like the other 5, flagged
// separately in the report rather than silently folded in. Tier-3 SUB-
// entries (`authoredFacts[i]`, any nested `*.authoredFact[i]`) are EXCLUDED
// from the containers-to-check list (a tier-3 entry's own annotation is a
// NARROWER phrase nested INSIDE an already-enumerated container's own span,
// not a separate printed behavior of its own) — collected instead as
// fallback coverage evidence, at whichever granularity (container or exact
// leaf effect) actually owns them.
//
// --- Effect-kind classification (how precise the PER-EFFECT check really is) ---
//
// `card.ts`'s `Effect.kind` union has 32 real values; `Fact.event` is a
// free-form string, not a closed union, so there is no single authoritative
// kind->event table anywhere in this codebase to import. This script builds
// one EMPIRICALLY, from the only real ground truth available — the existing
// structural recognizers already shipped in `functional-model/recognizers/`
// (each one's own `event:` literal, read directly from its source) plus
// PRD_AUTOMATED_AUTHORING.md's own documented "3-tier waterfall" additions
// (`addMana`, `pump`) — and is honest, in the report, about which kinds it
// could NOT confirm a mapping for:
//   - KNOWN (checked against a real recognizer or PRD-documented mapping):
//     destroy->{destroy,dies}, drawCard->{drawCard},
//     dealDamage/dealDamageTarget/dealDamageAnyTarget->{damage}
//     (dealDamageTarget's own mapping independently re-confirmed against
//     slash-of-light's real synergy.json, not assumed from dealDamage
//     alone), putCounter/putCounterAll/putCounterTarget->{putCounter},
//     sacrifice->{sacrifice,dies}, gainLife->{lifegain},
//     pumpAll/pumpSelf/pumpTarget->{pump}, addMana->{addMana}. A leaf effect
//     of one of these kinds is only counted "covered" by a fact whose own
//     `event` is actually in that kind's expected set — a same-container
//     fact of some OTHER unrelated event no longer counts as covering it
//     (this is the concrete fix for the "3 effects, 1 fact, falsely reported
//     covered" failure mode).
//   - ZONE-SHAPED (`move`, `createToken`): these effects' real consequence
//     is inherently a `to`/`from` zone movement, not a bare named `event` —
//     covered by any fact that is itself zone-shaped (`to`/`from`/`zone`
//     present) overlapping the span. Weaker than the KNOWN bucket (doesn't
//     verify the SPECIFIC zone matches this effect's own `to`/`from`), but
//     still kind-discriminating, not "any fact of any shape."
//   - UNCLASSIFIED (`grantKeywordAll`/`grantKeywordSelf`/`grantKeywordTarget`,
//     `tapAll`/`tapTarget`, `untapTarget`, `discard`, `mill`, `surveil`,
//     `dig`, `fightTarget`, `counter`, `animate`, `playFromLibraryTop`,
//     `loseLife`, `custom`): no confirmed real event/zone mapping exists in
//     this codebase to check against. These fall back to the ORIGINAL,
//     weaker "any fact at all overlaps the container's span" check — counted
//     and reported SEPARATELY as "approximate" so a genuine per-kind
//     verdict is never confused with an honest "can't tell" one. `custom` is
//     additionally opaque BY DESIGN (an arbitrary closure, `card.ts`'s own
//     documented wall) — for a `custom` leaf specifically, an exact tier-3
//     `authoredFact` sitting on THAT SPECIFIC effect (matched by an EXACT
//     path prefix, not the coarser container-level fallback) is checked
//     FIRST, since that's the only mechanism in this codebase that can ever
//     attribute a fact to one particular opaque closure among several on the
//     same card.
//
// --- KNOWN, DOCUMENTED LIMITATION of this method, not silently absorbed ---
//
// A card with NO `definition-annotations.json` file at all is reported as
// "0 containers, nothing to cover" — per this task's own explicit
// instruction, matching the established pure-keyword-card precedent (e.g.
// adelbert-steiner-shaped cards with only `keywords`/`staticAbilities` text,
// no `triggers`/`abilities`/`effects`/`ptFormula` at all). But this bucket is
// NOT reliably "genuinely nothing to annotate" for every such card: 3 real
// fin/1-100 cards (`eject`, `circle-of-power`, `cornered-by-black-mages`)
// have a completely missing file DESPITE having real, structurally present
// `effects` containers, per this session's own "definition-annotations.json
// scaled fin/1-100" pass (see `.claude/agent-memory/engine/notes.md`) —
// declined at authoring time because their own real oracle text spreads more
// than one distinct `Effect` across DIFFERENT physical lines with no
// `modal`/`modes[]` substructure to split by, which `computeFactAnnotations`
// /`AnnotationRef`'s single-line span model can't represent. This script
// independently re-confirms (via a minimal, SEPARATE structural presence
// check — `hasAnyBaseContainer`, used ONLY to classify a NO-FILE card, never
// to re-derive container-level enumeration for a card that DOES have a
// file) that these 3 (and, checked, only these 3) are the real "declined,
// not genuinely empty" cases among every no-file card in fin/1-100 —
// reported under a separate ANNOTATION-COVERAGE-GAP heading, not folded into
// either "nothing to cover" or a genuine fact-parity gap. This is a real,
// small, pre-existing blind spot INHERITED from the upstream annotation-
// authoring pass, not a new gap this checker invents, and not something this
// checker can resolve on its own (it would need those 3 containers to have a
// real resolvable single-line span in the first place — and, per the SAME
// reasoning this refinement pass surfaced, `eject`'s own 2 real effects
// — `move` then `drawCard` — are exactly the "multiple distinct effects, one
// shared line" shape this whole refinement is about, so even a resolvable
// span for it would still need the per-effect check, not just a per-
// container one, to confirm both its real effects are covered).
//
// Also: within the per-effect check, MULTIPLICITY beyond kind-presence is
// NOT verified — two leaf effects of the SAME kind in one container (rare;
// none confirmed in fin/1-100) would both be marked "covered" by a single
// matching fact of that kind, since no finer-than-kind text anchor exists to
// tell them apart. Flagged here rather than silently assumed correct.

import { readdir, readFile } from 'node:fs/promises';
import { computeFactAnnotations } from '../synergy.ts';

const cardsDir = new URL('../cards/', import.meta.url);
const FIN_SCRYFALL = new URL('../../data/fin/fin_scryfall.json', import.meta.url);

// The 5 base container shapes PRD_AUTOMATED_AUTHORING.md names, plus the
// real 6th (`triggerDoubling[i]`) this pool's own annotation pass produced —
// each optionally `backFace.`-prefixed for a DFC's second face.
const BASE_CONTAINER_RE = /^(backFace\.)?(triggers\[\d+\]|abilities\[\d+\]|effects|effects\[\d+\]\.modes\[\d+\]|ptFormula|triggerDoubling\[\d+\])$/;

// Effect-kind -> expected real `Fact.event` value(s) — see this file's own
// "Effect-kind classification" header comment for how each entry was
// confirmed (a real recognizer's own `event:` literal, or a PRD-documented
// mapping), not guessed.
const KNOWN_EVENT_FOR_KIND = {
  destroy: ['destroy', 'dies'],
  drawCard: ['drawCard'],
  dealDamage: ['damage'],
  dealDamageTarget: ['damage'],
  dealDamageAnyTarget: ['damage'],
  putCounter: ['putCounter'],
  putCounterAll: ['putCounter'],
  putCounterTarget: ['putCounter'],
  sacrifice: ['sacrifice', 'dies'],
  gainLife: ['lifegain'],
  pumpAll: ['pump'],
  pumpSelf: ['pump'],
  pumpTarget: ['pump'],
  addMana: ['addMana'],
};
// These effects' real consequence is inherently a zone MOVEMENT (`to`/
// `from`), not a bare named `event` — see header comment.
const ZONE_SHAPED_KINDS = new Set(['move', 'createToken']);

function isBackFace(path) {
  return path.startsWith('backFace.');
}

async function loadFinScryfall() {
  const raw = await readFile(FIN_SCRYFALL, 'utf8');
  const cards = JSON.parse(raw);
  const byName = new Map();
  for (const card of cards) {
    if (typeof card?.name !== 'string') continue;
    const collector = Number.parseInt(card.collector_number, 10);
    if (Array.isArray(card.card_faces) && card.card_faces.length > 0) {
      byName.set(card.name, {
        collector,
        front: { typeLine: card.card_faces[0]?.type_line ?? '', oracleText: card.card_faces[0]?.oracle_text ?? '' },
        back: card.card_faces[1] ? { typeLine: card.card_faces[1]?.type_line ?? '', oracleText: card.card_faces[1]?.oracle_text ?? '' } : undefined,
      });
    } else {
      byName.set(card.name, { collector, front: { typeLine: card.type_line ?? '', oracleText: card.oracle_text ?? '' } });
    }
  }
  return byName;
}

// ONLY used to classify a card with NO definition-annotations.json file at
// all — see the "KNOWN, DOCUMENTED LIMITATION" header comment above. Never
// used to enumerate containers for a card that DOES have a file.
function hasAnyBaseContainer(def) {
  if (!def) return false;
  if ((def.triggers?.length ?? 0) > 0) return true;
  if ((def.abilities?.length ?? 0) > 0) return true;
  if (def.effects && def.effects.length > 0) return true;
  if (def.ptFormula) return true;
  if ((def.triggerDoubling?.length ?? 0) > 0) return true;
  return hasAnyBaseContainer(def.backFace);
}

// Tier-3 `authoredFact`/`authoredFacts` index PATHS present in this card's
// own `definition.ts` (mirrors `prototype-index-path-annotations-fin1-5
// .mjs`'s own `collectAnnotationSites` walk, generalized to `backFace` —
// this file only needs the PATH, not the fact's own content, since
// correspondence here is purely annotation-span-based).
function collectTier3Paths(def, prefix = '') {
  const paths = [];
  const walkEffects = (effects, effPrefix) => {
    if (!effects) return;
    effects.forEach((effect, i) => {
      const effectPath = `${effPrefix}[${i}]`;
      if (effect.kind === 'modal') {
        (effect.modes ?? []).forEach((mode, mi) => {
          walkEffects(mode.effects, `${effectPath}.modes[${mi}].effects`);
        });
      }
      if (effect.kind === 'custom' && effect.authoredFact) {
        const arr = Array.isArray(effect.authoredFact) ? effect.authoredFact : [effect.authoredFact];
        arr.forEach((_, fi) => paths.push(`${prefix}${effectPath}.authoredFact[${fi}]`));
      }
    });
  };
  (def.triggers ?? []).forEach((trigger, i) => walkEffects(trigger.effects, `${prefix}triggers[${i}].effects`));
  (def.abilities ?? []).forEach((ability, i) => walkEffects(ability.effects, `${prefix}abilities[${i}].effects`));
  if (def.effects) walkEffects(def.effects, `${prefix}effects`);
  (def.authoredFacts ?? []).forEach((_, i) => paths.push(`${prefix}authoredFacts[${i}]`));
  if (def.backFace) paths.push(...collectTier3Paths(def.backFace, `${prefix}backFace.`));
  return paths;
}

// Which already-enumerated base container (from THIS card's own
// definition-annotations.json keys) owns a given tier-3 path — longest
// path-boundary-respecting prefix match (`triggers[1]` owns
// `triggers[1].effects[0].authoredFact[0]`; `effects[0].modes[1]` owns
// `effects[0].modes[1].effects[0].authoredFact[0]`, not the coarser bare
// `effects`). Used for the CONTAINER-level fallback only — the per-EFFECT
// fallback below uses an exact path match instead, since it can (and should)
// be more precise. A card-level `authoredFacts[i]` (no owning Effect/
// container at all, per PRD_AUTOMATED_AUTHORING.md's own "Tier 3 design" —
// a NAMED trigger's own firing precondition with no single owning Effect)
// never matches anything here; it's a standalone fallback fact, not owned by
// any one container.
function ownerContainer(tier3Path, baseContainerPaths) {
  let best;
  for (const base of baseContainerPaths) {
    if (tier3Path.startsWith(base)) {
      const next = tier3Path[base.length];
      if (next === '.' || next === '[') {
        if (!best || base.length > best.length) best = base;
      }
    }
  }
  return best;
}

function overlaps(a, b) {
  if (!a || !b) return false;
  if (a.target !== b.target) return false;
  if (a.target === 'oracle' && a.line !== b.line) return false;
  return Math.max(a.start, b.start) < Math.min(a.end, b.end);
}

function isZoneFactLike(f) {
  return f.zone !== undefined || f.to !== undefined || f.from !== undefined;
}

function classifyKind(kind) {
  if (Object.prototype.hasOwnProperty.call(KNOWN_EVENT_FOR_KIND, kind)) return { type: 'known', events: KNOWN_EVENT_FOR_KIND[kind] };
  if (ZONE_SHAPED_KINDS.has(kind)) return { type: 'zone' };
  return { type: 'unclassified' };
}

function factMatchesKindExpectation(fact, classification) {
  if (classification.type === 'known') return classification.events.includes(fact.event);
  if (classification.type === 'zone') return isZoneFactLike(fact);
  return true; // unclassified — approximate, "any fact at all" (see header comment)
}

// Resolves a container path to { arr, prefix } — the real Effect[] this
// container's own leaf effects live in, and the index-path PREFIX to use
// when building each leaf's own exact effect path. Returns null for
// `ptFormula`/`triggerDoubling[i]` (not an Effect[] at all — no per-effect
// breakdown is possible there, same single-check treatment as before this
// refinement).
function getEffectsArrayForContainer(def, path) {
  const back = isBackFace(path);
  const bare = back ? path.slice('backFace.'.length) : path;
  const root = back ? def.backFace : def;
  if (!root) return null;
  const backPrefix = back ? 'backFace.' : '';
  let m;
  if (bare === 'effects') return { arr: root.effects, prefix: `${backPrefix}effects` };
  if ((m = bare.match(/^triggers\[(\d+)\]$/))) {
    const i = Number(m[1]);
    return { arr: root.triggers?.[i]?.effects, prefix: `${backPrefix}triggers[${i}].effects` };
  }
  if ((m = bare.match(/^abilities\[(\d+)\]$/))) {
    const i = Number(m[1]);
    return { arr: root.abilities?.[i]?.effects, prefix: `${backPrefix}abilities[${i}].effects` };
  }
  if ((m = bare.match(/^effects\[(\d+)\]\.modes\[(\d+)\]$/))) {
    const i = Number(m[1]);
    const j = Number(m[2]);
    const mode = root.effects?.[i]?.modes?.[j];
    return { arr: mode?.effects, prefix: `${backPrefix}effects[${i}].modes[${j}].effects` };
  }
  return null; // ptFormula / triggerDoubling[i] — no Effect[] to break down
}

// One level of leaf effects for a container's own Effect[] — excludes a
// `kind:'modal'` entry itself (pure dispatch wrapper, no independent
// behavior; its own modes are separately enumerated as their own
// `effects[i].modes[j]` containers, never double-counted here).
function leafEffectsForContainer(arr, prefix) {
  if (!arr) return [];
  return arr.map((effect, i) => ({ effect, path: `${prefix}[${i}]` })).filter(({ effect }) => effect.kind !== 'modal');
}

async function main() {
  const finByName = await loadFinScryfall();
  const allSlugs = (await readdir(cardsDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);

  const report = [];
  const annotationGapCards = [];
  let cardsChecked = 0;

  // Container-level (original) tallies.
  let totalContainers = 0;
  let containerScriptCovered = 0;
  let containerAgentCovered = 0;
  const containerGaps = [];
  const resolutionFailures = [];
  let containerTier3FallbackUsed = 0;
  let containerUnverifiableCount = 0;
  let triggerDoublingHits = 0;

  // Per-EFFECT (this refinement) tallies.
  let totalEffects = 0;
  let effectScriptCovered = 0;
  let effectAgentCovered = 0;
  const effectGaps = [];
  let effectTier3FallbackUsed = 0;
  let effectApproximateCount = 0; // unclassified-kind leaves, weaker "any fact" check
  let effectUnverifiableCount = 0; // a matching-kind fact exists but has no annotations at all — see "unannotatedFacts"

  for (const slug of allSlugs) {
    let mod;
    try {
      mod = await import(new URL(`${slug}/definition.ts`, cardsDir).href);
    } catch {
      continue; // not a real card definition (or fails to load) — not this checker's concern
    }
    const def = Object.values(mod).find((v) => v && typeof v === 'object' && typeof v.name === 'string');
    if (!def) continue;

    const lookupName = def.backFace?.name ? `${def.name} // ${def.backFace.name}` : def.name;
    const scry = finByName.get(lookupName);
    if (!scry || Number.isNaN(scry.collector) || scry.collector < 1 || scry.collector > 100) continue; // not a real fin/1-100 card

    cardsChecked++;

    let annotationsByPath = null;
    try {
      annotationsByPath = JSON.parse(await readFile(new URL(`${slug}/definition-annotations.json`, cardsDir), 'utf8'));
    } catch {
      annotationsByPath = null;
    }

    if (!annotationsByPath || Object.keys(annotationsByPath).length === 0) {
      if (hasAnyBaseContainer(def)) annotationGapCards.push({ slug, collector: scry.collector });
      report.push({ slug, collector: scry.collector, containers: 0, containerScript: 0, containerAgent: 0, containerGaps: 0, effects: 0, effectScript: 0, effectAgent: 0, effectGaps: 0 });
      continue;
    }

    const baseContainerPaths = Object.keys(annotationsByPath).filter((k) => BASE_CONTAINER_RE.test(k));
    if (baseContainerPaths.some((k) => k.includes('triggerDoubling'))) triggerDoublingHits++;

    const tier3Paths = collectTier3Paths(def);

    let synergy = { source: [], sink: [] };
    try {
      synergy = JSON.parse(await readFile(new URL(`${slug}/synergy.json`, cardsDir), 'utf8'));
    } catch {
      synergy = { source: [], sink: [] };
    }
    const realFacts = [...(synergy.source ?? []), ...(synergy.sink ?? [])];
    // A real, distinct pre-existing data-quality issue this checker
    // surfaced (not something it can fix): `Fact.annotations` is supposed
    // to be REQUIRED (synergy.ts's own doc comment, enforced pool-wide by
    // `annotation-coverage.mjs` — but only for cards on that script's own
    // `ANNOTATED_CARD_SLUGS` allowlist). A handful of real fin/1-100 cards
    // (checked: fin/91-100, the LAST 10 cards this session's own fin/1-100
    // annotation-authoring pass covered) have a real fact with NO
    // `annotations` at all — a fact this checker (or ANY annotation-based
    // consumer) structurally cannot attribute to any specific container/
    // effect, since there is nothing to overlap. Tracked SEPARATELY below
    // as "unverifiable" rather than silently counted as either "covered" or
    // a "genuine gap" — a real fact may already exist for that behavior,
    // this checker just can't confirm it.
    const unannotatedFacts = realFacts.filter((f) => !f.annotations || f.annotations.length === 0);

    const cardResult = { slug, collector: scry.collector, containers: baseContainerPaths.length, containerScript: 0, containerAgent: 0, containerGaps: 0, containerUnverifiable: 0, effects: 0, effectScript: 0, effectAgent: 0, effectGaps: 0, effectUnverifiable: 0, effectGapDetails: [] };

    for (const path of baseContainerPaths) {
      totalContainers++;
      const authoring = annotationsByPath[path];
      const face = isBackFace(path) ? 'back' : 'front';
      const texts =
        face === 'back'
          ? { oracle: scry.back?.oracleText, typeLine: def.backFace?.typeLine }
          : { oracle: scry.front?.oracleText, typeLine: def.typeLine };

      const resolved = computeFactAnnotations(texts, authoring);
      if (!resolved || resolved.length === 0) {
        resolutionFailures.push({ slug, path });
        continue;
      }
      const containerRef = resolved[0];

      const factsOnThisFace = realFacts.filter((f) => (f.face ?? 'front') === face);
      const overlappingAny = factsOnThisFace.filter((f) => (f.annotations ?? []).some((ann) => overlaps(ann, containerRef)));

      // --- Container-level (original design) ---
      if (overlappingAny.length > 0) {
        if (overlappingAny.some((f) => f.provenance)) {
          containerScriptCovered++;
          cardResult.containerScript++;
        } else {
          containerAgentCovered++;
          cardResult.containerAgent++;
        }
      } else {
        const owned = tier3Paths.filter((t3) => ownerContainer(t3, baseContainerPaths) === path);
        let tier3Hit = false;
        for (const t3Path of owned) {
          const t3Authoring = annotationsByPath[t3Path];
          if (!t3Authoring) continue;
          const t3Resolved = computeFactAnnotations(texts, t3Authoring);
          if (t3Resolved && t3Resolved.length > 0 && overlaps(t3Resolved[0], containerRef)) {
            tier3Hit = true;
            break;
          }
        }
        if (tier3Hit) {
          containerTier3FallbackUsed++;
          containerAgentCovered++;
          cardResult.containerAgent++;
        } else if (unannotatedFacts.some((f) => (f.face ?? 'front') === face)) {
          // A real fact exists on this face with NO annotations at all — see
          // this file's own "unannotatedFacts" comment above. Can't confirm
          // it covers THIS container specifically, but it's dishonest to
          // call this a confirmed zero-fact gap either.
          containerUnverifiableCount++;
          cardResult.containerUnverifiable++;
        } else {
          containerGaps.push({ slug, collector: scry.collector, path, highlight: authoring.highlight });
          cardResult.containerGaps++;
        }
      }

      // --- Per-EFFECT (this refinement) ---
      const effArr = getEffectsArrayForContainer(def, path);
      if (!effArr) {
        // ptFormula / triggerDoubling[i] — no Effect[] breakdown possible;
        // treat the container's own single verdict (just computed above) as
        // its one synthetic "effect" for overall total-count consistency.
        totalEffects++;
        cardResult.effects++;
        if (overlappingAny.length > 0) {
          if (overlappingAny.some((f) => f.provenance)) {
            effectScriptCovered++;
            cardResult.effectScript++;
          } else {
            effectAgentCovered++;
            cardResult.effectAgent++;
          }
        } else {
          effectAgentCovered += 0; // no-op, for clarity: falls through to gap below unless tier-3 already hit above
          const owned = tier3Paths.filter((t3) => ownerContainer(t3, baseContainerPaths) === path);
          const hit = owned.some((t3) => {
            const t3Authoring = annotationsByPath[t3];
            if (!t3Authoring) return false;
            const t3Resolved = computeFactAnnotations(texts, t3Authoring);
            return t3Resolved && t3Resolved.length > 0 && overlaps(t3Resolved[0], containerRef);
          });
          if (hit) {
            effectTier3FallbackUsed++;
            effectAgentCovered++;
            cardResult.effectAgent++;
          } else if (unannotatedFacts.some((f) => (f.face ?? 'front') === face)) {
            effectUnverifiableCount++;
            cardResult.effectUnverifiable++;
          } else {
            effectGaps.push({ slug, collector: scry.collector, containerPath: path, effectPath: path, kind: '(ptFormula/triggerDoubling)', highlight: authoring.highlight });
            cardResult.effectGaps++;
            cardResult.effectGapDetails.push({ effectPath: path, kind: '(ptFormula/triggerDoubling)', highlight: authoring.highlight });
          }
        }
        continue;
      }

      const leaves = leafEffectsForContainer(effArr.arr, effArr.prefix);
      for (const { effect, path: effectPath } of leaves) {
        totalEffects++;
        cardResult.effects++;
        const classification = classifyKind(effect.kind);
        const approximate = classification.type === 'unclassified';
        const kindMatches = factsOnThisFace.filter((f) => (f.annotations ?? []).some((ann) => overlaps(ann, containerRef)) && factMatchesKindExpectation(f, classification));

        if (kindMatches.length > 0) {
          if (approximate) effectApproximateCount++;
          if (kindMatches.some((f) => f.provenance)) {
            effectScriptCovered++;
            cardResult.effectScript++;
          } else {
            effectAgentCovered++;
            cardResult.effectAgent++;
          }
          continue;
        }

        // Fallback: an EXACT tier-3 authoredFact sitting on THIS specific
        // effect (exact path prefix — the only case where per-effect
        // attribution is possible for an opaque `custom` closure).
        const ownedExact = tier3Paths.filter((t3) => t3.startsWith(`${effectPath}.authoredFact[`));
        let tier3Hit = false;
        for (const t3Path of ownedExact) {
          const t3Authoring = annotationsByPath[t3Path];
          if (!t3Authoring) continue;
          const t3Resolved = computeFactAnnotations(texts, t3Authoring);
          if (t3Resolved && t3Resolved.length > 0 && overlaps(t3Resolved[0], containerRef)) {
            tier3Hit = true;
            break;
          }
        }
        if (tier3Hit) {
          effectTier3FallbackUsed++;
          effectAgentCovered++;
          cardResult.effectAgent++;
          continue;
        }

        // A real fact matching this effect's OWN kind expectation exists on
        // this face but carries NO annotations at all (a real, pre-existing
        // data bug this checker surfaced — see the `unannotatedFacts` header
        // comment above) — can't confirm it covers THIS effect specifically,
        // but calling it a confirmed zero-fact gap would be dishonest too.
        const unannotatedMatch = unannotatedFacts.some((f) => (f.face ?? 'front') === face && factMatchesKindExpectation(f, classification));
        if (unannotatedMatch) {
          effectUnverifiableCount++;
          cardResult.effectUnverifiable++;
          continue;
        }

        effectGaps.push({ slug, collector: scry.collector, containerPath: path, effectPath, kind: effect.kind, highlight: authoring.highlight });
        cardResult.effectGaps++;
        cardResult.effectGapDetails.push({ effectPath, kind: effect.kind, highlight: authoring.highlight });
      }
    }

    report.push(cardResult);
  }

  console.log('=== Fact parity check — fin/1-100 (functional-model/PRD_AUTOMATED_AUTHORING.md) ===\n');
  console.log(`Real fin/1-100 cards checked: ${cardsChecked}\n`);

  console.log('--- CONTAINER-level (original granularity — "is this ability represented at all") ---');
  console.log(`Total containers: ${totalContainers}`);
  console.log(`  - script-covered: ${containerScriptCovered}`);
  console.log(`  - agent-covered (incl. ${containerTier3FallbackUsed} via tier-3 fallback): ${containerAgentCovered}`);
  console.log(`  - unverifiable (a fact exists on this face but has NO required annotations at all — can't confirm it covers this container; NOT counted as covered OR as a gap): ${containerUnverifiableCount}`);
  console.log(`  - GENUINE GAPS: ${containerGaps.length}`);

  console.log('\n--- PER-EFFECT-level (this refinement — "does EVERY real Effect object have its own fact") ---');
  console.log(`Total leaf effects checked: ${totalEffects}`);
  console.log(`  - script-covered: ${effectScriptCovered}`);
  console.log(`  - agent-covered (incl. ${effectTier3FallbackUsed} via exact-effect tier-3 fallback): ${effectAgentCovered}`);
  console.log(
    `  - unverifiable (a fact matching this effect's own kind expectation exists on this face but has NO required 'annotations' at all — a real, pre-existing data bug this checker surfaced, confined to fin/91-100; NOT counted as covered OR as a gap, since a real fact may already exist and this checker structurally can't confirm it): ${effectUnverifiableCount}`,
  );
  console.log(`  - GENUINE PARITY GAPS (zero fact of the right kind anywhere, INCLUDING unannotated ones): ${effectGaps.length}`);
  console.log(
    `  - of the covered effects, how many relied on the WEAKER "unclassified kind, any fact at all" approximate check (no confirmed kind->event/zone mapping exists for these — see header comment's "UNCLASSIFIED" bucket): ${effectApproximateCount}`,
  );

  console.log(`  - resolution failures (container annotation entry present but didn't resolve against real text — a data bug, NOT a fact-parity verdict either way): ${resolutionFailures.length}`);
  for (const r of resolutionFailures) console.log(`      ${r.slug}: ${r.path}`);

  const zeroContainerCards = report.filter((r) => r.containers === 0);
  console.log(`\nCards with zero containers ("nothing to cover"): ${zeroContainerCards.length}`);
  console.log(
    `  of which flagged as a KNOWN ANNOTATION-COVERAGE-GAP card (has a real, structurally-present container in definition.ts but NO definition-annotations.json file at all — a blind spot INHERITED from the upstream annotation pass, not a fact-parity gap this checker can resolve): ${annotationGapCards.length}`,
  );
  for (const c of annotationGapCards) console.log(`      fin/${c.collector} ${c.slug}`);
  const genuinelyEmpty = zeroContainerCards.length - annotationGapCards.length;
  console.log(`  of which genuinely have nothing to annotate (pure-keyword/static-text-only cards, adelbert-steiner-shaped precedent): ${genuinelyEmpty}`);

  if (triggerDoublingHits) {
    console.log(
      `\nNote: ${triggerDoublingHits} card(s) had a real 'triggerDoubling[i]' container — a 6th real container shape this pool's annotation pass produced, beyond the 5 literally named in PRD_AUTOMATED_AUTHORING.md's list (triggers/abilities/effects/ptFormula/modal modes). Counted as a container like the other 5, flagged here rather than silently folded in.`,
    );
  }

  if (effectGaps.length > 0) {
    console.log(`\n=== GENUINE PER-EFFECT PARITY GAPS (${effectGaps.length}) — real Effect object, container's own resolved annotation span, ZERO fact of the expected kind anywhere overlaps it ===`);
    for (const g of effectGaps) {
      console.log(`  fin/${g.collector} ${g.slug} :: ${g.effectPath} (kind: ${g.kind}) — container "${g.containerPath}" text: "${g.highlight}"`);
    }
  } else {
    console.log('\nNo genuine per-effect parity gaps found across fin/1-100.');
  }

  if (containerGaps.length > 0) {
    console.log(`\n=== (For reference) CONTAINER-level gaps (${containerGaps.length}) — coarser granularity, superseded by the per-effect list above for anything that has real leaf effects ===`);
    for (const g of containerGaps) {
      console.log(`  fin/${g.collector} ${g.slug} :: ${g.path} — "${g.highlight}"`);
    }
  }

  console.log('\n=== Per-card breakdown (cards with >=1 container only) ===');
  for (const r of report.filter((r) => r.containers > 0)) {
    console.log(
      `  fin/${r.collector} ${r.slug}: ${r.containers} containers (script:${r.containerScript} agent:${r.containerAgent} unverif:${r.containerUnverifiable ?? 0} gaps:${r.containerGaps}) — ${r.effects} effects (script:${r.effectScript} agent:${r.effectAgent} unverif:${r.effectUnverifiable ?? 0} gaps:${r.effectGaps})`,
    );
  }
}

main();
