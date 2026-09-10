import { describe, expect, it } from 'vitest';
import { describeFact, findInteractionsForCard, type EventFact, type Fact, type PoolCard, type ZoneFact } from './synergy';
import type { CardDefinition } from './card';

// Real matching proof for `EventFact.colors` (the `has`/`hasAny`/`not`
// color-SET shape added 2026-09-09 alongside `vector-imperial-capital`'s own
// single migrated mana fact) — a disposable fixture pool, not a real card in
// `cards/*`, since no FIN sink fact wants a specific color YET (see
// `EventFact.colors`'s own doc comment). Proves the matcher end-to-end via
// `findInteractionsForCard` (the same real entry point `find-synergies.mjs`
// calls), not just a hand-rolled call into a private helper.

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
  [{ id: 'mana-b-r', event: 'addMana', controller: 'you', colors: { hasAny: ['B', 'R'] }, value: 1 } satisfies Omit<EventFact, 'role'>],
  [],
);

describe('EventFact.colors — produce vs. want matching', () => {
  it('a want for one of the produced colors (hasAny) matches', () => {
    const wantsRed = poolCard(land('Wants Red'), [], [
      { id: 'want-r', event: 'addMana', controller: 'you', colors: { has: ['R'] }, value: 1 } satisfies Omit<EventFact, 'role'>,
    ]);
    const groups = findInteractionsForCard('Vector, Imperial Capital', [dualLand, wantsRed]);
    const manaGroup = groups.find((g) => g.direction === 'source' && (g.fact as EventFact).event === 'addMana');
    expect(manaGroup?.matches.map((m) => m.card)).toContain('Wants Red');
  });

  it('a want for a color NOT in the produced set does not match', () => {
    const wantsGreen = poolCard(land('Wants Green'), [], [
      { id: 'want-g', event: 'addMana', controller: 'you', colors: { has: ['G'] }, value: 1 } satisfies Omit<EventFact, 'role'>,
    ]);
    const groups = findInteractionsForCard('Vector, Imperial Capital', [dualLand, wantsGreen]);
    const manaGroup = groups.find((g) => g.direction === 'source' && (g.fact as EventFact).event === 'addMana');
    expect(manaGroup?.matches.map((m) => m.card) ?? []).not.toContain('Wants Green');
  });

  it('a want using hasAny (any of several acceptable colors) matches if the produced set overlaps', () => {
    const wantsWhiteOrBlack = poolCard(land('Wants White or Black'), [], [
      { id: 'want-w-b', event: 'addMana', controller: 'you', colors: { hasAny: ['W', 'B'] }, value: 1 } satisfies Omit<EventFact, 'role'>,
    ]);
    const groups = findInteractionsForCard('Vector, Imperial Capital', [dualLand, wantsWhiteOrBlack]);
    const manaGroup = groups.find((g) => g.direction === 'source' && (g.fact as EventFact).event === 'addMana');
    expect(manaGroup?.matches.map((m) => m.card)).toContain('Wants White or Black');
  });

  it('a want using not (excludes a color) fails to match a produce that makes it', () => {
    const wantsNonBlack = poolCard(land('Wants Non-Black'), [], [
      { id: 'want-not-b', event: 'addMana', controller: 'you', colors: { not: ['B'] }, value: 1 } satisfies Omit<EventFact, 'role'>,
    ]);
    const groups = findInteractionsForCard('Vector, Imperial Capital', [dualLand, wantsNonBlack]);
    const manaGroup = groups.find((g) => g.direction === 'source' && (g.fact as EventFact).event === 'addMana');
    expect(manaGroup?.matches.map((m) => m.card) ?? []).not.toContain('Wants Non-Black');
  });

  it('a legacy single-color `color` produce still matches a new `colors`-shaped want (backward compat)', () => {
    const singleGreen = poolCard(land('Single Green Source'), [
      { id: 'mana-g', event: 'addMana', controller: 'you', color: 'G', value: 1 } satisfies Omit<EventFact, 'role'>,
    ], []);
    const wantsGreen = poolCard(land('Wants Green Via New Shape'), [], [
      { id: 'want-g', event: 'addMana', controller: 'you', colors: { has: ['G'] }, value: 1 } satisfies Omit<EventFact, 'role'>,
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
// catching any of them first. `id`/`role` are irrelevant to `describeFact`
// itself (it only reads the `Constraints`/`zone`/`event`-shaped fields) —
// these two tiny builders exist purely so a fixture reads as "just the
// fields that matter" without repeating `id`/`role` boilerplate everywhere.
function zf(f: Partial<Omit<ZoneFact, 'id' | 'role'>> & Pick<ZoneFact, 'zone'>): ZoneFact {
  return { id: 'test', role: 'source', ...f };
}
function ef(f: Partial<Omit<EventFact, 'id' | 'role'>> & Pick<EventFact, 'event'>): EventFact {
  return { id: 'test', role: 'source', ...f };
}

describe('describeFact — zone facts', () => {
  describe('unconstrained zone presence (bare "<zone> presence", "you" stays unstated)', () => {
    it('Battlefield', () => {
      expect(describeFact(zf({ zone: 'Battlefield' }))).toBe('battlefield presence');
    });
    it('Battlefield — controller "you" reads identically to no controller at all (you is the default, stays unstated)', () => {
      expect(describeFact(zf({ zone: 'Battlefield', controller: 'you' }))).toBe('battlefield presence');
    });
    it('Battlefield — controller "opp" gets an explicit prefix', () => {
      expect(describeFact(zf({ zone: 'Battlefield', controller: 'opp' }))).toBe("opponent's battlefield presence");
    });
    it('Graveyard', () => {
      expect(describeFact(zf({ zone: 'Graveyard' }))).toBe('graveyard presence');
    });
    it("Graveyard — controller 'opp'", () => {
      expect(describeFact(zf({ zone: 'Graveyard', controller: 'opp' }))).toBe("opponent's graveyard presence");
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
    it("Exile — controller 'opp' still gets the override phrase, just prefixed", () => {
      expect(describeFact(zf({ zone: 'Exile', controller: 'opp' }))).toBe("opponent's exile from battlefield");
    });
  });

  describe('Battlefield, qualified (types constraint present) — real oracle-text-style "you control" phrasing, not a possessive', () => {
    it('controller "you"', () => {
      expect(describeFact(zf({ zone: 'Battlefield', types: { has: ['Creature'] }, controller: 'you' }))).toBe('creature permanents you control on the battlefield');
    });
    it('controller "opp"', () => {
      expect(describeFact(zf({ zone: 'Battlefield', types: { has: ['Creature'] }, controller: 'opp' }))).toBe('creature permanents an opponent controls on the battlefield');
    });
    it('no controller at all', () => {
      expect(describeFact(zf({ zone: 'Battlefield', types: { has: ['Creature'] } }))).toBe('creature permanents on the battlefield');
    });
  });

  describe('non-Battlefield, qualified — "<qualifier> <noun> in <side> <zone>"', () => {
    it('controller "you"', () => {
      expect(describeFact(zf({ zone: 'Graveyard', types: { has: ['Creature'] }, controller: 'you' }))).toBe('creature cards in your graveyard');
    });
    it('controller "opp"', () => {
      expect(describeFact(zf({ zone: 'Graveyard', types: { has: ['Creature'] }, controller: 'opp' }))).toBe("creature cards in an opponent's graveyard");
    });
    it('no controller at all', () => {
      expect(describeFact(zf({ zone: 'Library', types: { has: ['Land'] } }))).toBe('land cards in a library');
    });
    it('Exile, qualified — the ZONE_PRESENCE_PHRASE override does NOT apply once a qualifier is present', () => {
      expect(describeFact(zf({ zone: 'Exile', types: { has: ['Creature'] }, controller: 'you' }))).toBe('creature cards in your exile');
    });
  });
});

describe('describeFact — named event branches', () => {
  it('lifegain', () => {
    expect(describeFact(ef({ event: 'lifegain', controller: 'you' }))).toBe('your life gain');
    expect(describeFact(ef({ event: 'lifegain', controller: 'opp' }))).toBe("an opponent's life gain");
    expect(describeFact(ef({ event: 'lifegain' }))).toBe('a life gain');
  });

  it('dies — target: "self"', () => {
    expect(describeFact(ef({ event: 'dies', target: 'self' }))).toBe('dying');
    // The target:'self' branch is checked first — controller is irrelevant once target is 'self'.
    expect(describeFact(ef({ event: 'dies', target: 'self', controller: 'opp' }))).toBe('dying');
  });
  it('dies — no target (an opponent/anyone\'s creature dying)', () => {
    expect(describeFact(ef({ event: 'dies', controller: 'you' }))).toBe('your creature dying');
    expect(describeFact(ef({ event: 'dies', controller: 'opp' }))).toBe("an opponent's creature dying");
    expect(describeFact(ef({ event: 'dies' }))).toBe('a creature dying');
  });

  it('putCounter — with and without target: "self", with and without a counterType', () => {
    expect(describeFact(ef({ event: 'putCounter', counterType: '+1/+1' }))).toBe('+1/+1 counters');
    expect(describeFact(ef({ event: 'putCounter', counterType: '+1/+1', target: 'self' }))).toBe('+1/+1 counters on itself');
    expect(describeFact(ef({ event: 'putCounter' }))).toBe('counters');
    expect(describeFact(ef({ event: 'putCounter', target: 'self' }))).toBe('counters on itself');
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

  it('playLand — regression: "play a land," lowercase, no trailing period', () => {
    expect(describeFact(ef({ event: 'playLand' }))).toBe('play a land');
  });

  it('activateAbility', () => {
    expect(describeFact(ef({ event: 'activateAbility' }))).toBe('activate ability');
  });

  it('addMana — regression: no color breakdown in the label itself, regardless of color/colors', () => {
    expect(describeFact(ef({ event: 'addMana', controller: 'you', color: 'G' }))).toBe('your mana production');
    expect(describeFact(ef({ event: 'addMana', controller: 'opp', colors: { hasAny: ['W', 'U'] } }))).toBe("an opponent's mana production");
    expect(describeFact(ef({ event: 'addMana' }))).toBe('a mana production');
  });

  it('coinFlip — regression: "flip a coin" (a verb phrase, not the earlier "coin flip" noun phrase)', () => {
    expect(describeFact(ef({ event: 'coinFlip' }))).toBe('flip a coin');
  });

  it('sacrifice — reuses the shared qualifier machinery rather than hardcoding a type into the branch', () => {
    // With a types qualifier (The Gold Saucer's own real shape — "Sacrifice two artifacts").
    expect(describeFact(ef({ event: 'sacrifice', controller: 'you', types: { has: ['Artifact'] } }))).toBe('artifact sacrifice');
    // Without any qualifier at all — an unconstrained sacrifice fact.
    expect(describeFact(ef({ event: 'sacrifice', controller: 'you' }))).toBe('sacrifice');
  });

  it('an unrecognized event name falls through to the generic "<qualifier><event>" label', () => {
    expect(describeFact(ef({ event: 'grantKeyword' }))).toBe('grantKeyword');
    expect(describeFact(ef({ event: 'landfall', types: { has: ['Land'] } }))).toBe('land landfall');
  });
});

describe('describeFact — constraintBits / qualifier building', () => {
  it('types.has — regression: lowercased, space-joined (not the printed-case "Creature")', () => {
    expect(describeFact(zf({ zone: 'Battlefield', types: { has: ['Creature'] } }))).toBe('creature permanents on the battlefield');
    expect(describeFact(zf({ zone: 'Graveyard', types: { has: ['Creature', 'Artifact'] } }))).toBe('creature artifact cards in a graveyard');
  });

  it('types.hasAny — parenthesized, ORIGINAL casing kept (a disjunction reads differently from a conjunction)', () => {
    expect(describeFact(zf({ zone: 'Battlefield', types: { hasAny: ['Creature', 'Artifact'] } }))).toBe('(Creature/Artifact) permanents on the battlefield');
  });

  it('cmc — min only', () => {
    expect(describeFact(zf({ zone: 'Battlefield', cmc: { min: 3 } }))).toBe('mana value 3 permanents on the battlefield');
  });
  it('cmc — min and max (a range)', () => {
    expect(describeFact(zf({ zone: 'Battlefield', cmc: { min: 2, max: 4 } }))).toBe('mana value 2-4 permanents on the battlefield');
  });
  it('cmc — eq only', () => {
    expect(describeFact(zf({ zone: 'Battlefield', cmc: { eq: 5 } }))).toBe('mana value =5 permanents on the battlefield');
  });
});

describe('describeFact — label convention (lowercase, no trailing punctuation, colors/tapped/target omitted)', () => {
  // Every STATIC label branch (i.e. excluding a verbatim-passthrough field
  // like `putCounter`'s own `counterType`, which is real card data the
  // function has no business reshaping) should start lowercase or with the
  // hasAny parenthesis, and never end in sentence punctuation — the exact
  // shape of every regression fixed this session (playLand's trailing
  // period, entersBattlefield's tapped-redundancy, types.has's
  // capitalization, coinFlip's label). Asserted in bulk here so a FUTURE
  // one-off slip like these gets caught by `npx vitest run functional-model`
  // instead of needing another round of manual browser inspection.
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
