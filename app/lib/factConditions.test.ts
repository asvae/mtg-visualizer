import { describe, expect, it } from 'vitest';
import { factConditions } from './factConditions';
import type { Fact } from '../../functional-model/synergy';

describe('factConditions', () => {
  // A subset of the real facts off
  // functional-model/cards/summon-bahamut/synergy.json (fin/1, Summon:
  // Bahamut) — kept verbatim from the real on-disk fact shape, not
  // hand-simplified, so a future edit to that file's own facts would need
  // to update these too. NOT exhaustive of the card's current full fact
  // list (it's grown several more facts since this block was first written,
  // e.g. self-cast/self-enters/destroy-act/self-counters/self-sacrifice —
  // none of those touch this file's own logic, so they're not duplicated
  // here just to stay in lockstep).
  describe('fin/1 Summon: Bahamut — every fact, matching the live verification', () => {
    it('self-battlefield: SOURCE zone-change fact (`to: \'Battlefield\'`, 2026-09-11 rework) with self subject + trivial controller -> literal "self", no redundant "from"/"to" noise (movement is already named "enters the battlefield" by the label)', () => {
      const fact: Fact = { role: 'source', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], to: 'Battlefield', controller: 'you', subject: 'self', value: 1 };
      expect(factConditions(fact)).toBe('self');
    });

    it('destroy-nonland: no controller (either player, omitted entirely — no placeholder) + a real `target` type constraint -> "nonland permanent"', () => {
      const fact: Fact = {
        role: 'source',
        annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }],
        event: 'dies',
        target: { types: { not: ['Land'] } },
        value: 4,
      };
      expect(factConditions(fact)).toBe('nonland permanent');
    });

    it('chapter-iii-draw: `controller: \'you\'` is no longer folded into the (now bare) label -> shown as "yours"', () => {
      const fact: Fact = { role: 'source', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], event: 'drawCard', controller: 'you', value: 4 };
      expect(factConditions(fact)).toBe('yours');
    });

    it('chapter-iv-damage: both `controller` (dealer) and `recipient` (target) shown, distinctly -> "yours · to others"', () => {
      const fact: Fact = { role: 'source', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], event: 'damage', controller: 'you', recipient: 'opp', value: 5 };
      expect(factConditions(fact)).toBe('yours · to others');
    });

    it('self-sacrifice-graveyard: SOURCE zone-change fact (`from: \'Battlefield\', to: \'Graveyard\'`, 2026-09-11 rework — id renamed from the old bare `self-sacrifice` when a separate literal-sacrifice EVENT fact took that id) with self subject -> literal "self" only, no "from battlefield" noise (the "dies" label already means battlefield->graveyard per CR 700.4, regardless of cause)', () => {
      const fact: Fact = { role: 'source', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], from: 'Battlefield', to: 'Graveyard', controller: 'you', subject: 'self', value: 1 };
      expect(factConditions(fact)).toBe('self');
    });

    it('self-dies: `target: \'self\'` -> literal "self"', () => {
      const fact: Fact = { role: 'source', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], event: 'dies', target: 'self', value: 1 };
      expect(factConditions(fact)).toBe('self');
    });

    it('mega-flare-you (sink): unconstrained zone want, `controller: \'you\'` -> "yours"', () => {
      const fact: Fact = { role: 'sink', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], zone: 'Battlefield', controller: 'you', value: 1 };
      expect(factConditions(fact)).toBe('yours');
    });

    it('mega-flare-opp (sink): unconstrained zone want, `controller: \'opp\'` -> "other"', () => {
      const fact: Fact = { role: 'sink', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], zone: 'Battlefield', controller: 'opp', value: 1 };
      expect(factConditions(fact)).toBe('other');
    });
  });

  it('shows `subject` when it is a real token, not the trivial `\'self\'` value', () => {
    const fact: Fact = { role: 'source', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], zone: 'Battlefield', controller: 'you', subject: { token: 'c_a_treasure_sac' }, value: 1 };
    // `controller: 'you'` is genuinely shown too now (no longer folded into
    // any label) — this fact is a real "yours" want, not self-referencing,
    // since `subject` names a TOKEN, not `'self'`.
    expect(factConditions(fact)).toBe('yours · token: c_a_treasure_sac');
  });

  it('a zone fact with a real type constraint reads as a phrase, not JSON', () => {
    const fact: Fact = { role: 'sink', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], zone: 'Battlefield', controller: 'you', types: { has: ['Artifact'] }, value: 1 };
    expect(factConditions(fact)).toBe('yours · artifact permanents');
  });

  it('`types.hasAny` renders as a parenthetical option list, still no JSON', () => {
    const fact: Fact = { role: 'sink', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], zone: 'Battlefield', types: { hasAny: ['Artifact', 'Enchantment'] }, value: 1 };
    expect(factConditions(fact)).toBe('(Artifact/Enchantment) permanents');
  });

  it('putCounter shows `counterType` here now that the label is bare "counters" in every case (overridden 2026-09-10, later same day)', () => {
    const fact: Fact = { role: 'source', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], event: 'putCounter', counterType: 'stun', controller: 'opp', target: { types: { has: ['Creature'] } }, value: 1 };
    expect(factConditions(fact)).toBe('other · creature permanent · stun counters');
  });

  it('a non-putCounter event that happens to carry `counterType` still shows it the same way (defensive, not expected in the real corpus)', () => {
    const fact: Fact = { role: 'source', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], event: 'lifegain', counterType: '+1/+1', value: 1 };
    expect(factConditions(fact)).toBe('+1/+1 counters');
  });

  it('renders `cmc`/`power`/`toughness`/`amount`/`name` as readable phrases', () => {
    const fact: Fact = {
      role: 'sink',
      annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }],
      event: 'dies',
      target: { cmc: { max: 3 }, power: { min: 4 }, toughness: { eq: 1 }, amount: { min: 2 }, name: { eq: 'Bahamut' } },
      value: 1,
    };
    expect(factConditions(fact)).toBe('mana value up to 3 · power 4+ · toughness 1 · amount 2+ · named Bahamut');
  });

  it('legacy single `color` and new `colors` addMana details both render as "<color> mana", never JSON', () => {
    const legacy: Fact = { role: 'source', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], event: 'addMana', controller: 'you', color: 'G', value: 1 };
    expect(factConditions(legacy)).toBe('yours · G mana');
    const modern: Fact = { role: 'source', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], event: 'addMana', controller: 'you', colors: { hasAny: ['B', 'R'] }, value: 1 };
    expect(factConditions(modern)).toBe('yours · (B/R) mana');
  });

  it('`tapped`/`oncePerTurn` render as plain words', () => {
    const fact: Fact = { role: 'source', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], event: 'entersBattlefield', controller: 'you', tapped: true, oncePerTurn: true, value: 1 };
    expect(factConditions(fact)).toBe('yours · tapped · once per turn');
  });

  it('`tapped` on a plain (non-event) zone fact — a sink/movement\'s own top-level "candidate must be tapped" constraint, e.g. Fate of the Sun-Cryst\'s sink — still renders, not just on an `entersBattlefield` EventFact', () => {
    const sink: Fact = { role: 'sink', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], to: 'Battlefield', types: { has: ['Creature'] }, tapped: true, value: -1 };
    expect(factConditions(sink)).toBe('creature permanents · tapped');
  });

  it('`untilEndOfTurn` renders as "until end of turn", not raw camelCase', () => {
    const fact: Fact = { role: 'source', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], event: 'grantKeyword', controller: 'you', untilEndOfTurn: true, value: 1 };
    expect(factConditions(fact)).toBe('yours · until end of turn');
  });

  it('omits any key whose own value is undefined, rather than emitting a literal "undefined"', () => {
    const fact: Fact = {
      role: 'source',
      annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }],
      event: 'addMana',
      controller: 'you',
      value: undefined,
      tapped: undefined,
      colors: { hasAny: ['B', 'R'] },
    };
    expect(factConditions(fact)).toBe('yours · (B/R) mana');
  });

  it('a genuinely unknown future field still surfaces (exclusion-based, not an allowlist) without ever emitting raw JSON', () => {
    const fact = { role: 'source', zone: 'Battlefield', controller: 'you', brandNewField: 'wow' } as unknown as Fact;
    expect(factConditions(fact)).toBe('yours · brandNewField: wow');
  });

  describe('SOURCE zone-change `to`/`from` (2026-09-11 rework)', () => {
    it('shows "from <zone>" when the movement is NOT yet named by zoneMovementName — real, non-redundant info the fallback "<zone> presence" label says nothing about', () => {
      // No (from: 'Library', to: 'Exile') entry exists in ZONE_MOVEMENT_NAMES
      // today, so describeFact would fall back to bare "exile from
      // battlefield" (ZONE_PRESENCE_PHRASE's own Exile override) — this
      // fact's real origin (Library, not Battlefield) is genuinely new
      // information that label doesn't carry.
      const fact: Fact = { role: 'source', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], from: 'Library', to: 'Exile', controller: 'you', value: 1 };
      expect(factConditions(fact)).toBe('yours · from library');
    });

    it('shows nothing extra for a `to`-only movement with no known `from` (still unnamed) — nothing to add beyond the label itself', () => {
      const fact: Fact = { role: 'source', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], to: 'Hand', controller: 'you', value: 1 };
      expect(factConditions(fact)).toBe('yours');
    });

    it('a SINK zone fact is never treated as a movement, even if it somehow carried `to`/`from` (defensive — real sinks never do per the schema)', () => {
      const fact = { role: 'sink', from: 'Battlefield', to: 'Graveyard', controller: 'you', value: 1 } as unknown as Fact;
      expect(factConditions(fact)).toBe('yours');
    });

    it('a legacy bare-`zone` SOURCE fact (not yet migrated) renders exactly as before — no "to"/"from" noise, no regression', () => {
      const fact: Fact = { role: 'source', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], zone: 'Battlefield', controller: 'you', value: 1 };
      expect(factConditions(fact)).toBe('yours');
    });

    it('a `to`-only fact with its own type constraint picks the noun for the DESTINATION zone via `effectiveZone`, not a bare `zone` field that no longer exists on this shape', () => {
      const fact: Fact = { role: 'source', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], to: 'Graveyard', types: { has: ['Creature'] }, value: 1 };
      expect(factConditions(fact)).toBe('creature cards');
    });

    it('a `from`+`to` movement fact with its own type constraint picks the noun for the ORIGIN zone (`constraintNounZone`), not the destination — a Library-to-Battlefield tutor is searching artifact CARDS, not "artifact permanents" (the real fin/20 From Father to Son case; `from library` is separately shown by `movementOriginPhrase` since this exact (from,to) pair has no `zoneMovementName` entry — unrelated to, and unaffected by, this noun fix)', () => {
      const fact: Fact = { role: 'source', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], from: 'Library', to: 'Battlefield', controller: 'you', types: { has: ['Artifact'] }, value: 1 };
      expect(factConditions(fact)).toBe('yours · from library · artifact cards');
    });

    it('a plain `to`-only sink with a type constraint and no `from` at all still says "permanents" — it genuinely IS describing something already on the battlefield, unaffected by the origin-first noun change above', () => {
      const fact: Fact = { role: 'sink', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], to: 'Battlefield', types: { has: ['Artifact'] }, value: 1 };
      expect(factConditions(fact)).toBe('artifact permanents');
    });
  });

  describe('cast-event `from` origin (Flashback etc., 2026-09-11)', () => {
    it('shows nothing extra for the common `from: \'Hand\'` normal-cast case — no redundant "from hand" noise', () => {
      const fact: Fact = { role: 'source', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], event: 'cast', from: 'Hand', target: 'self', value: 1 };
      expect(factConditions(fact)).toBe('self');
    });

    it('shows "from graveyard" for a Flashback-style `from: \'Graveyard\'` cast — genuinely new info the bare "cast a spell" label doesn\'t carry', () => {
      const fact: Fact = { role: 'source', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], event: 'cast', from: 'Graveyard', target: 'self', value: 1 };
      expect(factConditions(fact)).toBe('self · from graveyard');
    });
  });

  describe('`excludeSelf` — "another X," not just "X" (2026-09-12, G\'raha Tia)', () => {
    it('event-shaped sink with `excludeSelf` nested under `target` (fin/21 G\'raha Tia\'s real dies want) folds "another" into the type+noun phrase', () => {
      const fact: Fact = {
        role: 'sink',
        annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }],
        event: 'dies',
        controller: 'you',
        target: { types: { hasAny: ['Creature', 'Artifact'] }, excludeSelf: true },
        oncePerTurn: true,
        value: 1,
      };
      expect(factConditions(fact)).toBe('yours · another (Creature/Artifact) permanent · once per turn');
    });

    it('zone-shaped fact with top-level `excludeSelf` and no other type constraint still says "another <noun>", not silently dropped (Magitek Infantry\'s real "another artifact" condition sink)', () => {
      const fact: Fact = { role: 'sink', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], to: 'Battlefield', controller: 'you', excludeSelf: true, value: 1 };
      expect(factConditions(fact)).toBe('yours · another permanents');
    });

    it('zone-shaped fact with top-level `excludeSelf` AND a real type constraint folds "another" into the type+noun phrase, same as the nested-target case', () => {
      const fact: Fact = { role: 'sink', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], to: 'Battlefield', controller: 'you', types: { has: ['Artifact'] }, excludeSelf: true, value: 1 };
      expect(factConditions(fact)).toBe('yours · another artifact permanents');
    });
  });

  it('never emits raw JSON syntax for any of the cases above', () => {
    const facts: Fact[] = [
      { role: 'source', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], zone: 'Battlefield', controller: 'opp', types: { not: ['Land'] }, value: 1 },
      { role: 'sink', annotations: [{ target: 'oracle', line: 0, start: 0, end: 1 }], event: 'dies', target: { types: { not: ['Land'] } }, value: 1 },
    ];
    for (const fact of facts) {
      const out = factConditions(fact);
      expect(out).not.toMatch(/[{}"]/);
    }
  });
});
