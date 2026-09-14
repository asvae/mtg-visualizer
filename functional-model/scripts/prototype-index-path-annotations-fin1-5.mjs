// PROTOTYPE / THROWAWAY — verifies the "definition-level annotation, DATA
// EXTERNALIZED" design correction to PRD_AUTOMATED_AUTHORING.md's earlier
// inline-`annotation`-field prototype (2026-09-13), scoped to real fin/1-5
// cards ONLY (summon-bahamut, ultima-origin-of-oblivion, adelbert-steiner,
// aerith-gainsborough, aerith-rescue-mission). NOT wired into
// `apply-recognizers.mjs`, does NOT write to any real `synergy.json` —
// read-only, diagnostic. Run with:
//   npx vite-node functional-model/scripts/prototype-index-path-annotations-fin1-5.mjs
//
// What this checks, per card:
//   1. Walks the card's OWN `CardDefinition` structure (triggers[], effects,
//      effects[].modes[], ptFormula, authoredFacts[], and any `authoredFact`
//      co-located on a `custom` Effect anywhere in that walk — including
//      inside a `modal` mode), computing each container's own INDEX PATH the
//      exact same way the migration's own doc comments in each card's
//      `definition.ts` describe it (`"triggers[1].effects[0]
//      .authoredFact[2]"`, `"effects[0].modes[1]"`, `"ptFormula"`, etc).
//   2. Looks that path up in the card's own new `cards/<slug>/
//      definition-annotations.json` (a flat path -> `FactAnnotationAuthoring`
//      map — `{highlight, line, anchor?}`).
//   3. Resolves it via the SAME real `computeFactAnnotations` (synergy.ts)
//      the production `annotations-authoring.json` convention uses — no new
//      resolution logic, only a new lookup step before it.
//   4. For every `authoredFact`/`authoredFacts` entry specifically (the tier-3
//      case whose `annotations` field was stripped by this migration), cross-
//      checks the resolved `AnnotationRef` against that card's own REAL,
//      currently-checked-in `synergy.json` — the exact same annotation this
//      migration removed from `definition.ts` must still appear, byte-for-
//      byte, on a real fact in `synergy.json` today. This is the concrete,
//      not-just-self-consistent proof this migration didn't silently change
//      what gets served.
import { readFile } from 'node:fs/promises';
import { computeFactAnnotations } from '../synergy.ts';

const cardsDir = new URL('../cards/', import.meta.url);

const SLUGS = ['summon-bahamut', 'ultima-origin-of-oblivion', 'adelbert-steiner', 'aerith-gainsborough', 'aerith-rescue-mission'];

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

// Walks a `CardDefinition`, yielding `{ path, kind, ref }` sites — `kind`
// distinguishes a coarse "whole ability" annotation site (`trigger`/
// `ability`/`ptFormula`/`effects`/`mode`) from a tier-3 `authoredFactEntry`
// site (which additionally carries the AuthoredFact-shaped `ref` object
// itself, so its OWN stripped-annotation can be re-derived/cross-checked).
function collectAnnotationSites(def) {
  const sites = [];

  const walkEffects = (effects, prefix) => {
    if (!effects) return;
    effects.forEach((effect, i) => {
      const effectPath = `${prefix}[${i}]`;
      if (effect.kind === 'modal') {
        effect.modes.forEach((mode, mi) => {
          const modePath = `${effectPath}.modes[${mi}]`;
          sites.push({ path: modePath, kind: 'mode' });
          walkEffects(mode.effects, `${modePath}.effects`);
        });
      }
      if (effect.kind === 'custom' && effect.authoredFact) {
        const arr = Array.isArray(effect.authoredFact) ? effect.authoredFact : [effect.authoredFact];
        arr.forEach((fact, fi) => {
          sites.push({ path: `${effectPath}.authoredFact[${fi}]`, kind: 'authoredFactEntry', ref: fact });
        });
      }
    });
  };

  (def.triggers ?? []).forEach((trigger, i) => {
    sites.push({ path: `triggers[${i}]`, kind: 'trigger' });
    walkEffects(trigger.effects, `triggers[${i}].effects`);
  });
  (def.abilities ?? []).forEach((ability, i) => {
    sites.push({ path: `abilities[${i}]`, kind: 'ability' });
    walkEffects(ability.effects, `abilities[${i}].effects`);
  });
  if (def.effects) {
    sites.push({ path: 'effects', kind: 'effects' });
    walkEffects(def.effects, 'effects');
  }
  if (def.ptFormula) sites.push({ path: 'ptFormula', kind: 'ptFormula' });
  (def.authoredFacts ?? []).forEach((fact, i) => {
    sites.push({ path: `authoredFacts[${i}]`, kind: 'authoredFactEntry', ref: fact });
  });

  return sites;
}

// `AnnotationRef` structural equality (both possible shapes).
function sameRef(a, b) {
  if (!a || !b) return a === b;
  if (a.target !== b.target) return false;
  if (a.target === 'oracle') return a.line === b.line && a.start === b.start && a.end === b.end;
  return a.start === b.start && a.end === b.end;
}

async function verifyCard(slug, oracleByName) {
  const mod = await import(new URL(`${slug}/definition.ts`, cardsDir).href);
  const def = Object.values(mod)[0];
  const annotationsRaw = await readFile(new URL(`${slug}/definition-annotations.json`, cardsDir), 'utf8');
  const annotationsByPath = JSON.parse(annotationsRaw);
  const synergyRaw = await readFile(new URL(`${slug}/synergy.json`, cardsDir), 'utf8');
  const realSynergy = JSON.parse(synergyRaw);
  const realFacts = [...(realSynergy.source ?? []), ...(realSynergy.sink ?? [])];
  const texts = { oracle: oracleByName.get(def.name)?.front?.oracleText ?? '', typeLine: def.typeLine };

  const sites = collectAnnotationSites(def);
  const results = [];
  let usedPaths = 0;

  for (const site of sites) {
    const authoring = annotationsByPath[site.path];
    if (!authoring) {
      results.push({ path: site.path, status: 'NO ANNOTATION FILE ENTRY', kind: site.kind });
      continue;
    }
    usedPaths++;
    const resolved = computeFactAnnotations(texts, authoring);
    if (!resolved) {
      results.push({ path: site.path, status: 'FAILED TO RESOLVE', kind: site.kind, authoring });
      continue;
    }
    if (site.kind !== 'authoredFactEntry') {
      results.push({ path: site.path, status: 'OK (coarse span)', kind: site.kind, resolved: resolved[0] });
      continue;
    }
    // Tier-3 entry — cross-check the resolved ref against a REAL fact in
    // this card's own checked-in synergy.json (matched by real annotation
    // equality — the exact thing this migration must not have changed).
    const matchesReal = realFacts.some((f) => (f.annotations ?? []).some((r) => sameRef(r, resolved[0])));
    results.push({ path: site.path, status: matchesReal ? 'OK (matches real synergy.json)' : 'NO MATCHING REAL FACT', kind: site.kind, resolved: resolved[0] });
  }

  // Every key present in the annotations file should have been consumed by
  // an actual site in the definition (catches stale/typo'd paths).
  const unusedKeys = Object.keys(annotationsByPath).filter((k) => !sites.some((s) => s.path === k));

  return { slug, results, unusedKeys, siteCount: sites.length, usedPaths };
}

async function main() {
  const oracleByName = await loadOracleTextByName();
  let allOk = true;
  for (const slug of SLUGS) {
    const r = await verifyCard(slug, oracleByName);
    console.log(`\n=== ${slug} === ${r.siteCount} annotation sites, ${r.usedPaths} resolved via external file`);
    for (const res of r.results) {
      const bad = !res.status.startsWith('OK');
      if (bad) allOk = false;
      console.log(`  [${res.kind}] ${res.path}: ${res.status}`);
    }
    if (r.unusedKeys.length) {
      allOk = false;
      console.log(`  STALE KEYS in definition-annotations.json (no matching site): ${r.unusedKeys.join(', ')}`);
    }
  }
  console.log(`\n${allOk ? 'ALL OK' : 'FAILURES ABOVE'}`);
  if (!allOk) process.exitCode = 1;
}

main();
