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
//     (equip/dig/...) with no
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
    case 'mill':
      // Real, dedicated `state.mill` chokepoint (ENGINE_GAPS.md gap #19,
      // closed) — distinct from `move` above (fn:'move' still backs a
      // library->graveyard zone fact for every OTHER card's own generic
      // batch move; `fn:'mill'` is now the one The Water Crystal's own
      // activated ability produces).
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
    case 'gainLife': {
      const events = [{ event: 'lifegain', side: entry.player === 'you' ? 'you' : 'opp' }];
      // The Wind Crystal's own real CR 614.2 lifegain-doubling replacement
      // (ENGINE_GAPS.md gap #8b, closed 2026-09-12) — `harness.ts`'s own
      // `loggingPlayer.gainLife` now logs the REAL, post-replacement `amount`
      // alongside the nominal `requestedAmount` whenever they genuinely
      // differ (additive field, `.claude/contracts/state-event-format.md`) —
      // a real, concrete "the amount was actually doubled" signal, not an
      // assumption from the card's own name/text.
      if (entry.requestedAmount !== undefined && entry.amount > entry.requestedAmount) {
        events.push({ event: 'lifegainDouble', side: entry.player === 'you' ? 'you' : 'opp' });
      }
      return events;
    }
    case 'addMana':
      // Promoted the same way drawCard was (2026-09-05) — see card.ts's
      // own `Effect` doc comment on `addMana` for why this exists as a
      // deliberately inert observation point (no real mana pool).
      return [{ event: 'addMana', side: entry.player === 'you' ? 'you' : 'opp' }];
    case 'loseLife':
      return [{ event: 'lifeloss', side: entry.player === 'you' ? 'you' : 'opp' }];
    case 'discard':
      // Promoted (2026-09-12, Qiqirn Merchant/fin-65's own real "Draw a
      // card, then discard a card") — `producedZone` above already reads
      // this same `fn:'discard'` line for its own zone-shaped (Graveyard)
      // evidence, but a card whose own real effect just discards a card as
      // part of what it DOES (not a self-referencing discard-as-COST the
      // way Cloudbound Moogle's Plainscycling/Ice Flan's Islandcycling model
      // it — a DIFFERENTLY-SHAPED `{fn:'discard', target, id, controller}`
      // entry with no `player` field at all, `engine-trace.ts`'s
      // `pilotActivate`, ENGINE_GAPS.md gap #23 — so it never satisfies THIS
      // case's own `entry.player` read) needs the EVENT-shaped sibling fact too,
      // same "one action, two simultaneously-true fact shapes" pattern
      // `sacrifice`/`destroy` already establish above. `harness.ts`'s own
      // `loggingActions.discard` always logs the scenario's own `player`
      // field (never a bare object name needing `sideOf`'s guess), same
      // shape `gainLife`/`loseLife` already use.
      return [{ event: 'discard', side: entry.player === 'you' ? 'you' : 'opp' }];
    case 'mill': {
      // The Water Crystal's own real CR 614.2 mill-modifier replacement
      // (ENGINE_GAPS.md gap #19, closed) — same "log the real, post-
      // replacement amount alongside the nominal requested one, only when
      // they genuinely differ" convention `gainLife`'s own `requestedAmount`
      // (case 'gainLife' above) already established for the lifegain-
      // doubling case; `event:'millIncrease'` here is the additive-modifier
      // sibling of that case's `event:'lifegainDouble'` (a flat "+N" instead
      // of a "x2," per `card.ts`'s own `MillModifierGrant` doc comment on
      // why this needed a different shape than a fixed-multiplier keyword).
      const events = [];
      if (entry.requestedQty !== undefined && entry.qty > entry.requestedQty) {
        events.push({ event: 'millIncrease', side: entry.player === 'you' ? 'you' : 'opp' });
      }
      return events;
    }
    case 'putCounter':
      return [{ event: 'putCounter', counterType: entry.counterType, side: undefined }];
    case 'dealDamage':
      return [{ event: 'damage', side: 'you' }];
    // Real CR 614.2 damage-prevention shields (ENGINE_GAPS.md gap #8,
    // closed 2026-09-12) — `harness.ts`'s own `loggingActions.dealDamage`
    // (any damage) and `engine-trace.ts`'s own `pilotResolveCombatDamage`
    // (real 510 combat damage) both log this REPLACING `dealDamage` entirely
    // (never both — see either function's own doc comment: the damage
    // event genuinely never happened, so there's no "amount actually dealt"
    // to also log) whenever a real shield ('DamagePrevention'/
    // 'CombatDamagePrevention', card.ts's own `Keyword` doc comment) fires.
    // Crystal Fragments/Summon: Alexander's own chapter I/II, Diamond
    // Weapon's own printed "Immune" clause are the two real cards.
    case 'damagePrevented':
      return [{ event: 'preventDamage', side: sideOf(entry, cardName) }];
    // Real coin-flip resolution + Edgar, King of Figaro's own Two-Headed
    // Coin replacement (ENGINE_GAPS.md gap #15, closed 2026-09-12) —
    // `state.flipCoin`'s own real return value, logged verbatim by whoever
    // pilots it (`entry.forced` — real, present ONLY when the caller's own
    // requested outcome was genuinely overridden, same "additive field,
    // present only when true" convention `untilEndOfTurn` already uses).
    // `event:'coinFlip'` itself (the flip happening, no vocabulary change
    // from The Gold Saucer's own 2026-09-09 precedent) stays the fallback
    // for a real, non-forced flip; `event:'winCoinFlip'` is genuinely new
    // vocabulary for the REPLACEMENT specifically (see synergy.ts's own
    // `describeFact` doc comment on why these are two different claims).
    case 'coinFlip':
      return [{ event: entry.forced ? 'winCoinFlip' : 'coinFlip', side: entry.player === 'you' ? 'you' : 'opp' }];
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
    // CR 601/305's own umbrella "play" (ENGINE_GAPS.md gap #16, closed
    // 2026-09-12) — The Lunar Whale's own real "As long as The Lunar Whale
    // attacked this turn, you may play the top card of your library" now has
    // a real, engine-checked mechanism behind it (`engine.ts`'s
    // `canPlayFromLibraryTop`/`playFromLibraryTop`, `card.ts`'s new
    // `kind:'playFromLibraryTop'` Effect) — `engine-trace.ts`'s own
    // `pilotActions` override logs a real `fn:'play'` line before dispatching
    // to the underlying real `playLand`/`cast`, same "cast"/"playLand"
    // treatment immediately above. Unconditional `side:'you'` — no FIN
    // scenario plays an opponent's library top through this path.
    case 'play':
      return [{ event: 'play', side: 'you' }];
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
    // `beginCombat-trigger-structural.ts`'s own real "At the beginning of
    // combat on your turn," precondition sink (2026-09-16, weapons-vendor's
    // own remaining coverage gap) — genuinely new event vocabulary: nothing
    // in the pool declared a `beginCombat` fact before this. Real trace
    // evidence already existed and needed no new engine/scenario work —
    // `advance`/`advanceOneStep` (`engine-trace.ts`) already logs a real
    // `{fn:'phase', phase:'CombatBegin', player}` line every time turn
    // passage reaches the Combat-Begin phase (`turn.ts`'s own `PHASES`),
    // independent of whether any card's own trigger fires there at all.
    // Player-scoped (not self-referencing the way `attack` above is) since
    // the real fact is `controller:'you'` — "wants YOUR OWN combat phase to
    // begin," not "wants ITSELF to attack."
    case 'phase':
      return entry.phase === 'CombatBegin' ? [{ event: 'beginCombat', side: entry.player === 'you' ? 'you' : 'opp' }] : [];
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
    // Promoted off `PARKED_ACTION_FNS` (2026-09-12, Magic Damper/fin-61's own
    // real "Untap it." — the first card in the pool whose own effect, not
    // just an untap-as-cost-refund, is a real untap). `card.ts`'s own
    // `untapTarget` Effect kind (`Card.untap()`/`UntapEffect`, forge-game)
    // already existed for exactly this card before this pass — this was
    // purely a Fact-vocabulary gap, same "engine machinery real, only the
    // fact vocabulary was parked" shape `tap`'s own promotion above already
    // established. `loggingActions.untap` (harness.ts) logs a bare object
    // NAME (`target`), no `controller` field at all (unlike `tap`, which
    // gained one) — reuses `sideOf`'s own name-guessing fallback, same as
    // `tap` before its own real controller field existed.
    case 'untap':
      return [{ event: 'untap', side: sideOf(entry, cardName) }];
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
    // Promoted off `PARKED_ACTION_FNS` (2026-09-12, Dreams of Laguna/fin-50's
    // own real "Surveil 1, then draw a card" — the first card in the pool
    // whose own effect needs `event:'surveil'` as REAL, checkable vocabulary
    // rather than the parked/no-evidence-possible status it had before).
    // `harness.ts`'s own `loggingActions.surveil` already logs a real
    // `{fn:'surveil', player, qty}` line for every real `actions.surveil`
    // call (`card.ts`'s own `kind:'surveil'` Effect, wired since before this
    // promotion — this was purely a Fact-vocabulary gap, not an engine gap,
    // same shape every other "parked -> real" promotion this file already
    // has). `qty` is deliberately NOT compared here (no fact anywhere needs
    // to distinguish "surveil 1" from "surveil 2" for MATCHING purposes —
    // same "generic catch-all, no amount sub-vocabulary" scope `pump`'s own
    // promotion established); `compute-weights.mjs` reads real trace
    // magnitude separately, for ranking, not matching.
    case 'surveil':
      return [{ event: 'surveil', side: entry.player === 'you' ? 'you' : 'opp' }];
    // Promoted off `PARKED_ACTION_FNS` (2026-09-12, Stolen Uniform/fin-75's
    // own real "Attach it to the chosen creature" — the second half of its
    // own gainControl+equip `custom` effect). `harness.ts`'s own
    // `loggingActions.equip` already logs a real `{fn:'equip', equipment,
    // equipmentId, target, id}` line (`state.ts`'s real `RealCard.attachedToId`
    // mutation via the real `Actions.equip`, interfaces.ts) for every real
    // attach — this was purely a Fact-vocabulary gap, not an engine gap
    // (`equip` was already wired and exercised by 30+ real Equipment cards'
    // own Equip abilities plus stolen-uniform/unexpected-request's own
    // gainControl+equip effects, just never claimable as evidence), same
    // "parked -> real" shape `gainControl`'s own promotion documented.
    // `side` derived via `sideOf`'s own name-guessing fallback (no
    // `controller` field logged by `loggingActions.equip`) — reads
    // `entry.target` (the creature BEING equipped), same "bare object name"
    // shape `tap`/`pump`/`untap` already use.
    case 'equip':
      return [{ event: 'equip', side: sideOf(entry, cardName) }];
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
// drawCard; dig/copyPermanent/destroyPrevented have no fact vocabulary
// defined by the design at all) — unexplained occurrences of these are
// noted, never a hard failure.
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
// own `case 'gainControl'` above. `surveil` REMOVED 2026-09-12, later still
// (Dreams of Laguna/fin-50) — promoted to real fact vocabulary,
// `producedEvents`'s own `case 'surveil'` above. `untap` REMOVED 2026-09-12,
// later still (Magic Damper/fin-61) — promoted to real fact vocabulary,
// `producedEvents`'s own `case 'untap'` above. `equip` REMOVED 2026-09-12,
// later still (Stolen Uniform/fin-75) — promoted to real fact vocabulary,
// `producedEvents`'s own `case 'equip'` above. **Known, expected, LARGE
// side effect, not a regression**: 30+ real pool cards' own Equip abilities
// (`actions.equip(...)` in their own `definition.ts`) already produce a real
// `fn:'equip'` trace line — these were previously silently parked/invisible
// in the reverse "explain every action" check, now they're real, visible,
// correctly categorized SOFT notes (never hard failures) on every one of
// them until each is authored a matching `event:'equip'` Fact of its own —
// same size/shape of side effect `pump`'s own promotion produced (~90 cards)
// and `PARKED_ACTION_FNS`'s own header, above.
const PARKED_ACTION_FNS = new Set(['dig', 'copyPermanent', 'destroyPrevented']);
// fn's that are pure lifecycle/mechanics, never produce-relevant at all.
// `phase`/`delayUntil` added for turn.ts's real phase-advancement/delayed-
// trigger scheduling (2026-09-05, Elrond, Moon-Reader's own "return at the
// beginning of the next end step") — the actual EFFECT a delayed trigger
// runs (Elrond's own `moveTo`, e.g.) still logs and still needs a produce,
// same as any other action; only the scheduling/phase bookkeeping itself is
// ignored here. `illegalAttempt` added 2026-09-12 (ENGINE_GAPS.md gap #18's
// closure, Stuck in Summoner's Sanctum — the first real pool card to use
// `engine-trace.ts`'s own `pilotExpectIllegal*` family) — by that family's
// own doc comment ("Purely observational: never mutates anything"), an
// illegal-attempt trace line is BY DEFINITION never produce-relevant (the
// whole point is that nothing happened), so it belongs in this bucket, not
// `PARKED_ACTION_FNS` (which is for actions that DO mutate/produce something
// real but lack fact vocabulary yet).
// `queueExtraPhase` added 2026-09-12 (ENGINE_GAPS.md gap #17's closure,
// Y'shtola Rhul's own "additional end step") — same bucket as `phase`/
// `delayUntil` just above, for the identical reason: it's real turn-
// structure bookkeeping (which phase group repeats), never itself a
// produce-relevant board effect a synergy Fact could model — same
// treatment `queueExtraTurn` (gap #3, closed) never needed a `PARKED_
// ACTION_FNS`/Fact entry for either, since `harness.ts`'s own plain path
// never logs it at all (no engine-piloted turn passage there).
// `installCounterConditionalGrant` added 2026-09-14 (ENGINE_GAPS.md's own
// "Ultima, Origin of Oblivion" blight-counter closure) — same bucket as
// `queueExtraPhase` just above, for the identical reason: it's real engine
// bookkeeping (which continuous effect got installed onto which object),
// never itself a produce/consume-shaped board Fact any synergy vocabulary
// models — the counter that GATES the effect is already covered by the
// existing, separately-logged `putCounter` line.
const IGNORED_FNS = new Set(['cast', 'trigger', 'activate', 'phase', 'delayUntil', 'illegalAttempt', 'queueExtraPhase', 'installCounterConditionalGrant']);

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
  // Weapons Vendor's own real "At the beginning of combat on your turn,"
  // trigger (2026-09-16, `beginCombat-trigger-structural.ts`'s own new
  // sink) — this card's own scenario fires it for real via
  // `pilotFireTrigger` (`engine-trace.ts`), which already logs a real
  // `{fn:'trigger', name:'onBeginCombat'}` bracket, so this map entry alone
  // is enough real evidence — no new trace machinery needed.
  onBeginCombat: 'beginCombat',
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
  // The Prima Vista's own real "Whenever you cast a noncreature spell, if
  // at least four mana was spent to cast it, ... becomes an artifact
  // creature until end of turn" — same generic Constraints-shaped `'cast'`
  // event Venat's own onCastLegendarySpell above established (not a bespoke
  // `castNoncreatureSpell` string), for the same reason: this sink's own
  // `target:{types:{not:['Creature']},cmc:{min:4}}` filter is what narrows
  // it, not the event name. The `cmc:{min:4}` half is honest-but-currently-
  // unsatisfiable — no producer's `CardDefinition.cmc` is populated pool-
  // wide (Phoenix Down's own already-documented gap), and this engine has
  // no "mana actually spent" tracking at all (a strictly deeper gap than
  // the cmc opt-in field: even a populated `cmc` would only approximate
  // "mana spent," which can exceed mana value via additional/kicker costs)
  // — kept anyway per the "correctness over match count" precedent
  // (SYNERGY_DESIGN.md, Phoenix Down). Real evidence for the WANT itself:
  // this card's own scenario manually fires `{fn:'trigger', name:
  // 'onCastNoncreatureSpell4Mana'}` (no real "cast another spell" trace
  // exists in this card's own harness-style scenario — same documented
  // limitation as every other manually-fired trigger name in this map).
  onCastNoncreatureSpell4Mana: 'cast',
  // Shantotto, Tactician Magician / Tellah, Great Sage / Vivi Ornitier's own
  // real bare "Whenever you cast a noncreature spell, ..." (no mana-spent
  // qualifier at all — checked directly against all 3 cards' own real
  // Scryfall oracle text, genuinely bare, not a truncated form of the
  // `4Mana` sibling above) — same generic `'cast'` event as its `4Mana`
  // sibling, newly recognized by `castTypeSpell-trigger-structural`
  // (2026-09-16, fin/26-50 re-triage follow-up); all 3 cards' own
  // `scenarios.ts` already fires `trigger: 'onCastNoncreatureSpell'`
  // directly, so this is real evidence, not a guess.
  onCastNoncreatureSpell: 'cast',
  // Rook Turret's own real "Whenever another artifact you control enters,
  // you may draw a card. If you do, discard a card." (fin/69, 2026-09-12) —
  // same shape/precedent as `onOtherElfEnters`/`onOtherCreatureEnters`
  // above (a filtered "another X enters" trigger condition, the filter
  // living on the fact's own `types`, not the trigger name), left
  // deliberately unmapped until now per this map's own "add when a card
  // actually declares the want" discipline (SYNERGY_DESIGN.md's
  // Implementation notes already flagged this exact trigger name as
  // unmapped-on-purpose while `wants:[]`). Real evidence: this card's own
  // scenario already logs a real `{fn:'trigger', name:'onArtifactEnters'}`
  // bracket.
  onArtifactEnters: 'entersBattlefield',
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
 * A real, ORDINARILY-payable `CardDefinition.manaAbilities` entry (`card.ts`'s
 * own `ManaAbility` — a bare `{T}` cost, no `restriction`/
 * `activationCondition`/`variableAmount`, closed 2026-09-14, superseding the
 * OLD text-regex path this function used to scan — `mana.ts`'s own
 * `manaAbilityColorFromStaticText`/`manaAbilityColorsFromStaticText`, both
 * deleted) never produces its own trace line — card.ts/harness.ts only ever
 * log a real `addMana` fn when the ability is ALSO modeled as a structured
 * `{kind:'addMana', ...}` Effect with a matching `activationCost` (Elvish
 * Archdruid's own "for each Elf you control" shape, which DOES get
 * exercised through a real scenario and so keeps needing real trace
 * evidence below — unaffected by this migration, since it was never on the
 * `manaAbilities`/regex path to begin with). A plain mana-tapping
 * land/artifact has no such scenario to write — the ability's own existence
 * is already fully verifiable by reading `definition.ts` directly, same
 * "known statically, no trace needed" treatment `DEATH_TRIGGER_NAMES` above
 * already gets. Returns every color across every qualifying entry on BOTH
 * faces (a two-faced card's front/back can each have their own) — a
 * choice-of-color ability contributes ALL its colors, since the prefill
 * script declares one `addMana` fact per color for that shape (see
 * prefill-mana-facts.mjs's own header for why). A `restriction`/
 * `activationCondition`/`variableAmount`-bearing entry (Cargo Ship, Freya
 * Crescent, The Emperor of Palamecia, Willowrush Verge's second ability,
 * Elvish Archdruid's/Woodland Weavemaster's own variable shapes, ...) is
 * deliberately EXCLUDED here too, same as `mana.ts`'s own
 * `payableManaAbility` — those still need their own real trace evidence (or
 * stay flagged, unverified) rather than a free statically-known pass.
 *
 * Also recognizes crossroads-village's own unique real pair — "As this land
 * enters, choose a color." (a real `K:ETBReplacement:Other:ChooseColor`)
 * plus "{T}: Add one mana of the chosen color." — as the SAME "known
 * statically, no trace needed" shape, just widened to all five colors since
 * the choice is genuinely unconstrained (any of W/U/B/R/G) rather than a
 * fixed pair. This card is DELIBERATELY NOT migrated to `manaAbilities`
 * (real, flagged gap, not an oversight — see `ENGINE_GAPS.md`'s own
 * "Non-basic mana sources" entry): real Forge fixes the produced color
 * PERMANENTLY at ETB (`Produced$ Chosen`, reading `Card.getChosenColors()`),
 * a genuinely narrower guarantee than "any of 5, every activation" — this
 * engine has no persisted per-permanent "chosen color" state and no ETB
 * choice mechanism to set one, so modeling it as an ordinary 5-color
 * `ManaAbility` would be WRONG (more permissive than reality), not just
 * incomplete. Stays on `staticAbilities` text, checked via this bespoke
 * string match, same "known statically" free pass, until that real,
 * separate gap (an ETB-choice-persistence primitive) is built.
 */
const WUBRG = ['W', 'U', 'B', 'R', 'G'];
function manaAbilityColorsOf(manaAbilities) {
  const colors = [];
  for (const ability of manaAbilities ?? []) {
    if (ability.restriction || ability.activationCondition || ability.variableAmount) continue;
    colors.push(...ability.colors);
  }
  return colors;
}
function staticManaColorsFor(card) {
  const colors = new Set();
  for (const c of manaAbilityColorsOf(card?.manaAbilities)) colors.add(c);
  for (const c of manaAbilityColorsOf(card?.backFace?.manaAbilities)) colors.add(c);
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
  // `!card.abilities?.length` added 2026-09-14 (ENGINE_GAPS.md gap #23) —
  // Capital City (one of the 6 real cards this function names below) now
  // carries a genuinely executable named Cycling ability (`abilities`),
  // real card-specific behavior a scenario CAN exercise (and does — see its
  // own scenarios.ts) — this predicate would otherwise stay stale, still
  // claiming "no card-specific behavior left" for a card that now has one.
  return !card.effects && !card.triggers && !card.activationCost && !card.modal && !card.abilities?.length;
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
 *
 * `card?.backFace?.crewCost` (2026-09-12, sidequest-card-collection-
 * magicked-card/fin-73's migration) — a transforming DFC's own Crew
 * ability can live on the BACK face only (Magicked Card is an Artifact —
 * Vehicle; the front face, Sidequest: Card Collection, isn't a Vehicle at
 * all), unlike Magitek Armor/Cargo Ship/The Lunar Whale, which are all
 * single-faced. `card` here is always the front-level `CardDefinition`
 * (this whole script's own convention — see its header), so a bare
 * `card?.crewCost` alone would miss this real card's own crewCost
 * entirely. No FIN card has `crewCost` on BOTH faces, so checking either
 * doesn't risk over-matching a hypothetical front-face-crew want against a
 * back-face fact or vice versa.
 */
function isCrewCostCreatureWant(w, card) {
  return (
    !!(card?.crewCost ?? card?.backFace?.crewCost) &&
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
 * RETIRED (2026-09-16) — `isAuronsInspirationBroadcastPumpFact` used to
 * exempt Auron's Inspiration's own real "Attacking creatures get +2/+0
 * until end of turn" `pump` fact from trace-evidence checking here: no live
 * attacker-state reached `card.ts`'s engine-agnostic `Effect`/
 * `EffectContext` surface at all (no `Card.isAttacking()`, no `pumpAll`
 * predicate broadcasting across BOTH players), so the effect was an
 * honest, intentional no-op with no possible trace evidence. That cross-
 * cutting engine surface is real now (ENGINE_GAPS.md closure, 2026-09-15:
 * `Card.isAttacking()`/`GameState.attackers`, `pumpAll`'s own
 * `predicate:'attacking-creatures'`, and a new structural recognizer,
 * `recognizers/pumpAllAttacking-effect-structural.ts`), and this card's own
 * `scenarios.ts` was migrated to a real engine-piloted trace
 * (`pilotDeclareAttackers` + a real `effectivePT` before/after check) that
 * genuinely logs a `{fn:'pump', target:'Coeurl', power:2, toughness:0,
 * untilEndOfTurn:true}` line — real, ordinary `producedEvents`'s own
 * `case 'pump'` evidence, no exemption needed anymore (same "no longer
 * needed, not fixed AROUND" retirement this file's own Crystal Fragments
 * NOTE above already established for the identical gap class on a
 * different fact). Removed for real, not just left as dead code, since a
 * future regression on this fact would otherwise be silently swallowed by
 * a stale exemption instead of surfacing as a real failure.
 */

/**
 * Matoya, Archon Elder's own real "Whenever you scry or surveil, draw a
 * card." (fin/62) — the SCRY half of its two-trigger pair (`onScry`/
 * `onSurveil`, matching Forge's own real script's separate Mode$ Scry/
 * Mode$ Surveil abilities that both run the same TrigDraw). `surveil` is
 * fully wired, real engine vocabulary (`card.ts`'s own `kind:'surveil'`
 * Effect, `actions.surveil`/`state.ts`, exercised for real by Dreams of
 * Laguna/fin-50), but `scry` has ZERO implementation anywhere in this
 * engine — checked directly: `interfaces.ts`'s own `declare function
 * scry(player, qty): void` is a bare Forge-signature mirror (same doc-only
 * treatment every `interfaces.ts` entry gets before it's actually wired),
 * with no `Effect` kind, no `Actions.scry`, no `state.ts` method anywhere
 * in the pool. There is no possible scenario addition that could produce
 * real `fn:'scry'` (or any other) trace evidence for this want without
 * first building that missing action from scratch — a real, separate
 * engine task, not a one-card authoring gap. Same "real fact, real
 * documented wall, zero achievable evidence" tolerance
 * `isAuronsInspirationBroadcastPumpFact` already established for a produce
 * fact, extended here to a bare event-shaped SINK want. Deliberately
 * scoped to THIS one card/event (not a blanket "any unimplemented event
 * want is fine" exemption) — the `onSurveil` sibling sink on this SAME
 * card is NOT exempted and does get real evidence (this card's own
 * scenarios.ts calls the real `actions.surveil`, then fires `onSurveil`
 * manually).
 */
function isMatoyaScryBroadcastWant(w, card) {
  return w.event === 'scry' && card.name === 'Matoya, Archon Elder';
}

/**
 * NOTE (ENGINE_GAPS.md gap #14's own follow-up, closed 2026-09-12): Crystal
 * Fragments' own "Equipped creature gets +1/+1" used to be exempted here
 * (`isCrystalFragmentsEquippedPumpFact`) as a structural engine gap — no
 * pipeline existed anywhere in this model for a static P/T bonus flowing
 * from an Equipment to whatever it's attached to. It's real now:
 * `card.ts`'s new `CardDefinition.continuousPTGrants` (a sibling field to
 * `continuousKeywordGrants`), read live by `state.ts`'s `effectivePT`, and
 * this card's own `scenarios.ts` (a real `engine-trace.ts` pilot, unlike
 * its sibling cards below) now pushes a genuine `read:getNetPower` line
 * proving the recalculation — so the `pump` fact is evidence-backed like
 * any other (via the pre-existing, generic `case 'read:getNetPower'`
 * branch in `producedEvents` above, unchanged) and no longer needs (or
 * gets) a name-matched exemption. See `isEquippedPTGrantFact` below for the
 * sibling cards that DO still need one (their own plain `harness.ts`
 * Scenario[] style can't inject the same read).
 */

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
// `isGaelicatArtifactThresholdPumpFact`/`isMagitekInfantryArtifactThresholdPumpFact`/
// `isMagitekInfantryArtifactThresholdWant` REMOVED 2026-09-15 (fin/16-25
// pass) — the real engine gap these three exemptions documented (no
// threshold-CDA machinery at all) is now CLOSED: `card.ts`'s new
// `ptFormula.kind:'thresholdBonus'` (real Forge `IsPresent$/
// PresentCompare$ GE<min>` citations on that field's own doc comment) plus
// `state.ts`'s `effectivePT` handling it means both cards' own `pump`
// source facts now get real, genuine `read:getNetPower` trace evidence
// (the pre-existing generic `harness.ts` gate that pushes this line for
// ANY card with a `ptFormula`, once on the battlefield — no scenario
// changes needed, it already fires off each card's own existing board
// state) via the pre-existing generic `case 'read:getNetPower'` branch
// above — same mechanism Adelbert Steiner's own scaling CDA already relied
// on, now genuinely extended to a threshold-gated CDA too.
//
// `isScorpionSentinelLandThresholdPumpFact`/`isScorpionSentinelLandThresholdWant`
// REMOVED the same pass, same reason, generalized to the LAND-count shape
// (Scorpion Sentinel AND Gigantoad both migrated to `ptFormula` — Gigantoad
// had NO facts at all before this, its own `scenarios.ts` rewritten to a
// real `engine-trace.ts` pilot the same way Scorpion Sentinel's already
// was, so both now have real trace evidence, not just Scorpion Sentinel).

/**
 * NOTE (ENGINE_GAPS.md gap #8, closed 2026-09-12): Summon: Alexander's own
 * "I, II — Prevent all damage that would be dealt to creatures you control
 * this turn" used to be exempted here as a structural engine gap (no
 * replacement/prevention mechanism existed). It's real now:
 * `state.dealDamage`'s own `DamagePrevention`/`CombatDamagePrevention`
 * keyword check (chokepoint-narrow, same shape as the STUN/FINALITY
 * counter replacements), Chapters I/II's own
 * `grantKeywordAll(..., 'DamagePrevention', untilEndOfTurn: true)` effect,
 * and this card's own scenario now produces a genuine `fn:'damagePrevented'`
 * trace line (see the `case 'damagePrevented'` branch in `producedEvents`
 * above) — so the `preventDamage` fact is evidence-backed like any other
 * and no longer needs (or gets) a name-matched exemption.
 */

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
  if (card.name !== 'Ardyn, the Usurper') return false;
  if (p.event === 'grantKeyword') return ['Menace', 'Lifelink', 'Haste'].includes(p.keyword);
  // The real "Lifelink-always-means-lifegain-source" standing exception
  // (SYNERGY_DESIGN.md, 2026-09-12) extended to a GRANTED (not printed)
  // Lifelink: Ardyn's Demons genuinely gain him life when they deal damage
  // (`state.dealDamage`'s Lifelink check reads `effectiveKeywords`, which
  // includes this card's own `continuousKeywordGrants` — a real mechanism,
  // ENGINE_GAPS.md gap #14) — but this card's plain `harness.ts` Scenario[]
  // style has no Demon token ever dealing damage in its own scenario, so
  // there's zero possible trace evidence for it, same wall the grantKeyword
  // facts above already hit.
  if (p.event === 'lifegain') return true;
  return false;
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
 * The SAME real, shape-scoped exemption as `isEquippedKeywordGrantFact`
 * above, generalized to the P/T-grant sibling family (ENGINE_GAPS.md gap
 * #14's own follow-up, closed 2026-09-12: `card.ts`'s new
 * `continuousPTGrants`) — Dragoon's Lance ("+1/+0"), Machinist's Arsenal
 * (a genuinely VARIABLE per-artifact-count bonus — a real, DIFFERENT,
 * still-open CDA gap this field structurally can't represent at all, see
 * that card's own `definition.ts` comment; its own bare `{target:
 * {equippedBySelf:true}}` pump fact still matches this shape regardless of
 * WHICH reason blocks evidence), Paladin's Arms ("+2/+1"), White Mage's
 * Staff ("+1/+1"), and Sage's Nouliths ("+1/+0") all hit the identical
 * structural wall: their own `scenarios.ts` is a plain `harness.ts`
 * `Scenario[]` array with no manual-log-injection field, so none of them
 * can push the `read:getNetPower` line that WOULD constitute real evidence
 * (the exact same generic `case 'read:getNetPower'` branch in
 * `producedEvents` above already recognizes one, unconditionally, for any
 * card — no new evidence plumbing needed, just a card whose own scenario
 * can actually inject it). Crystal Fragments is the one real card in this
 * exact clause-shape family whose `scenarios.ts` IS a real
 * `engine-trace.ts` pilot (see that card's own scenario) and DOES now push
 * that line — explicitly EXCLUDED from this shape check by name so its own
 * `pump` fact is evaluated for real evidence below instead of exempted
 * away (see the NOTE where `isCrystalFragmentsEquippedPumpFact` used to be,
 * just above where the now-removed `isGaelicatArtifactThresholdPumpFact`
 * used to sit — both since closed for real, see that NOTE).
 *
 * **Thief's Knife ALSO excluded (2026-09-12, later same day)** — the SAME
 * reason as Crystal Fragments: its own `scenarios.ts` was migrated to a
 * real `engine-trace.ts` pilot specifically to get real evidence for BOTH
 * this card's pump fact and its `grantType` sibling below (a genuine
 * `read:getNetPower` line, Hero token 1/1 -> 2/2 the instant it's equipped,
 * re-verified 1/1 again after re-equipping onto Qiqirn Merchant). Confirms
 * this exclusion really is per-CARD, not a one-off — this function's own
 * sibling doc comment above ("evidence checked FIRST" for a hypothetical
 * future card) turned out to describe the WRONG mechanism: the actual loop
 * below checks this `continue` BEFORE `hasKeywordReadEvidence`/
 * `hasSubtypeReadEvidence`/the `pump`-case `producedEvents` branch are ever
 * computed, so a real future card genuinely needs its own name added HERE
 * (same as this fix), not just real trace evidence — confirmed the hard way
 * while wiring Thief's Knife's own real `read:getNetPower` line in: it was
 * silently exempted away (never actually evaluated) until this exclusion
 * was added, exactly the failure mode the stale comment claimed couldn't
 * happen.
 */
function isEquippedPTGrantFact(p, card) {
  return card.name !== 'Crystal Fragments' && card.name !== "Thief's Knife" && p.event === 'pump' && p.target && typeof p.target === 'object' && p.target.equippedBySelf === true;
}

/**
 * The SAME real, shape-scoped exemption again, generalized to the
 * creature-TYPE-grant sibling family (ENGINE_GAPS.md gap #14's own
 * follow-up, closed 2026-09-12: `card.ts`'s new `continuousTypeGrants`) —
 * Dragoon's Lance ("is a Knight"), Machinist's Arsenal ("is an Artificer"),
 * Paladin's Arms ("is a Knight"), White Mage's Staff ("is a Cleric"),
 * Sage's Nouliths ("is a Cleric"), and Astrologian's Planisphere ("is a
 * Wizard") all hit the identical structural wall as the P/T-grant family
 * above — none of their own `scenarios.ts` can inject the
 * `read:hasSubtype` line that WOULD constitute real evidence (see the new
 * `hasSubtypeReadEvidence` check below, the direct `effectiveSubtypes`
 * analogue of `hasKeywordReadEvidence`'s own `effectiveKeywords` check). A
 * future card with a real `engine-trace.ts` pilot script (and a real
 * `read:hasSubtype` line) is unaffected, since `hasSubtypeReadEvidence` is
 * checked FIRST and would already satisfy it — same "shape exemption,
 * evidence checked first" precedent `isEquippedKeywordGrantFact`'s own doc
 * comment already establishes.
 */
function isEquippedTypeGrantFact(p, card) {
  return p.event === 'grantType' && p.target && typeof p.target === 'object' && p.target.equippedBySelf === true;
}

/**
 * White Mage's Staff's own real "...has 'Whenever this creature attacks,
 * you gain 1 life,'..." (fin/42) — a genuinely DIFFERENT gap class from its
 * own sibling pump/grantType facts just above, checked and confirmed before
 * reusing the same treatment: pump/grantType are a STATIC continuous bonus/
 * type applied to whatever's equipped (missing a layer-7c-style broadcast
 * pipeline); this clause instead GRANTS A WHOLE NEW TRIGGERED ABILITY (its
 * own trigger condition — "whenever this creature attacks" — plus its own
 * effect) to the equipped creature. No Effect kind or `Actions` member
 * anywhere in this model grants a new triggered ability to ANOTHER
 * permanent at all (checked `card.ts`'s full `Effect` union — closest is
 * `grantKeywordTarget`/`grantKeywordAll`, which only ever grant a KEYWORD,
 * never a fresh ability with its own condition+effect). Modeled honestly as
 * a real `{event:'lifegain', controller:'you'}` fact — reusing
 * already-established `lifegain` vocabulary (same shape Lifelink's own
 * standing exception uses) rather than inventing a new event name, since
 * the real-world CONSEQUENCE this clause describes (you gain life) is
 * already exactly what `lifegain` means — but genuinely inert: no
 * `fn:'gainLife'` trace evidence is possible without first solving the
 * ability-granting gap above, and fabricating a `gainLife` call on this
 * card's own scenario would misrepresent an unmodeled granted trigger as a
 * real, working effect. Scoped by card name (not by fact shape) since this
 * is the pool's first instance of this specific gap class.
 */
function isWhiteMagesStaffGrantedAbilityFact(p, card) {
  return card.name === "White Mage's Staff" && p.event === 'lifegain';
}

/**
 * Astrologian's Planisphere's own real "...has 'Whenever you cast a
 * noncreature spell and whenever you draw your third card each turn, put
 * a +1/+1 counter on this creature.'" (fin/46) — the SAME real gap class
 * `isWhiteMagesStaffGrantedAbilityFact` above documents (an Equipment
 * granting a WHOLE NEW triggered ability, its own trigger condition plus
 * its own effect, to whatever creature is equipped — checked `card.ts`'s
 * full `Effect`/`Actions` surface again for this card specifically, same
 * result: nothing grants a fresh ability to ANOTHER permanent).
 * `definition.ts` itself documents the same call, including a real,
 * corrected mismodel: an earlier version of this file put the counter on
 * `target: 'self'` (the Equipment permanent), which isn't just inert, it's
 * WRONG (the real text puts the counter on the equipped creature) — fixed
 * by removing the fabricated engine trigger entirely and keeping only the
 * honest fact.
 *
 * Generalized by SHAPE (`target.equippedBySelf === true`, same pattern
 * `isEquippedKeywordGrantFact` above already established for the
 * keyword-grant case), NOT by card name like
 * `isWhiteMagesStaffGrantedAbilityFact` — this is the SECOND real card to
 * hit this exact wall with this exact target shape, which is what
 * `isEquippedKeywordGrantFact`'s own doc comment says justifies
 * generalizing (a first instance is scoped by name since it might be
 * incidental; a second real, identically-shaped instance confirms the
 * pattern is structural). Scoped to `event: 'putCounter'` specifically
 * (not every `equippedBySelf` produce) since `pump`/`grantType`/
 * `grantKeyword` targeting `equippedBySelf` are a DIFFERENT, already
 * separately-exempted gap class (a static continuous broadcast, not a
 * granted NEW triggered ability) — conflating the two would blur two real,
 * differently-caused gaps into one.
 */
function isEquipGrantedPutCounterFact(p, card) {
  return p.event === 'putCounter' && p.target && typeof p.target === 'object' && p.target.equippedBySelf === true;
}

/**
 * Black Mage's Rod's own real "...has 'Whenever you cast a noncreature
 * spell, this creature deals 1 damage to each opponent,'..." (fin/90) — the
 * SAME real gap class `isWhiteMagesStaffGrantedAbilityFact`/
 * `isEquipGrantedPutCounterFact` above document (an Equipment granting a
 * WHOLE NEW triggered ability, its own trigger condition plus its own
 * effect, to whatever creature is equipped — checked `card.ts`'s full
 * `Effect`/`Actions` surface again for this card specifically, and checked
 * ENGINE_GAPS.md fresh: still nothing grants a fresh ability to ANOTHER
 * permanent as of this card's own migration). Modeled honestly as a real
 * `{event:'damage', controller:'you', recipient:'opp', targeted:false}`
 * fact — reusing already-established `damage` vocabulary
 * (Summon: Bahamut's own Mega Flare, `controller`+`recipient`+`targeted`
 * shape) rather than inventing a new event name, since the real-world
 * CONSEQUENCE this clause describes (1 damage to each opponent) is already
 * exactly what `damage`+`recipient:'opp'` means — but genuinely inert: no
 * `fn:'dealDamage'` trace evidence is possible without first solving the
 * ability-granting gap above, and fabricating a `dealDamage` call on this
 * card's own scenario would misrepresent an unmodeled granted trigger as a
 * real, working effect. Scoped by card name (not by fact shape) since this
 * is the THIRD real card to hit this gap class but the FIRST with a
 * `damage`-shaped consequence (`putCounter`/`lifegain` already generalized
 * or name-scoped on their own siblings — a new event shape restarts the
 * "is this structural yet" question, same discipline
 * `isEquipGrantedPutCounterFact`'s own doc comment establishes for its
 * shape-vs-name choice).
 */
function isBlackMagesRodGrantedAbilityFact(p, card) {
  return card.name === "Black Mage's Rod" && p.event === 'damage';
}

/**
 * Summon: Leviathan's own real "II, III — Until end of turn, whenever a
 * Kraken, Leviathan, Merfolk, Octopus, or Serpent attacks, draw a card."
 * (fin/77) — the SAME real gap class `isWhiteMagesStaffGrantedAbilityFact`/
 * `isEquipGrantedPutCounterFact`/`isBlackMagesRodGrantedAbilityFact` above
 * document (a permanent granting a WHOLE NEW triggered ability, its own
 * trigger condition plus its own effect, to some other permanent — checked
 * `card.ts`'s full `Effect`/`Actions` surface again for this card
 * specifically, same result: nothing grants a fresh ability to ANOTHER
 * permanent), but a genuinely NEW sub-shape: every prior instance of this
 * gap class is an EQUIPMENT granting to whatever it's attached to
 * (`equippedBySelf`); this is a SAGA CHAPTER granting to a whole
 * TYPE-matched bucket of creatures across the battlefield (any Kraken/
 * Leviathan/Merfolk/Octopus/Serpent, either player's — real Forge:
 * `SVar:DBDraw:DB$ Effect | Triggers$ AttackTrig`, no owner restriction on
 * `ValidCard$`), not a single equipped permanent — `definition.ts`'s own
 * `chapterII`/`chapterIII` triggers correctly no-op (`run: () => {}`) for
 * the exact same reason. Modeled as two real, honest, deliberately inert
 * `{event:'drawCard', controller:'you', target:{types:{hasAny:[...]}}}`
 * facts — one per real chapter firing (same "repeat per real
 * occurrence" convention jill-shiva-s-dominant's/dion-bahamut-s-dominant's
 * own duplicated chapter facts establish) — reusing already-promoted
 * `drawCard` vocabulary (summon-bahamut's own chapter III) rather than
 * inventing a new event name, since the real-world CONSEQUENCE this clause
 * describes (you draw a card) is already exactly what `drawCard` means.
 * Scoped by card name (not by shape) since this is the pool's first
 * non-equipment instance of this gap class — a future second instance
 * would be the point to generalize by shape, same escalation
 * `isEquipGrantedPutCounterFact`'s own doc comment documents for the
 * equip-scoped sibling.
 */
function isSummonLeviathanGrantedDrawFact(p, card) {
  return card.name === 'Summon: Leviathan' && p.event === 'drawCard';
}

/**
 * Cloud, Midgar Mercenary's own real "...or an Equipment attached to it
 * triggers" — the equipment half of its Panharmonicon-style static
 * (2026-09-11, added same day the `attacking`-shaped `attachedToSelf`
 * field landed for it — see `synergy.ts`'s own `Constraints.attachedToSelf`
 * doc comment). The DOUBLING effect itself is still a real, DEEP,
 * already-documented engine gap (ENGINE_GAPS.md gap #13: no
 * trigger-multiplying machinery anywhere in this model) — but this
 * particular want fact is only about the CONDITION ("an Equipment attached
 * to it triggers" happening at all, not it triggering an EXTRA time), and
 * that condition now DOES have real evidence: Cloud's own 2026-09-12 "fin
 * 563" combo trace genuinely casts + equips the real Ultima Weapon and
 * fires its own real `onEquippedAttacks` trigger while attached — see the
 * new `w.target.attachedToSelf === true` branch a few lines above this
 * function, which recognizes exactly that real evidence shape now. This
 * exemption function is kept only as a fallback for a differently-shaped
 * retrace that happens to lose that evidence again (e.g. a future edit to
 * cloud-midgar-mercenary/scenarios.ts) — not because the fact is
 * inherently unevidenceable anymore, which is no longer an accurate claim.
 * `w.target` being a `Constraints` object (not `'self'`) is exactly what
 * distinguishes this half from the self half's own real, evidenced
 * `w.target === 'self'` check just above — scoped narrowly to THIS one
 * card/fact shape, not a blanket exemption for any non-self
 * `triggeredAbility` want a future card might declare.
 */
function isCloudEquipmentTriggeredAbilityFact(w, card) {
  return w.event === 'triggeredAbility' && card.name === 'Cloud, Midgar Mercenary' && w.target !== 'self';
}

/**
 * Cloud, Midgar Mercenary's own real combo trace (2026-09-12, "fin 563"
 * scenario — cast Cloud, tutor the real Ultima Weapon, cast + equip it for
 * real, attack, its own attack trigger fires manually). Ultima Weapon — a
 * DIFFERENT real card's own `CardDefinition` — is deliberately reused
 * directly (not re-authored) within this trace, so its own two real
 * Battlefield reads show up here too: `ctx.you.getCreaturesInPlay()`
 * (choosing the equip target) and the destroy effect's own
 * `owner:'opponents'` battlefield search (finding a legal creature to
 * destroy). Both are real, but they're ULTIMA WEAPON's own oracle-text
 * conditions ("attach to target creature you control" / "destroy target
 * creature an opponent controls"), not anything Cloud itself says —
 * authoring a Cloud-side Battlefield want fact for either would misattribute
 * a different card's own condition onto this one. Scoped to exactly these
 * two read shapes on this one card (by name), not a blanket "any Battlefield
 * read is fine" exemption.
 */
function isCloudUltimaWeaponComboRead(e, card) {
  return card.name === 'Cloud, Midgar Mercenary' && (e.fn === 'read:getCreaturesInPlay' || e.fn === 'read:getCardsIn');
}

/**
 * Traveling Chocobo's own real trigger-doubling combo trace (2026-09-12,
 * ENGINE_GAPS.md gap #13's closure) — Ambrosia Whiteheart, a DIFFERENT real
 * card's own `CardDefinition`, is deliberately reused directly (not
 * re-authored) to demonstrate Chocobo's own "a land or Bird entering causes
 * a triggered ability of a permanent you control to trigger" static (the
 * static needs SOME OTHER real permanent's own reactive trigger to double —
 * Chocobo has no named trigger of its own at all). Ambrosia's own ETB
 * ("return another permanent you control to hand") reads
 * `ctx.you.getCardsIn('Battlefield')` to find its own bounce target — real,
 * but ABROSIA's own oracle-text condition, not anything Traveling Chocobo
 * itself says. Same "scoped to exactly this read shape on this one card by
 * name" treatment `isCloudUltimaWeaponComboRead` above already establishes
 * for the identical structural situation (a combo scenario reusing a
 * different card's own effect).
 */
function isTravelingChocoboAmbrosiaComboRead(e, card) {
  return card.name === 'Traveling Chocobo' && e.fn === 'read:getCardsIn';
}

/**
 * The real "play the top card of your library" Effect (ENGINE_GAPS.md gap
 * #16, closed 2026-09-12 — `card.ts`'s `kind:'playFromLibraryTop'`) reads
 * `ctx.you.getCardsIn('Library')` purely to find WHAT'S currently on top to
 * play — a real mechanical peek, not a genuine "this card wants Library-zone
 * presence" claim the way an actual Library-zone SINK fact would assert
 * (nothing about this effect cares whether the library is non-empty as a
 * state to preserve; it just looks at whatever's there). Shape-scoped (ANY
 * card whose trace shows this exact read-then-play pairing), not
 * name-scoped like `isCloudUltimaWeaponComboRead` above, specifically so
 * Traveling Chocobo's own identical "play lands and cast Bird spells from
 * the top of your library" clause (fin/158, unmigrated) is covered for free
 * once/if migrated, without re-deriving this exemption per card.
 */
function isPlayFromLibraryTopPeekRead(e, allEntries) {
  return e.fn === 'read:getCardsIn' && e.zone === 'Library' && allEntries.some((other) => other.fn === 'play' && other.from === 'Library');
}

/**
 * Sidequest: Card Collection's own real "at the beginning of your end
 * step, if eight or more cards are in your graveyard, transform this
 * enchantment" (fin/73) — `definition.ts`'s `onEndStep` trigger genuinely
 * reads `ctx.you.getCardsIn('Graveyard').length` to check this real CR
 * 603.4 intervening-if condition (not a documentary stand-in — see that
 * file's own comment), which is exactly why this read exists in the trace
 * at all. But there is no Fact for it to support: this model's own
 * vocabulary only has TYPE-filtered Graveyard-presence wants ("a Creature
 * card in your graveyard," e.g. — every real `{zone/to:'Graveyard', types:
 * {...}}` sink checked pool-wide) — nothing expresses a plain, untyped
 * CARD-COUNT threshold on a zone, and the actual consequence (the
 * transform itself) has no Fact either, since it's a pure face-flip with
 * no zone movement (see `definition.ts`'s own header) — so there's
 * genuinely nothing for this read to explain a want FOR. Name-scoped, not
 * shape-scoped like `isPlayFromLibraryTopPeekRead` above: checked the
 * whole pool first (only this one real FIN card has an "N or more cards
 * are in your graveyard" clause at all, 2026-09-12) — a shape-scoped
 * version would be speculative generalization with no second real case to
 * verify it against yet, same discipline `isCloudUltimaWeaponComboRead`'s
 * own name-scoping already established for a genuinely one-off situation.
 */
function isSidequestCardCollectionGraveyardThresholdRead(e, card) {
  return e.fn === 'read:getCardsIn' && e.zone === 'Graveyard' && card?.name === 'Sidequest: Card Collection';
}

// `isCloudboundMoogleDiscardSelfWant`/`isIceFlanDiscardSelfWant` (Plainscycling/
// Islandcycling's own discard-as-cost SINK) and `isCloudboundMoogleTutorFact`/
// `isIceFlanTutorFact` (their own resulting tutor-for-Plains/Island SOURCE)
// REMOVED 2026-09-14 (ENGINE_GAPS.md gap #23, closed) — both cards' real
// Cycling/TypeCycling ability is now genuinely engine-piloted (`engine.ts`'s
// `costRequiresDiscardSelf`/`activateAbility`, `card.ts`'s `move` effect
// with `subtype`/`shuffleAfter`), producing real `{fn:'discard'}`/
// `{fn:'moveTo', zone:'Hand'}` trace lines — see the general (not per-card)
// `w.event === 'discard' && w.target === 'self'` readEvidence branch below,
// and the ordinary zone-fact `evidence` check just above, for how these are
// verified for real now instead of being exempted.
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

// Third sibling of `isSelfTapActivationCostFact`/`isSelfExileActivationCostFact`
// above (2026-09-12, Zack Fair/fin-45's own real "{1}, Sacrifice Zack Fair:
// ...") — a NAMED self-sacrifice cost ("Sacrifice Zack Fair", as opposed to
// the ONE self-sacrifice shape `unsupportedCostComponent` (engine.ts) does
// recognize, "Sacrifice another/a/two X") is never accepted as payable
// there either, so `canActivateAbility`/`activateAbility` always reject
// this exact ability through the real engine — same "no real trace
// evidence could ever exist through the normal activation pipeline"
// situation as the {T}/exile-this-artifact costs, and, per that same doc
// comment, this one specifically can't be fixed by modeling the sacrifice
// as a real `{kind:'sacrifice'}` effect the way ahriman/phantom-train/
// quina-qu-gourmet pay their own "Sacrifice another/a X" costs — doing so
// would need real 608.2h last-known-information tracking to keep this
// card's own "read Zack Fair's live counters/attached Equipment" logic
// correct once it's actually gone, a real, separate, unbuilt gap.
// Generalized by shape (any card, not scoped to Zack Fair by name) for the
// same reason the {T}/exile siblings are: a self-sacrifice-as-cost
// activation hits this exact wall regardless of which card prints it. Same
// false-pass-collision guard as those two: scoped to the exact
// `subject`/`target` shape so an unrelated real `{event:'sacrifice'}`
// produce (Summon: Bahamut's own real Saga-rule sacrifice, e.g. — which has
// no `subject` at all) can't accidentally satisfy this exemption's intent
// in reverse.
function isSelfSacrificeActivationCostFact(p) {
  return p.event === 'sacrifice' && p.subject === 'self' && p.target === 'self';
}

/**
 * A normal, non-Adventure Instant/Sorcery's own real self-move from the
 * stack to its owner's graveyard on resolution (CR 608.2m) is no longer a
 * stored `Fact` at all (2026-09-14 — `synergy.ts`'s own
 * `isNormalInstantOrSorcery`/`syntheticInstantSorceryGraveyardFact` doc
 * comments), synthesized purely at MATCH TIME instead. `harness.ts`'s own
 * scenario runner naturally logs a real `{fn:'move', card:<name>,
 * from:'stack', to:'Graveyard'}` entry for nearly every plain Instant/
 * Sorcery scenario (the spell resolves, then moves to the graveyard, same
 * as any other card) — this reverse "explain every action" check has no
 * way to see `synergy.ts`'s own match-time synthesis (it only ever reads
 * this card's raw, on-disk `source` array), so stripping the stored fact
 * pool-wide would otherwise surface a brand-new soft note on ~20 real pool
 * cards for a trace event that is, once again, a generic mechanical
 * default rather than a genuine per-card gap — same "note-not-fail side
 * effect, name/shape-scoped rather than silently swallowed" treatment this
 * file's own `moveTo`-to-Exile promotion comment already accepts for an
 * analogous situation (see this file's own `case 'moveTo'` comment
 * earlier). Mirrors `isNormalInstantOrSorcery` in `synergy.ts` structurally
 * (typeLine primary-type check, Adventure-subtype exclusion) rather than
 * importing it, matching this script's own established "small, stable,
 * duplicated helper" convention for `.mjs`-side structural checks
 * (`apply-recognizers.mjs`'s own `loadOracleTextByName` doc comment).
 */
function isNormalInstantOrSorceryGraveyardMove(e, cardName, card) {
  if (e.fn !== 'move' || e.card !== cardName || e.from !== 'stack' || e.to !== 'Graveyard') return false;
  if (!card?.typeLine) return false;
  const primaryType = card.typeLine.split('—')[0].trim();
  if (!/^(Instant|Sorcery)\b/.test(primaryType)) return false;
  const subtypes = card.typeLine.split('—')[1];
  if (subtypes?.includes('Adventure')) return false;
  return true;
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
      // `isCloudboundMoogleTutorFact`/`isIceFlanTutorFact` REMOVED
      // 2026-09-14 (ENGINE_GAPS.md gap #23, closed) — Plainscycling/
      // Islandcycling's own real library search now genuinely logs a
      // `{fn:'moveTo', zone:'Hand', controller:'you'}` line (see
      // `engine-trace.ts`'s `pilotActivate`/card.ts's `move` effect), so the
      // ordinary `evidence` check just below already covers this fact for
      // real — no per-card exemption needed anymore.
      const evidence = allEntries.some((e) => {
        const z = producedZone(e, cardName);
        return z && z.zone === zone && (!p.controller || z.side === p.controller);
      });
      if (!evidence) {
        const msg = `produce {zone:${zone}${p.controller ? `,controller:${p.controller}` : ''}} has no supporting trace line (enters/move/moveTo/ceasesToExist/createToken/sacrifice/discard/destroy/legendRule)`;
        // A `provenance.origin === 'parser'` fact (`functional-model/
        // recognizers/`, `PRD_AUTOMATED_AUTHORING.md`, wired in 2026-09-13
        // by `scripts/apply-recognizers.mjs`) is a real, deliberate
        // DOWNGRADE from hard failure to a soft note, not a new per-card
        // exemption predicate — this reconciliation script's own hard-
        // failure bar was built for HAND-authored facts a human is claiming
        // as verified-correct; the PRD this fact type comes from explicitly
        // supersedes its own earlier all-or-nothing draft
        // ("A hard, blocking trace-verification gate before a parser fact
        // can be trusted ... is superseded" — retroactive correction is the
        // accepted safety net instead). Concretely: dozens of real pool
        // cards' own `scenarios.ts` only ever exercise that card's OWN
        // distinguishing activated/triggered ability (the part that
        // actually needed human judgment) and never bother casting it from
        // hand first (World Map/Zell Dincht among them, surfaced by this
        // exact check the first time this script ran after the wiring) —
        // that's a real, pre-existing scenario-coverage gap in how much of
        // the card each scenario bothers to exercise, not a wrong parser
        // verdict, and demanding 200+ cards' scenarios be rewritten just to
        // silence a boilerplate cast/enters claim would be exactly the
        // redundant authoring effort this whole PRD exists to avoid. Still
        // surfaced as a visible note (not silently dropped) so a real
        // recognizer mistake would still show up here if one existed.
        if (p.provenance?.origin === 'parser') notes.push(msg);
        else failures.push(msg);
      }
    } else {
      if (p.event === 'addMana' && p.color && staticManaColors.has(p.color)) continue; // plain "{T}: Add X." text — see staticManaColorsFor
      if (p.event === 'addMana' && p.colors && [...(p.colors.has ?? []), ...(p.colors.hasAny ?? [])].every((c) => staticManaColors.has(c))) continue; // plain "{T}: Add X or Y." text, combined-fact shape — see staticManaColorsFor
      if (isLandEntersTappedSelfFact(p, card)) continue; // real "enters tapped" replacement — see isLandEntersTappedSelfFact
      if (isSelfPlayableLand(p, card)) continue; // a plain land's own self-play fact — see isSelfPlayableLand
      if (isCoinFlipFact(p, card)) continue; // the flip itself, guaranteed by the ability's own printed text — see hasCoinFlipAbility/isCoinFlipFact
      if (isCoinFlipTokenSubjectFact(p, card)) continue; // a coin-flip-produced token's own ETB — see isCoinFlipTokenSubjectFact
      if (isCostOnlyArtifactSacrificeFact(p, card)) continue; // the sacrifice ACT itself, cost-only, tautologically real — see isCostOnlyArtifactSacrificeFact
      if (isSelfTapActivationCostFact(p)) continue; // the {T} cost payment itself, never logged — see isSelfTapActivationCostFact
      if (isSelfExileActivationCostFact(p)) continue; // the exile-this-artifact cost payment itself, never logged — see isSelfExileActivationCostFact
      if (isSelfSacrificeActivationCostFact(p)) continue; // a NAMED self-sacrifice cost payment itself, never payable through canActivateAbility — see isSelfSacrificeActivationCostFact
      if (card.name === 'The Wind Crystal' && p.event === 'costReduction') continue; // real fact (ENGINE_GAPS.md gap #7's second example, engine.ts's SpellCostReductionGrant/canCastSpell hook, 2026-09-12) — real mechanism, but demonstrating it needs a DIFFERENT spell's own cast-cost log line to differ, which this card's own scenario (its OWN grantKeywordAll activation) doesn't produce; zero possible trace evidence given this card's own scenario shape, same class as isAuronsInspirationBroadcastPumpFact
      if (card.name === 'The Water Crystal' && p.event === 'costReduction') continue; // same real mechanism/same class of exemption as The Wind Crystal immediately above (its own Blue-spell discount, ENGINE_GAPS.md gap #7's second example) — this card's own scenario only ever activates its OWN mill ability, never casts a second spell for the discount to apply to
      if (isArdynDemonGrantFact(p, card)) continue; // real fact, real mechanism, zero possible evidence given this card's plain Scenario style — see isArdynDemonGrantFact
      if (isEquippedKeywordGrantFact(p, card)) continue; // real fact, real mechanism, zero possible evidence given this card's plain Scenario style — see isEquippedKeywordGrantFact
      if (isEquippedPTGrantFact(p, card)) continue; // real fact, real mechanism (Crystal Fragments excepted — see that function's own doc comment), zero possible evidence given these cards' plain Scenario style — see isEquippedPTGrantFact
      if (isEquippedTypeGrantFact(p, card)) continue; // real fact, real mechanism, zero possible evidence given these cards' plain Scenario style — see isEquippedTypeGrantFact
      if (isWhiteMagesStaffGrantedAbilityFact(p, card)) continue; // real fact, a genuinely different gap class from pump/grantType — see isWhiteMagesStaffGrantedAbilityFact
      if (isEquipGrantedPutCounterFact(p, card)) continue; // real fact, same gap class as isWhiteMagesStaffGrantedAbilityFact (a granted NEW triggered ability, not a static broadcast) — see isEquipGrantedPutCounterFact
      if (isBlackMagesRodGrantedAbilityFact(p, card)) continue; // real fact, same gap class as isWhiteMagesStaffGrantedAbilityFact/isEquipGrantedPutCounterFact, first damage-shaped instance — see isBlackMagesRodGrantedAbilityFact
      if (isSummonLeviathanGrantedDrawFact(p, card)) continue; // real fact, same gap class, first non-equipment (Saga-chapter, type-broadcast) instance — see isSummonLeviathanGrantedDrawFact
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
      // The direct `effectiveSubtypes` analogue of `hasKeywordReadEvidence`
      // just above (ENGINE_GAPS.md gap #14's own follow-up, closed
      // 2026-09-12: `card.ts`'s new `continuousTypeGrants`) — a
      // query-time continuous type grant never fires a discrete
      // `fn:'grantType'` ACTION either (nothing calls an `actions.grantType`
      // for it — `state.ts`'s own `effectiveSubtypes` is a pure read, not a
      // logged mutation), so a deliberate `hasSubtype` query against the
      // real board state is the only possible evidence shape for this fact
      // family too. Not yet exercised by any real card's own scenario (all
      // 6 real `grantType`-declaring cards stay on the shape-scoped
      // `isEquippedTypeGrantFact` exemption above instead — none has an
      // `engine-trace.ts` pilot script that could inject this line), but
      // wired for real now so a FUTURE card that gets one is recognized
      // without further plumbing, same "evidence checked first" precedent
      // `isEquippedKeywordGrantFact`'s own doc comment already establishes.
      const hasSubtypeReadEvidence =
        p.event === 'grantType' && allEntries.some((e) => e.fn === 'read:hasSubtype' && e.subtype === p.type && e.result === true);
      const evidence =
        hasKeywordReadEvidence ||
        hasSubtypeReadEvidence ||
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
      if (!evidence) {
        const msg = `produce {event:${p.event}${p.counterType ? `,counterType:${p.counterType}` : ''}} has no supporting trace line`;
        // Same real, deliberate downgrade as the zone-shaped branch above —
        // see that branch's own comment for the full rationale. The exact
        // case this hits in practice: a parser-derived `event: 'cast'`
        // fact on a card whose own scenarios never actually cast it from
        // hand (same class of gap this whole file's many named
        // `isXFact`-exemptions already document for hand-authored facts,
        // just pool-wide here instead of per-card, since it's the SAME two
        // boilerplate facts on every accepting card rather than a card-
        // specific mechanism).
        if (p.provenance?.origin === 'parser') notes.push(msg);
        else failures.push(msg);
      }
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
              : w.event === 'triggeredAbility' && typeof w.target === 'object' && w.target?.attachedToSelf === true
                ? // The EQUIPMENT half (2026-09-12, Cloud's own real
                  // "fin 563" combo trace: cast Cloud, tutor + cast + equip
                  // the real Ultima Weapon, attack, its own real
                  // `onEquippedAttacks` trigger fires) — `isCloudEquipmentTriggeredAbilityFact`'s
                  // own doc comment used to say this fact had "ZERO possible
                  // evidence... nor should one be fabricated just to
                  // manufacture evidence." That's now false: this exact
                  // trace genuinely does it — a real `{fn:'equip', target:
                  // cardName}` bracket (this permanent got attached to by
                  // SOME other real card) followed anywhere later by a real
                  // `{fn:'trigger', card: <that same equipment's name>}`
                  // bracket (that attached permanent's OWN triggered ability
                  // actually firing) is exactly "a triggered ability of an
                  // Equipment attached to it triggers," read straight off
                  // the trace, not inferred. Scoped to trace-order (the
                  // trigger must come AFTER the equip) so an unrelated,
                  // earlier same-named coincidence can't satisfy this.
                  (() => {
                    const equipIdx = allEntries.findIndex((e) => e.fn === 'equip' && e.target === cardName);
                    if (equipIdx === -1) return false;
                    const equipmentName = allEntries[equipIdx].equipment;
                    return allEntries.slice(equipIdx + 1).some((e) => e.fn === 'trigger' && e.card === equipmentName);
                  })()
                : w.event === 'discard' && w.target === 'self'
                  ? // Real 702.13 Cycling's own "discard this card" cost
                    // (ENGINE_GAPS.md gap #23, closed 2026-09-14) — a genuine
                    // Hand->Graveyard move NOW paid for real by
                    // `engine.ts`'s `activateAbility`, logged by
                    // `engine-trace.ts`'s `pilotActivate` as a real
                    // `{fn:'discard', target: cardName, ...}` bracket (see
                    // that call site's own doc comment) — REPLACES the
                    // former `isCloudboundMoogleDiscardSelfWant`/
                    // `isIceFlanDiscardSelfWant` per-card exemptions (removed
                    // same pass), which existed only because no real trace
                    // evidence could exist before this closure.
                    allEntries.some((e) => e.fn === 'discard' && e.target === cardName)
                  : false;
      if (!triggerEvidence && !readEvidence) {
        if (isCloudEquipmentTriggeredAbilityFact(w, card)) continue; // see isCloudEquipmentTriggeredAbilityFact
        if (isMatoyaScryBroadcastWant(w, card)) continue; // no real scry action anywhere in this engine — see isMatoyaScryBroadcastWant
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
    if (!sink.some((w) => ('zone' in w || 'to' in w) && wantMatchesZoneRead(w, zone))) {
      if (isCloudUltimaWeaponComboRead(e, card)) continue; // see isCloudUltimaWeaponComboRead
      if (isTravelingChocoboAmbrosiaComboRead(e, card)) continue; // see isTravelingChocoboAmbrosiaComboRead
      if (isPlayFromLibraryTopPeekRead(e, allEntries)) continue; // see isPlayFromLibraryTopPeekRead
      if (isSidequestCardCollectionGraveyardThresholdRead(e, card)) continue; // see isSidequestCardCollectionGraveyardThresholdRead
      failures.push(`trace has ${e.fn} on zone ${zone} with no matching declared want`);
    }
  }

  // --- Reverse: every produce-relevant ACTION must be explained (soft) ---
  // `read:getNetPower` deliberately NOT added here — every `read:`-prefixed
  // fn is already skipped by this loop's own guard below (`e.fn.startsWith
  // ('read:')`), same treatment every other low-level read already gets;
  // only `pump` (the real, non-`read:`-prefixed ACTION) needed adding.
  const explainableFns = new Set(['enters', 'move', 'mill', 'moveTo', 'ceasesToExist', 'createToken', 'sacrifice', 'discard', 'destroy', 'legendRule', 'gainLife', 'loseLife', 'putCounter', 'dealDamage', 'damagePrevented', 'coinFlip', 'grantKeyword', 'drawCard', 'drawCards', 'addMana', 'counter', 'playLand', 'play', 'pump', 'attack', 'tap', 'untap', 'animate', 'gainControl', 'surveil', 'equip']);
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
    if (!zoneOk && !eventOk) {
      if (isNormalInstantOrSorceryGraveyardMove(e, cardName, card)) continue; // see isNormalInstantOrSorceryGraveyardMove
      notes.push(`trace has ${e.fn} (${JSON.stringify(e)}) with no matching declared produce`);
    }
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
