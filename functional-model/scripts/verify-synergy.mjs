// Reconciles ONE card's own AI-authored cards/<slug>/synergy.json against
// its real, instrumented trace.json — SYNERGY_DESIGN.md's "Step 5", the
// piece that makes AI-authored facts trustworthy instead of just plausible.
// A reconciliation, not a proof of correctness (per the design doc's own
// framing): it catches an AI OMITTING a want the code clearly reads, and an
// AI FABRICATING a want/produce nothing in the trace supports — it cannot
// confirm a filter is exactly right (a `types: {has: [...]}` constraint
// could still be subtly wrong in a way that happens to read the same
// zone/event either way).
//
// Scope, stated plainly rather than silently assumed:
//   - HARD failures (nonzero exit): a declared fact with NO supporting
//     trace evidence at all; an AGGREGATE read (read:getCardsIn/
//     getCreaturesInPlay/getLandsInPlay) with no matching declared want.
//   - SOFT notes (printed, don't fail the run): a produce-relevant ACTION
//     (surveil/animate/equip/tap/dig/gainControl/dealDamage/...) with no
//     matching declared produce. `drawCard`/`drawCards` were promoted off
//     this parked list 2026-09-05 (Elrond, Moon-Reader's own real "draw a
//     card" trigger) — a real, checkable `event: 'drawCard'` produce now,
//     same as gainLife/lifegain. The rest are mechanical/non-resource
//     actions with no fact vocabulary yet — flagging them as fatal would
//     make every real card fail for facts the design doc itself says not
//     to build yet. Low-level per-object predicate reads
//     (read:hasSubtype/isCreature/isLand/isArtifact/isEnchantment/isTapped/
//     getCMC/getCounters/getNetPower/getNetToughness/getAttachedTo/
//     getEquippedBy) are treated as SUPPORTING evidence for whichever
//     zone/type want they happen to back, never independently required to
//     have their own top-level want — same "read ≠ separate fact" reasoning
//     the old staticFactsFor()/factsFor() split used to need, just folded
//     into "any of these counts as corroborating a types/cmc/power/
//     toughness-constrained want," not gated field-by-field.
//
// A card whose synergy.json is still the OLD string-key shape (`{key,
// description}` entries, no `zone`/`event` field — most of the 298-card
// pool as of this writing, not yet migrated to the v2 attribute-bag model)
// is reported as "needs v2 migration" and SKIPPED, not failed — this script
// only ever holds a genuinely v2-shaped file to account.
//
// Usage: npx vite-node functional-model/scripts/verify-synergy.mjs [slug...]
// (no args = every card dir; nonzero exit iff any v2-shaped card has a hard
// failure)

import { readdir, readFile } from 'node:fs/promises';

const cardsDir = new URL('../cards/', import.meta.url);
const requested = process.argv.slice(2);
const slugs = requested.length ? requested : (await readdir(cardsDir, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);

/**
 * `{source:[],sink:[]}` is valid under EITHER schema — most of the pool
 * is still old-model files the now-deleted derive-synergy.mjs happened to
 * derive zero facts for, not real v2 authorship — so an all-empty file is
 * always reported as "not yet authored," never silently treated as a
 * verified-empty v2 card (which would wrongly turn a genuine "nobody has
 * written this card's facts yet" gap into a passing check).
 */
function isV2Shaped(synergy) {
  const all = [...(synergy.source ?? []), ...(synergy.sink ?? [])];
  if (all.length === 0) return false;
  return all.every((f) => 'zone' in f || 'event' in f);
}

// fn -> zone this action produces into, and how to read WHICH side off the
// log entry's own fields (a small, explicit per-fn map — see harness.ts's
// own LogEntry shapes for what each fn actually carries).
function producedZone(entry, cardName) {
  switch (entry.fn) {
    case 'enters':
      return { zone: entry.zone ?? 'Battlefield', side: 'you' };
    case 'move':
      return entry.to ? { zone: entry.to, side: entry.player === 'you' || entry.player === undefined ? 'you' : entry.player.startsWith('opp') ? 'opp' : 'you' } : null;
    case 'moveTo':
      return entry.zone ? { zone: entry.zone, side: sideOfName(entry.target, cardName) } : null;
    case 'createToken':
      return { zone: 'Battlefield', side: entry.controller === 'you' ? 'you' : 'opp' };
    case 'sacrifice':
      return { zone: 'Graveyard', side: entry.player === 'you' ? 'you' : 'opp' };
    case 'discard':
      return { zone: 'Graveyard', side: entry.player === 'you' ? 'you' : 'opp' };
    case 'destroy':
      return { zone: 'Graveyard', side: sideOfName(entry.target, cardName) };
    case 'legendRule':
      return { zone: 'Graveyard', side: 'you' };
    default:
      return null;
  }
}
// fn -> event this action produces, plus its own extra fields (counterType, etc).
// `sacrifice`/`destroy`/`legendRule` produce BOTH a zone fact (Graveyard —
// see producedZone above) and an event fact (`dies`) — the same underlying
// action described two ways, exactly like SYNERGY_DESIGN.md's own "legend
// rule ... counts as a source for a {event:'dies', target:'self'} sink."
function producedEvent(entry, cardName) {
  switch (entry.fn) {
    case 'gainLife':
      return { event: 'lifegain', side: entry.player === 'you' ? 'you' : 'opp' };
    case 'loseLife':
      return { event: 'lifeloss', side: entry.player === 'you' ? 'you' : 'opp' };
    case 'putCounter':
      return { event: 'putCounter', counterType: entry.counterType, side: undefined };
    case 'dealDamage':
      return { event: 'damage', side: 'you' };
    case 'grantKeyword':
      return { event: 'grantKeyword', keyword: entry.keyword, side: undefined };
    case 'sacrifice':
      return { event: 'dies', side: entry.player === 'you' ? 'you' : 'opp' };
    case 'destroy':
      return { event: 'dies', side: sideOfName(entry.target, cardName) };
    case 'legendRule':
      return { event: 'dies', side: 'you' };
    case 'drawCard':
    case 'drawCards':
      // Promoted off SYNERGY_DESIGN.md's own "parked" list (2026-09-05,
      // Elrond, Moon-Reader's own real "draw a card" trigger) — a real,
      // checkable produce now, not just a soft note.
      return { event: 'drawCard', side: entry.player === 'you' ? 'you' : 'opp' };
    case 'moveTo':
      // A real MTG rule, not card-specific: landing on the battlefield always
      // triggers "enters" replacement/triggered abilities (any other zone
      // doesn't) — added for Elrond, Moon-Reader's own exile-then-return
      // activation (2026-09-05), a real blink effect other cards' own
      // `entersBattlefield` sink facts (loporrit-scout, woodland-weavemaster)
      // can now match against, but the case applies pool-wide to any card whose
      // effect moves something onto the battlefield.
      return entry.zone === 'Battlefield' ? { event: 'entersBattlefield', side: sideOfName(entry.target, cardName) } : null;
    default:
      return null;
  }
}
// Best-effort side-of-a-target-NAME heuristic (destroy/putCounter/pump/tap/
// etc. log a bare object name, not a side field) — generated names are
// always prefixed by their owning player's own name (harness.ts's own
// setupPlayer), and `self` is always on the 'you' side in every scenario
// this harness builds. A heuristic, not a proof — matches this script's own
// "reconciliation, not proof" scope.
function sideOfName(name, cardName) {
  if (!name) return 'you';
  if (name.startsWith('opp')) return 'opp';
  if (name.startsWith('you-') || name === cardName) return 'you';
  return 'you';
}

// A small set of fn's this script treats as mechanical/parked — a produce
// action with no fact vocabulary yet (SYNERGY_DESIGN.md explicitly parks
// drawCard; surveil/animate/equip/tap/untap/dig/gainControl/copyPermanent/
// destroyPrevented have no fact vocabulary defined by the design at all) —
// unexplained occurrences of these are noted, never a hard failure.
const PARKED_ACTION_FNS = new Set(['surveil', 'animate', 'equip', 'tap', 'untap', 'dig', 'gainControl', 'copyPermanent', 'destroyPrevented', 'pump']);
// fn's that are pure lifecycle/mechanics, never produce-relevant at all.
// `phase`/`delayUntil` added for turn.ts's real phase-advancement/delayed-
// trigger scheduling (2026-09-05, Elrond, Moon-Reader's own "return at the
// beginning of the next end step") — the actual EFFECT a delayed trigger
// runs (Elrond's own `moveTo`, e.g.) still logs and still needs a produce,
// same as any other action; only the scheduling/phase bookkeeping itself is
// ignored here.
const IGNORED_FNS = new Set(['cast', 'trigger', 'activate', 'phase', 'delayUntil']);

// Per-object predicate reads — corroborating evidence for a TYPE/CMC/etc.
// constraint on some want/produce's target, never independently gated (see
// this file's own header).
const LOW_LEVEL_READ_FNS = new Set([
  'read:hasSubtype',
  'read:hasKeyword',
  'read:isCreature',
  'read:isLand',
  'read:isArtifact',
  'read:isEnchantment',
  'read:isTapped',
  'read:getCMC',
  'read:getCounters',
  'read:getNetPower',
  'read:getNetToughness',
  'read:getAttachedTo',
  'read:getEquippedBy',
]);

function aggregateReadZone(entry) {
  if (entry.fn === 'read:getCardsIn') return entry.zone;
  if (entry.fn === 'read:getCreaturesInPlay') return 'Battlefield';
  if (entry.fn === 'read:getLandsInPlay') return 'Battlefield';
  return null;
}

// A named trigger this card fires is itself evidence for an event-shaped
// want of the matching name — a small, explicit vocabulary (grow only when
// a real card's trigger name needs recognizing), same discipline the old
// factsFor()'s own `trigger` case used.
const TRIGGER_EVENT_MAP = {
  onLifeGained: 'lifegain',
  onDies: 'dies',
  onDealsDamage: 'damage',
  onOtherPermanentsDie: 'dies',
  onOpponentCreatureDies: 'dies',
  onCreatureSacrificed: 'dies',
  onScry: 'scry',
  onSurveil: 'surveil',
  onLandfall: 'landfall',
  onOtherCreatureEnters: 'entersBattlefield',
  onCreatureOrArtifactDies: 'dies',
  onMutantDies: 'dies',
  onOpponentLosesLife: 'lifeloss',
  // Fang, Fearless l'Cie's own trigger name doesn't match its synergy.json
  // event name 1:1 (`onGraveyardCardsLeave` vs. `graveyardLeaves`) — this
  // map's job is exactly that translation, not a naming convention.
  onGraveyardCardsLeave: 'graveyardLeaves',
  // Elrond, Moon-Reader's own real "Whenever you activate an ability of a
  // creature, draw a card" — new event name, first card that needs it.
  onActivateCreatureAbility: 'activateAbility',
  // Woodland Weavemaster's own real "Whenever ANOTHER ELF you control
  // enters" — same underlying event as onOtherCreatureEnters, just
  // subtype-filtered (the filter lives on the fact's own `types`, not the
  // trigger name).
  onOtherElfEnters: 'entersBattlefield',
  // Champions of the Perfect's own real "Whenever you cast a creature
  // spell, draw a card" — same naming convention onCastNoncreatureSpell
  // (shantotto-tactician-magician) already establishes for a cast trigger.
  onCastCreatureSpell: 'castCreatureSpell',
};
// Triggers whose very existence already implies the card left the
// battlefield — the harness deliberately does NOT log a real zone-change
// for these (moving `self` would wipe its own counters via the real 400.7
// rule before the trigger could read them — see harness.ts's own
// `lifecycleBefore`/selfZone comment) — so a `{zone:'Graveyard',
// controller:'you', subject:'self'}` produce fact is verified by the
// TRIGGER firing, not a move/enters line that will never exist.
const DEATH_TRIGGER_NAMES = new Set(['onDies']);

function wantMatchesZoneRead(want, zone) {
  return want.zone === zone;
}

async function verifyCard(slug) {
  const synergyRaw = await readFile(new URL(`${slug}/synergy.json`, cardsDir), 'utf8').catch(() => null);
  if (!synergyRaw) return { slug, skipped: 'no synergy.json' };
  const traceRaw = await readFile(new URL(`${slug}/trace.json`, cardsDir), 'utf8').catch(() => null);
  if (!traceRaw) return { slug, skipped: 'no trace.json (run run-scenarios.mjs)' };

  const synergy = JSON.parse(synergyRaw);
  if (!isV2Shaped(synergy)) return { slug, skipped: 'old (v1) synergy.json shape — needs v2 migration' };

  const cardModule = await import(new URL(`${slug}/definition.ts`, cardsDir)).catch(() => null);
  const card = cardModule ? Object.values(cardModule)[0] : null;
  const cardName = card?.name ?? slug;

  const traces = JSON.parse(traceRaw);
  const allEntries = traces.flatMap((t) => t.log);
  const triggerNames = new Set(allEntries.filter((e) => e.fn === 'trigger').map((e) => e.name));

  const source = synergy.source ?? [];
  const sink = synergy.sink ?? [];

  const failures = [];
  const notes = [];

  // --- Forward: every declared PRODUCE needs supporting trace evidence ---
  for (const p of source) {
    if ('zone' in p) {
      if (p.zone === 'Graveyard' && p.subject === 'self' && [...triggerNames].some((n) => DEATH_TRIGGER_NAMES.has(n))) continue; // see DEATH_TRIGGER_NAMES
      const evidence = allEntries.some((e) => {
        const z = producedZone(e, cardName);
        return z && z.zone === p.zone && (!p.controller || z.side === p.controller);
      });
      if (!evidence) failures.push(`produce {zone:${p.zone}${p.controller ? `,controller:${p.controller}` : ''}} has no supporting trace line (enters/move/moveTo/createToken/sacrifice/discard/destroy/legendRule)`);
    } else {
      const evidence = allEntries.some((e) => {
        const ev = producedEvent(e, cardName);
        return ev && ev.event === p.event && (!p.counterType || ev.counterType === p.counterType) && (!p.controller || !ev.side || ev.side === p.controller);
      });
      if (!evidence) failures.push(`produce {event:${p.event}${p.counterType ? `,counterType:${p.counterType}` : ''}} has no supporting trace line`);
    }
  }

  // --- Forward: every declared WANT needs supporting trace evidence ---
  for (const w of sink) {
    if ('zone' in w) {
      const hasAggregateRead = allEntries.some((e) => aggregateReadZone(e) === w.zone);
      const hasTypedRead = allEntries.some((e) => LOW_LEVEL_READ_FNS.has(e.fn));
      if (!hasAggregateRead && !hasTypedRead) failures.push(`want {zone:${w.zone}} has no read:getCardsIn/getCreaturesInPlay/getLandsInPlay (or per-object type read) anywhere in the trace`);
    } else {
      const triggerEvidence = [...triggerNames].some((n) => TRIGGER_EVENT_MAP[n] === w.event);
      const readEvidence = w.event === 'dies' || w.event === 'lifegain' ? triggerEvidence : false;
      if (!triggerEvidence && !readEvidence) {
        // With/without diff fallback — a scenario pair whose logs differ at
        // all counts as the want being demonstrated (SYNERGY_DESIGN.md's
        // own "with/without diff" check), since this script doesn't know
        // which single setup axis two scenarios intentionally vary.
        const diffFound = traces.length >= 2 && new Set(traces.map((t) => JSON.stringify(t.log))).size > 1;
        if (!diffFound) failures.push(`want {event:${w.event}${w.target ? `,target:${JSON.stringify(w.target)}` : ''}} has no trigger/read evidence and no scenario-pair diff`);
      }
    }
  }

  // --- Reverse: every AGGREGATE read must be explained by a declared want ---
  for (const e of allEntries) {
    const zone = aggregateReadZone(e);
    if (!zone) continue;
    if (!sink.some((w) => 'zone' in w && wantMatchesZoneRead(w, zone))) failures.push(`trace has ${e.fn} on zone ${zone} with no matching declared want`);
  }

  // --- Reverse: every produce-relevant ACTION must be explained (soft) ---
  const explainableFns = new Set(['enters', 'move', 'moveTo', 'createToken', 'sacrifice', 'discard', 'destroy', 'legendRule', 'gainLife', 'loseLife', 'putCounter', 'dealDamage', 'grantKeyword', 'drawCard', 'drawCards']);
  for (const e of allEntries) {
    if (IGNORED_FNS.has(e.fn) || e.fn.startsWith('read:')) continue;
    if (!explainableFns.has(e.fn)) {
      if (!PARKED_ACTION_FNS.has(e.fn)) notes.push(`trace has unrecognized action ${e.fn} — no fact vocabulary for it yet`);
      continue;
    }
    const z = producedZone(e, cardName);
    const ev = producedEvent(e, cardName);
    const zoneOk = z && source.some((p) => 'zone' in p && p.zone === z.zone && (!p.controller || p.controller === z.side));
    const eventOk = ev && source.some((p) => 'event' in p && p.event === ev.event);
    if (!zoneOk && !eventOk) notes.push(`trace has ${e.fn} (${JSON.stringify(e)}) with no matching declared produce`);
  }

  return { slug, cardName, failures, notes };
}

let hardFailures = 0;
let checked = 0;
let skipped = 0;
for (const slug of slugs) {
  const result = await verifyCard(slug);
  if (result.skipped) {
    skipped++;
    continue;
  }
  checked++;
  if (result.failures.length === 0 && result.notes.length === 0) {
    console.log(`OK   ${result.slug}`);
    continue;
  }
  console.log(`${result.failures.length ? 'FAIL' : 'note'} ${result.slug} (${result.cardName})`);
  for (const f of result.failures) console.log(`  ✗ ${f}`);
  for (const n of result.notes) console.log(`  · ${n}`);
  if (result.failures.length) hardFailures++;
}

console.log(`\n${checked} v2 card(s) checked, ${skipped} skipped (no synergy.json/trace.json, or still v1-shaped), ${hardFailures} with hard failures.`);
if (hardFailures > 0) process.exit(1);
