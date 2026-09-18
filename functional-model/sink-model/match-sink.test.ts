// Sanity check for the sink-only matching prototype (2026-09-17) — the
// actual point of this task, not a formality. Every sink query below is a
// stripped/adapted version of a REAL, already-authored `cards/<slug>/
// synergy.json` sink Fact (never invented), and every candidate is a REAL,
// already-authored FIN `CardDefinition` (never a synthetic placeholder):
// Summon: Bahamut (fin/1), Battle Menu (fin/9), Fight On!, Loporrit Scout,
// Aerith Gainsborough, Baron, Airship Kingdom — all confirmed present in
// `data/fin/fin_scryfall.json`.
//
// Each block below states, in its own comment, whether the new matcher's
// verdict AGREES with today's production system (`scripts/find-
// synergies.mjs`'s own real, current output — re-run and grepped by hand
// while building this file, not assumed) or DISAGREES — and if it
// disagrees, names which of the three buckets the task asked for: a real
// bug in this new matcher, a real semantic gap in the structural-matching
// approach itself, or an existing recognizer/production behavior being
// wrong. See this task's own final report for the summarized, go/no-go
// read across all of these.
import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { aerithGainsborough } from '../cards/aerith-gainsborough/definition';
import { baronAirshipKingdom } from '../cards/baron-airship-kingdom/definition';
import { battleMenu } from '../cards/battle-menu/definition';
import { fightOn } from '../cards/fight-on/definition';
import { loporritScout } from '../cards/loporrit-scout/definition';
import { summonBahamut } from '../cards/summon-bahamut/definition';
import { matchSink, deriveOccurrences } from './match-sink';
import type { SinkQuery } from './sink-query';
import { sagaChapterCompletionOccurrences } from './predicates/saga';

// ---------------------------------------------------------------------------
// A — Fight On!'s own real sink, verbatim (`cards/fight-on/synergy.json`):
// `{ "zone": "Graveyard", "controller": "you", "types": { "has": ["Creature"] } }`
// stripped of nothing but the fields `SinkQuery` always drops (this sink
// never had `annotations`/`provenance`/`role`/`triggeredBy` to begin with).
const graveyardCreatureSink: SinkQuery = { category: 'Graveyard fodder', zone: 'Graveyard', controller: 'you', types: { has: ['Creature'] } };

describe('sink A — graveyard creature (Fight On!, as-authored)', () => {
  it('AGREES: Battle Menu’s "destroy target creature" mode satisfies it (real prod match: "Battle Menu --[destroy]--> Fight On!")', () => {
    expect(matchSink(graveyardCreatureSink, battleMenu).matched).toBe(true);
  });

  it('AGREES: Loporrit Scout (no destroy/sacrifice/graveyard-move effect at all) does not satisfy it (real prod: no edge into Fight On! at all)', () => {
    expect(matchSink(graveyardCreatureSink, loporritScout).matched).toBe(false);
  });

  it('AGREES (self-check): Fight On! itself moves creatures OUT of the graveyard (Graveyard->Hand), not into it — does not satisfy its own sink', () => {
    expect(matchSink(graveyardCreatureSink, fightOn).matched).toBe(false);
  });

  it('AGREES (2026-09-17, formerly a documented DISAGREEMENT — CLOSED): Summon: Bahamut’s chapter I/II "destroy up to one target nonland permanent" ALONE still does not guarantee a Creature (guaranteed types = [] once nonLand-only) — but `deriveOccurrences` now ALSO consults `sink-model/predicates/saga.ts`’s own `sagaChapterCompletionOccurrences`, which structurally recognizes that Bahamut’s chapterIV has no self-zone-change effect, so 714.4’s completion sacrifice genuinely fires (a real `dies`/Battlefield->Graveyard occurrence) — the SAME real, Saga-automation-derived match production gets via its own hand-authored `saga-lore-and-sacrifice-structural` `dies` fact ("Summon: Bahamut --[dies]--> Fight On!"), now derived structurally instead of hand-authored. See `sink-model/predicates/saga.ts`/`saga.test.ts` for the predicate itself and its own real corpus verification.', () => {
    expect(matchSink(graveyardCreatureSink, summonBahamut).matched).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// B — Loporrit Scout's own real sink, verbatim (`cards/loporrit-scout/synergy.json`):
// `{ "event": "entersBattlefield", "controller": "you", "types": {"has":["Creature"]}, "excludeSelf": true }`
const creatureEtbSinkAsAuthored: SinkQuery = { category: 'Creature ETB (as authored, event-shaped)', event: 'entersBattlefield', controller: 'you', types: { has: ['Creature'] }, excludeSelf: true };

describe('sink B — creature ETB (Loporrit Scout, as-authored, event-shaped)', () => {
  it('DISAGREES, explained — a real, ALREADY-DOCUMENTED production bug (SYNERGY_DESIGN.md’s own "Fact unification" section), not a bug in this new matcher: production genuinely matches Baron, Airship Kingdom (a plain Land, real prod line "Baron, Airship Kingdom --[enters the battlefield]--> Loporrit Scout") purely because Baron’s hand-authored `{event:\'entersBattlefield\', tapped:true}` fact happens to share the bare event string with NO `target` wrapper for factsInteract to check `types` against — the sink’s own `types:{has:[\'Creature\']}` constraint is silently never consulted. This matcher’s own `on:\'enter\'`-trigger baseline occurrence for Baron is ZONE-shaped (carries `to:\'Battlefield\'`, mirroring `synergy.ts`’s own `syntheticEntersBattlefieldFact` convention), so it never even reaches the event-vs-event branch where that bug would apply — a different structural reason, not this matcher deliberately re-implementing the type check for this exact pairing (see sink B’ below for that check demonstrated directly).', () => {
    expect(matchSink(creatureEtbSinkAsAuthored, baronAirshipKingdom).matched).toBe(false);
  });

  it('AGREES: Battle Menu’s created Knight token does not satisfy the as-authored sink either (real prod: no "Battle Menu --> Loporrit Scout" edge at all) — both systems represent "a token enters the battlefield" as a ZONE move (`to:\'Battlefield\'`), which structurally cannot match a bare EVENT-only sink with no zone fields at all; this is the exact real, ALREADY-DOCUMENTED zone/event shape-partition regression SYNERGY_DESIGN.md’s "Fact unification" section names Loporrit Scout/Woodland Weavemaster as the two real cards it hit.', () => {
    expect(matchSink(creatureEtbSinkAsAuthored, battleMenu).matched).toBe(false);
  });

  it('AGREES: Aerith Gainsborough’s own baseline "is itself a normal permanent entering the battlefield" does not satisfy the as-authored sink either, for the identical zone/event shape reason (real prod: no such edge)', () => {
    expect(matchSink(creatureEtbSinkAsAuthored, aerithGainsborough).matched).toBe(false);
  });
});

// B' — the SAME real card's SAME real intent ("wants a Creature entering
// the battlefield"), re-expressed as a zone-shaped query instead of
// mechanically copying today's historically event-shaped encoding. This is
// NOT a production comparison (nothing on disk is authored this way today)
// — it demonstrates that once a sink is expressed the way this project's
// OWN "entering the battlefield is fundamentally a zone move" convention
// already treats every OTHER real zone-shaped fact, the new matcher gets
// exactly the semantically-intended result, unlike the fragmented as-
// authored form above.
const creatureEtbSinkZoneAdapted: SinkQuery = { category: 'Creature ETB (zone-adapted)', to: 'Battlefield', controller: 'you', types: { has: ['Creature'] }, excludeSelf: true };

describe('sink B’ — creature ETB (zone-adapted, illustrative, not an on-disk sink)', () => {
  it('correctly matches Battle Menu’s created Knight token (a real Creature token, via the createToken->resolvedAttrs path)', () => {
    const result = matchSink(creatureEtbSinkZoneAdapted, battleMenu);
    expect(result.matched).toBe(true);
    expect(result.via).toContain('createToken');
  });

  it('correctly matches Aerith Gainsborough’s own baseline permanent-entering-battlefield occurrence (she IS a Creature)', () => {
    expect(matchSink(creatureEtbSinkZoneAdapted, aerithGainsborough).matched).toBe(true);
  });

  it('correctly rejects Baron, Airship Kingdom (a real Land, not a Creature) — the type constraint genuinely gates the match this time', () => {
    expect(matchSink(creatureEtbSinkZoneAdapted, baronAirshipKingdom).matched).toBe(false);
  });

  it('correctly rejects Fight On! (an Instant — never a permanent, no baseline ETB occurrence at all)', () => {
    expect(matchSink(creatureEtbSinkZoneAdapted, fightOn).matched).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// D — Aerith Gainsborough's own real sink, verbatim (minus its own
// `event:'dies'`/`putCounter`/zone sinks, tested separately below):
// `{ "event": "lifegain", "controller": "you" }`
const lifegainSink: SinkQuery = { category: 'Lifegain', event: 'lifegain', controller: 'you' };

describe('sink D — lifegain (Aerith Gainsborough, as-authored)', () => {
  it('AGREES: Battle Menu’s "you gain 4 life" mode satisfies it (real prod match: "Battle Menu --[life gain]--> Aerith Gainsborough")', () => {
    expect(matchSink(lifegainSink, battleMenu).matched).toBe(true);
  });

  it('AGREES: Summon: Bahamut (no gainLife effect anywhere) does not satisfy it', () => {
    expect(matchSink(lifegainSink, summonBahamut).matched).toBe(false);
  });

  it('SUPERSEDED, 2026-09-18 — DISAGREES with production, deliberately, not a regression: Aerith Gainsborough’s own printed Lifelink keyword now DOES satisfy it. Until 2026-09-18 this asserted `false`, matching `synergy.ts`’s own PARKED `LIFELINK_SYNTHETIC_FACT_ENABLED = false` decision (2026-09-14) — that parked flag is UNCHANGED and still governs production’s own `augmentPoolCards`/`findInteractionsForCard` path (FIN’s real served Interactions/graph-links output is untouched by this file). This prototype matcher instead now derives Lifelink’s automatic lifegain via a dedicated, corpus-verified sink-derivation predicate (`sink-model/predicates/lifelink.ts`, added for Felidar Savior/FDN #12, the same real engine-automation-hidden-mechanic shape Saga/Crew already use) — a deliberate, explicit, freshly-commissioned design decision for THIS matcher specifically, not a silent revival of the parked FIN pattern. See `sink-derivation-status.ts`’s own `lifelink` entry + `lifelink.test.ts`’s real `state.dealDamage` engine-agreement corpus for the verification trail.', () => {
    expect(matchSink(lifegainSink, aerithGainsborough).matched).toBe(true);
  });

  it('2026-09-18: `SinkMatchResult.predicateDerived` distinguishes the two real ways this sink can match — Aerith Gainsborough’s own match above comes ONLY from the `lifelink` predicate (no `gainLife` effect anywhere on her own definition) and is marked `predicateDerived: true`; Battle Menu’s match comes from a real, direct `gainLife` effect and is NOT marked (`undefined`) — the real signal `card-interactions.ts`’s own self-ownership gate (`.claude/contracts/card-schema.md` section 7) is built on.', () => {
    expect(matchSink(lifegainSink, aerithGainsborough).predicateDerived).toBe(true);
    expect(matchSink(lifegainSink, battleMenu).predicateDerived).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// E — Aerith Gainsborough's own real zone-shaped sink, verbatim:
// `{ "to": "Battlefield", "controller": "you", "types": {"has":["Creature","Legendary"]} }`
// (the trigger-condition half of her own "whenever a legendary creature
// enters" broadcast — already zone-shaped on disk, no adaptation needed).
const legendaryCreatureEtbSink: SinkQuery = { category: 'Legendary creature ETB', to: 'Battlefield', controller: 'you', types: { has: ['Creature', 'Legendary'] } };

describe('sink E — legendary creature ETB (Aerith Gainsborough, as-authored, zone-shaped)', () => {
  it('matches Aerith Gainsborough herself (Legendary Creature — Human Cleric) — a real, KEPT self-interaction, not excluded (SYNERGY_DESIGN.md: "self-interactions are computed like any other pair, never dropped")', () => {
    expect(matchSink(legendaryCreatureEtbSink, aerithGainsborough).matched).toBe(true);
  });

  it('AGREES: rejects Summon: Bahamut (a real Creature, but NOT Legendary — real Scryfall type line has no Legendary supertype)', () => {
    expect(matchSink(legendaryCreatureEtbSink, summonBahamut).matched).toBe(false);
  });

  it('AGREES: rejects Baron, Airship Kingdom (a Land, not a Creature at all)', () => {
    expect(matchSink(legendaryCreatureEtbSink, baronAirshipKingdom).matched).toBe(false);
  });

  it('AGREES: rejects Fight On! (an Instant, never a permanent)', () => {
    expect(matchSink(legendaryCreatureEtbSink, fightOn).matched).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// F — a SINK built by turning around Aerith Gainsborough's own real SOURCE
// fact (her onDies `kind:'program'` effect's real, migrated combinator AST
// — `you.creaturesInPlay().filter('subtype','Legendary').each(putCounter(...))`
// — see `cards/aerith-gainsborough/synergy.json`'s own
// `putCounter-broadcast-structural`-tagged fact, which this query mirrors
// exactly): "wants a +1/+1 counter put on Legendary creatures you control."
// This is the direct test of `recognizers/program-ast-walker.ts` integration
// end to end, against a REAL migrated `kind:'program'` card, not a synthetic
// AST built just for this test.
const legendaryPutCounterSink: SinkQuery = { category: 'Legendary +1/+1 counter (broadcast)', event: 'putCounter', counterType: '+1/+1', controller: 'you', target: { types: { has: ['Creature', 'Legendary'] } } };

describe('sink F — legendary +1/+1 counter broadcast, via program-ast-walker', () => {
  it('matches Aerith Gainsborough herself — her own onDies program effect (branch/each/filter(subtype,Legendary)/putCounter) resolves via extractOccurrences to exactly this pool/counterType, a real self-interaction the SAME shape her own hand-authored `putCounter-broadcast-structural` fact already declares', () => {
    const result = matchSink(legendaryPutCounterSink, aerithGainsborough);
    expect(result.matched).toBe(true);
    expect(result.via).toContain('program:putCounter');
  });

  it('AGREES: rejects Summon: Bahamut, Battle Menu, Baron, Airship Kingdom, and Fight On! — none of them has any putCounter-shaped effect at all', () => {
    expect(matchSink(legendaryPutCounterSink, summonBahamut).matched).toBe(false);
    expect(matchSink(legendaryPutCounterSink, battleMenu).matched).toBe(false);
    expect(matchSink(legendaryPutCounterSink, baronAirshipKingdom).matched).toBe(false);
    expect(matchSink(legendaryPutCounterSink, fightOn).matched).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// G — Aerith Gainsborough's own real `dies, target:'self'` sink, verbatim:
// `{ "event": "dies", "target": "self" }` — a documented, DELIBERATE gap in
// this matcher (see `match-sink.ts`'s own `satisfiesDestroyImpliesDies` doc
// comment): resolving "is the SINK'S OWN card a legal victim of this
// destroy" needs the sink owner's OWN `CardDefinition`, which a `SinkQuery`
// deliberately does not carry (it's a card-agnostic, curated query, per
// `sink-query.ts`'s own header) — not extended for this task since none of
// the OTHER 6 sink queries above need it, but exercised here explicitly so
// the gap is demonstrated, not just asserted in a comment nobody runs.
const selfDiesSink: SinkQuery = { category: 'Self dies (trigger condition)', event: 'dies', target: 'self' };

describe('sink G — self dies (Aerith Gainsborough, as-authored) — documented SinkQuery scope gap', () => {
  it('DISAGREES, explained — a deliberate SinkQuery scope decision, not a matcher bug: production DOES match Summon: Bahamut’s chapter I/II "destroy up to one target nonland permanent" against this exact sink (real prod line "Summon: Bahamut --[destroy]--> Aerith Gainsborough"), because `factsInteract` resolves the SINK OWNER’s (Aerith’s) own static attrs to check she is a legal (non-Land) victim. This matcher’s `SinkQuery` has no reference to its own owning card to do the same, and declines rather than silently guessing — a real, named, documented scope limitation of a card-agnostic sink query, not a semantic gap in structural effect-matching itself.', () => {
    expect(matchSink(selfDiesSink, summonBahamut).matched).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// H — sink-derivation-predicate live-status gate (2026-09-18). Real, direct
// proof that `deriveOccurrences`/`matchSink` only consult a sink-derivation
// predicate's occurrences when its mechanism's LIVE status is blue/green
// (`sink-derivation-status.ts`'s `isSinkDerivationMechanismUsable`) — never
// gray/purple. Uses a genuinely fake ROOT (an empty temp directory — no
// `functional-model/sink-model/predicates/saga.ts` or `.corpus.json` exists
// under it at all) rather than any mocking, so the gate is exercised through
// its own real, documented fs-presence computation, not a stand-in.
describe('gate H — sink-derivation-predicate live status must be blue/green to be usable by real matching', () => {
  let fakeRoot: string;
  afterEach(() => {
    if (fakeRoot) rmSync(fakeRoot, { recursive: true, force: true });
  });

  it('real repo root (process.cwd(), default): saga is blue today, so Summon: Bahamut’s chapter-completion sacrifice DOES contribute to a real match — same real production behavior as before this gate existed', () => {
    expect(matchSink(graveyardCreatureSink, summonBahamut).matched).toBe(true);
    expect(deriveOccurrences(summonBahamut).some((o) => o.via.includes('saga'))).toBe(true);
  });

  it('a fake root with no saga predicate module/corpus manifest at all (gray, same as if saga.ts never existed): Summon: Bahamut’s IDENTICAL CardDefinition no longer matches the same sink through the saga path — the occurrence is excluded, not an error', () => {
    fakeRoot = mkdtempSync(join(tmpdir(), 'match-sink-gate-test-'));
    expect(matchSink(graveyardCreatureSink, summonBahamut, fakeRoot).matched).toBe(false);
    expect(deriveOccurrences(summonBahamut, fakeRoot).some((o) => o.via.includes('saga'))).toBe(false);
  });

  it('the raw predicate function itself is NEVER gated — saga.ts’s own corpus/verification test (saga.test.ts) calls sagaChapterCompletionOccurrences directly and must keep seeing Bahamut’s real occurrence regardless of what any fake root reports, or a not-yet-blue predicate could never be developed/verified up to blue in the first place', () => {
    const rawOccurrences = sagaChapterCompletionOccurrences(summonBahamut);
    expect(rawOccurrences.length).toBeGreaterThan(0);
    expect(rawOccurrences.some((o) => o.to === 'Graveyard')).toBe(true);
  });
});
