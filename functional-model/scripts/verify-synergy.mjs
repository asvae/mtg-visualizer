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
//     (surveil/equip/dig/...) with no
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
import { manaAbilityColorsFromStaticText } from '../mana.ts';
import { findFabricatedScenarioCardNames } from './scenario-card-names.mjs';
import { findMissingAnnotations, ANNOTATED_CARD_SLUGS } from './annotation-coverage.mjs';

const cardsDir = new URL('../cards/', import.meta.url);
const dataDir = new URL('../../data/', import.meta.url);
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
  // `'to' in f` / `'from' in f` — a SOURCE zone-change fact (2026-09-11
  // rework, synergy.ts's own `ZoneFact` doc comment) may declare `to`/`from`
  // instead of a bare `zone` — still a v2-shaped fact either way.
  return all.every((f) => 'zone' in f || 'to' in f || 'from' in f || 'event' in f);
}

/** `synergy.ts`'s own `effectiveZone` — the zone a `ZoneFact`-shaped JSON
 * entry is really "about," regardless of which shape authored it: a sink's
 * (or a pre-rework source's) plain `zone`, or a rework-shaped source's own
 * `to`. Kept as a small local mirror rather than importing synergy.ts's
 * (TypeScript, not directly importable from this plain-.mjs script without
 * a build step) — same "small stable duplicate" trade this script already
 * accepts elsewhere (see e.g. `ZONE_NOUN` duplicated in app/lib/factConditions.ts). */
function effectiveZone(f) {
  return f.zone ?? f.to;
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
      return entry.zone ? { zone: entry.zone, side: sideOf(entry, cardName) } : null;
    // Real 111.7: a TOKEN target the effect moved off the battlefield never
    // actually reaches `zone` (harness.ts's own `moveTo` logs this instead
    // in that case) — still real evidence the effect DID try to move it
    // there (a card's own declared "returns to hand"-shaped produce fact is
    // about the effect's target zone, not this instantiation's specific
    // token-target consequence), so this counts the same as `moveTo` would.
    case 'ceasesToExist':
      return entry.zone ? { zone: entry.zone, side: sideOf(entry, cardName) } : null;
    case 'createToken':
      return { zone: 'Battlefield', side: entry.controller === 'you' ? 'you' : 'opp' };
    case 'sacrifice':
      return { zone: 'Graveyard', side: entry.player === 'you' ? 'you' : 'opp' };
    case 'discard':
      return { zone: 'Graveyard', side: entry.player === 'you' ? 'you' : 'opp' };
    case 'destroy':
      return { zone: 'Graveyard', side: sideOf(entry, cardName) };
    case 'legendRule':
      return { zone: 'Graveyard', side: 'you' };
    default:
      return null;
  }
}
// fn -> event(s) this action produces, plus its own extra fields (counterType,
// etc). `sacrifice`/`destroy`/`legendRule` produce BOTH a zone fact (Graveyard
// — see producedZone above) and an event fact (`dies`) — the same underlying
// action described two ways, exactly like SYNERGY_DESIGN.md's own "legend
// rule ... counts as a source for a {event:'dies', target:'self'} sink."
// Returns an ARRAY (2026-09-10, Summon: Bahamut's own literal `sacrifice`
// and `destroy` event facts) — `sacrifice`/`destroy` are the fns that
// genuinely back TWO distinct event facts at once (the object dying, AND
// the sacrifice/destroy act itself — CR 701.20a "sacrificing" IS dying by a
// specific cause; CR 701.6 "destroying" likewise), so a single `{event,...}`
// return can no longer represent every fn's real evidence. Every other case
// still returns exactly one, same values as before.
function producedEvents(entry, cardName) {
  switch (entry.fn) {
    case 'gainLife':
      return [{ event: 'lifegain', side: entry.player === 'you' ? 'you' : 'opp' }];
    case 'addMana':
      // Promoted the same way drawCard was (2026-09-05) — see card.ts's
      // own `Effect` doc comment on `addMana` for why this exists as a
      // deliberately inert observation point (no real mana pool).
      return [{ event: 'addMana', side: entry.player === 'you' ? 'you' : 'opp' }];
    case 'loseLife':
      return [{ event: 'lifeloss', side: entry.player === 'you' ? 'you' : 'opp' }];
    case 'putCounter':
      return [{ event: 'putCounter', counterType: entry.counterType, side: undefined }];
    case 'dealDamage':
      return [{ event: 'damage', side: 'you' }];
    case 'grantKeyword':
      return [{ event: 'grantKeyword', keyword: entry.keyword, side: undefined }];
    case 'counter':
      // Log-only (see interfaces.ts's own `counter` doc comment — no real
      // stack/object model exists), but still a real, checkable produce —
      // same "promoted off the parked list" treatment addMana/drawCard got.
      return [{ event: 'counter', side: undefined }];
    case 'sacrifice':
      // BOTH the resulting `dies` (pre-existing) AND the literal `sacrifice`
      // event itself (2026-09-10, Summon: Bahamut's own `self-sacrifice`
      // fact — real Saga "Sacrifice after IV," distinct from the OTHER,
      // already-existing `self-graveyard` zone-change fact on that same
      // card, which is about the DYING consequence, not the sacrifice act —
      // "dying" and "sacrifice" are deliberately kept as separate concepts,
      // 2026-09-11, same distinction `destroy-act`/the dies-consequence
      // fact already keep for the destroy case).
      return [
        { event: 'dies', side: entry.player === 'you' ? 'you' : 'opp' },
        { event: 'sacrifice', side: entry.player === 'you' ? 'you' : 'opp' },
      ];
    case 'destroy':
      // BOTH the resulting `dies` (pre-existing) AND the literal `destroy`
      // event itself (2026-09-10, Summon: Bahamut's own `destroy-act` fact
      // — CR 701.6, the act of destroying, distinct from the `dies`
      // consequence the SAME log line already backs) — same "one action,
      // two simultaneously-true event facts" shape `sacrifice` got above,
      // not a new pattern. Only the literal `fn:'destroy'` line counts as
      // `destroy` evidence — a TOKEN target instead logs `ceasesToExist`
      // (case below), which stays `dies`-only: that log shape is genuinely
      // ambiguous (a `moveTo`-driven token loss to Graveyard, e.g. "put
      // into graveyard," logs identically but isn't a destroy at all), so
      // it's not safe to also credit it as `destroy` evidence.
      return [
        { event: 'dies', side: sideOf(entry, cardName) },
        { event: 'destroy', side: sideOf(entry, cardName) },
      ];
    // A destroyed TOKEN logs `ceasesToExist` instead of `destroy` (harness.ts's
    // own `destroy` — real 700.4/704.5d, it genuinely dies on the way to
    // ceasing to exist) — only when `zone` is 'Graveyard' (a destroy), not
    // when it's some other zone (a BOUNCED token, e.g. Jill's own ETB —
    // that's not a death, 700.4 requires battlefield -> graveyard).
    case 'ceasesToExist': {
      if (entry.zone === 'Graveyard') return [{ event: 'dies', side: sideOf(entry, cardName) }];
      // Same "the effect really did try to move it there, 111.7 ceasing to
      // exist is a downstream consequence of the target being a token, not
      // evidence the effect didn't attempt the move" reasoning `producedZone`
      // already applies for a token's own zone-presence evidence — extended
      // here to the `exile` EVENT specifically (2026-09-12, Phoenix Down's
      // own real "Exile target Skeleton, Spirit, or Zombie" mode, whose own
      // scenario exiles a TOKEN Zombie, so `moveTo`'s own `case 'moveTo'`
      // `exile`-event promotion above never fires for it — this is the
      // sibling case that does).
      if (entry.zone === 'Exile') return [{ event: 'exile', side: sideOf(entry, cardName) }];
      return [];
    }
    case 'legendRule':
      return [{ event: 'dies', side: 'you' }];
    case 'drawCard':
    case 'drawCards':
      // Promoted off SYNERGY_DESIGN.md's own "parked" list (2026-09-05,
      // Elrond, Moon-Reader's own real "draw a card" trigger) — a real,
      // checkable produce now, not just a soft note.
      return [{ event: 'drawCard', side: entry.player === 'you' ? 'you' : 'opp' }];
    case 'playLand':
      // CR 305.1 — harness.ts's own `lifecycleBefore` only emits this for a
      // Land typeLine going through the ordinary (non-trigger/non-ability/
      // non-activation) scenario path, never for an effect that moves a
      // land onto the battlefield some other way (Elven Passage's own
      // `moveTo`-based fetch, e.g.) — this is what actually makes a
      // declared `{event:'playLand'}` produce fact require REAL evidence
      // instead of an assumed label (synergy.ts's own `EventFact` doc
      // comment). Always the scenario's own controller — no FIN scenario
      // plays an opponent's land through this path.
      return [{ event: 'playLand', side: 'you' }];
    case 'moveTo': {
      // A real MTG rule, not card-specific: landing on the battlefield always
      // triggers "enters" replacement/triggered abilities (any other zone
      // doesn't) — added for Elrond, Moon-Reader's own exile-then-return
      // activation (2026-09-05), a real blink effect other cards' own
      // `entersBattlefield` sink facts (loporrit-scout, woodland-weavemaster)
      // can now match against, but the case applies pool-wide to any card whose
      // effect moves something onto the battlefield.
      const events = [];
      if (entry.zone === 'Battlefield') events.push({ event: 'entersBattlefield', side: sideOf(entry, cardName) });
      // Promoted the same way (2026-09-12, Phoenix Down/fin-29's own real
      // "Exile target Skeleton, Spirit, or Zombie" removal mode) — a real
      // CR-recognizable named action (406/CR "exile"), not card-specific;
      // applies pool-wide to any card whose effect moves something into
      // exile via `moveTo`. Checked before promoting: zero real
      // `event:'exile'` facts existed anywhere in the pool prior to this
      // (same "real, documented zero-match new vocabulary usage" situation
      // `pump`'s own promotion was in), so this is zero-risk for every
      // OTHER pool card's own forward evidence checks; it DOES newly
      // surface real `fn:'moveTo', zone:'Exile'` trace lines (43 found
      // pool-wide) as produced-but-unexplained SOFT notes on the reverse
      // "explain every action" check for every other card whose own
      // scenario already exiles something without declaring a matching
      // `event:'exile'` fact — same accepted, documented, note-not-fail
      // side effect `pump`'s own promotion caused pool-wide.
      if (entry.zone === 'Exile') events.push({ event: 'exile', side: sideOf(entry, cardName) });
      return events;
    }
    // A permanent (any card, not just a moveTo-driven blink) actually
    // ENTERING the battlefield — harness.ts's own `lifecycleBefore` and
    // engine-trace.ts's own `pilotCast`/`pilotResolveTop` already log a real
    // `{fn:'enters', zone:'Battlefield', ...}` entry for every permanent
    // that resolves onto the battlefield (producedZone above already reads
    // this fn for the zone-presence side; this is the missing event-fact
    // sibling), same "small missing forward-evidence link" as `cast` below
    // — needed for Summon: Bahamut's own bare `{event:'entersBattlefield',
    // target:'self'}` fact (2026-09-10), the same "this permanent enters,
    // full stop" baseline `self-cast`/`self-dies` already establish for
    // their own events.
    case 'enters':
      return [{ event: 'entersBattlefield', side: 'you' }];
    // A card's own bare "this card itself was cast" source fact (`{event:
    // 'cast', target:'self'}`, added 2026-09-10 for Summon: Bahamut,
    // fin/1 — synergy.ts's own `describeFact` comment on `event === 'cast'`)
    // — harness.ts's own `lifecycleBefore` (and engine-trace.ts's own
    // `pilotCast`) already log a real `{fn:'cast', ...}` entry for every
    // non-Land cast with no `controller`/`player` field at all (it's always
    // the scenario's own 'you' pilot casting the card under test, same as
    // `playLand`'s own unconditional `side:'you'` immediately above), so
    // this is the small missing forward-evidence link, not a new want-side
    // `TRIGGER_EVENT_MAP` entry — this is a PRODUCE fact, not a trigger-
    // backed want, and no trigger name is involved at all. `IGNORED_FNS`
    // already has `cast` (it's mechanical, never itself a produce ACTION
    // worth a reverse "explain every action" soft-note — see that set's own
    // comment), but that only gates the REVERSE check below, not this
    // forward one; a declared `{event:'cast'}` source fact still needs its
    // own evidence path here same as any other event fact.
    case 'cast':
      return [{ event: 'cast', side: 'you' }];
    // Promoted off `PARKED_ACTION_FNS` (2026-09-11, user's own explicit
    // ask: "we need it, otherwise fin8 [Auron's Inspiration] pretty much
    // does nothing") — a deliberately GENERIC catch-all for a real P/T-boost
    // effect (`kind:'pumpAll'|'pumpTarget'|'pumpSelf'`, all already real/
    // executable via `actions.pump`/`state.pump`, card.ts's own layer-7
    // machinery), not a detailed amount/duration/permanence vocabulary — see
    // synergy.ts's own `Fact.event` doc comment for the full "catch-all, not
    // a new sub-vocabulary" scope. `harness.ts`'s own `loggingActions.pump`
    // logs a bare object NAME (`target`), not a `player`/`controller` field
    // — same shape `sacrifice`/`destroy` above already handle, so this
    // reuses `sideOf`'s own name-guessing fallback rather than a new one.
    case 'pump':
      return [{ event: 'pump', side: sideOf(entry, cardName) }];
    // Adelbert Steiner's own real, live-recalculated layer-7a CDA
    // (`effectivePT`, card.ts's own `ptFormula`) has no discrete `pump`
    // ACTION to log at all — a CDA is a pure read, recomputed from current
    // board state every time P/T is checked, not a timestamped delta
    // `state.pump` would create (see `effectivePT`'s own doc comment). Its
    // own scenario logs this real `read:getNetPower` line specifically to
    // demonstrate the recalculation for real (2026-09-11) — treated as
    // equivalent produce evidence for a `pump` fact, same "a real low-level
    // read backs a produce/want it corroborates" reasoning this file's own
    // header already establishes for zone/type reads, just extended to this
    // one event shape (unique to this card today — grep confirms no other
    // scenario logs this fn).
    case 'read:getNetPower':
      return [{ event: 'pump', side: undefined }];
    // Ashe, Princess of Dalmasca's own real "Whenever Ashe attacks" —
    // genuinely new event vocabulary (2026-09-11): NOTHING in the pool has
    // ever declared an `attacks` fact before (checked, zero precedent
    // either role). Real trace evidence already existed and needed no new
    // scenario work — `pilotDeclareAttackers` (engine-trace.ts) already
    // logs a real `{fn:'attack', card}` line per real declared attacker
    // (508.1). Scoped to `entry.card === cardName` (stricter than the
    // `sideOf` heuristic every other case here uses) since this fact is
    // specifically self-referencing (`target:'self'`) — only THIS card's
    // own attack should count, not some other creature's in the same
    // scenario.
    case 'attack':
      return entry.card === cardName ? [{ event: 'attacks', side: 'you' }] : [];
    // Promoted off `PARKED_ACTION_FNS` (2026-09-11, Coeurl/fin-12's own real
    // "{1}{W}, {T}: Tap target nonenchantment creature." — the first card in
    // the pool whose own EFFECT, not just its activation cost, is a tap).
    // `loggingActions.tap` (harness.ts) logs a bare object NAME (`target`),
    // same shape `destroy`/`pump` already handle, so this reuses `sideOf`'s
    // own name-guessing fallback rather than a new one. Deliberately does
    // NOT fire for a `{T}` ACTIVATION COST payment — `engine.ts`'s own
    // `activateAbility` pays that via a bare `engine.state.tap(permanent)`
    // call with no `loggingActions.tap`/no log line at all (checked), so
    // every real `fn:'tap'` trace line is genuinely the ability's own tap
    // EFFECT, never cost payment double-counted as a produce.
    case 'tap':
      return [{ event: 'tap', side: sideOf(entry, cardName) }];
    // Promoted off `PARKED_ACTION_FNS` (2026-09-12, Magitek Armor/fin-24's
    // own real Crew-triggered "becomes an artifact creature until end of
    // turn") — `loggingActions.animate` (harness.ts) logs a real `types`
    // array (the full new type list `actions.animate(ctx.self, effect.types)`
    // applies, e.g. `['Artifact', 'Creature']`), giving REAL per-type
    // evidence, unlike the still-genuinely-inert Dragoon's Lance/Machinist's
    // Arsenal `grantType` facts (their own equip-broadcast type grant has NO
    // execution path at all — `animate` only ever self-targets, see card.ts's
    // own dispatch — so those two cards keep their own by-name exemptions
    // just below rather than gaining false evidence from this promotion).
    // One `grantType` event PER type in the array (not one combined fact) so
    // a fact naming just the meaningful NEW type (Magitek Armor's own
    // `type: 'Creature'` — the `Artifact` half is a redundant restatement,
    // never separately declared) still finds its own real match.
    case 'animate':
      return (entry.types ?? []).map((t) => ({ event: 'grantType', type: t, side: undefined }));
    // A card's own Crew-cost activation (2026-09-12, Magitek Armor/fin-24)
    // — `harness.ts`'s own activationCost lifecycle already logs a real
    // `{fn:'activate', cost: card.activationCost, ...}` line for ANY
    // activated ability (`IGNORED_FNS` already has `'activate'`, but — same
    // as `cast` above — that only gates the REVERSE "explain every action"
    // check, not this forward one). Scoped to a real printed "Crew N" cost
    // prefix (this model's own established convention for representing Crew,
    // `crewCost` + a matching `activationCost` label string — see
    // magitek-armor/the-lunar-whale/the-prima-vista's own `definition.ts`
    // comments) rather than a blanket "any activation is a crew" reading,
    // which would be wrong for every other activated-ability card in the
    // pool.
    case 'activate':
      return typeof entry.cost === 'string' && /^Crew\s/.test(entry.cost) ? [{ event: 'crew', side: 'you' }] : [];
    // Promoted off `PARKED_ACTION_FNS` (2026-09-12, Stiltzkin, Moogle
    // Merchant/fin-34's own real "{2}, {T}: Target opponent gains control
    // of another target permanent you control. If they do, you draw a
    // card.") — `harness.ts`'s own `loggingActions.gainControl` already
    // logs a real `{fn:'gainControl', controller, target, id}` line
    // (`state.ts`'s real `RealPlayer.gainControl` via the real
    // `Actions.gainControl`, interfaces.ts) for every real control change —
    // this was purely a Fact-vocabulary gap, not an engine gap (`gainControl`
    // was already wired and exercised by stolen-uniform/unexpected-request/
    // zidane-tantalus-thief's own effects, just never claimable as evidence).
    // `side` hardcoded 'you', NOT derived from `entry.controller` (which
    // names the RECIPIENT of the new control, e.g. 'opp0' for Stiltzkin's
    // own trace — the opposite of what `side` needs to mean here) — same
    // "always the scenario's own controller" reasoning `cast`/`playLand`
    // already use: every gainControl-causing card in this pool is always
    // activated/cast/triggered by the 'you' pilot in every real scenario.
    // `entry.controller` (the real recipient) is exactly what a fact's own
    // `recipient` field carries instead — deliberately NOT read here, since
    // `recipient` is purely descriptive (see synergy.ts's own doc comment)
    // and not part of this reconciliation.
    case 'gainControl':
      return [{ event: 'gainControl', side: 'you' }];
    default:
      return [];
  }
}
// Best-effort side-of-a-target-NAME heuristic (destroy/putCounter/pump/tap/
// etc. log a bare object name, not a side field) — generated PLACEHOLDER
// names are always prefixed by their owning player's own name (harness.ts's
// own setupPlayer), and `self` is always on the 'you' side in every
// scenario this harness builds. A heuristic, not a proof — matches this
// script's own "reconciliation, not proof" scope. Doesn't work at all for a
// REAL, unprefixed card/token name (`PlayerState.tokens`'s own doc comment)
// — `sideOf` below is the real fix for those; this stays only as the
// fallback for the fn's `sideOf` doesn't cover yet.
function sideOfName(name, cardName) {
  if (!name) return 'you';
  if (name.startsWith('opp')) return 'opp';
  if (name.startsWith('you-') || name === cardName) return 'you';
  return 'you';
}
// Real controller (harness.ts's own `moveTo`/`destroy` now log one,
// 2026-09-06) when present, falling back to the name-guessing heuristic
// above for any entry shape that doesn't carry it yet.
function sideOf(entry, cardName) {
  if (entry.controller !== undefined) return entry.controller === 'you' ? 'you' : 'opp';
  return sideOfName(entry.target, cardName);
}

// A small set of fn's this script treats as mechanical/parked — a produce
// action with no fact vocabulary yet (SYNERGY_DESIGN.md explicitly parks
// drawCard; surveil/animate/equip/tap/untap/dig/gainControl/copyPermanent/
// destroyPrevented have no fact vocabulary defined by the design at all) —
// unexplained occurrences of these are noted, never a hard failure.
// `pump` REMOVED (2026-09-11) — promoted to real fact vocabulary
// (`producedEvents`'s own `case 'pump'`/`case 'read:getNetPower'` above),
// same "parked -> real" promotion `drawCard`/`addMana`/`counter` already
// got; see this set's own header comment just above for the ones still
// genuinely unmodeled. `tap` REMOVED same day, later still (Coeurl/fin-12)
// — same promotion, `producedEvents`'s own `case 'tap'` above. `animate`
// REMOVED 2026-09-12 (Magitek Armor/fin-24) — promoted to real `grantType`
// fact vocabulary, `producedEvents`'s own `case 'animate'` above.
// `gainControl` REMOVED 2026-09-12, later still (Stiltzkin, Moogle
// Merchant/fin-34) — promoted to real fact vocabulary, `producedEvents`'s
// own `case 'gainControl'` above.
const PARKED_ACTION_FNS = new Set(['surveil', 'equip', 'untap', 'dig', 'copyPermanent', 'destroyPrevented']);
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
  // Ultima, Origin of Oblivion's own real "Whenever you tap a land for {C},
  // add an additional {C}." — a genuinely new event shape (`addMana`) for a
  // NAMED trigger (every other `addMana` fact in the pool is the plain,
  // unrestricted "{T}: Add X." static-text shape `staticManaColorsFor`
  // already exempts from evidence entirely — this is the first card whose
  // addMana fact is behind an actual triggered ability instead).
  onTapLandForC: 'addMana',
  // Ashe, Princess of Dalmasca's own real "Whenever Ashe attacks" —
  // genuinely new SINK vocabulary (`event:'attacks'`, 2026-09-11): the
  // FIRST card in the pool to ever declare a want for this event (checked
  // — `attacks` had zero precedent either role before this). Real
  // evidence: this card's own scenario already logs a real
  // `{fn:'attack', card:...}` line (508.1, via `pilotDeclareAttackers`)
  // immediately followed by the real `{fn:'trigger', name:'onAttack'}`
  // bracket this maps off of — same causal-order reasoning every other
  // trigger-backed want here already relies on.
  onAttack: 'attacks',
  // Cloud, Midgar Mercenary's own real "When Cloud enters" — genuinely
  // new use of an EXISTING event string (`entersBattlefield` already
  // exists pool-wide as a SOURCE, but had zero precedent as a SINK before
  // this, 2026-09-11). Real evidence: this card's own scenario already
  // logs a real `{fn:'trigger', name:'onEnter'}` bracket (`pilotResolveTop`'s
  // own real 603.6b auto-fire log, engine-trace.ts) — no scenario change
  // needed.
  onEnter: 'entersBattlefield',
  // Venat, Heart of Hydaelyn's own real "Whenever you cast a legendary
  // spell, draw a card" — DELIBERATELY mapped to the generic `'cast'` event
  // name, not a bespoke `castLegendarySpell` string the way
  // `onCastCreatureSpell`/`onCastNoncreatureSpell` above are: this is the
  // first real card to exercise `factsInteract`'s own `Constraints`-shaped
  // event `target` branch (synergy.ts's `Fact.event` doc comment already
  // documents it as real, wired, matcher code — "rare — none of today's
  // cards need it," until now), which checks the PRODUCER's own resolved
  // `subject` against the sink's `target:{types:{has:['Legendary']}}`
  // filter directly, rather than needing a differently-named event per
  // spell-type variant. Real evidence: this card's own scenario casts a
  // real second legendary spell (Freya Crescent) while Venat is already on
  // the battlefield, then manually fires this trigger right after —
  // `pilotFireTrigger` logs the real `{fn:'trigger', name:
  // 'onCastLegendarySpell'}` bracket this maps off of.
  onCastLegendarySpell: 'cast',
};
// Triggers whose very existence already implies the card left the
// battlefield — the harness deliberately does NOT log a real zone-change
// for these (moving `self` would wipe its own counters via the real 400.7
// rule before the trigger could read them — see harness.ts's own
// `lifecycleBefore`/selfZone comment) — so a `{zone:'Graveyard',
// controller:'you', subject:'self'}` produce fact is verified by the
// TRIGGER firing, not a move/enters line that will never exist.
const DEATH_TRIGGER_NAMES = new Set(['onDies']);

/**
 * A plain, unrestricted `"{T}: Add {X}."` (single-color) or
 * `"{T}: Add {X} or {Y}."` (choice-of-color) static-ability STRING
 * (`mana.ts`'s own `manaAbilityColorsFromStaticText`) never produces
 * its own trace line — card.ts/harness.ts only ever log a real `addMana` fn
 * when the ability is ALSO modeled as a structured `{kind:'addMana', ...}`
 * Effect with a matching `activationCost` (Elvish Archdruid's own
 * "for each Elf you control" shape, which DOES get exercised through a
 * real scenario and so keeps needing real trace evidence below). A plain
 * mana-tapping land/artifact has no such scenario to write — the ability's
 * own existence is already fully verifiable by reading `definition.ts`
 * directly, same "known statically, no trace needed" treatment
 * `DEATH_TRIGGER_NAMES` above already gets. Returns every color recognized
 * across BOTH faces (a two-faced card's front/back can each have their own)
 * — a choice-of-color ability contributes BOTH its colors, since the
 * prefill script declares one `addMana` fact per color for that shape (see
 * prefill-mana-facts.mjs's own header for why).
 *
 * Also recognizes crossroads-village's own unique real pair — "As this land
 * enters, choose a color." (a real `K:ETBReplacement:Other:ChooseColor`)
 * plus "{T}: Add one mana of the chosen color." — as the SAME "known
 * statically, no trace needed" shape, just widened to all five colors since
 * the choice is genuinely unconstrained (any of W/U/B/R/G) rather than a
 * fixed pair; `manaAbilityColorsFromStaticText` itself deliberately doesn't
 * parse this phrasing (it only recognizes an exact printed color symbol or
 * pair, not "the chosen color"), so this stays a narrow addition here rather
 * than widening that function's own documented WUBRG-symbol-only scope.
 * Checked: this exact "chosen color" phrasing appears on no other card in
 * the pool, so this is safely scoped to that one real card, not a general
 * pattern that could misfire elsewhere.
 */
const WUBRG = ['W', 'U', 'B', 'R', 'G'];
function staticManaColorsFor(card) {
  const colors = new Set();
  for (const c of manaAbilityColorsFromStaticText(card?.staticAbilities)) colors.add(c);
  for (const c of manaAbilityColorsFromStaticText(card?.backFace?.staticAbilities)) colors.add(c);
  const abilities = [...(card?.staticAbilities ?? []), ...(card?.backFace?.staticAbilities ?? [])];
  if (abilities.some((t) => t === '{T}: Add one mana of the chosen color.')) {
    for (const c of WUBRG) colors.add(c);
  }
  return colors;
}

/**
 * A land (typeLine includes 'Land') with NO declarative `effects`,
 * `triggers`, `activationCost`, or `modal` at all — every real ability is
 * static text only (an unrecognized mana ability, Cycling, Hideaway, a
 * turn-count-gated conditional ETB-tap, ... — see each such card's own
 * definition.ts comment for why). Its baseline `{zone:'Battlefield',
 * controller:'you', subject:'self'}` fact — "this permanent is on your
 * battlefield" — is true by construction the instant it resolves; there is
 * no card-specific behavior left for a scenario to exercise or a trace to
 * misrepresent, same "known statically" reasoning `staticManaColorsFor`
 * above already gets for plain mana text. Checked the real FIN land pool:
 * 6 cards are fully static-text-only this way (cavern-of-souls,
 * capital-city, clive-s-hideaway, starting-town, eclipsed-realms,
 * willowrush-verge) — a land with ANY real declarative effect/trigger/
 * activation (ETB-tap, sacrifice-for-value, Adventure, transform, mill,
 * search-and-fetch, ...) does NOT qualify; those are exactly the
 * genuinely card-specific shapes a scenario/trace is still the only way to
 * reconcile. Deliberately scoped to Land here (the user's own ask), not
 * generalized to every permanent type, even though the same reasoning
 * would apply to a fully-vanilla creature too.
 */
function isStaticOnlyLand(card) {
  if (!card || !/\bLand\b/.test(card.typeLine ?? '')) return false;
  return !card.effects && !card.triggers && !card.activationCost && !card.modal;
}

/**
 * A permanent whose own `definition.ts` carries a top-level
 * `activationCost` (Coeurl/fin-12's own "{1}{W}, {T}: Tap target
 * nonenchantment creature." — the FIRST card in the migrated pool shaped
 * this way; checked fin/1-11, none of them have one) — `lifecycleBefore`
 * (harness.ts) ALWAYS takes the `card.activationCost` branch for such a
 * card (`{fn:'activate', ...}`), regardless of what any given scenario
 * declares (engine.ts's own comment, line ~315: "a permanent with its OWN
 * `activationCost` reserves `card.effects`..."/"...as an ACTIVATION, never
 * a [cast]"). So NO scenario for this card can EVER produce a real
 * `fn:'cast'`/`fn:'enters'` trace line — structurally, not merely because
 * none of its own scenarios happen to exercise one; the harness has no
 * scenario field that bypasses this branch. A baseline
 * `{event:'cast', ...}`/`{to:'Battlefield', subject:'self', ...}` fact on
 * such a card is still TRUE (CR 601/603.6b — the permanent unconditionally
 * was cast from hand and entered the battlefield before its own activated
 * ability could ever be activated in the first place) — just unverifiable
 * by this harness's own scenario mechanics, same "known statically, no
 * trace needed" treatment `isStaticOnlyLand` above already gets for an
 * unrelated (land-specific) harness gap. Scoped to `subject:'self'`/
 * `target:'self'` baseline facts only, same self-referencing narrowing
 * every other exemption here already applies — a differently-shaped fact
 * on an activationCost permanent (some other card/zone/event) still needs
 * real evidence.
 */
function isActivationCostPermanentBaselineFact(p, card) {
  return !!card?.activationCost && (p.subject === 'self' || p.target === 'self');
}

/**
 * A land's own `onEnter` trigger containing the real, mechanically-
 * identical "enters tapped" replacement effect this model uses across 17
 * real FIN Town-cycle lands (grep `kind: 'tapTarget', validType: 'land',
 * owner: 'you'` across `cards/*\/definition.ts`) — self is already on the
 * battlefield by the time a named trigger's own effects run (harness.ts's
 * own selfZone rule), so this pool-based tap finds exactly self as long as
 * no OTHER land is set up for 'you' in a given scenario; treno-dark-city's
 * own definition.ts comment is the canonical citation. Checked both faces
 * (a transforming land's back face could in principle carry its own).
 */
function hasStaticLandTapSelfTrigger(card) {
  const triggers = [...(card?.triggers ?? []), ...(card?.backFace?.triggers ?? [])];
  return triggers.some((t) => (t.effects ?? []).some((e) => e.kind === 'tapTarget' && e.validType === 'land' && e.owner === 'you'));
}

/**
 * The SOURCE-side counterpart to `hasStaticLandTapSelfTrigger` above: the
 * same `tapTarget`/`validType:'land'`/`owner:'you'` onEnter trigger IS the
 * real card's own "enters tapped" replacement (each of the 17 Town-cycle
 * lands' own `definition.ts` comment cites this — e.g. treno-dark-city's
 * "This land enters tapped" real script text). A card carrying that trigger
 * shape needs no trace/scenario evidence for its own `{event:
 * 'entersBattlefield', subject:'self', tapped:true}` produce fact — its
 * mere presence already proves the fact, same "known statically" treatment
 * the sink side and `isStaticOnlyLand`/`DEATH_TRIGGER_NAMES` above already
 * get. Scoped narrowly to `subject:'self'`/`controller:'you'`/`tapped:true`
 * — a differently-shaped `entersBattlefield` fact (some other permanent
 * entering, no `tapped`, an opponent's side, ...) still needs real evidence.
 */
function isLandEntersTappedSelfFact(p, card) {
  return (
    p.event === 'entersBattlefield' &&
    p.subject === 'self' &&
    p.tapped === true &&
    (!p.controller || p.controller === 'you') &&
    hasStaticLandTapSelfTrigger(card)
  );
}

/**
 * The one real WANT `hasStaticLandTapSelfTrigger` above statically
 * explains: `tapTarget`'s own `validType: 'land'` IS "needs a land on the
 * battlefield to tap" — a plain, unconstrained `{zone:'Battlefield',
 * types:{has:['Land']}}` want, never narrower (a cmc/power-constrained
 * variant is a DIFFERENT, genuinely card-specific want this doesn't
 * cover). Matches every one of the 17 real cards' own declared sink fact
 * for this trigger shape (checked).
 */
function isLandTapSelfWant(w) {
  return (
    w.zone === 'Battlefield' &&
    (!w.controller || w.controller === 'you') &&
    w.types &&
    Array.isArray(w.types.has) &&
    w.types.has.length === 1 &&
    w.types.has[0] === 'Land' &&
    !w.types.hasAny &&
    !w.types.not &&
    w.cmc === undefined
  );
}

/**
 * A plain land's own `{event:'playLand', subject:'self'}` produce fact —
 * "I get played, from hand, when someone plays me" — is just as
 * tautologically true-by-construction as `isStaticOnlyLand`/
 * `isLandEntersTappedSelfFact` above: nothing about a Land-typeLine card's
 * OWN definition.ts is ambiguous about how IT specifically reaches the
 * battlefield, so no scenario/trace is needed to prove it for THIS card.
 * Scoped narrowly to `subject:'self'` (and `controller` unset or 'you') on a
 * card whose own typeLine actually includes Land — the real risk this
 * fact's evidence requirement guards against is a DIFFERENT card fetching/
 * putting a land OTHER than itself onto the battlefield without going
 * through CR 305 at all (cards/elven-passage's own library fetch, e.g.) —
 * that card's own synergy.json simply never declares a `playLand` fact in
 * the first place, so this exemption never applies there; it only ever
 * short-circuits a land's own self-referential fact.
 */
function isSelfPlayableLand(p, card) {
  return p.event === 'playLand' && p.subject === 'self' && (!p.controller || p.controller === 'you') && /\bLand\b/.test(card?.typeLine ?? '');
}

/**
 * The zone-fact counterpart to `isSelfPlayableLand` above, added the same
 * pass (2026-09-09) for the same reason: a Land-typeLine card's own bare,
 * unconstrained `{zone:'Battlefield', subject:'self'}` "battlefield
 * presence" fact is tautologically true the instant it resolves — CR
 * 305.4/601.2i, no replacement effect in this pool redirects a played land
 * anywhere else — regardless of what OTHER abilities the card has. Unlike
 * `isStaticOnlyLand` above (which deliberately stays conservative and
 * requires NO triggers/effects/activation/modal at all, since it's really
 * asking "is there anything card-specific left to verify"), this predicate
 * asks a narrower question — "will resolving ever fail to put THIS card on
 * the battlefield" — which stays "no" even for a card with an onEnter
 * trigger or a mana ability (Vector, Imperial Capital's own tap-self +
 * choice-of-color abilities, e.g.): neither changes whether the permanent
 * itself ends up on the battlefield. Scoped narrowly the same way — bare
 * `{zone:'Battlefield', subject:'self'}` only (`hasAnyConstraint` false — a
 * types/cmc/power/toughness/name-qualified zone fact is a DIFFERENT, more
 * specific claim this doesn't cover), and only for a card whose own
 * typeLine actually includes Land.
 */
function isSelfBattlefieldPresenceLand(p, card) {
  const unconstrained = !p.types && p.cmc === undefined && p.power === undefined && p.toughness === undefined && !p.name;
  return p.zone === 'Battlefield' && p.subject === 'self' && (!p.controller || p.controller === 'you') && unconstrained && /\bLand\b/.test(card?.typeLine ?? '');
}

/**
 * The-Gold-Saucer-shaped `{event:'coinFlip'}` produce fact — about the FLIP
 * itself happening, never its win/lose OUTCOME (a real Treasure token only
 * sometimes gets created, genuinely unmodeled here — no coin-flip mechanism
 * exists anywhere in this model, see that card's own definition.ts comment
 * — but the flip itself is a different, tautologically-guaranteed claim:
 * activating an ability whose own printed text literally says "Flip a
 * coin" always performs that flip, 100% of the time, same "known
 * statically, no trace needed" treatment `isSelfPlayableLand`/
 * `isLandEntersTappedSelfFact` already get for a different guaranteed-by-
 * construction claim). Checked against the real pool: The Gold Saucer is
 * the only card with a coin-flip ability at all (2026-09-09) — scoped this
 * narrowly (an exact printed "Flip a coin" substring in the card's own
 * `activationCost`+effects-bearing ability text or plain `staticAbilities`)
 * on purpose, not a speculative general mechanism nobody has asked for yet.
 */
function hasCoinFlipAbility(card) {
  const texts = [card?.activationCost, ...(card?.staticAbilities ?? [])].filter(Boolean);
  return texts.some((t) => /Flip a coin/i.test(t));
}
function isCoinFlipFact(p, card) {
  return p.event === 'coinFlip' && (!p.controller || p.controller === 'you') && hasCoinFlipAbility(card);
}

/**
 * A produce fact (zone- or event-shaped, either one) about a TOKEN this
 * card's own coin-flip ability can create — same "the connection is real
 * regardless of whether any single activation actually lands" stance
 * `isCoinFlipFact` above already gets, extended from the flip itself to the
 * token it can produce (The Gold Saucer's own Treasure, e.g.): no
 * coin-flip/random-outcome mechanism exists anywhere in this model, so no
 * scenario could EVER log a real `createToken` for it — the harness never
 * executes a coin-flip-gated effect at all, there's nothing to write a
 * scenario against. Deliberately gated on `hasCoinFlipAbility` specifically
 * — NOT a general "any token-creation ability text is exempt" rule, which
 * would be far too broad (a card whose token creation IS a real, resolvable
 * `effects`/`triggers` `createToken` call — zanarkand-ancient-metropolis-
 * lasting-fayth's own Hero token, gysahl-greens' own Chocobo, etc. — still
 * needs genuine scenario/trace evidence, same as always; only a
 * genuinely un-mechanizable coin-flip outcome gets this pass). Checked: The
 * Gold Saucer is the only coin-flip card in the whole pool, so this only
 * ever applies to its own Treasure-token facts today.
 */
function isCoinFlipTokenSubjectFact(p, card) {
  return !!(p.subject && typeof p.subject === 'object' && 'token' in p.subject && (!p.controller || p.controller === 'you') && hasCoinFlipAbility(card));
}

/**
 * A "wants an artifact to sacrifice" sink fact for a card whose own printed
 * `activationCost` requires sacrificing an artifact (Forge's own `Cost$ ...
 * Sac<N/Artifact...>`), where — unlike ahriman/phantom-train/
 * quina-qu-gourmet/sidequest-hunt-the-mark's own back face, which all model
 * their matching sacrifice cost as a real `{kind:'sacrifice'}` effect (the
 * "cost modeled as effect #1 for trace visibility" convention `engine.ts`'s
 * own `unsupportedCostComponent` doc comment describes), giving real
 * `read:isArtifact`/`sacrifice` trace evidence through harness.ts's own
 * `actions.sacrifice` — this card's sacrifice is COST-ONLY: never modeled
 * as a real effect at all, so the harness's scripted scenario runner never
 * calls `actions.sacrifice` (or reads any artifact) for it, and no trace
 * evidence for this want could ever exist. The WANT itself is still
 * tautologically real regardless — paying the printed cost genuinely
 * requires an artifact to exist, whether or not THIS engine can actually
 * pay it — same "known statically, no trace needed" treatment
 * `isLandTapSelfWant`/`hasStaticLandTapSelfTrigger` already get for a
 * different structural cost requirement. Checked the real pool: The Gold
 * Saucer and sidequest-catch-a-fish-cooking-campsite's own back face
 * (Cooking Campsite) are the only two cards with this exact
 * cost-only-sacrifice-an-artifact shape (cooking-campsite's own
 * `knownGaps` already documents it as unmodeled, unresolved as of this
 * writing) — scoped to an exact "Sacrifice a/an/two artifact(s)" cost
 * substring (not "creature or artifact," not another card's differently-
 * worded cost) since that's the only variant either of these two real
 * cards actually has; checks both faces the same way `staticManaColorsFor`
 * does, for the same reason (a transforming/Adventure card's real ability
 * can live on either one).
 */
function hasCostOnlyArtifactSacrifice(card) {
  const faces = [card, card?.backFace].filter(Boolean);
  return faces.some((face) => {
    const cost = face.activationCost ?? '';
    if (!/Sacrifice (a|an|two) artifacts?\b/i.test(cost)) return false;
    return !(face.effects ?? []).some((e) => e.kind === 'sacrifice');
  });
}
function isCostOnlyArtifactSacrificeWant(w, card) {
  return (
    // `effectiveZone` (not a bare `w.zone` read) so this also recognizes a
    // v2-migrated sink's own `to:'Battlefield'` spelling, not just the
    // legacy `zone` field this check was first written against (same
    // `zone`→`to` fold `isCrewCostCreatureWant` just above already applies)
    // — sidequest-catch-a-fish-cooking-campsite's own back-face sink is the
    // first real v2-shaped fact to hit this exemption.
    effectiveZone(w) === 'Battlefield' &&
    (!w.controller || w.controller === 'you') &&
    w.types &&
    Array.isArray(w.types.has) &&
    w.types.has.length === 1 &&
    w.types.has[0] === 'Artifact' &&
    !w.types.hasAny &&
    !w.types.not &&
    hasCostOnlyArtifactSacrifice(card)
  );
}

/**
 * A `crewCost`-bearing card's own tautological "wants a creature you
 * control on the battlefield" sink (2026-09-12, Magitek Armor/fin-24) — CR
 * 702.121b crewing genuinely, unconditionally requires tapping creatures
 * you control with total power >= `crewCost`, real regardless of whether
 * this engine's own simplified `activationCost` scenario lifecycle
 * (`harness.ts`) actually simulates a `crewedBy` creature list and logs a
 * per-creature read for it (it doesn't — the scenario harness just logs a
 * bare `fn:'activate'` + runs `card.effects`, unlike `engine.ts`'s own real
 * `canActivateAbility`/`activateAbility` crewedBy path, ENGINE_DESIGN.md's
 * "Crew" section) — same "known statically, no trace needed" treatment
 * `isLandTapSelfWant`/`isCostOnlyArtifactSacrificeWant` already get for a
 * different structural cost requirement. Scoped to the exact real want
 * shape every such fact should have (`Battlefield`, `you`, `types:{has:
 * ['Creature']}` only, no narrower/broader constraint) rather than any
 * `crewCost` card's arbitrary Battlefield-creature want, so a real,
 * DIFFERENT creature-shaped want on a crewCost card (none exist in the
 * pool today, but the exemption shouldn't over-match if one ever does)
 * still gets checked for real evidence.
 */
function isCrewCostCreatureWant(w, card) {
  return (
    !!card?.crewCost &&
    effectiveZone(w) === 'Battlefield' &&
    (!w.controller || w.controller === 'you') &&
    w.types &&
    Array.isArray(w.types.has) &&
    w.types.has.length === 1 &&
    w.types.has[0] === 'Creature' &&
    !w.types.hasAny &&
    !w.types.not
  );
}

/**
 * The PRODUCE-side sibling of `isCostOnlyArtifactSacrificeWant` above,
 * added the same day for The Gold Saucer's own real `{event:'sacrifice',
 * types:{has:['Artifact']}}` fact — the ACT of sacrificing (paying the
 * cost) is just as tautologically real-by-construction as the sink fact
 * already is: a card whose own printed `activationCost` requires
 * sacrificing an artifact performs that sacrifice every time the ability
 * resolves, whether or not THIS engine's `resolveCard` actually executes a
 * real `{kind:'sacrifice'}` effect for it (see `hasCostOnlyArtifactSacrifice`'s
 * own doc comment for why no trace evidence could ever exist for a
 * cost-only sacrifice). Reuses the exact same `hasCostOnlyArtifactSacrifice`
 * predicate — same two real cards qualify (The Gold Saucer,
 * sidequest-catch-a-fish-cooking-campsite's own back face) — scoped the
 * same narrow way: exactly `{event:'sacrifice', types:{has:['Artifact']}}`,
 * not a broader "any sacrifice event is exempt" (a card whose sacrifice IS
 * modeled as a real effect — ahriman/phantom-train/quina-qu-gourmet/
 * sidequest-hunt-the-mark's own back face — still needs genuine
 * scenario/trace evidence for its own `sacrifice` fact, same as always).
 */
function isCostOnlyArtifactSacrificeFact(p, card) {
  // A v2-migrated SOURCE fact's own type filter lives under `target`, not
  // bare `types` (`Constraints` only appears at the top level on a SINK —
  // see synergy.ts's own `Fact` doc comment) — `types` here is kept only
  // for backward compatibility with a legacy v1-shaped fact predating that
  // convention. sidequest-catch-a-fish-cooking-campsite's own back-face
  // `{event:'sacrifice', target:{types:{has:['Artifact']}}}` fact is the
  // first (and, checked, only) real fact to hit the `target` branch.
  const types = p.types ?? (p.target && typeof p.target === 'object' ? p.target.types : undefined);
  return (
    p.event === 'sacrifice' &&
    (!p.controller || p.controller === 'you') &&
    types &&
    Array.isArray(types.has) &&
    types.has.length === 1 &&
    types.has[0] === 'Artifact' &&
    !types.hasAny &&
    !types.not &&
    hasCostOnlyArtifactSacrifice(card)
  );
}

/**
 * Auron's Inspiration's own real "Attacking creatures get +2/+0 until end
 * of turn" — `target: {types:{has:['Creature']}, attacking:true}` (the
 * `attacking` half added 2026-09-11, later same day, per the user's own
 * live spot-check: the fact must actually SAY "attacking creatures," not
 * stay silent about scope — see `synergy.ts`'s own `Constraints.attacking`
 * doc comment). A genuine, DEEP, already-documented engine gap (see this
 * card's own `definition.ts` comment in full): no live attacker-state
 * reaches `card.ts`'s engine-agnostic `Effect`/`EffectContext` surface at
 * all (no `Card.isAttacking()`, no `pumpAll` predicate broadcasting across
 * BOTH players), so the effect is an honest, intentional no-op — there is
 * no scenario addition that could produce real `pump` trace evidence for
 * this specific fact without first building that missing cross-cutting
 * engine surface (a real, separate, larger task, not a one-card fix). This
 * is UNCHANGED by the `attacking` addition — `Constraints.attacking` isn't
 * consulted by `satisfiesConstraints` either (same real limitation, see
 * its own doc comment), so there was never a live-state path this
 * exemption could instead lean on. User's own explicit call (2026-09-11):
 * the FACT should exist regardless — a real, scoped `pump` signal is fine
 * even without engine execution backing it, same tolerance the annotation-
 * required rule already extends to a fact with real textual backing but
 * imperfect trace coverage. Deliberately scoped to THIS one card/fact (not
 * a blanket "any unimplemented pump is fine" exemption) — a future `pump`
 * fact still needs real trace evidence unless it hits this exact
 * documented wall.
 */
function isAuronsInspirationBroadcastPumpFact(p, card) {
  return p.event === 'pump' && card.name === "Auron's Inspiration";
}

/**
 * Crystal Fragments' own real "Equipped creature gets +1/+1" — same real,
 * pool-wide engine gap class as Auron's Inspiration above (no live
 * continuous-effect/layer-7c pipeline for an Equipment's own static bonus
 * reaching whatever creature it's attached to — checked EVERY Equipment
 * `definition.ts` in this pool, e.g. excalibur-ii/buster-sword/the-
 * masamune/ultima-weapon/lion-heart/samurai-s-katana/thief-s-knife, and all
 * of them leave this exact line as `staticAbilities` text only, never a
 * resolvable `Effect` — this is not a one-card oversight, it's the
 * established, consistent treatment for "equipped creature gets +N/+N"
 * pool-wide). No scenario addition can produce real `fn:'pump'` trace
 * evidence for this fact without first building that missing continuous-
 * effect machinery — a real, separate, larger engine task, not a one-card
 * fix. Deliberately scoped to THIS one card/fact (not a blanket "any
 * unimplemented pump is fine" exemption), same discipline
 * `isAuronsInspirationBroadcastPumpFact` above already established.
 */
function isCrystalFragmentsEquippedPumpFact(p, card) {
  return p.event === 'pump' && card.name === 'Crystal Fragments';
}

/**
 * Gaelicat's own real "As long as you control two or more artifacts, this
 * creature gets +2/+0" — a genuine layer-7a CDA, but a THRESHOLD-gated one
 * (on/off at a count boundary), not either of the two real `ptFormula`
 * shapes this engine actually implements (`addPerEquipmentControlled` scales
 * continuously per count with no threshold, Adelbert Steiner's own;
 * `setToCreaturesControlled` sets power outright, Snow Villiers' own) — see
 * `card.ts`'s own `CardDefinition.ptFormula` doc comment: "Anything else (a
 * conditional CDA, a formula over a different subtype/count) stays
 * `staticAbilities` text until a real card needs it." `definition.ts` itself
 * documents the same call (kept as `staticAbilities` text, not a new
 * `ptFormula` variant) — same real, established, pool-wide treatment
 * scorpion-sentinel's and gigantoad's own identical-shaped "as long as you
 * control seven or more lands, gets +N/+N" text already get (checked both,
 * neither ever got engine modeling either). No `effectivePT`-driven
 * `read:getNetPower` line (or any other trace evidence) is achievable for
 * this fact without first building genuine threshold-CDA machinery — a
 * real, separate, larger engine task, not a one-card fix. Same "real fact,
 * real documented engine gap, tolerated via a narrowly-scoped named
 * exemption" treatment `isAuronsInspirationBroadcastPumpFact`/
 * `isCrystalFragmentsEquippedPumpFact` above already establish — scoped to
 * THIS one card/fact, not a blanket "any unimplemented pump is fine" pass.
 */
function isGaelicatArtifactThresholdPumpFact(p, card) {
  return p.event === 'pump' && card.name === 'Gaelicat';
}

/**
 * Magitek Infantry's own real "This creature gets +1/+0 as long as you
 * control another artifact" — the exact same real engine gap class as
 * Gaelicat's own identical-SHAPED (if differently-worded) threshold CDA
 * right above: a genuine layer-7a CDA, but a THRESHOLD-gated one (on/off at
 * a count boundary — "another artifact" = 1-or-more OTHER artifacts, same
 * on/off-not-scaling shape Gaelicat's own "two or more" is), not either of
 * the two real `ptFormula` shapes this engine actually implements. `card
 * .ts`'s own `CardDefinition.ptFormula` doc comment says the same thing
 * Gaelicat's own `definition.ts` comment already documents for this exact
 * card too (kept as `staticAbilities` text, not a new `ptFormula` variant).
 * No `effectivePT`-driven `read:getNetPower` line (or any other trace
 * evidence) is achievable for this fact without first building genuine
 * threshold-CDA machinery — a real, separate, larger engine task, not a
 * one-card fix. Same "real fact, real documented engine gap, tolerated via
 * a narrowly-scoped named exemption" treatment `isGaelicatArtifactThresholdPumpFact`
 * above establishes — scoped to THIS one card/fact, not a blanket "any
 * unimplemented pump is fine" pass.
 */
function isMagitekInfantryArtifactThresholdPumpFact(p, card) {
  return p.event === 'pump' && card.name === 'Magitek Infantry';
}

/**
 * The WANT-side sibling of `isMagitekInfantryArtifactThresholdPumpFact`
 * above — Magitek Infantry's own real condition ("as long as you control
 * ANOTHER artifact") is also authored as a genuine `Constraints`-based
 * zone-shaped SINK (`{to:'Battlefield', controller:'you', types:{has:
 * ['Artifact']}, amount:{min:1}}`), per SYNERGY_DESIGN.md's own "a card's
 * static condition is itself a real want other cards' own artifact-producing
 * effects can satisfy" framing — not merely a bare unbacked `pump` source
 * fact. Same real engine gap as the produce side: no threshold-CDA machinery
 * anywhere in this engine ever performs a live `read:getCardsIn`/
 * `read:getCreaturesInPlay`-style Battlefield-artifact-count check for this
 * text (confirmed — the static ability is pure descriptive text, `card.ts`'s
 * `staticAbilities` field, never a resolvable `Effect`), so no scenario
 * addition could ever produce the `hasAggregateRead`/`hasTypedRead` evidence
 * the zone-shaped want check otherwise requires. `amount` itself is never
 * matched by `factsInteract`/`satisfiesConstraints` (synergy.ts's own
 * `constraintsOf`/`hasAnyConstraint` — real, checked-purely-descriptive
 * field, same as everywhere else in the pool), so "another" (vs. a plain
 * "an") artifact needs no separate self-exclusion mechanism here either —
 * a second real copy of Magitek Infantry entering the battlefield (from
 * this card's own tutor, or literally anywhere else in the pool) genuinely
 * DOES satisfy "another artifact," and correctly shows up as a real
 * `selfInteractionKind: 'second-copy'` self-match (synergy.ts), not a false
 * positive needing exclusion — checked against `factsInteract`'s own zone
 * branch before writing this exemption. Scoped to THIS one card, not a
 * blanket "any threshold-condition want is unverifiable" pass.
 */
function isMagitekInfantryArtifactThresholdWant(w, card) {
  return (
    card.name === 'Magitek Infantry' &&
    effectiveZone(w) === 'Battlefield' &&
    (!w.controller || w.controller === 'you') &&
    w.types &&
    Array.isArray(w.types.has) &&
    w.types.has.length === 1 &&
    w.types.has[0] === 'Artifact' &&
    !w.types.hasAny &&
    !w.types.not
  );
}

/**
 * Summon: Alexander's own real "I, II — Prevent all damage that would be
 * dealt to creatures you control this turn" — a genuine, pool-wide
 * STRUCTURAL engine gap, not specific to this card: `state.ts`'s own header
 * rules out replacement/prevention effects entirely (no mechanism anywhere
 * in this model can intercept a damage event before it applies), so there
 * is no scenario addition that could ever produce real trace evidence for a
 * damage-PREVENTION fact — same "genuinely blocked, document via a real
 * fact + real named exemption" treatment `isAuronsInspirationBroadcastPumpFact`
 * already established, just for a different missing engine surface (real
 * replacement effects vs. real cross-player attacker state). `event:
 * 'preventDamage'` is genuinely new vocabulary (checked: no other pool card
 * declares it) — introduced here specifically because this real printed
 * ability (two full chapters' worth of text) would otherwise be entirely
 * absent from this card's own fact model. Scoped to THIS one card/fact,
 * same narrow-exemption discipline as the pump case above — a future
 * `preventDamage` fact still needs its own real justification, not a free
 * pass just because this name exists.
 */
function isSummonAlexanderDamagePreventionFact(p, card) {
  return p.event === 'preventDamage' && p.face === 'back' && card.name === 'Crystal Fragments';
}

/**
 * Ardyn, the Usurper's own real "Demons you control have menace, lifelink,
 * and haste" (`CardDefinition.continuousKeywordGrants`, ENGINE_GAPS.md gap
 * #14, closed 2026-09-12) — a genuinely real, query-time grant (same live
 * `state.ts`'s own `effectiveKeywords` mechanism Dion, Bahamut's Dominant's
 * own Dragonfire Dive fact relies on), but Dion's own scenario is a hand-
 * written `engine-trace.ts` pilot script that can inject an arbitrary
 * `{fn:'read:hasKeyword', ...}` line as deliberate manual evidence (see
 * `hasKeywordReadEvidence` above) — Ardyn's own `scenarios.ts` is a plain
 * `harness.ts` `Scenario[]` array (checked: no field on `Scenario`/
 * `SequenceStep` lets a pilot script push an arbitrary custom log line
 * mid-scenario), so this exact evidence shape is structurally unavailable
 * for THIS card without a disproportionate full migration to the pilot-
 * script style for a single grant fact. Real fact, real mechanism, zero
 * possible evidence given Ardyn's own scenario-authoring style — same
 * "document via a real fact + real named exemption" treatment as the
 * cases above, scoped to THIS one card's own 3 keyword grants (not a
 * blanket "any continuousKeywordGrants fact is fine" exemption).
 */
function isArdynDemonGrantFact(p, card) {
  return p.event === 'grantKeyword' && card.name === 'Ardyn, the Usurper' && ['Menace', 'Lifelink', 'Haste'].includes(p.keyword);
}

/**
 * Dragoon's Lance's own real "During your turn, equipped creature has
 * flying" (`continuousKeywordGrants`'s new `equippedBySelf` mode,
 * ENGINE_GAPS.md gap #14, generalized 2026-09-12) — same real, query-time
 * mechanism as Ardyn's own grant above, same exact structural wall: this
 * card's `scenarios.ts` is a plain `harness.ts` `Scenario[]` array (a
 * bare `onEnter`-trigger scenario plus a bare Equip-activation scenario),
 * which cannot inject a manual `read:hasKeyword` line either. Scoped by
 * the fact's own SHAPE (`target.equippedBySelf`), not by card name, since
 * this is a real, reusable mechanism any future Equipment-broadcast
 * turn-conditional grant would hit the identical wall under — a future
 * card that DOES get a real `engine-trace.ts` pilot script (and a real
 * `read:hasKeyword` line) is unaffected, since `hasKeywordReadEvidence`
 * above is checked FIRST and would already satisfy it.
 */
function isEquippedKeywordGrantFact(p, card) {
  return p.event === 'grantKeyword' && p.target && typeof p.target === 'object' && p.target.equippedBySelf === true;
}

/**
 * Cloud, Midgar Mercenary's own real "...or an Equipment attached to it
 * triggers" — the equipment half of its Panharmonicon-style static
 * (2026-09-11, added same day the `attacking`-shaped `attachedToSelf`
 * field landed for it — see `synergy.ts`'s own `Constraints.attachedToSelf`
 * doc comment). Same real, DEEP, already-documented engine gap as the
 * SELF half's own doubling effect (ENGINE_GAPS.md gap #13: no
 * trigger-multiplying machinery anywhere in this model) — but this fact
 * is even further from any possible evidence than the self half: not only
 * would demonstrating it need a real attached-Equipment card in the
 * scenario, that Equipment would ALSO need its OWN separate triggered
 * ability that fires independently, which no scenario in this pool
 * exercises for Cloud today (nor should one be fabricated just to
 * manufacture evidence). `w.target` being a `Constraints` object (not
 * `'self'`) is exactly what distinguishes this half from the self half's
 * own real, evidenced `w.target === 'self'` check just above — scoped
 * narrowly to THIS one card/fact shape, not a blanket exemption for any
 * non-self `triggeredAbility` want a future card might declare.
 */
function isCloudEquipmentTriggeredAbilityFact(w, card) {
  return w.event === 'triggeredAbility' && card.name === 'Cloud, Midgar Mercenary' && w.target !== 'self';
}

/**
 * Cloudbound Moogle's own real Plainscycling ("{2}, Discard this card:
 * Search your library for a Plains card...") — modeled as two specific
 * facts per the user's own explicit ask (2026-09-11: "sink for discard
 * self" + "tutor for Plains"), NOT as generic TypeCycling engine machinery
 * (that gap stays open — same as malboro/hill-gigas/ice-flan/balamb-t-
 * rexaur/capital-city/cid-timeless-artificer's own *cycling abilities,
 * still unmodeled). No scenario/trace path can exist for either half:
 * Plainscycling lives only as a `staticAbilities` text string on this
 * card's own `definition.ts` (never a resolvable `Effect`), same "known
 * statically, no trace needed" treatment `isCostOnlyArtifactSacrificeWant`/
 * `Fact` above already get for a different structural cost requirement.
 * `isCloudboundMoogleDiscardSelfWant` covers the discard-as-cost SINK
 * (`{event:'discard', target:'self'}` — the ACT of discarding itself, no
 * `to`/`from`, mirroring the bare-event `dies`/`sacrifice` self-reference
 * shape rather than a zone fact, since this is about the payment ACT, not
 * a plain "wants a card in Graveyard" presence want); `isCloudboundMoogle
 * TutorFact` covers the resulting SOURCE zone fact (`{to:'Hand',
 * from:'Library', types:{has:['Plains']}}` — same shape/`tutor`
 * `ZONE_MOVEMENT_NAMES` label as Ashe/Cloud's own real tutor facts).
 * Deliberately scoped to THIS one card, not a blanket cycling exemption.
 */
function isCloudboundMoogleDiscardSelfWant(w, card) {
  return w.event === 'discard' && w.target === 'self' && card.name === 'Cloudbound Moogle';
}
/**
 * A `{event:'tap', subject:'self', target:'self'}` SOURCE fact — the
 * `{T}` ACTIVATION-COST payment itself (Coeurl/Dion, Bahamut's Dominant,
 * 2026-09-11, "self-tap cost" — same family as
 * `isCostOnlyArtifactSacrificeFact`'s own sacrifice-cost treatment above),
 * deliberately kept as its own fact separate from either card's OWN
 * tap-target EFFECT fact (Coeurl's `{event:'tap', target:{types:...}}`) or
 * lack of one (Dion has no tap EFFECT at all, just the `{T}` cost). See
 * `producedEvents`'s own `case 'tap'` doc comment: `engine.ts`'s
 * `activateAbility` pays a `{T}` cost via a bare
 * `engine.state.tap(permanent)` call with NO `loggingActions.tap` log line
 * at all, so no real trace evidence could ever exist for THIS fact
 * specifically — a general engine limitation, not a per-card one, so this
 * exemption is deliberately NOT scoped by card name (any future `{T}`-cost
 * card hits the exact same wall). Scoped instead to the exact self-tap-
 * cost SHAPE (`subject==='self' && target==='self'`) — without this,
 * Coeurl's own real `fn:'tap'` trace line (from its UNRELATED tap-target
 * EFFECT, which legitimately produces `{event:'tap'}` evidence for ITS
 * OWN fact) would silently, WRONGLY also satisfy this fact's forward
 * check by bare event-name equality (no `subject`/`target`-shape
 * distinction in that generic check) — a false pass, not a real
 * demonstration of the cost being paid. A card's own tap-TARGET effect
 * fact still needs, and already has, real trace evidence; this exemption
 * only ever covers the cost-payment shape.
 */
// `isInnatePrintedKeywordFact` (a card's own bare self-only printed
// keyword modeled as a `grantKeyword` fact) — added 2026-09-11, REMOVED
// 2026-09-12 same reversal that removed the facts it existed to exempt:
// user's own correction, "Not needed for keywords on card. That would be
// parsed directly - we don't need facts for that." A card's own printed
// keyword (no grant/broadcast to anything else involved) is already
// structured, directly-parseable data (`CardDefinition.keywords`) — not
// synergy-relevant occurrence data, so it never needed a Fact (or this
// exemption) at all. See SYNERGY_DESIGN.md's own dated entry for the full
// standing rule this establishes for future migrations. A keyword being
// GRANTED (to self via a real effect, or to something else) is still
// real, Fact-worthy vocabulary — unaffected, see the `grantKeyword`
// branches elsewhere in this file.

function isSelfTapActivationCostFact(p) {
  return p.event === 'tap' && p.subject === 'self' && p.target === 'self';
}

// Symmetric sibling of `isSelfTapActivationCostFact` above (2026-09-12,
// Phoenix Down/fin-29's own real "{1}{W}, {T}, Exile this artifact: Choose
// one —" activation cost) — the exile-THIS-artifact-as-cost act itself,
// same "no real trace evidence could ever exist" situation as the {T} cost:
// `engine.ts`'s own `unsupportedCostComponent` doesn't even recognize "Exile
// this artifact" as a payable cost component at all (it isn't a bare mana/
// {T} symbol run, and it doesn't match the one accepted "Sacrifice
// another/a/two X" pattern either), so this card's own activated ability
// can't be piloted through `canActivateAbility`/`activateAbility` in the
// first place — a real, general engine limitation (any future card with a
// self-exile-as-cost activation hits the same wall), not per-card. Also
// prevents a real false-pass collision: this card's OWN mode-1 "exile
// target Skeleton, Spirit, or Zombie" EFFECT genuinely produces real
// `{event:'exile'}` trace evidence (see `producedEvents`'s own `case
// 'moveTo'` above) — without this exemption's exact `subject`/`target`-
// shape scoping, that unrelated evidence would silently, wrongly also
// satisfy this fact by bare event-name equality alone, the same collision
// class `isSelfTapActivationCostFact`'s own doc comment already documents
// for Coeurl's tap-target effect vs. its self-tap-cost fact.
function isSelfExileActivationCostFact(p) {
  return p.event === 'exile' && p.subject === 'self' && p.target === 'self';
}

function isCloudboundMoogleTutorFact(p, card) {
  return (
    card.name === 'Cloudbound Moogle' &&
    effectiveZone(p) === 'Hand' &&
    p.from === 'Library' &&
    p.types &&
    Array.isArray(p.types.has) &&
    p.types.has.includes('Plains')
  );
}

function wantMatchesZoneRead(want, zone) {
  // `effectiveZone`, not a bare `want.zone` (fixed 2026-09-11 alongside
  // synergy.ts's ZoneFact/EventFact merge — a SINK fact can now
  // legitimately author `to` instead of `zone` too, e.g. summon-bahamut's
  // own `mega-flare-you`; a bare `want.zone` read silently stopped
  // recognizing it, since the source-side checks in this same file already
  // widened to `'zone' in p || 'to' in p` but this sink-side pair (here and
  // its own caller below) was missed in that same pass — real, live bug,
  // caught by this exact card's own re-verification, not by inspection).
  return effectiveZone(want) === zone;
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
  const staticManaColors = staticManaColorsFor(card);

  const failures = [];
  const notes = [];

  // --- Forward: every declared PRODUCE needs supporting trace evidence ---
  for (const p of source) {
    // `'to' in p` — a rework-shaped (2026-09-11) SOURCE zone-change fact
    // (synergy.ts's own `ZoneFact` doc comment) declares `to`/`from`
    // instead of a bare `zone`; `effectiveZone` reads either shape. `from`
    // itself isn't independently re-verified against the trace below —
    // same "verify the destination, not the documented origin" scope every
    // other exemption/evidence check here already has (e.g. `controller`
    // is checked, `subject` beyond `self`-exemptions is not).
    if ('zone' in p || 'to' in p) {
      const zone = effectiveZone(p);
      if (zone === 'Graveyard' && p.subject === 'self' && [...triggerNames].some((n) => DEATH_TRIGGER_NAMES.has(n))) continue; // see DEATH_TRIGGER_NAMES
      if (zone === 'Battlefield' && p.subject === 'self' && (!p.controller || p.controller === 'you') && isStaticOnlyLand(card)) continue; // see isStaticOnlyLand
      if (zone === 'Battlefield' && isActivationCostPermanentBaselineFact(p, card)) continue; // see isActivationCostPermanentBaselineFact
      if (isSelfBattlefieldPresenceLand(p, card)) continue; // any Land's own tautological battlefield presence — see isSelfBattlefieldPresenceLand
      if (isCoinFlipTokenSubjectFact(p, card)) continue; // a coin-flip-produced token's own presence — see isCoinFlipTokenSubjectFact
      if (isCloudboundMoogleTutorFact(p, card)) continue; // Plainscycling's own tutor-for-Plains half, cost-only ability — see isCloudboundMoogleTutorFact
      const evidence = allEntries.some((e) => {
        const z = producedZone(e, cardName);
        return z && z.zone === zone && (!p.controller || z.side === p.controller);
      });
      if (!evidence) failures.push(`produce {zone:${zone}${p.controller ? `,controller:${p.controller}` : ''}} has no supporting trace line (enters/move/moveTo/ceasesToExist/createToken/sacrifice/discard/destroy/legendRule)`);
    } else {
      if (p.event === 'addMana' && p.color && staticManaColors.has(p.color)) continue; // plain "{T}: Add X." text — see staticManaColorsFor
      if (p.event === 'addMana' && p.colors && [...(p.colors.has ?? []), ...(p.colors.hasAny ?? [])].every((c) => staticManaColors.has(c))) continue; // plain "{T}: Add X or Y." text, combined-fact shape — see staticManaColorsFor
      if (isLandEntersTappedSelfFact(p, card)) continue; // real "enters tapped" replacement — see isLandEntersTappedSelfFact
      if (isSelfPlayableLand(p, card)) continue; // a plain land's own self-play fact — see isSelfPlayableLand
      if (isCoinFlipFact(p, card)) continue; // the flip itself, guaranteed by the ability's own printed text — see hasCoinFlipAbility/isCoinFlipFact
      if (isCoinFlipTokenSubjectFact(p, card)) continue; // a coin-flip-produced token's own ETB — see isCoinFlipTokenSubjectFact
      if (isCostOnlyArtifactSacrificeFact(p, card)) continue; // the sacrifice ACT itself, cost-only, tautologically real — see isCostOnlyArtifactSacrificeFact
      if (isAuronsInspirationBroadcastPumpFact(p, card)) continue; // real fact, real documented engine gap blocks any possible trace evidence — see isAuronsInspirationBroadcastPumpFact
      if (isCrystalFragmentsEquippedPumpFact(p, card)) continue; // real fact, real documented engine gap blocks any possible trace evidence — see isCrystalFragmentsEquippedPumpFact
      if (isGaelicatArtifactThresholdPumpFact(p, card)) continue; // real fact, real documented engine gap (no threshold-CDA machinery) — see isGaelicatArtifactThresholdPumpFact
      if (isMagitekInfantryArtifactThresholdPumpFact(p, card)) continue; // real fact, same threshold-CDA engine gap as Gaelicat — see isMagitekInfantryArtifactThresholdPumpFact
      if (isSummonAlexanderDamagePreventionFact(p, card)) continue; // real fact, real documented engine gap blocks any possible trace evidence — see isSummonAlexanderDamagePreventionFact
      if (isSelfTapActivationCostFact(p)) continue; // the {T} cost payment itself, never logged — see isSelfTapActivationCostFact
      if (isSelfExileActivationCostFact(p)) continue; // the exile-this-artifact cost payment itself, never logged — see isSelfExileActivationCostFact
      if (isArdynDemonGrantFact(p, card)) continue; // real fact, real mechanism, zero possible evidence given this card's plain Scenario style — see isArdynDemonGrantFact
      if (isEquippedKeywordGrantFact(p, card)) continue; // real fact, real mechanism, zero possible evidence given this card's plain Scenario style — see isEquippedKeywordGrantFact
      if (card.name === "Dragoon's Lance" && p.event === 'pump') continue; // real fact, real documented engine gap (no equip-broadcast pump pipeline) — same class as isCrystalFragmentsEquippedPumpFact
      if (card.name === "Dragoon's Lance" && p.event === 'grantType') continue; // real fact, real documented engine gap (no dynamic type-grant-to-another-permanent pipeline) — new vocabulary, genuinely inert
      if (card.name === "Machinist's Arsenal" && p.event === 'pump') continue; // real fact, same equip-broadcast pump gap as Dragoon's Lance — see that exemption above
      if (card.name === "Machinist's Arsenal" && p.event === 'grantType') continue; // real fact, same dynamic type-grant-to-another-permanent gap as Dragoon's Lance — see that exemption above
      if (card.name === "Paladin's Arms" && p.event === 'pump') continue; // real fact, same equip-broadcast pump gap as Dragoon's Lance — see that exemption above
      if (card.name === "Paladin's Arms" && p.event === 'grantType') continue; // real fact, same dynamic type-grant-to-another-permanent gap as Dragoon's Lance — see that exemption above
      if (p.event === 'cast' && isActivationCostPermanentBaselineFact(p, card)) continue; // see isActivationCostPermanentBaselineFact
      // A real `read:hasKeyword` line with `result:true` (2026-09-12,
      // ENGINE_GAPS.md gap #14) is ALSO real evidence for a `grantKeyword`
      // SOURCE fact backed by `CardDefinition.continuousKeywordGrants` — a
      // query-time continuous grant (Dion's own Dragonfire Dive, Ardyn's
      // Demons grant) never fires a discrete `fn:'grantKeyword'` ACTION
      // (nothing ever calls `actions.grantKeyword` for it — see `state.ts`'s
      // own `effectiveKeywords` doc comment), so `producedEvents`'s own
      // `case 'grantKeyword'` alone could never recognize it; a real,
      // deliberate `hasKeyword` query against the real board state (same
      // "manual CDA read" pattern adelbert-steiner's own `read:getNetPower`
      // line already established) is the only possible evidence shape for
      // this fact family, and IS genuinely real (not fabricated) — it asks
      // the exact same live function the engine itself consults.
      const hasKeywordReadEvidence =
        p.event === 'grantKeyword' && allEntries.some((e) => e.fn === 'read:hasKeyword' && e.keyword === p.keyword && e.result === true);
      const evidence =
        hasKeywordReadEvidence ||
        allEntries.some((e) =>
          producedEvents(e, cardName).some(
            (ev) =>
              ev.event === p.event &&
              (!p.counterType || ev.counterType === p.counterType) &&
              // `type` — Magitek Armor's own `grantType`/fin-24 (2026-09-12):
              // a real `fn:'animate'` line's `types` array produces ONE event
              // per type (`producedEvents`'s own `case 'animate'`), so this
              // checks the SPECIFIC granted type a fact names, same "extra
              // field, matched by plain equality" treatment `counterType`
              // already gets right above.
              (!p.type || ev.type === p.type) &&
              (!p.controller || !ev.side || ev.side === p.controller),
          ),
        );
      if (!evidence) failures.push(`produce {event:${p.event}${p.counterType ? `,counterType:${p.counterType}` : ''}} has no supporting trace line`);
    }
  }

  // --- Forward: every declared WANT needs supporting trace evidence ---
  for (const w of sink) {
    // `'zone' in w || 'to' in w`, not a bare `'zone' in w` (fixed
    // 2026-09-11, same real bug as `wantMatchesZoneRead`'s own fix above —
    // a SINK fact can now legitimately author `to` instead of `zone`).
    if ('zone' in w || 'to' in w) {
      const zone = effectiveZone(w);
      if (isLandTapSelfWant(w) && hasStaticLandTapSelfTrigger(card)) continue; // see isLandTapSelfWant/hasStaticLandTapSelfTrigger
      if (isCostOnlyArtifactSacrificeWant(w, card)) continue; // see hasCostOnlyArtifactSacrifice/isCostOnlyArtifactSacrificeWant
      if (isMagitekInfantryArtifactThresholdWant(w, card)) continue; // real fact, real documented engine gap (no threshold-CDA machinery) — see isMagitekInfantryArtifactThresholdWant
      if (isCrewCostCreatureWant(w, card)) continue; // see isCrewCostCreatureWant
      const hasAggregateRead = allEntries.some((e) => aggregateReadZone(e) === zone);
      const hasTypedRead = allEntries.some((e) => LOW_LEVEL_READ_FNS.has(e.fn));
      if (!hasAggregateRead && !hasTypedRead) failures.push(`want {zone:${zone}} has no read:getCardsIn/getCreaturesInPlay/getLandsInPlay (or per-object type read) anywhere in the trace`);
    } else {
      const triggerEvidence = [...triggerNames].some((n) => TRIGGER_EVENT_MAP[n] === w.event);
      // A real `read:getCounters` line is direct evidence for a
      // `{event:'putCounter', target:'self'}` want (an effect's own "X =
      // however many counters are already on this" read, e.g. Aerith
      // Gainsborough's own onDies spread) — same "a low-level read backs a
      // want it corroborates" reasoning this file's own header comment
      // already establishes for zone/type wants, just extended to this one
      // event shape (no card needed it until now).
      const readEvidence =
        w.event === 'dies' || w.event === 'lifegain'
          ? triggerEvidence
          : w.event === 'putCounter'
            ? allEntries.some((e) => e.fn === 'read:getCounters' && (!w.counterType || e.counterType === w.counterType))
            : w.event === 'triggeredAbility' && w.target === 'self'
              ? // Cloud, Midgar Mercenary's own real "if a triggered ability of
                // Cloud ... triggers" (the SELF half only — see below for the
                // equipment half) — genuinely new event vocabulary
                // (2026-09-11, RENAMED same day from an original `'trigger'`
                // — user's own live call: the bare word "trigger" undersells
                // it, this is specifically a CR 603 TRIGGERED ABILITY firing,
                // not any generic trigger; picked `triggeredAbility` over the
                // shorter `ability` to avoid reading as the unrelated,
                // already-real `event:'activateAbility'` — 602 activated vs.
                // 603 triggered are deliberately distinct real MTG concepts
                // here, not interchangeable). "One of THIS card's own
                // triggered abilities fired," not any specific named
                // trigger, so `TRIGGER_EVENT_MAP` (a name -> ONE fixed event
                // dictionary) is the wrong tool here (this trigger name,
                // 'onEnter', already needs to map to `entersBattlefield` for
                // this same card's OTHER new sink — see that map entry). A
                // direct, real, per-card-scoped check instead: any
                // `{fn:'trigger', card: cardName}` bracket anywhere in this
                // card's own trace is exactly "one of MY OWN triggered
                // abilities fired." Deliberately scoped to `w.target ===
                // 'self'` only — this says nothing about an ATTACHED
                // Equipment's own trigger firing (a genuinely different,
                // still-unmodeled claim — see `isCloudEquipmentTriggeredAbilityFact`
                // below for that half's own real, zero-evidence treatment).
                allEntries.some((e) => e.fn === 'trigger' && e.card === cardName)
              : false;
      if (!triggerEvidence && !readEvidence) {
        if (isCloudEquipmentTriggeredAbilityFact(w, card)) continue; // see isCloudEquipmentTriggeredAbilityFact
        if (isCloudboundMoogleDiscardSelfWant(w, card)) continue; // Plainscycling's own discard-as-cost half — see isCloudboundMoogleDiscardSelfWant
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
    // `'zone' in w || 'to' in w`, not a bare `'zone' in w` — same real fix
    // as this file's own forward-direction want check above.
    if (!sink.some((w) => ('zone' in w || 'to' in w) && wantMatchesZoneRead(w, zone))) failures.push(`trace has ${e.fn} on zone ${zone} with no matching declared want`);
  }

  // --- Reverse: every produce-relevant ACTION must be explained (soft) ---
  // `read:getNetPower` deliberately NOT added here — every `read:`-prefixed
  // fn is already skipped by this loop's own guard below (`e.fn.startsWith
  // ('read:')`), same treatment every other low-level read already gets;
  // only `pump` (the real, non-`read:`-prefixed ACTION) needed adding.
  const explainableFns = new Set(['enters', 'move', 'moveTo', 'ceasesToExist', 'createToken', 'sacrifice', 'discard', 'destroy', 'legendRule', 'gainLife', 'loseLife', 'putCounter', 'dealDamage', 'grantKeyword', 'drawCard', 'drawCards', 'addMana', 'counter', 'playLand', 'pump', 'attack', 'tap', 'animate', 'gainControl']);
  for (const e of allEntries) {
    if (IGNORED_FNS.has(e.fn) || e.fn.startsWith('read:')) continue;
    if (!explainableFns.has(e.fn)) {
      if (!PARKED_ACTION_FNS.has(e.fn)) notes.push(`trace has unrecognized action ${e.fn} — no fact vocabulary for it yet`);
      continue;
    }
    const z = producedZone(e, cardName);
    const evs = producedEvents(e, cardName);
    const zoneOk = z && source.some((p) => ('zone' in p || 'to' in p) && effectiveZone(p) === z.zone && (!p.controller || p.controller === z.side));
    const eventOk = evs.length > 0 && source.some((p) => 'event' in p && evs.some((ev) => ev.event === p.event));
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

// --- Scenario board-filler names: every addCard(...) literal name must be a
// real, non-token Scryfall card (see scenario-card-names.mjs's own header —
// `functional-model/scenario-card-names.test.ts` also runs this in
// `npm run test`; wired here too so a manual `verify-synergy.mjs` sweep,
// scoped to specific slug(s) or not, catches it in the same pass instead of
// requiring a separate command). A fabricated name here is a HARD failure,
// same convention as this file's own per-card checks above — this is a
// straight authoring-rule violation, not a "the engine can't represent this
// yet" gap that would warrant a soft note instead. ---
const allScenarioViolations = await findFabricatedScenarioCardNames({ cardsDir, dataDir });
const scenarioViolations = requested.length ? allScenarioViolations.filter((v) => requested.includes(v.slug)) : allScenarioViolations;
if (scenarioViolations.length > 0) {
  console.log(`\n${scenarioViolations.length} fabricated scenario card name(s) (see scripts/verify-scenario-card-names.mjs for a standalone report):`);
  for (const v of scenarioViolations) console.log(`  ✗ ${v.file}:${v.line} — name: '${v.name}' is not a real Scryfall card`);
}

// --- Annotation coverage: every fact on a card that opted into the
// `Fact.annotations` model (`ANNOTATED_CARD_SLUGS`) must carry at least one
// real annotation (see annotation-coverage.mjs's own header — 2026-09-11
// hard invariant). Same standalone-pool-sweep-appended-to-the-same-exit-code
// shape as the scenario-name check just above, scoped by `requested` the
// same way. ---
const allAnnotationSlugs = requested.length ? [...ANNOTATED_CARD_SLUGS].filter((s) => requested.includes(s)) : [...ANNOTATED_CARD_SLUGS];
const annotationViolations = await findMissingAnnotations({ cardsDir, slugs: allAnnotationSlugs });
if (annotationViolations.length > 0) {
  console.log(`\n${annotationViolations.length} fact(s) with zero annotations (see scripts/verify-annotation-coverage.mjs for a standalone report):`);
  for (const v of annotationViolations) console.log(`  ✗ ${v.slug} [${v.role}][${v.index}] — ${v.description}`);
}

if (hardFailures > 0 || scenarioViolations.length > 0 || annotationViolations.length > 0) process.exit(1);
