import { describe, expect, it } from 'vitest';
import {
  computeFactAnnotations,
  describeFact,
  findInteractionsForCard,
  isEventFact,
  isZoneFact,
  themeOf,
  type AnnotationRef,
  type EventFact,
  type Fact,
  type PoolCard,
  type ZoneFact,
} from './synergy';
import type { CardDefinition } from './card';

// Real matching proof for `EventFact.colors` (the `has`/`hasAny`/`not`
// color-SET shape added 2026-09-09 alongside `vector-imperial-capital`'s own
// single migrated mana fact) — a disposable fixture pool, not a real card in
// `cards/*`, since no FIN sink fact wants a specific color YET (see
// `EventFact.colors`'s own doc comment). Proves the matcher end-to-end via
// `findInteractionsForCard` (the same real entry point `find-synergies.mjs`
// calls), not just a hand-rolled call into a private helper.

// `annotations` is required on every `Fact` (2026-09-11 — see synergy.ts's
// own doc comment: "no annotation if undefined" is a checked invariant now,
// not just a convention, enforced pool-wide for real cards by
// `scripts/annotation-coverage.mjs`). These fixtures describe wholly
// imaginary, non-real cards purely to exercise MATCHING logic (`land(...)`
// below has no real oracle text at all) — this is NOT a real annotation
// pointing at anything, just the minimum shape the type now requires so
// these disposable fixtures compile; `annotation-coverage.mjs`'s own
// `ANNOTATED_CARD_SLUGS` never includes any of these fixture names, so
// nothing here is ever held to the REAL "points at genuine card text"
// invariant that check enforces.
const FIXTURE_ANNOTATIONS: [AnnotationRef, ...AnnotationRef[]] = [{ target: 'typeLine', start: 0, end: 0 }];

function land(name: string): CardDefinition {
  return { name, manaCost: '', typeLine: 'Land' };
}

function poolCard(card: CardDefinition, source: Omit<Fact, 'role'>[], sink: Omit<Fact, 'role'>[]): PoolCard {
  return {
    name: card.name,
    card,
    source: source.map((f) => ({ ...f, role: 'source' }) as Fact),
    sink: sink.map((f) => ({ ...f, role: 'sink' }) as Fact),
  };
}

const dualLand = poolCard(
  land('Vector, Imperial Capital'),
  [{ event: 'addMana', controller: 'you', colors: { hasAny: ['B', 'R'] }, annotations: FIXTURE_ANNOTATIONS } satisfies Omit<EventFact, 'role'>],
  [],
);

describe('EventFact.colors — produce vs. want matching', () => {
  it('a want for one of the produced colors (hasAny) matches', () => {
    const wantsRed = poolCard(land('Wants Red'), [], [
      { event: 'addMana', controller: 'you', colors: { has: ['R'] }, annotations: FIXTURE_ANNOTATIONS } satisfies Omit<EventFact, 'role'>,
    ]);
    const groups = findInteractionsForCard('Vector, Imperial Capital', [dualLand, wantsRed]);
    const manaGroup = groups.find((g) => g.direction === 'source' && (g.fact as EventFact).event === 'addMana');
    expect(manaGroup?.matches.map((m) => m.card)).toContain('Wants Red');
  });

  it('a want for a color NOT in the produced set does not match', () => {
    const wantsGreen = poolCard(land('Wants Green'), [], [
      { event: 'addMana', controller: 'you', colors: { has: ['G'] }, annotations: FIXTURE_ANNOTATIONS } satisfies Omit<EventFact, 'role'>,
    ]);
    const groups = findInteractionsForCard('Vector, Imperial Capital', [dualLand, wantsGreen]);
    const manaGroup = groups.find((g) => g.direction === 'source' && (g.fact as EventFact).event === 'addMana');
    expect(manaGroup?.matches.map((m) => m.card) ?? []).not.toContain('Wants Green');
  });

  it('a want using hasAny (any of several acceptable colors) matches if the produced set overlaps', () => {
    const wantsWhiteOrBlack = poolCard(land('Wants White or Black'), [], [
      { event: 'addMana', controller: 'you', colors: { hasAny: ['W', 'B'] }, annotations: FIXTURE_ANNOTATIONS } satisfies Omit<EventFact, 'role'>,
    ]);
    const groups = findInteractionsForCard('Vector, Imperial Capital', [dualLand, wantsWhiteOrBlack]);
    const manaGroup = groups.find((g) => g.direction === 'source' && (g.fact as EventFact).event === 'addMana');
    expect(manaGroup?.matches.map((m) => m.card)).toContain('Wants White or Black');
  });

  it('a want using not (excludes a color) fails to match a produce that makes it', () => {
    const wantsNonBlack = poolCard(land('Wants Non-Black'), [], [
      { event: 'addMana', controller: 'you', colors: { not: ['B'] }, annotations: FIXTURE_ANNOTATIONS } satisfies Omit<EventFact, 'role'>,
    ]);
    const groups = findInteractionsForCard('Vector, Imperial Capital', [dualLand, wantsNonBlack]);
    const manaGroup = groups.find((g) => g.direction === 'source' && (g.fact as EventFact).event === 'addMana');
    expect(manaGroup?.matches.map((m) => m.card) ?? []).not.toContain('Wants Non-Black');
  });

  it('a legacy single-color `color` produce still matches a new `colors`-shaped want (backward compat)', () => {
    const singleGreen = poolCard(land('Single Green Source'), [
      { event: 'addMana', controller: 'you', color: 'G', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<EventFact, 'role'>,
    ], []);
    const wantsGreen = poolCard(land('Wants Green Via New Shape'), [], [
      { event: 'addMana', controller: 'you', colors: { has: ['G'] }, annotations: FIXTURE_ANNOTATIONS } satisfies Omit<EventFact, 'role'>,
    ]);
    const groups = findInteractionsForCard('Single Green Source', [singleGreen, wantsGreen]);
    const manaGroup = groups.find((g) => g.direction === 'source' && (g.fact as EventFact).event === 'addMana');
    expect(manaGroup?.matches.map((m) => m.card)).toContain('Wants Green Via New Shape');
  });
});

// `describeFact` real unit coverage — this is the function that kept getting
// hand-fixed via manual browser inspection this session (the `playLand`
// trailing-period bug, the `entersBattlefield` tapped-redundancy bug, the
// `types.has` capitalization bug, the `coinFlip` label) with no test ever
// catching any of them first. `role` is irrelevant to `describeFact` itself
// (it only reads the `Constraints`/`zone`/`event`-shaped fields) — these two
// tiny builders exist purely so a fixture reads as "just the fields that
// matter" without repeating `role` boilerplate everywhere.
function zf(f: Partial<Omit<ZoneFact, 'role'>> & Pick<ZoneFact, 'zone'>): ZoneFact {
  return { role: 'source', annotations: FIXTURE_ANNOTATIONS, ...f };
}
function ef(f: Partial<Omit<EventFact, 'role'>> & Pick<EventFact, 'event'>): EventFact {
  return { role: 'source', annotations: FIXTURE_ANNOTATIONS, ...f };
}

describe('describeFact — zone facts', () => {
  describe('unconstrained zone presence — bare "<zone> presence" always, regardless of `controller` (2026-09-10: reverts a same-day "your"/"opponent\'s" prefix — who it belongs to is real `controller` data, surfaced in the notes/conditions column instead, not this label)', () => {
    it('Battlefield — no controller at all', () => {
      expect(describeFact(zf({ zone: 'Battlefield' }))).toBe('battlefield presence');
    });
    it('Battlefield — controller "you" still renders bare', () => {
      expect(describeFact(zf({ zone: 'Battlefield', controller: 'you' }))).toBe('battlefield presence');
    });
    it('Battlefield — controller "opp" still renders bare', () => {
      expect(describeFact(zf({ zone: 'Battlefield', controller: 'opp' }))).toBe('battlefield presence');
    });
    it('Graveyard', () => {
      expect(describeFact(zf({ zone: 'Graveyard' }))).toBe('graveyard presence');
    });
    it("Graveyard — controller 'you' still renders bare", () => {
      expect(describeFact(zf({ zone: 'Graveyard', controller: 'you' }))).toBe('graveyard presence');
    });
    it("Graveyard — controller 'opp' still renders bare", () => {
      expect(describeFact(zf({ zone: 'Graveyard', controller: 'opp' }))).toBe('graveyard presence');
    });
    it('Hand', () => {
      expect(describeFact(zf({ zone: 'Hand' }))).toBe('hand presence');
    });
    it('Library', () => {
      expect(describeFact(zf({ zone: 'Library' }))).toBe('library presence');
    });
    it('Stack', () => {
      expect(describeFact(zf({ zone: 'Stack' }))).toBe('stack presence');
    });
    it('Exile — ZONE_PRESENCE_PHRASE override ("exile from battlefield," not "exile presence")', () => {
      expect(describeFact(zf({ zone: 'Exile' }))).toBe('exile from battlefield');
    });
    it("Exile — controller 'opp' still gets the override phrase, no prefix", () => {
      expect(describeFact(zf({ zone: 'Exile', controller: 'opp' }))).toBe('exile from battlefield');
    });
  });

  describe('Battlefield, qualified (types constraint present) — bare "battlefield presence" always now (2026-09-10: closes the formerly-deliberate exception — see describeFact\'s own doc comment); control/type detail lives in the notes/conditions column instead', () => {
    it('controller "you"', () => {
      expect(describeFact(zf({ zone: 'Battlefield', types: { has: ['Creature'] }, controller: 'you' }))).toBe('battlefield presence');
    });
    it('controller "opp"', () => {
      expect(describeFact(zf({ zone: 'Battlefield', types: { has: ['Creature'] }, controller: 'opp' }))).toBe('battlefield presence');
    });
    it('no controller at all', () => {
      expect(describeFact(zf({ zone: 'Battlefield', types: { has: ['Creature'] } }))).toBe('battlefield presence');
    });
  });

  describe('non-Battlefield, qualified — bare "<zone> presence" always now (2026-09-10), same treatment as unqualified', () => {
    it('controller "you"', () => {
      expect(describeFact(zf({ zone: 'Graveyard', types: { has: ['Creature'] }, controller: 'you' }))).toBe('graveyard presence');
    });
    it('controller "opp"', () => {
      expect(describeFact(zf({ zone: 'Graveyard', types: { has: ['Creature'] }, controller: 'opp' }))).toBe('graveyard presence');
    });
    it('no controller at all', () => {
      expect(describeFact(zf({ zone: 'Library', types: { has: ['Land'] } }))).toBe('library presence');
    });
    it('Exile, qualified — the ZONE_PRESENCE_PHRASE override now DOES apply even with a qualifier present, same as unqualified', () => {
      expect(describeFact(zf({ zone: 'Exile', types: { has: ['Creature'] }, controller: 'you' }))).toBe('exile from battlefield');
    });
  });

  describe('SOURCE zone-change facts (`to`/`from`, 2026-09-11 rework) — a named movement, not generic "<zone> presence"', () => {
    it('to: "Battlefield", no `from` at all — "enters the battlefield" (any/unspecified origin — this exact ZONE-shaped form isn\'t currently used by any real pool card; Summon: Bahamut\'s own ETB is instead the EventFact `self-enters` — kept as a generic matcher-behavior test)', () => {
      expect(describeFact(zf({ to: 'Battlefield', controller: 'you', subject: 'self' }))).toBe('enters the battlefield');
    });
    it('from: "Battlefield", to: "Graveyard" — "dies" (CR 700.4 — real Summon: Bahamut shape, self-graveyard — the DYING zone-consequence, a separate concept from the sacrifice ACT itself, which is its own event fact)', () => {
      expect(describeFact(zf({ from: 'Battlefield', to: 'Graveyard', controller: 'you', subject: 'self' }))).toBe('dies');
    });
    it('a `(from, to)` pair with no named movement gets a generic-but-honest movement phrase, NEVER presence wording (real bug, fixed 2026-09-11 — Ambrosia Whiteheart\'s own unnamed Battlefield->Hand bounce fact used to render as "Hand presence")', () => {
      expect(describeFact(zf({ from: 'Hand', to: 'Graveyard', controller: 'you' }))).toBe('moves to graveyard (from hand)');
      expect(describeFact(zf({ from: 'Library', to: 'Exile' }))).toBe('moves to exile (from library)'); // ZONE_PRESENCE_PHRASE (sink-only) no longer applies to a SOURCE fact's own fallback
    });
    it('a Battlefield->Hand SOURCE fact renders the real named "bounce" movement', () => {
      expect(describeFact(zf({ from: 'Battlefield', to: 'Hand', controller: 'you' }))).toBe('bounce');
    });
    it('a Library->Hand SOURCE fact renders the real named "tutor" movement (shared by Cloud, Midgar Mercenary\'s full-library search and Ashe, Princess of Dalmasca\'s top-5 dig — this table keys on (from,to) only, not effect kind)', () => {
      expect(describeFact(zf({ from: 'Library', to: 'Hand', controller: 'you' }))).toBe('tutor');
    });
    it('a SINK fact never gets a movement name, even if it happened to carry `to`/`from` (it should not, but the label must not silently misrepresent a state check as an event)', () => {
      expect(describeFact({ role: 'sink', zone: 'Battlefield', annotations: FIXTURE_ANNOTATIONS })).toBe('battlefield presence');
    });
    it('a pre-rework SOURCE fact (bare `zone`, no `to`/`from`) still renders the unchanged bare presence label — full backward compatibility', () => {
      expect(describeFact(zf({ zone: 'Battlefield', controller: 'you', subject: 'self' }))).toBe('battlefield presence');
      expect(describeFact(zf({ zone: 'Graveyard', controller: 'you', subject: 'self' }))).toBe('graveyard presence');
    });
  });
});

describe('factsInteract — SOURCE zone-change facts match a SINK presence want on `to` alone, ignoring `from` (2026-09-11 rework — the explicit design goal: "cares about things put into a graveyard, regardless of where they came from")', () => {
  it('a `to: "Graveyard"` produce (with a real `from: "Battlefield"`) matches a bare Graveyard-presence sink want', () => {
    const dier = poolCard(land('Dies A Lot'), [{ from: 'Battlefield', to: 'Graveyard', controller: 'you', subject: 'self', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<ZoneFact, 'role'>], []);
    const wantsGraveyard = poolCard(land('Wants Graveyard'), [], [{ zone: 'Graveyard', controller: 'you', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<ZoneFact, 'role'>]);
    const groups = findInteractionsForCard('Dies A Lot', [dier, wantsGraveyard]);
    const zoneGroup = groups.find((g) => g.direction === 'source');
    expect(zoneGroup?.matches.map((m) => m.card)).toContain('Wants Graveyard');
    expect(zoneGroup?.description).toBe('dies');
  });

  it('a `to: "Battlefield"` produce with NO `from` at all still matches a bare Battlefield-presence sink want (any origin)', () => {
    const enterer = poolCard(land('Enters A Lot'), [{ to: 'Battlefield', controller: 'you', subject: 'self', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<ZoneFact, 'role'>], []);
    const wantsBattlefield = poolCard(land('Wants Battlefield'), [], [{ zone: 'Battlefield', controller: 'you', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<ZoneFact, 'role'>]);
    const groups = findInteractionsForCard('Enters A Lot', [enterer, wantsBattlefield]);
    const zoneGroup = groups.find((g) => g.direction === 'source');
    expect(zoneGroup?.matches.map((m) => m.card)).toContain('Wants Battlefield');
  });

  it('a `to`-shaped produce does NOT match a differently-zoned sink want', () => {
    const dier = poolCard(land('Dies A Lot 2'), [{ from: 'Battlefield', to: 'Graveyard', controller: 'you', subject: 'self', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<ZoneFact, 'role'>], []);
    const wantsBattlefield = poolCard(land('Wants Battlefield 2'), [], [{ zone: 'Battlefield', controller: 'you', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<ZoneFact, 'role'>]);
    const groups = findInteractionsForCard('Dies A Lot 2', [dier, wantsBattlefield]);
    const zoneGroup = groups.find((g) => g.direction === 'source');
    expect(zoneGroup).toBeUndefined();
  });
});

describe('selfInteractionKind — a merged zone+event fact self-matches via its ZONE shape, not its `event` name (real bug found+fixed 2026-09-11 during aerith-gainsborough\'s migration — see synergy.ts\'s own doc comment on `selfInteractionKind`)', () => {
  function legendaryCreature(name: string): CardDefinition {
    return { name, manaCost: '', typeLine: 'Legendary Creature — Test Testperson' };
  }

  it('a merged `{event:\'entersBattlefield\', to:\'Battlefield\'}` produce self-matching its OWN zone-shaped Battlefield-presence want is `second-copy-legendary`, not `same-instance`', () => {
    const card = poolCard(
      legendaryCreature('Self Enters Legend'),
      [{ event: 'entersBattlefield', to: 'Battlefield', controller: 'you', subject: 'self', target: 'self', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<Fact, 'role'>],
      [{ zone: 'Battlefield', controller: 'you', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<ZoneFact, 'role'>],
    );
    const groups = findInteractionsForCard('Self Enters Legend', [card]);
    const zoneGroup = groups.find((g) => g.direction === 'source');
    const selfMatch = zoneGroup?.matches.find((m) => m.card === 'Self Enters Legend');
    expect(selfMatch?.selfInteraction).toBe('second-copy-legendary');
  });

  it('a pure event-only produce (no zone data) self-matching its own event-shaped want is still `same-instance` (unaffected by the fix)', () => {
    const card = poolCard(
      land('Self Lifegain'),
      [{ event: 'lifegain', controller: 'you', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<EventFact, 'role'>],
      [{ event: 'lifegain', controller: 'you', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<EventFact, 'role'>],
    );
    const groups = findInteractionsForCard('Self Lifegain', [card]);
    const eventGroup = groups.find((g) => g.direction === 'source');
    const selfMatch = eventGroup?.matches.find((m) => m.card === 'Self Lifegain');
    expect(selfMatch?.selfInteraction).toBe('same-instance');
  });
});

// PARKED (2026-09-14, later same day) — `LIFELINK_SYNTHETIC_FACT_ENABLED` in
// synergy.ts is now `false` by explicit user decision (the pattern may come
// back later); the 12 real cards this used to cover have their own explicit
// `{event:'lifegain'}` source fact restored instead. `describe.skip`, not
// deleted, so this coverage is ready to re-enable alongside the flag.
describe.skip('printed Lifelink implicitly counts as a real lifegain SOURCE (2026-09-14 — replaces the old hand-authored, redundant `{event:\'lifegain\'}` fact 11 real pool cards used to carry for this exact reason, see synergy.ts\'s own `hasPrintedLifelink`/`syntheticLifelinkFact` doc comments)', () => {
  function lifelinkCreature(name: string): CardDefinition {
    return { name, manaCost: '', typeLine: 'Creature — Test Testperson', keywords: ['Lifelink'] };
  }

  it('a card with printed Lifelink and NO declared lifegain fact still matches a real lifegain-wanting SINK on another card', () => {
    const lifelinker = poolCard(lifelinkCreature('Bare Lifelinker'), [], []);
    const payoff = poolCard(land('Lifegain Payoff'), [], [{ event: 'lifegain', controller: 'you', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<EventFact, 'role'>]);
    const pool = [lifelinker, payoff];

    // From the PAYOFF's own perspective (its sink finds the Lifelink producer)...
    const payoffGroups = findInteractionsForCard('Lifegain Payoff', pool);
    const sinkGroup = payoffGroups.find((g) => g.direction === 'sink');
    expect(sinkGroup?.matches.map((m) => m.card)).toContain('Bare Lifelinker');

    // ...AND from the LIFELINKER's own perspective (its implicit produce finds the payoff) —
    // this is the direction `server/api/graph-links.ts` actually walks for real graph edges
    // (only `direction === 'source'` groups, keyed off the PRODUCER's own name).
    const lifelinkerGroups = findInteractionsForCard('Bare Lifelinker', pool);
    const sourceGroup = lifelinkerGroups.find((g) => g.direction === 'source');
    expect(sourceGroup?.matches.map((m) => m.card)).toContain('Lifegain Payoff');
  });

  it('a card with a genuinely SEPARATE, real lifegain ability (no Lifelink at all) is unaffected — still matches normally off its own real fact, not the synthetic one', () => {
    const genuineGainer = poolCard(
      land('Genuine Gainer'),
      [{ event: 'lifegain', controller: 'you', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<EventFact, 'role'>],
      [],
    );
    const payoff = poolCard(land('Lifegain Payoff 2'), [], [{ event: 'lifegain', controller: 'you', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<EventFact, 'role'>]);
    const groups = findInteractionsForCard('Genuine Gainer', [genuineGainer, payoff]);
    const sourceGroup = groups.find((g) => g.direction === 'source');
    expect(sourceGroup?.fact.annotations).toEqual(FIXTURE_ANNOTATIONS); // the REAL declared fact, not a synthetic one
    expect(sourceGroup?.matches.map((m) => m.card)).toContain('Lifegain Payoff 2');
  });

  it('a card printing Lifelink that ALSO already declares its own real lifegain fact is never double-counted — exactly one produce group, not two', () => {
    const both = poolCard(
      lifelinkCreature('Lifelink Plus Real Fact'),
      [{ event: 'lifegain', controller: 'you', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<EventFact, 'role'>],
      [],
    );
    const payoff = poolCard(land('Lifegain Payoff 5'), [], [{ event: 'lifegain', controller: 'you', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<EventFact, 'role'>]);
    const groups = findInteractionsForCard('Lifelink Plus Real Fact', [both, payoff]);
    expect(groups.filter((g) => g.direction === 'source' && g.fact.event === 'lifegain')).toHaveLength(1);
  });

  it('a card with NO printed Lifelink and no lifegain fact never gets a synthetic produce group', () => {
    const bystander = poolCard(land('No Lifelink Here'), [], []);
    const payoff = poolCard(land('Lifegain Payoff 3'), [], [{ event: 'lifegain', controller: 'you', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<EventFact, 'role'>]);
    const groups = findInteractionsForCard('No Lifelink Here', [bystander, payoff]);
    expect(groups.find((g) => g.direction === 'source' && g.fact.event === 'lifegain')).toBeUndefined();
  });

  it('printed Lifelink on the BACK face alone (a transforming card) still counts — `face` is a rendering hint only, never consulted by the matcher', () => {
    const backFaceLifelinker: CardDefinition = {
      name: 'Front Face',
      manaCost: '',
      typeLine: 'Creature — Test Testperson',
      backFace: { name: 'Back Face', manaCost: '', typeLine: 'Creature — Test Testperson', keywords: ['Lifelink'] },
    };
    const lifelinker = poolCard(backFaceLifelinker, [], []);
    const payoff = poolCard(land('Lifegain Payoff 4'), [], [{ event: 'lifegain', controller: 'you', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<EventFact, 'role'>]);
    const groups = findInteractionsForCard('Front Face', [lifelinker, payoff]);
    const sourceGroup = groups.find((g) => g.direction === 'source' && g.fact.event === 'lifegain');
    expect(sourceGroup?.matches.map((m) => m.card)).toContain('Lifegain Payoff 4');
  });
});

describe('a normal permanent implicitly casts from Hand and enters the Battlefield (2026-09-14 — replaces the old parser-derived `permanent-enters-battlefield-normally` fact pair 210 real pool cards used to carry for this exact reason, see synergy.ts\'s own `isNormalPermanent`/`syntheticCastFact`/`syntheticEntersBattlefieldFact` doc comments)', () => {
  function vanillaCreature(name: string): CardDefinition {
    return { name, manaCost: '', typeLine: 'Creature — Test Testperson' };
  }

  it('a normal permanent with no declared cast/entersBattlefield fact still matches a real "wants a creature to enter" SINK on another card', () => {
    const creature = poolCard(vanillaCreature('Bare Creature'), [], []);
    const payoff = poolCard(land('Enters Payoff'), [], [{ to: 'Battlefield', controller: 'you', types: { has: ['Creature'] }, annotations: FIXTURE_ANNOTATIONS } satisfies Omit<ZoneFact, 'role'>]);
    const pool = [creature, payoff];

    const creatureGroups = findInteractionsForCard('Bare Creature', pool);
    const sourceGroup = creatureGroups.find((g) => g.direction === 'source' && g.fact.event === 'entersBattlefield');
    expect(sourceGroup?.matches.map((m) => m.card)).toContain('Enters Payoff');
  });

  // No standalone "the synthetic cast fact matches a real want" test here —
  // a `from`-only fact (this one has no `to`/`zone`) is genuinely
  // ZONE-shaped (`isZoneFact`) but `effectiveZone(p)` is `undefined` for it
  // (`fact.zone ?? fact.to`, both absent), and `factsInteract`'s own zone
  // branch immediately returns `false` whenever `effectiveZone(p) ===
  // undefined` — REGARDLESS of the wanter's own shape. This is a
  // pre-existing, already-true structural fact about the matcher, not
  // something this change introduces: the real, now-retired hand/parser-
  // authored `{event:'cast', from:'Hand', target:'self'}` fact could never
  // satisfy any real pool sink either (confirmed: every real "wants a spell
  // cast" sink in the pool — `sahagin`/`the-prima-vista`/`venat-heart-of-
  // hydaelyn-hydaelyn-the-mothercrystal` — uses a `target`-Constraints
  // shape, never `from`/`to`/`zone`, so `isZoneFact` disagrees with this
  // fact either way). The synthetic version is emitted for completeness/
  // parity with what used to be stored, not because it does real matching
  // work today.

  it('a card that already declares its own real self-entersBattlefield fact is never double-counted — exactly one produce group, not two', () => {
    const already = poolCard(
      vanillaCreature('Already Declared'),
      [{ event: 'entersBattlefield', to: 'Battlefield', subject: 'self', target: 'self', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<EventFact, 'role'>],
      [],
    );
    const payoff = poolCard(land('Enters Payoff 2'), [], [{ to: 'Battlefield', controller: 'you', types: { has: ['Creature'] }, annotations: FIXTURE_ANNOTATIONS } satisfies Omit<ZoneFact, 'role'>]);
    const groups = findInteractionsForCard('Already Declared', [already, payoff]);
    expect(groups.filter((g) => g.direction === 'source' && g.fact.event === 'entersBattlefield')).toHaveLength(1);
  });

  it('a Land never gets a synthetic cast/entersBattlefield produce group — played, not cast', () => {
    const plainLand = poolCard(land('Plain Land'), [], []);
    const groups = findInteractionsForCard('Plain Land', [plainLand]);
    expect(groups.find((g) => g.direction === 'source' && (g.fact.event === 'cast' || g.fact.event === 'entersBattlefield'))).toBeUndefined();
  });

  it('a normal permanent whose ONLY permanent type lives on its own BACK face is unaffected — `isNormalPermanent` only ever reads the front `CardDefinition` this PoolCard represents', () => {
    const frontIsSpell: CardDefinition = { name: 'Front Spell', manaCost: '', typeLine: 'Sorcery — Adventure' };
    const spellCard = poolCard(frontIsSpell, [], []);
    const groups = findInteractionsForCard('Front Spell', [spellCard]);
    expect(groups.find((g) => g.direction === 'source' && (g.fact.event === 'cast' || g.fact.event === 'entersBattlefield'))).toBeUndefined();
  });
});

describe('a normal Instant/Sorcery implicitly casts from Hand and resolves to the Graveyard (2026-09-14, same day, third instance of this exact pattern — replaces the old parser-derived `instant-sorcery-resolves-to-graveyard` fact pair 62 real pool cards used to carry for this exact reason, see synergy.ts\'s own `isNormalInstantOrSorcery`/`syntheticCastFact`/`syntheticInstantSorceryGraveyardFact` doc comments)', () => {
  function vanillaSorcery(name: string): CardDefinition {
    return { name, manaCost: '', typeLine: 'Sorcery' };
  }

  it('a normal Instant/Sorcery with no declared cast/graveyard fact still matches a real "wants a card in the graveyard" SINK on another card', () => {
    const spell = poolCard(vanillaSorcery('Bare Sorcery'), [], []);
    const payoff = poolCard(land('Graveyard Payoff'), [], [{ to: 'Graveyard', controller: 'you', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<ZoneFact, 'role'>]);
    const pool = [spell, payoff];

    const spellGroups = findInteractionsForCard('Bare Sorcery', pool);
    const sourceGroup = spellGroups.find((g) => g.direction === 'source' && g.fact.to === 'Graveyard');
    expect(sourceGroup?.matches.map((m) => m.card)).toContain('Graveyard Payoff');
  });

  it('a card that already declares its own real self-graveyard fact is never double-counted — exactly one produce group, not two', () => {
    const already = poolCard(
      vanillaSorcery('Already Declared Sorcery'),
      [{ to: 'Graveyard', controller: 'you', subject: 'self', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<ZoneFact, 'role'>],
      [],
    );
    const payoff = poolCard(land('Graveyard Payoff 2'), [], [{ to: 'Graveyard', controller: 'you', annotations: FIXTURE_ANNOTATIONS } satisfies Omit<ZoneFact, 'role'>]);
    const groups = findInteractionsForCard('Already Declared Sorcery', [already, payoff]);
    expect(groups.filter((g) => g.direction === 'source' && g.fact.to === 'Graveyard')).toHaveLength(1);
  });

  it('an Adventure Instant/Sorcery half never gets a synthetic cast/graveyard produce group — CR 715.3d exiles it instead', () => {
    const adventureHalf = poolCard({ name: 'Adventure Half', manaCost: '', typeLine: 'Sorcery — Adventure' }, [], []);
    const groups = findInteractionsForCard('Adventure Half', [adventureHalf]);
    expect(groups.find((g) => g.direction === 'source' && (g.fact.event === 'cast' || g.fact.to === 'Graveyard'))).toBeUndefined();
  });

  it('a normal permanent (not an Instant/Sorcery) never gets a synthetic self-graveyard produce group', () => {
    const creature: CardDefinition = { name: 'Bystander Creature', manaCost: '', typeLine: 'Creature — Test Testperson' };
    const creatureCard = poolCard(creature, [], []);
    const groups = findInteractionsForCard('Bystander Creature', [creatureCard]);
    expect(groups.find((g) => g.direction === 'source' && g.fact.to === 'Graveyard')).toBeUndefined();
  });

  // No standalone "a Flashback-shaped card's own real self-cast-from-
  // GRAVEYARD fact doesn't suppress the synthetic self-cast-from-HAND one"
  // test here, for the SAME structural reason the normal-permanent describe
  // block above already documents for its own cast fact: a `from`-only fact
  // is genuinely ZONE-shaped (`isZoneFact`) but `effectiveZone(p)` is
  // `undefined` for it (no `to`/`zone`), and `factsInteract`'s own zone
  // branch immediately returns `false` whenever `effectiveZone(p) ===
  // undefined` — REGARDLESS of the wanter's own shape, and regardless of
  // whether zero, one, or two such facts exist side by side. There is
  // structurally no way for `findInteractionsForCard`'s own group output to
  // ever distinguish "the synthetic Hand-cast fact was correctly added
  // alongside a real Graveyard-cast one" from "it was wrongly skipped" —
  // neither ever produces an observable group either way. The `from:
  // 'Hand'` narrowing in `findInteractionsForCard`'s own dedup guard (see
  // that function's doc comment, and contrast with `isNormalPermanent`'s
  // own laxer `f.event === 'cast' && f.target === 'self'` check) is
  // real and load-bearing the moment cast facts EVER become matchable
  // (or the moment anything else reads `pc.source` directly instead of
  // going through the matcher) — verified by direct code inspection here
  // rather than a false-positive-proof executable assertion. Confirmed via
  // the real pool instead: `auron-s-inspiration`/`from-father-to-son` (both
  // real Flashback cards, both still carrying their own genuinely distinct
  // `{event:'cast', from:'Graveyard', ...}` fact after the pool-wide
  // `instant-sorcery-resolves-to-graveyard` strip) are exactly the shape
  // this guard protects.
});

describe('describeFact — named event branches', () => {
  it('lifegain — always bare "life gain", regardless of `controller` (2026-09-10: closes the last inconsistent branch — see describeFact\'s own doc comment)', () => {
    expect(describeFact(ef({ event: 'lifegain', controller: 'you' }))).toBe('life gain');
    expect(describeFact(ef({ event: 'lifegain', controller: 'opp' }))).toBe('life gain');
    expect(describeFact(ef({ event: 'lifegain' }))).toBe('life gain');
  });

  it('dies — always bare "dying", regardless of `target`/`controller` (2026-09-10: reverts a same-day pass that derived a type-qualified noun from `target` plus a who-prefix from `controller` — both are real, intact fact data now surfaced in the notes/conditions column instead of this label)', () => {
    expect(describeFact(ef({ event: 'dies', target: 'self' }))).toBe('dying');
    expect(describeFact(ef({ event: 'dies', target: 'self', controller: 'opp' }))).toBe('dying');
    expect(describeFact(ef({ event: 'dies', controller: 'you' }))).toBe('dying');
    expect(describeFact(ef({ event: 'dies', controller: 'opp' }))).toBe('dying');
    expect(describeFact(ef({ event: 'dies' }))).toBe('dying');
    // Real fin/1 (Summon: Bahamut) shape — `target:{types:{not:['Land']}}}` no
    // longer widens the noun to "nonland permanent"; still bare "dying".
    expect(describeFact(ef({ event: 'dies', target: { types: { not: ['Land'] } } }))).toBe('dying');
    expect(describeFact(ef({ event: 'dies', controller: 'opp', target: { types: { not: ['Land'] } } }))).toBe('dying');
    expect(describeFact(ef({ event: 'dies', controller: 'you', target: { types: { has: ['Creature'] } } }))).toBe('dying');
  });

  it('dies with real `from`/`to` (2026-09-11, ZoneFact/EventFact merged into one `Fact` — supersedes the old separately-named `zoneFrom`/`zoneTo` workaround; see synergy.ts\'s own `Fact` doc comment) now classifies as BOTH a zone fact (real `to`/`from`) AND an event fact (`event` key), which was structurally impossible before the merge — and still renders "dies" via `zoneMovementName`\'s own (from,to) table lookup, same label as before, now reached through the ZONE branch of `describeFact` instead of the EVENT branch. Real fin/1 (Summon: Bahamut) shape (`self-dies`/`destroy-nonland`).', () => {
    const fact = ef({ event: 'dies', from: 'Battlefield', to: 'Graveyard', target: 'self' });
    expect(isZoneFact(fact)).toBe(true);
    expect(isEventFact(fact)).toBe(true);
    expect(describeFact(fact)).toBe('dies');
  });

  it('putCounter — bare "counters" always, `counterType` no longer folds into the label (overridden 2026-09-10, later same day)', () => {
    expect(describeFact(ef({ event: 'putCounter', counterType: '+1/+1' }))).toBe('counters');
    expect(describeFact(ef({ event: 'putCounter', counterType: '+1/+1', target: 'self' }))).toBe('counters');
    expect(describeFact(ef({ event: 'putCounter' }))).toBe('counters');
    expect(describeFact(ef({ event: 'putCounter', target: 'self' }))).toBe('counters');
    // Real shape: Minwu, White Mage's own "put a +1/+1 counter on each Cleric
    // you control" — `counterType`/`controller` are both real, intact data
    // (surfaced in the notes/conditions column) but neither renders in the
    // label anymore.
    expect(describeFact(ef({ event: 'putCounter', counterType: '+1/+1', controller: 'you', target: { types: { has: ['Creature', 'Cleric'] } } }))).toBe('counters');
    // Real shape: Ice Flan's own "put a stun counter on target creature an opponent controls."
    expect(describeFact(ef({ event: 'putCounter', counterType: 'stun', controller: 'opp', target: { types: { has: ['Creature'] } } }))).toBe('counters');
    // Real shape: summon-bahamut's own self-referencing LORE-counter fact
    // (`target: 'self'`) — bare, same treatment as `cast`'s own self-
    // referencing "cast a spell" (never "cast a spell on itself").
    expect(describeFact(ef({ event: 'putCounter', counterType: '+1/+1', controller: 'you', target: 'self' }))).toBe('counters');
  });

  it('drawCard / drawCards both read as "card draw"', () => {
    expect(describeFact(ef({ event: 'drawCard' }))).toBe('card draw');
    expect(describeFact(ef({ event: 'drawCards' }))).toBe('card draw');
  });

  it('entersBattlefield — regression: always "enters the battlefield," regardless of tapped (tapped belongs in the details column, not the label)', () => {
    expect(describeFact(ef({ event: 'entersBattlefield', tapped: true }))).toBe('enters the battlefield');
    expect(describeFact(ef({ event: 'entersBattlefield', tapped: false }))).toBe('enters the battlefield');
    expect(describeFact(ef({ event: 'entersBattlefield' }))).toBe('enters the battlefield');
  });

  it('entersBattlefield with real `to` (2026-09-11, ZoneFact/EventFact merge — `from` deliberately OMITTED since the real origin varies per effect/is often the deliberately-invisible Stack, unlike dying\'s fixed battlefield origin) now classifies as BOTH zone-shaped (real `to`) AND event-shaped (`event` key) — structurally impossible before the merge — and still renders "enters the battlefield" via `zoneMovementName`\'s own table lookup (reached through the ZONE branch now, not the EVENT branch). Real fin/1 (Summon: Bahamut) shape (`self-enters`).', () => {
    const fact = ef({ event: 'entersBattlefield', to: 'Battlefield', target: 'self' });
    expect(isZoneFact(fact)).toBe(true);
    expect(isEventFact(fact)).toBe(true);
    expect(describeFact(fact)).toBe('enters the battlefield');
  });

  it('cast with real `from` and NO `to` at all (2026-09-11, ZoneFact/EventFact merge — Stack is the one zone this model never assigns as a value on either side, but the OTHER end of a movement still counts when known; Summon: Bahamut has no alternate-cost/flashback wrinkle, so its own cast really does originate in Hand) classifies as zone-shaped too (has `from`) — a genuinely NEW real fact shape this merge introduces, a `from`-only fact with no `to`/`zone` at all. `describeFact` cannot find a zone-movement-table entry for it (no `to`) and has no bare zone to render as "presence" either, so it falls through to the EVENT branch and still renders "cast a spell" — confirms the fallthrough guard added alongside this merge (synergy.ts\'s own `describeFact`) does not crash and still produces a sensible label. Real fin/1 (Summon: Bahamut) shape (`self-cast`).', () => {
    const fact = ef({ event: 'cast', from: 'Hand', target: 'self' });
    expect(isZoneFact(fact)).toBe(true);
    expect(isEventFact(fact)).toBe(true);
    expect(describeFact(fact)).toBe('cast a spell');
  });

  it('`targeted` (2026-09-11 — purely descriptive, never a matching dimension, never added to `themeOf`) does not affect matching or theme-tagging either way. Real fin/1 shapes: `destroy-act` (targeted:true, a real "up to one target" choice) vs. `chapter-iv-damage` (targeted:false, an unconditional "to each opponent" broadcast).', () => {
    const targetedDestroy = ef({ event: 'destroy', target: { types: { not: ['Land'] } }, targeted: true });
    const broadcastDamage = ef({ event: 'damage', controller: 'you', recipient: 'opp', targeted: false });
    expect(isEventFact(targetedDestroy)).toBe(true);
    expect(isEventFact(broadcastDamage)).toBe(true);
    expect(themeOf(targetedDestroy)).not.toContain('targeted');
    expect(themeOf(broadcastDamage)).not.toContain('targeted');
    // Matching stays pure `event` string equality — a `targeted:false` want
    // still matches a `targeted:true` produce of the SAME event, since
    // `targeted` is never compared by `factsInteract`.
    const producer = poolCard(land('Targeted Producer'), [{ event: 'destroy', targeted: true, annotations: FIXTURE_ANNOTATIONS } satisfies Omit<EventFact, 'role'>], []);
    const consumer = poolCard(land('Broadcast Consumer'), [], [{ event: 'destroy', targeted: false, annotations: FIXTURE_ANNOTATIONS } satisfies Omit<EventFact, 'role'>]);
    const groups = findInteractionsForCard('Targeted Producer', [producer, consumer]);
    const group = groups.find((g) => g.direction === 'source');
    expect(group?.matches.map((m) => m.card)).toContain('Broadcast Consumer');
  });

  it('playLand — regression: "play a land," lowercase, no trailing period', () => {
    expect(describeFact(ef({ event: 'playLand' }))).toBe('play a land');
  });

  it('activateAbility', () => {
    expect(describeFact(ef({ event: 'activateAbility' }))).toBe('activate ability');
  });

  it('addMana — always bare "mana production", regardless of `controller` or color/colors (2026-09-10: closes the last inconsistent branch — see describeFact\'s own doc comment)', () => {
    expect(describeFact(ef({ event: 'addMana', controller: 'you', color: 'G' }))).toBe('mana production');
    expect(describeFact(ef({ event: 'addMana', controller: 'opp', colors: { hasAny: ['W', 'U'] } }))).toBe('mana production');
    expect(describeFact(ef({ event: 'addMana' }))).toBe('mana production');
  });

  it('coinFlip — regression: "flip a coin" (a verb phrase, not the earlier "coin flip" noun phrase)', () => {
    expect(describeFact(ef({ event: 'coinFlip' }))).toBe('flip a coin');
  });

  it('cast — flat "cast a spell," ignoring any Constraints.types the fact carries for wording purposes (type-specificity is matching-only data, per SYNERGY_DESIGN.md)', () => {
    expect(describeFact(ef({ event: 'cast', target: 'self' }))).toBe('cast a spell');
    expect(describeFact(ef({ event: 'cast', controller: 'you' }))).toBe('cast a spell');
    // A sink wanting specifically a creature/noncreature spell cast still
    // renders flat — no "cast a creature spell" wording variant.
    expect(describeFact(ef({ event: 'cast', types: { has: ['Creature'] } }))).toBe('cast a spell');
    expect(describeFact(ef({ event: 'cast', types: { not: ['Creature'] } }))).toBe('cast a spell');
  });

  it('sacrifice — always bare "sacrifice", regardless of `types` qualifier or `controller` (2026-09-10: reverts a same-day pass baking both into the label)', () => {
    // The Gold Saucer's own real shape — "Sacrifice two artifacts" — no longer renders "artifact sacrifice".
    expect(describeFact(ef({ event: 'sacrifice', controller: 'you', types: { has: ['Artifact'] } }))).toBe('sacrifice');
    expect(describeFact(ef({ event: 'sacrifice', controller: 'you' }))).toBe('sacrifice');
    expect(describeFact(ef({ event: 'sacrifice', controller: 'opp' }))).toBe('sacrifice');
    expect(describeFact(ef({ event: 'sacrifice' }))).toBe('sacrifice');
  });

  it('an unrecognized event name falls through to the bare event string itself — no `controller`/qualifier prefix (2026-09-10: reverts a same-day pass baking both in)', () => {
    // `grantKeyword` used to be the example here — 2026-09-12 gave it (and
    // its new sibling `grantType`) real explicit branches (same camelCase-
    // display-bug fix class as `preventDamage`/`castCreatureSpell`), so
    // it's no longer a real "falls through" example; `surveil` still is
    // (checked: no branch exists for it).
    expect(describeFact(ef({ event: 'surveil' }))).toBe('surveil');
    // Real shape: "land landfall" no longer includes the `types` qualifier.
    expect(describeFact(ef({ event: 'landfall', types: { has: ['Land'] } }))).toBe('landfall');
    // Real shapes: "each opponent loses life" / "you lose 2 life" (Golbez, Crystal Collector / Summon: Primal Odin)
    // both render as bare "lifeloss" now — `controller` stays real, intact fact data, just not in this label.
    expect(describeFact(ef({ event: 'lifeloss', controller: 'you' }))).toBe('lifeloss');
    expect(describeFact(ef({ event: 'lifeloss', controller: 'opp' }))).toBe('lifeloss');
  });
});

describe('describeFact — damage (bare label; direction lives in real `controller`/`recipient` data, not the label — 2026-09-10)', () => {
  it('always bare "damage", regardless of `controller`/`recipient`', () => {
    expect(describeFact(ef({ event: 'damage', controller: 'you' }))).toBe('damage');
    // Summon: Bahamut's own Mega Flare, "deals damage ... to each opponent" — `recipient` no longer renders into the label.
    expect(describeFact(ef({ event: 'damage', controller: 'you', recipient: 'opp' }))).toBe('damage');
    expect(describeFact(ef({ event: 'damage', controller: 'opp', recipient: 'you' }))).toBe('damage');
    expect(describeFact(ef({ event: 'damage', recipient: 'opp' }))).toBe('damage');
  });
});

// `constraintBits`/`ZONE_NOUN` (the helpers that used to bake a zone fact's
// own `types`/`cmc` qualifier into its label) were removed alongside
// describeFact's own bare conversion (2026-09-10) — a qualified zone fact
// now renders the exact same bare "<zone> presence" as an unqualified one,
// covered above under "describeFact — zone facts". This block is retired;
// `app/lib/factConditions.test.ts` (card-owned) is where the qualifier
// itself — `types.has`/`hasAny`/`not`/`cmc` — still gets real coverage, now
// that it renders in the notes/conditions column instead of this label.

describe('describeFact — label convention (lowercase, no trailing punctuation, colors/tapped/target omitted)', () => {
  // Every label branch is now STATIC — no verbatim-passthrough field folds
  // into any label anymore (`putCounter`'s own `counterType` was the last
  // holdout; overridden bare 2026-09-10, later same day) — so every case
  // should start lowercase or with the hasAny parenthesis, and never end in
  // sentence punctuation — the exact shape of every regression fixed this
  // session (playLand's trailing period, entersBattlefield's tapped-
  // redundancy, types.has's capitalization, coinFlip's label). Asserted in
  // bulk here so a FUTURE one-off slip like these gets caught by `npx
  // vitest run functional-model` instead of needing another round of manual
  // browser inspection.
  const representativeFacts: Fact[] = [
    zf({ zone: 'Battlefield' }),
    zf({ zone: 'Battlefield', controller: 'opp' }),
    zf({ zone: 'Graveyard' }),
    zf({ zone: 'Hand' }),
    zf({ zone: 'Library' }),
    zf({ zone: 'Exile' }),
    zf({ zone: 'Stack' }),
    zf({ zone: 'Battlefield', types: { has: ['Creature'] }, controller: 'you' }),
    zf({ zone: 'Battlefield', types: { hasAny: ['Creature', 'Artifact'] } }),
    zf({ zone: 'Graveyard', types: { has: ['Creature'] }, controller: 'opp' }),
    zf({ zone: 'Battlefield', cmc: { min: 3 } }),
    ef({ event: 'lifegain', controller: 'you' }),
    ef({ event: 'dies', target: 'self' }),
    ef({ event: 'dies', controller: 'opp' }),
    ef({ event: 'drawCard' }),
    ef({ event: 'entersBattlefield', tapped: true }),
    ef({ event: 'playLand' }),
    ef({ event: 'activateAbility' }),
    ef({ event: 'addMana', color: 'G' }),
    ef({ event: 'coinFlip' }),
    ef({ event: 'grantKeyword' }),
    ef({ event: 'putCounter', counterType: '+1/+1' }),
  ];

  it('starts lowercase or with the hasAny-disjunction "(", never with an uppercase letter', () => {
    for (const fact of representativeFacts) {
      expect(describeFact(fact), JSON.stringify(fact)).toMatch(/^[a-z(]/);
    }
  });

  it('never ends in sentence punctuation (".", "!", "?")', () => {
    for (const fact of representativeFacts) {
      expect(describeFact(fact), JSON.stringify(fact)).not.toMatch(/[.!?]$/);
    }
  });

  it('addMana never leaks the specific color(s) into the label (that belongs in the details column)', () => {
    expect(describeFact(ef({ event: 'addMana', color: 'G' }))).not.toMatch(/\bG\b/);
    expect(describeFact(ef({ event: 'addMana', colors: { hasAny: ['W', 'U'] } }))).not.toMatch(/[WU]/);
  });

  it('entersBattlefield never leaks "tapped" into the label (that belongs in the details column)', () => {
    expect(describeFact(ef({ event: 'entersBattlefield', tapped: true }))).not.toMatch(/tap/i);
  });
});

describe('computeFactAnnotations — legitimate "nothing to anchor to" cases stay silent (undefined), a resolved-but-highlight-missing entry throws (2026-09-14)', () => {
  const oracle = 'Destroy target creature.\nDraw a card.\nGain 3 life.';

  it('no authoring entry at all (null) → undefined', () => {
    expect(computeFactAnnotations({ oracle }, null)).toBeUndefined();
  });

  it('missing text for the requested anchor → undefined', () => {
    expect(computeFactAnnotations({}, { highlight: 'Destroy' })).toBeUndefined();
    expect(computeFactAnnotations({ oracle }, { anchor: 'typeLine', highlight: 'Creature' })).toBeUndefined();
  });

  it('line index out of range → undefined', () => {
    expect(computeFactAnnotations({ oracle }, { line: 99, highlight: 'Destroy' })).toBeUndefined();
  });

  it('sourceText not found at all (whole-text search, no line) → undefined', () => {
    expect(computeFactAnnotations({ oracle }, { sourceText: 'Exile target creature', highlight: 'Exile' })).toBeUndefined();
  });

  it('sourceText not found within the named line → undefined', () => {
    expect(computeFactAnnotations({ oracle }, { line: 0, sourceText: 'Exile target creature', highlight: 'Exile' })).toBeUndefined();
  });

  it('resolves correctly on the happy path — whole-text, line-scoped, line+sourceText, and typeLine anchor all still work unchanged', () => {
    expect(computeFactAnnotations({ oracle }, { sourceText: 'Destroy target creature.', highlight: 'Destroy' })).toEqual([{ target: 'oracle', line: 0, start: 0, end: 7 }]);
    expect(computeFactAnnotations({ oracle }, { line: 1, highlight: 'Draw a card' })).toEqual([{ target: 'oracle', line: 1, start: 0, end: 11 }]);
    expect(computeFactAnnotations({ oracle }, { line: 2, sourceText: 'Gain 3 life.', highlight: 'Gain 3 life' })).toEqual([{ target: 'oracle', line: 2, start: 0, end: 11 }]);
    expect(
      computeFactAnnotations({ typeLine: 'Enchantment Creature — Saga Dragon' }, { anchor: 'typeLine', sourceText: 'Saga Dragon', highlight: 'Saga Dragon' }),
    ).toEqual([{ target: 'typeLine', start: 23, end: 34 }]);
  });

  it('highlight not found within a resolved LINE (no sourceText) — throws, does not silently return undefined', () => {
    expect(() => computeFactAnnotations({ oracle }, { line: 0, highlight: 'Exile' })).toThrow(/authoring\.highlight.*not found.*line 0/s);
  });

  it('highlight not found within a resolved sourceText scoped to a LINE — throws', () => {
    expect(() => computeFactAnnotations({ oracle }, { line: 0, sourceText: 'Destroy target creature.', highlight: 'Exile' })).toThrow(/not found within authoring\.sourceText/);
  });

  it('highlight not found within a resolved sourceText, whole-text mode (no line) — throws', () => {
    expect(() => computeFactAnnotations({ oracle }, { sourceText: 'Destroy target creature.', highlight: 'Exile' })).toThrow(/not found within authoring\.sourceText/);
  });

  it('the thrown error names the actual highlight/sourceText/line so a real authoring bug is attributable, not just "something failed"', () => {
    try {
      computeFactAnnotations({ oracle }, { line: 1, sourceText: 'Draw a card.', highlight: 'Draw two cards' });
      expect.unreachable('expected computeFactAnnotations to throw');
    } catch (err) {
      expect(String((err as Error).message)).toContain('Draw two cards');
      expect(String((err as Error).message)).toContain('Draw a card.');
      expect(String((err as Error).message)).toContain('line 1');
    }
  });
});
