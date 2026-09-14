// PROTOTYPE / THROWAWAY — proof-of-concept for `PRD_AUTOMATED_AUTHORING.md`'s
// "3-tier waterfall" idea (2026-09-13), scoped to the real fin/1-10 cards
// ONLY. NOT wired into `apply-recognizers.mjs`, does NOT write to any real
// `synergy.json` — read-only, diagnostic. Run with:
//   npx vite-node functional-model/scripts/prototype-3tier-reconstruct-fin1-10.mjs
//
// Reconstructs each card's FULL fact set (source + sink) purely from its own
// `definition.ts`, via three tiers tried in fallback order:
//   1. STATIC STRUCTURAL — the 5 real, already-shipped recognizers
//      (`recognizers/*.ts`), imported and run AS-IS (no re-implementation),
//      PLUS a handful of NEW, narrowly-scoped structural derivations
//      (below, `EXTRA_STRUCTURAL_DERIVERS`) covering `Effect` kinds none of
//      the 5 shipped recognizers read yet (`move`, `dig`, `pumpSelf`,
//      `pumpTarget`, `createToken`, `gainLife`, `putCounter`,
//      `putCounterTarget`, `addMana`, `dealDamage`), plus 3 non-`Effect`
//      structural sources (`keywords: ['Lifelink']`, `ptFormula.kind ===
//      'addPerEquipmentControlled'`, `alternateCosts[]`, `triggerDoubling[]`)
//      and a derived "dies" consequence paired with an accepted `destroy`
//      fact (CR 700.4 — see that deriver's own comment for why this is safe
//      to always pair, unlike the general mirrored-sink heuristic below).
//   2. RUNTIME DEPENDENCY PROBE — `recognizers/runtime-dependency-probe
//      .prototype.ts`'s `probeComputedNumber`, run against any `Computed<T>`
//      closure tier 1 found but couldn't read a literal value from (this
//      sample: exactly one, summon-bahamut's chapter IV `amount`). Its
//      classification ("scales with permanents you control") is mapped to
//      the paired SINK fact tier 1 alone can't justify (`to: 'Battlefield'`)
//      — tier 1 already supplied the ACT/SOURCE fact's other fields
//      (`event`, `target`, `recipient` are all literal), tier 2 only fills
//      in what the magnitude depends on.
//   3. AUTHORED (tier 3) — reads `Effect.authoredFact` /
//      `CardDefinition.authoredFacts` directly (see `card.ts`'s own doc
//      comments on both fields for the full design rationale). Populated
//      for real on 4 of these 10 cards this session (aerith-gainsborough,
//      auron-s-inspiration, aerith-rescue-mission, ashe-princess-of-
//      dalmasca, ambrosia-whiteheart — 5, not 4, once written).
//
// A separate, GENERIC post-processing step, `mirroredPresenceSink` (tier 1,
// checked against every produce fact this script derives OR a shipped
// recognizer derives): a produce fact whose `target` is a Constraints object
// asserting a POSITIVE type list (`types.has`) gets a paired
// `{to:'Battlefield', types:{has:[...]}, ...}` "wants this present to target"
// sink. Deliberately does NOT apply to a `types.not` (exclusion) constraint —
// checked against every real fact in this 10-card sample before being
// trusted: Bahamut's own "destroy target NONLAND permanent" (`types.not:
// ['Land']`) has NO such sink in the real, hand-authored `synergy.json`,
// while every real `types.has`-constrained target in this same sample DOES
// (Ultima's blight-counter target land, Battle Menu's power>=4 destroy
// target, Battle Menu's pumpTarget creature target, Aerith Rescue Mission's
// stun-counter creature target) — a genuine, checked, sample-confirmed
// pattern, not a guess extended past what's been verified. Flagged
// explicitly in this file's own final report as unverified against the
// WHOLE pool (this task is scoped to fin/1-10 only).
//
// `value` (a magnitude WEIGHT, computed pool-wide by the pre-existing
// `compute-weights.mjs` from trace evidence — see that script) and precise
// sub-line annotation OFFSETS (computed by the pre-existing
// `compute-annotations.mjs`/`toLineOffset` for a real recognizer's own
// regex-anchored match) are DELIBERATELY OUT OF SCOPE for this
// reconstruction's pass/fail verdict — both are already-solved, orthogonal,
// tier-agnostic mechanical concerns this prototype doesn't re-litigate. The
// comparison below checks fact SHAPE/EXISTENCE only: `role` + every
// semantic field except `value`/`annotations`/`provenance`.
import { recognizeInstantSorceryResolvesToGraveyard } from '../recognizers/instant-sorcery-resolves-to-graveyard.ts';
import { recognizePermanentEntersBattlefieldNormally } from '../recognizers/permanent-enters-battlefield-normally.ts';
import { recognizeDestroyEffectStructural } from '../recognizers/destroy-effect-structural.ts';
import { recognizeDrawCardEffectStructural } from '../recognizers/drawCard-effect-structural.ts';
import { recognizeSagaLoreAndSacrificeStructural } from '../recognizers/saga-lore-and-sacrifice-structural.ts';
import { recognizeDiesTriggerStructural } from '../recognizers/dies-trigger-structural.ts';
import { recognizeLifegainTriggerStructural } from '../recognizers/lifegain-trigger-structural.ts';
import { probeComputedNumber } from '../recognizers/runtime-dependency-probe.ts';
import { probeBroadcastPutCounter } from '../recognizers/runtime-action-probe.ts';
import { TOKENS } from '../tokens.ts';
import { readFile } from 'node:fs/promises';

const cardsDir = new URL('../cards/', import.meta.url);

const SLUGS = [
  'summon-bahamut',
  'ultima-origin-of-oblivion',
  'adelbert-steiner',
  'aerith-gainsborough',
  'aerith-rescue-mission',
  'ambrosia-whiteheart',
  'ashe-princess-of-dalmasca',
  "auron-s-inspiration",
  'battle-menu',
  'cloud-midgar-mercenary',
];

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

function isLiteral(v) {
  return typeof v !== 'function';
}

function tokenKeyOf(tokenInfo) {
  const entry = Object.entries(TOKENS).find(([, v]) => v === tokenInfo);
  return entry ? entry[0] : undefined;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Walks the same containers `structural-effects.ts`'s `collectEffects` does
// (top-level `effects`, every named `triggers[].effects`, `abilities[]
// .effects`, recursing into `modal` modes) but keeps a reference to the
// OWNING container object (`Effect`, `Trigger`, or a modal `mode`) alongside
// each effect, so `authoredFact`/`authoredFacts` (co-located on that SAME
// container) can be read back out during tier-3 lookup, and so a `modal`
// mode's own effects still resolve their per-mode annotation context. Faces
// (front/back) are walked independently — DFCs in this sample are none, so
// this doesn't need to differentiate the caller-facing output.
function collectEffectSites(def) {
  const sites = [];
  const walk = (list) => {
    if (!list) return;
    for (const effect of list) {
      sites.push({ effect });
      if (effect.kind === 'modal') {
        for (const mode of effect.modes) walk(mode.effects);
      }
    }
  };
  walk(def.effects);
  for (const t of def.triggers ?? []) walk(t.effects);
  for (const a of def.abilities ?? []) walk(a.effects);
  return sites;
}

// ---------------------------------------------------------------------------
// Tier 1 — the 5 real, shipped structural/text recognizers, used AS-IS.
// ---------------------------------------------------------------------------

async function loadOracleTextByName() {
  const dataDir = new URL('../../data/', import.meta.url);
  const { readdir } = await import('node:fs/promises');
  const byName = new Map();
  const setDirs = await readdir(dataDir, { withFileTypes: true }).catch(() => []);
  for (const dirent of setDirs) {
    if (!dirent.isDirectory()) continue;
    const setDir = new URL(`${dirent.name}/`, dataDir);
    const files = await readdir(setDir, { withFileTypes: true }).catch(() => []);
    for (const file of files) {
      if (!file.isFile() || !file.name.endsWith('_scryfall.json') || file.name.endsWith('_tokens_scryfall.json')) continue;
      const raw = await readFile(new URL(file.name, setDir), 'utf8').catch(() => null);
      if (!raw) continue;
      let cards;
      try {
        cards = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!Array.isArray(cards)) continue;
      for (const card of cards) {
        if (typeof card?.name !== 'string') continue;
        if (Array.isArray(card.card_faces) && card.card_faces.length > 0) {
          byName.set(card.name, {
            front: { typeLine: card.card_faces[0]?.type_line ?? '', oracleText: card.card_faces[0]?.oracle_text ?? '' },
            back: card.card_faces[1] ? { typeLine: card.card_faces[1]?.type_line ?? '', oracleText: card.card_faces[1]?.oracle_text ?? '' } : undefined,
          });
        } else {
          byName.set(card.name, { front: { typeLine: card.type_line ?? '', oracleText: card.oracle_text ?? '' } });
        }
      }
    }
  }
  return byName;
}

const SHIPPED_RECOGNIZERS = [
  recognizeInstantSorceryResolvesToGraveyard,
  recognizePermanentEntersBattlefieldNormally,
  recognizeDestroyEffectStructural,
  recognizeDrawCardEffectStructural,
  recognizeSagaLoreAndSacrificeStructural,
  // New this pass (tier-3 elimination, fin/1-5) — both text-only, same
  // `RecognizerInput` shape A/B already use, so they slot into this same
  // loop with no other wiring.
  recognizeDiesTriggerStructural,
  recognizeLifegainTriggerStructural,
];

// ---------------------------------------------------------------------------
// Tier 1 (extra) — new, narrow structural derivations this prototype adds,
// for `Effect` kinds/`CardDefinition` fields none of the 5 shipped
// recognizers read. Each declines (returns nothing) rather than guess on a
// non-literal (`Computed`) field — same discipline the shipped recognizers
// use. NOT real recognizer files — inline here, POC only.
// ---------------------------------------------------------------------------

// A `destroy` ACT fact `recognizeDestroyEffectStructural` already accepted
// gets a paired `dies` CONSEQUENCE fact for free — CR 700.4: BY THE TIME
// `dies` fires, the battlefield->graveyard move is unconditionally
// guaranteed, regardless of whatever upstream act caused it (see
// SYNERGY_DESIGN.md's own "ACT vs CONSEQUENCE" standing rule — this is
// squarely the CONSEQUENCE side, always eligible, not the conditional ACT
// side). Same `target`/`targeted` carried over unchanged.
function deriveDiesFromDestroy(shippedFacts) {
  const out = [];
  for (const f of shippedFacts) {
    if (f.role === 'source' && f.event === 'destroy') {
      out.push({ role: 'source', event: 'dies', from: 'Battlefield', to: 'Graveyard', ...(f.target ? { target: f.target } : {}), targeted: f.targeted });
    }
  }
  return out;
}

function deriveExtraStructuralFacts(def) {
  const facts = [];

  // Lifelink keyword -> lifegain source (CR 702.15e: whenever this deals
  // damage, its controller gains that much life — the KEYWORD alone
  // guarantees the fact, no separate Effect needed).
  if (def.keywords?.includes('Lifelink')) {
    facts.push({ role: 'source', event: 'lifegain', controller: 'you' });
  }

  // A real layer-7a CDA keyed on Equipment count implies BOTH a self-pump
  // source (the CDA's own effect) and a paired sink (the CDA's own declared
  // dependency IS "Equipment you control" — not a guess, the field name
  // says so directly).
  if (def.ptFormula?.kind === 'addPerEquipmentControlled') {
    facts.push({ role: 'source', event: 'pump', target: 'self' });
    facts.push({ role: 'sink', to: 'Battlefield', controller: 'you', types: { has: ['Equipment'] } });
  }

  // Alternate cost (Flashback/Jump-start/etc.) — CR 601.2a: casting always
  // moves the card from wherever it's cast FROM onto the stack; `thenExile`
  // is real printed rule text, not inferred.
  for (const alt of def.alternateCosts ?? []) {
    facts.push({ role: 'source', event: 'cast', from: capitalize(alt.from), target: 'self' });
    if (alt.thenExile) facts.push({ role: 'source', to: 'Exile', controller: 'you', subject: 'self' });
  }

  // Trigger-doubling grant (`TriggerDoublingGrant.scope`, a closed enum) —
  // this IS the real, structural "wants a triggered ability to trigger"
  // sink; only the one real shape this 10-card sample needs is covered.
  for (const grant of def.triggerDoubling ?? []) {
    if (grant.scope === 'selfAndAttachedEquipment') {
      facts.push({ role: 'sink', event: 'triggeredAbility', target: 'self' });
      facts.push({ role: 'sink', event: 'triggeredAbility', target: { types: { has: ['Equipment'] }, attachedToSelf: true } });
    }
  }

  for (const { effect } of collectEffectSites(def)) {
    switch (effect.kind) {
      case 'gainLife':
        if (isLiteral(effect.amount)) facts.push({ role: 'source', event: 'lifegain', controller: 'you' });
        break;
      case 'pumpSelf':
        if (isLiteral(effect.power) && isLiteral(effect.toughness)) facts.push({ role: 'source', event: 'pump', target: 'self' });
        break;
      case 'pumpTarget':
        if (isLiteral(effect.power) && isLiteral(effect.toughness)) {
          facts.push({ role: 'source', event: 'pump', target: { types: { has: ['Creature'] } }, targeted: true });
        }
        break;
      case 'createToken':
        if (isLiteral(effect.amount)) {
          const key = tokenKeyOf(effect.token);
          if (key) facts.push({ role: 'source', event: 'entersBattlefield', to: 'Battlefield', controller: 'you', subject: { token: key } });
        }
        break;
      case 'putCounter':
        if (isLiteral(effect.amount) && effect.target === 'self') {
          facts.push({ role: 'source', event: 'putCounter', counterType: effect.counterType, target: 'self' });
        }
        break;
      case 'putCounterTarget':
        if (isLiteral(effect.amount) && !effect.owner) {
          const target =
            effect.validType === 'land'
              ? { types: { has: ['Land'] } }
              : effect.validType === 'creature'
                ? { types: { has: ['Creature'] } }
                : effect.validType === 'artifact'
                  ? { types: { has: ['Artifact'] } }
                  : undefined;
          if (target) facts.push({ role: 'source', event: 'putCounter', counterType: effect.counterType, target, targeted: true });
        }
        break;
      case 'addMana':
        if (isLiteral(effect.amount)) {
          facts.push({ role: 'source', event: 'addMana', colors: { has: [effect.color] }, controller: 'you' });
        }
        break;
      case 'move': {
        if (!isLiteral(effect.qty)) break;
        const target =
          effect.validType === 'land'
            ? { types: { has: ['Land'] } }
            : effect.validType === 'creature'
              ? { types: { has: ['Creature'] } }
              : effect.validType === 'artifact'
                ? // GAP, flagged deliberately, not silently "fixed": the
                  // structural field only distinguishes 'artifact' from
                  // 'creature'/'land'/'any' — it cannot recover a MORE
                  // specific real subtype (Cloud, Midgar Mercenary's own
                  // real "search ... for an Equipment card" narrows further
                  // than this model's own `move.validType` union can
                  // express). Reconstructed here at the coarser, honest
                  // level the structural field actually supports.
                  { types: { has: ['Artifact'] } }
                : undefined;
        facts.push({ role: 'source', to: effect.to, from: effect.from, controller: 'you', ...(target ? { types: target.types } : {}) });
        // A real, genuinely CHOSEN target (`move.target === true`, a boolean
        // — as opposed to a library-search's own `validType`-scoped dig,
        // which has no board target at all) with no type restriction of its
        // own implies a generic "wants a permanent present to target" sink
        // — same "you need something to target" reasoning
        // `mirroredPresenceSinks` already applies to a `types.has`-
        // constrained target, just for the unconstrained case that helper's
        // own `types.has` check can't express.
        if (effect.target === true && !target) facts.push({ role: 'sink', to: 'Battlefield', controller: 'you' });
        break;
      }
      case 'dig':
        if (isLiteral(effect.qty) && isLiteral(effect.take)) {
          const typeWord = effect.validType === 'artifact' ? 'Artifact' : undefined;
          if (typeWord) {
            facts.push({ role: 'source', to: 'Hand', from: 'Library', controller: 'you', types: { has: [typeWord] } });
            facts.push({ role: 'sink', to: 'Library', controller: 'you', types: { has: [typeWord] } });
          }
        }
        break;
      case 'dealDamage':
        // `target` (an `EffectOwner`) is a LITERAL field even when `amount`
        // is a `Computed<number>` closure — tier 1 can confidently emit the
        // ACT/SOURCE fact's shape; only the SINK (what the magnitude scales
        // with) needs tier 2, handled separately below.
        if (effect.target === 'opponents') {
          facts.push({ role: 'source', event: 'damage', controller: 'you', recipient: 'opp', targeted: false });
        }
        break;
    }
  }

  return facts;
}

// A produce fact whose `target` is a Constraints object asserting a
// POSITIVE type list gets a paired "wants this present" sink — see this
// file's own header for the full reasoning + the checked Bahamut
// counterexample this rule deliberately does NOT fire on.
function mirroredPresenceSinks(facts) {
  const out = [];
  for (const f of facts) {
    if (f.role !== 'source') continue;
    const t = f.target;
    if (t && typeof t === 'object' && t.types?.has) {
      const sink = { role: 'sink', to: 'Battlefield', types: { has: t.types.has } };
      if (t.power) sink.power = t.power;
      out.push(sink);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tier 2 — runtime dependency probe, mapped onto a paired sink fact.
// ---------------------------------------------------------------------------

const BUCKET_TO_SINK = {
  'permanents you control': { to: 'Battlefield', controller: 'you' },
  'creatures you control': { to: 'Battlefield', controller: 'you', types: { has: ['Creature'] } },
  'lands you control': { to: 'Battlefield', controller: 'you', types: { has: ['Land'] } },
};

function deriveTier2Facts(def) {
  const facts = [];
  for (const { effect } of collectEffectSites(def)) {
    if (effect.kind === 'dealDamage' && typeof effect.amount === 'function') {
      const result = probeComputedNumber(effect.amount);
      if (result.classified) {
        const sink = BUCKET_TO_SINK[result.tag.replace(/^scales with /, '')];
        if (sink) facts.push({ role: 'sink', ...sink, __tier: 2, __evidence: result.tag });
      }
    }
    // New this pass — the ACTIONS half of the runtime probe
    // (`runtime-action-probe.prototype.ts`), scoped to exactly ONE real
    // closure shape (see that file's own header): a `kind:'custom'`
    // effect's own `run` broadcasting `actions.putCounter` over a
    // same-side, subtype-filtered collection, with no `chooseTarget` call
    // anywhere. `selfCounters` is seeded generically (not per-card) so a
    // closure gated on "has any +1/+1 counters" doesn't short-circuit
    // before reaching its own interesting branch — harmless for any
    // closure that never reads it at all.
    if (effect.kind === 'custom' && typeof effect.run === 'function') {
      const result = probeBroadcastPutCounter(effect.run, { selfCounters: { '+1/+1': 2 } });
      if (result.classified) {
        facts.push({
          role: 'source',
          event: result.fact.event,
          counterType: result.fact.counterType,
          controller: result.fact.controller,
          target: result.fact.target,
          targeted: result.fact.targeted,
          __tier: 2,
          __evidence: 'actions.putCounter broadcast, action-probe',
        });
      }
    }
  }
  return facts;
}

// ---------------------------------------------------------------------------
// Tier 3 — authored facts embedded directly in `definition.ts`.
// ---------------------------------------------------------------------------

function deriveTier3Facts(def) {
  const facts = [];
  for (const f of def.authoredFacts ?? []) facts.push(f);
  for (const { effect } of collectEffectSites(def)) {
    if (effect.kind === 'custom' && effect.authoredFact) {
      const arr = Array.isArray(effect.authoredFact) ? effect.authoredFact : [effect.authoredFact];
      for (const f of arr) facts.push(f);
    }
  }
  return facts;
}

// ---------------------------------------------------------------------------
// Comparison — SHAPE/EXISTENCE only, `value`/`annotations`/`provenance`
// excluded (see this file's own header for why).
// ---------------------------------------------------------------------------

// Recursive, key-order-independent canonicalizer — `JSON.stringify`'s
// array-replacer form only filters TOP-LEVEL keys, silently collapsing any
// nested object (`target`, `types`, `colors`, ...) to `{}` if used naively;
// this walks the whole structure instead.
function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    const keys = Object.keys(v).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

// `controller` excluded to match `apply-recognizers.mjs`'s own documented
// `coreKey` precedent (a real, confirmed pool inconsistency — some
// hand-authored facts declare it, some omit it, for the identical real
// claim). `subject` normalized away when `target === 'self'` and `subject`
// is absent/'self' — same documented `coreKey` fix (a self-referencing fact
// predating the `subject`+`target` convention carries `target:'self'` alone).
function normalize(fact) {
  const { value, annotations, provenance, controller, __tier, __evidence, ...rest } = fact;
  if (rest.target === 'self' && (rest.subject === undefined || rest.subject === 'self')) delete rest.subject;
  return stableStringify(rest);
}

async function reconstructCard(slug, oracleByName) {
  const mod = await import(new URL(`${slug}/definition.ts`, cardsDir).href);
  const def = Object.values(mod)[0];
  const synergyRaw = await readFile(new URL(`${slug}/synergy.json`, cardsDir), 'utf8');
  const real = JSON.parse(synergyRaw);
  const realFacts = [...(real.source ?? []).map((f) => ({ role: 'source', ...f })), ...(real.sink ?? []).map((f) => ({ role: 'sink', ...f }))];

  const faceInput = { name: def.name, typeLine: def.typeLine, oracleText: oracleByName.get(def.name)?.front?.oracleText ?? '', effects: def.effects, triggers: def.triggers, abilities: def.abilities };

  const shippedFacts = [];
  for (const recognize of SHIPPED_RECOGNIZERS) {
    const result = recognize(faceInput);
    if (result.matched) for (const rf of result.facts) shippedFacts.push({ ...rf.fact, role: rf.role });
  }

  const extraTier1 = deriveExtraStructuralFacts(def);
  const diesFromDestroy = deriveDiesFromDestroy(shippedFacts);
  const tier1All = [...shippedFacts, ...extraTier1, ...diesFromDestroy];
  const tier2 = deriveTier2Facts(def);
  // `mirroredPresenceSinks` reads ANY produce fact with a `types.has`-shaped
  // `target`, tier1 or tier2 alike — a tier-2 action-probe-derived produce
  // fact (e.g. aerith-gainsborough's own broadcast putCounter) needs the
  // exact same paired "wants this present" sink tier1's own destroy/
  // putCounterTarget facts already get, so both are fed through together.
  const mirrored = mirroredPresenceSinks([...tier1All, ...tier2]);
  const tier3 = deriveTier3Facts(def);

  const reconstructed = [...tier1All, ...mirrored, ...tier2, ...tier3];

  const reconstructedKeys = new Set(reconstructed.map(normalize));
  const realKeys = new Set(realFacts.map(normalize));

  const missing = realFacts.filter((f) => !reconstructedKeys.has(normalize(f)));
  const extra = reconstructed.filter((f) => !realKeys.has(normalize(f)));

  return { slug, realCount: realFacts.length, reconstructedCount: reconstructed.length, missing, extra, tier2 };
}

async function main() {
  const oracleByName = await loadOracleTextByName();
  let fullyReconstructed = 0;
  for (const slug of SLUGS) {
    const r = await reconstructCard(slug, oracleByName);
    const ok = r.missing.length === 0 && r.extra.length === 0;
    if (ok) fullyReconstructed++;
    console.log(`\n=== ${slug} === real:${r.realCount} reconstructed:${r.reconstructedCount} ${ok ? 'FULL MATCH' : 'GAPS'}`);
    if (r.tier2.length) console.log(`  tier2 evidence: ${r.tier2.map((f) => f.__evidence).join(', ')}`);
    for (const m of r.missing) console.log(`  MISSING: ${normalize(m)}`);
    for (const e of r.extra) console.log(`  EXTRA:   ${normalize(e)}`);
  }
  console.log(`\n${fullyReconstructed}/${SLUGS.length} cards fully reconstructed (shape/existence, value+annotations excluded).`);
}

main();
