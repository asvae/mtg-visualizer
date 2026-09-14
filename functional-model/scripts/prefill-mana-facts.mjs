// Mechanical, non-judgment prefill for ONE narrow real produce shape: a
// "{T}: Add X mana" ability — same "bulk-add the zero-judgment stuff, don't
// hand-type it" precedent scripts/prefill-main-types.mjs already established
// for the theme-tagging pipeline, applied here to the functional-model's own
// AI-authored synergy.json facts instead. Mana producers were previously
// completely invisible to synergy/findInteractionsForCard — this closes
// that gap corpus-wide in one mechanical pass rather than requiring an AI to
// hand-author the same fact shape per card.
//
// Recognizes exactly the two real shapes this codebase already models a
// mana ability as (see mana.ts's own header for why nothing wider is safe
// to recognize mechanically):
//  - A structured `{ kind: 'addMana', color, amount }` Effect (Elvish
//    Archdruid today) — a real, checkable trace line via card.ts's own
//    `ctx.you.addMana(...)`.
//  - A real, ORDINARILY-payable `CardDefinition.manaAbilities` entry
//    (`card.ts`'s own `ManaAbility` — closed 2026-09-14, superseding the OLD
//    `mana.ts`-only text-regex path this comment used to cite
//    [`manaAbilityColorFromStaticText`/`manaAbilityColorsFromStaticText`,
//    both deleted]): a bare `{T}` cost, no `restriction`/
//    `activationCondition`/`variableAmount` — the single-color case is the
//    same narrow slice engine.ts's non-basic-mana-source support recognizes
//    for piloting a real game; the choice-of-color case is ALSO now a real
//    payment primitive (`mana.ts`'s `assignManaRequirements`), not just
//    fact-generation-only. A RESTRICTED/conditioned/variable entry (Cargo
//    Ship, Freya Crescent, Elvish Archdruid's own separate `effects`-based
//    ability, ...) is correctly skipped here too — same exclusion
//    `mana.ts`'s own `payableManaAbility` applies. A `manaAbilities` entry
//    is text-only in the sense that `resolveCard()` never executes it as a
//    resolvable step — it never produces its own trace line, so
//    scripts/verify-synergy.mjs trusts the card's own definition.ts directly
//    for it (same "known statically, no trace needed" treatment
//    DEATH_TRIGGER_NAMES already gets for a card whose own death never logs
//    a real zone-change) — see that script's own `staticManaColorsFor`.
//  A choice-of-color ability ("Add {X} or {Y}.") produces ONE `addMana` fact
//  with a `colors: {hasAny:[...]}` set (`EventFact.colors`, 2026-09-09 —
//  reuses `TypeConstraint`'s own `has`/`hasAny`/`not` vocabulary, matched via
//  the exact same `satisfiesType` logic a type want already uses, see
//  synergy.ts's own doc comment) — NOT two separate single-color facts the
//  way this script used to emit (see git history before 2026-09-09): a real
//  future "wants a red mana source" sink can match on just the R half of a
//  `hasAny:['B','R']` set without this script needing to have split it into
//  two facts in the first place. A single-color ability keeps the OLDER,
//  still-supported `color: string` shape unchanged (out of scope to migrate
//  the 11 real cards already using it — see vector-imperial-capital's own
//  synergy.json for the one hand-migrated `colors` example).
//
// Idempotent: skips a face already carrying an `event:'addMana'` fact with
// the same `color` (single-color shape), or the same `colors.hasAny` SET
// (multi-color shape, order-independent) — so a card an AI already
// hand-authored one for, or a prior run of this script, is never
// duplicated — checked once at `verifySynergy.mjs`, but nothing stops an AI
// author from freely editing this fact further afterward (sourceText/
// highlight/value, etc.), same as any other mechanically-prefilled fact in
// this codebase's other pipelines.
//
// Usage: npx vite-node functional-model/scripts/prefill-mana-facts.mjs [--dry] [--slug=<slug>]
// `--slug` scopes a run to exactly one card folder — used to trial a change
// on a single card before a corpus-wide run (see notes.md); omit for the
// normal full-corpus sweep.

import { readdir, readFile, writeFile } from 'node:fs/promises';

const dryRun = process.argv.includes('--dry');
const onlySlug = process.argv.find((a) => a.startsWith('--slug='))?.split('=')[1];
const cardsDir = new URL('../cards/', import.meta.url);
const slugs = (await readdir(cardsDir, { withFileTypes: true }))
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .filter((s) => !onlySlug || s === onlySlug);

/** One real recognized mana source on one face — `colors` is always the full set this one ability can make (length 1 for a plain single-color ability or a structured `addMana` Effect, length 2+ for a real choice-of-color ability); `staticText` present only for a `manaAbilities` entry (re-derived from its own typed `colors`, not scanned off pre-existing free text — undefined for a structured `addMana` Effect, which has no single oracle-text line to cite here). A `restriction`/`activationCondition`/`variableAmount`-bearing `manaAbilities` entry is correctly skipped, same exclusion `mana.ts`'s own `payableManaAbility` applies. */
function manaSourcesOnFace(face) {
  const out = [];
  for (const ability of face.manaAbilities ?? []) {
    if (ability.restriction || ability.activationCondition || ability.variableAmount) continue;
    if ((ability.cost ?? '{T}') !== '{T}') continue;
    const staticText = `{T}: Add ${ability.colors.map((c) => `{${c}}`).join(' or ')}${ability.amount && ability.amount > 1 ? ` (x${ability.amount})` : ''}.`;
    out.push({ colors: ability.colors, staticText });
  }
  for (const effect of face.effects ?? []) {
    if (effect.kind === 'addMana' && typeof effect.color === 'string') {
      out.push({ colors: [effect.color], staticText: undefined });
    }
  }
  return out;
}

let written = 0;
let skippedNoFile = 0;
let alreadyPresent = 0;
const touchedSlugs = [];

for (const slug of slugs) {
  const cardModule = await import(new URL(`${slug}/definition.ts`, cardsDir).href).catch(() => null);
  if (!cardModule) continue;
  const card = Object.values(cardModule)[0];
  if (!card?.name) continue;

  const faces = [card, ...(card.backFace ? [card.backFace] : [])];
  const sources = faces.flatMap(manaSourcesOnFace);
  if (!sources.length) continue;

  const synergyPath = new URL(`${slug}/synergy.json`, cardsDir);
  const raw = await readFile(synergyPath, 'utf8').catch(() => null);
  if (raw === null) {
    console.log(`skip ${slug}: no synergy.json (author one first, same v2 convention every other card follows)`);
    skippedNoFile++;
    continue;
  }
  const synergy = JSON.parse(raw);
  synergy.source = synergy.source ?? [];

  let changed = false;
  for (const { colors, staticText } of sources) {
    if (colors.length === 1) {
      const [color] = colors;
      // A same-color match is a genuine duplicate (skip). A COLORLESS-field
      // addMana fact already on file (Elvish Archdruid's own hand-authored
      // "mana-per-elf", predating this field) is the SAME real ability missing
      // just this one detail — enrich it in place rather than push a second,
      // differently-shaped fact for the one addMana ability this face has.
      const existing = synergy.source.find((f) => f.event === 'addMana' && (f.color === color || (f.color === undefined && !f.colors)));
      if (existing) {
        if (existing.color === undefined) {
          existing.color = color;
          changed = true;
        } else {
          alreadyPresent++;
        }
        continue;
      }
      const fact = {
        event: 'addMana',
        controller: 'you',
        color,
        ...(staticText ? { sourceText: staticText, highlight: `{${color}}` } : {}),
      };
      synergy.source.push(fact);
      changed = true;
      continue;
    }

    // A real choice-of-color ability (2+ colors) — ONE combined `colors:
    // {hasAny:[...]}` fact, not one per color (see this file's own header).
    const wanted = new Set(colors);
    const existing = synergy.source.find(
      (f) => f.event === 'addMana' && f.colors?.hasAny && f.colors.hasAny.length === wanted.size && f.colors.hasAny.every((c) => wanted.has(c)),
    );
    if (existing) {
      alreadyPresent++;
      continue;
    }
    const fact = {
      event: 'addMana',
      controller: 'you',
      colors: { hasAny: colors },
      ...(staticText ? { sourceText: staticText, highlight: `{${colors[0]}} or {${colors[1]}}` } : {}),
    };
    synergy.source.push(fact);
    changed = true;
  }
  if (!changed) continue;

  touchedSlugs.push(slug);
  if (!dryRun) {
    await writeFile(synergyPath, JSON.stringify(synergy, null, 2) + '\n', 'utf8');
  }
  written++;
}

console.log(`${dryRun ? '[dry run] would write' : 'wrote'} ${written} synergy.json file(s): ${touchedSlugs.join(', ')}`);
console.log(`${alreadyPresent} face(s) already had a matching addMana fact (untouched), ${skippedNoFile} card(s) skipped (no synergy.json yet).`);
