import { describe, expect, it } from 'vitest';
import { factConditions } from './factConditions';
import type { Fact } from '../../functional-model/synergy';

describe('factConditions', () => {
  // The 5 concrete facts the user/coordinator worked through by hand
  // against the live page (fin/279 The Gold Saucer, fin/1 Summon:
  // Bahamut's own `played`/`coin-flip` facts) — verified against the
  // actual `describeFact` branches, not just trusted at face value.
  describe('the concrete cases worked through against the live page', () => {
    it('Gold Saucer\'s artifact-sink: fully redundant with "artifact permanents you control on the battlefield" -> "—"', () => {
      const fact: Fact = { id: 'wants-artifact', role: 'sink', zone: 'Battlefield', controller: 'you', types: { has: ['Artifact'] } };
      expect(factConditions(fact)).toBe('—');
    });

    it('Treasure battlefield-presence: `subject` is real info, not folded into "battlefield presence" -> shown alone', () => {
      const fact: Fact = {
        id: 'treasure-presence',
        role: 'source',
        zone: 'Battlefield',
        controller: 'you',
        subject: { token: 'c_a_treasure_sac' },
        value: 1,
      };
      expect(factConditions(fact)).toBe(JSON.stringify({ subject: { token: 'c_a_treasure_sac' } }));
    });

    it('Gold Saucer mana: `color` is deliberately NOT in the generic "your mana production" label -> shown alone (unchanged from before this task)', () => {
      const fact: Fact = { id: 'mana', role: 'source', event: 'addMana', controller: 'you', color: 'C', sourceText: '{T}: Add {C}.', highlight: '{C}', value: 1 };
      expect(factConditions(fact)).toBe(JSON.stringify({ color: 'C' }));
    });

    it('`playLand` with `subject: \'self\'` and `controller: \'you\'`: both trivial defaults for this branch -> "—"', () => {
      const fact: Fact = { id: 'played', role: 'source', event: 'playLand', controller: 'you', subject: 'self', sourceText: 'Play a land.', value: 1 };
      expect(factConditions(fact)).toBe('—');
    });

    it('`coinFlip` with `controller: \'you\'`: trivial default for this branch -> "—"', () => {
      const fact: Fact = { id: 'coin-flip', role: 'source', event: 'coinFlip', controller: 'you', sourceText: 'Flip a coin.', highlight: 'Flip a coin', value: 1 };
      expect(factConditions(fact)).toBe('—');
    });
  });

  // Regression: `subject` (see the Treasure case above) was silently
  // dropped by the old hand-maintained `CONDITION_KEYS` allowlist — the
  // whole point of switching to an exclusion-based approach.
  it('includes `subject` when it is not the trivial `\'self\'` value', () => {
    const fact: Fact = { id: 'treasure-etb', role: 'source', event: 'entersBattlefield', controller: 'you', subject: { token: 'c_a_treasure_sac' }, value: 1 };
    expect(factConditions(fact)).toBe(JSON.stringify({ subject: { token: 'c_a_treasure_sac' } }));
  });

  // Regression (forward-looking): a brand new field added to the `Fact`
  // schema — `face`, added the same session this test was written — shows
  // up automatically, no allowlist update needed, proving the exclusion-
  // based approach actually generalizes.
  it('includes a brand-new schema field (`face`) automatically, no allowlist update needed', () => {
    const fact: Fact = { id: 'mana', role: 'source', event: 'addMana', controller: 'you', color: 'G', face: 'front' };
    expect(factConditions(fact)).toBe(JSON.stringify({ color: 'G', face: 'front' }));
  });

  // Real corpus regression this task was actually about: a `putCounter`
  // fact whose OWN label ("<counterType> counters") never mentions who
  // controls it at all — hiding `controller` unconditionally (a first,
  // too-blunt pass at this fix) would have made ice-flan/omega-heartless-
  // evolution/ultros-obnoxious-octopus's real "puts stun counters on an
  // OPPONENT's creature" fact indistinguishable from one that targets your
  // own board.
  it('shows `controller: \'opp\'` on a putCounter fact (its own label never mentions controller at all)', () => {
    const fact: Fact = { id: 'stun', role: 'source', event: 'putCounter', counterType: 'stun', controller: 'opp', target: { types: { has: ['Creature'] } }, value: 1 };
    expect(factConditions(fact)).toBe(JSON.stringify({ controller: 'opp', target: { types: { has: ['Creature'] } } }));
  });

  // `controller: 'you'` on that SAME branch is the trivial, unstated-by-
  // convention default and stays hidden (paired with the case above to
  // show this isn't "always show controller for putCounter", it's
  // specifically the non-default value that matters).
  it('hides `controller: \'you\'` on a putCounter fact (the trivial default)', () => {
    const fact: Fact = { id: 'stun', role: 'source', event: 'putCounter', counterType: 'stun', controller: 'you', target: { types: { has: ['Creature'] } }, value: 1 };
    expect(factConditions(fact)).toBe(JSON.stringify({ target: { types: { has: ['Creature'] } } }));
  });

  // A zone fact ALWAYS folds `controller` regardless of its value (both
  // "you control" and "an opponent controls" are spelled out explicitly) —
  // confirmed against 74 real corpus facts (e.g. bartz-and-boko's own
  // opponent-creature want) that this must stay hidden even for `'opp'`,
  // unlike the putCounter case above (a real bug caught while implementing
  // this: a naive "hide only 'you', show 'opp'" rule applied everywhere
  // would have reintroduced redundant JSON noise for every one of those 74
  // facts).
  it('hides `controller: \'opp\'` on a zone fact too (already spelled out as "an opponent controls")', () => {
    const fact: Fact = { id: 'wants-opp-creature', role: 'sink', zone: 'Battlefield', controller: 'opp', types: { has: ['Creature'] }, value: 1 };
    expect(factConditions(fact)).toBe('—');
  });

  // `types.not` is never folded into any label (`constraintBits` only ever
  // reads `.has`/`.hasAny`) — real information, stays visible even on a
  // zone fact whose `.has`/`.hasAny` portion (absent here) would otherwise
  // be fully redundant.
  it('shows `types.not` even on a zone fact (never folded, unlike `.has`/`.hasAny`)', () => {
    const fact: Fact = { id: 'wants-opp-nonland', role: 'sink', zone: 'Battlefield', controller: 'opp', types: { not: ['Land'] }, value: 1 };
    expect(factConditions(fact)).toBe(JSON.stringify({ types: { not: ['Land'] } }));
  });

  // `entersBattlefield`'s own label ("enters the battlefield") never reads
  // `types` at all (unlike a zone fact/the generic fallback) — real corpus
  // facts (loporrit-scout, woodland-weavemaster) rely on this actually
  // showing here, since it's the only place their real "another Elf/
  // Creature enters" filter is visible at all.
  it('shows `types.has` verbatim on an entersBattlefield fact (that branch never folds it in)', () => {
    const fact: Fact = { id: 'elf-etb', role: 'source', event: 'entersBattlefield', controller: 'you', types: { has: ['Elf'] }, value: 1 };
    expect(factConditions(fact)).toBe(JSON.stringify({ types: { has: ['Elf'] } }));
  });

  // The generic fallback branch (an `event` string with no named
  // `describeFact` case, e.g. `landfall`) folds `types`/`cmc` the same way
  // a zone fact does (`` `${qualifier}${event}` `` reuses the same
  // `constraintBits`) — confirmed this still hides them correctly, not
  // just for the 10 explicitly-named branches.
  it('folds `types`/`cmc` on a fallback (unnamed) event branch, same as a zone fact', () => {
    const fact: Fact = { id: 'landfall-cmc', role: 'source', event: 'landfall', controller: 'you', types: { has: ['Land'] }, cmc: { min: 3 }, value: 1 };
    expect(factConditions(fact)).toBe('—');
  });

  it('renders "—" when every present field is hidden/folded', () => {
    const fact: Fact = { id: 'wants-artifact', role: 'sink', zone: 'Battlefield', controller: 'you', types: { has: ['Artifact'] }, value: 1, sourceText: 'x' };
    expect(factConditions(fact)).toBe('—');
  });

  it('omits any key whose own value is undefined, hidden or not, rather than emitting a literal "undefined"', () => {
    const fact: Fact = {
      id: 'mana',
      role: 'source',
      event: 'addMana',
      controller: 'you',
      value: undefined,
      sourceText: undefined,
      tapped: undefined,
      colors: { hasAny: ['B', 'R'] },
    };
    expect(factConditions(fact)).toBe(JSON.stringify({ colors: { hasAny: ['B', 'R'] } }));
  });

  // `target` is deliberately never rendered by `describeFact` (per its own
  // doc comment) — stays visible unconditionally, including the "self"
  // sentinel value (unlike `subject`, no special-cased triviality here;
  // the coordinator's own review didn't ask for one, and `dies`'s label
  // DOES branch on it — "dying" vs "creature dying" — so it isn't purely
  // inert the way `subject: 'self'` is).
  it('always shows `target`, including the literal "self" sentinel', () => {
    const fact: Fact = { id: 'self-dies', role: 'source', event: 'dies', target: 'self', value: 1 };
    expect(factConditions(fact)).toBe(JSON.stringify({ target: 'self' }));
  });
});
