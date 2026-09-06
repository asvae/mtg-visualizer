import { describe, expect, it } from 'vitest';
import { actionEndIndices, groupForDisplay, replayTrace } from './scenarioReplay';
import type { LogEntry } from '../../functional-model/harness';

/** Minimal trace wrapper — every test here seeds an empty board (no `raw`) and drives everything through log entries, since `replayTrace` creates a chip on first reference regardless of whether `raw` seeded it. */
function trace(log: LogEntry[]) {
  return { scenario: { raw: undefined }, log };
}

function lastCards(log: LogEntry[]) {
  return replayTrace(trace(log)).at(-1)!.cards;
}

describe('replayTrace', () => {
  it('createToken adds one NEW chip per qty, not aliased onto an existing same-named card', () => {
    const cards = lastCards([
      { fn: 'createToken', controller: 'you', token: 'Treasure', qty: 1, tapped: false },
      { fn: 'createToken', controller: 'you', token: 'Treasure', qty: 2, tapped: false },
    ]);
    const treasures = cards.filter((c) => c.name === 'Treasure');
    expect(treasures).toHaveLength(3);
    expect(treasures.every((c) => c.owner === 'you' && c.zone === 'Battlefield')).toBe(true);
  });

  it('copyPermanent adds a NEW chip sharing the source name, not an alias', () => {
    const cards = lastCards([
      { fn: 'enters', card: 'Elite Guard', instanceId: 1, zone: 'Battlefield' },
      { fn: 'copyPermanent', source: 'Elite Guard', controller: 'opp0' },
    ]);
    const copies = cards.filter((c) => c.name === 'Elite Guard');
    expect(copies).toHaveLength(2);
    expect(copies.find((c) => c.owner === 'opp0')).toBeTruthy();
  });

  it('legendRule moves the named card to the graveyard', () => {
    const cards = lastCards([
      { fn: 'enters', card: 'Adelbert Steiner', instanceId: 1, zone: 'Battlefield' },
      { fn: 'legendRule', card: 'Adelbert Steiner', player: 'you' },
    ]);
    expect(cards.find((c) => c.name === 'Adelbert Steiner')?.zone).toBe('Graveyard');
  });

  it('pump accumulates power/toughness across multiple entries', () => {
    const cards = lastCards([
      { fn: 'pump', target: 'Bear', power: 1, toughness: 1 },
      { fn: 'pump', target: 'Bear', power: 2, toughness: 0 },
    ]);
    const bear = cards.find((c) => c.name === 'Bear')!;
    expect(bear.powerMod).toBe(3);
    expect(bear.toughnessMod).toBe(1);
  });

  it('animate replaces (not merges) the tracked type list', () => {
    const cards = lastCards([
      { fn: 'animate', target: 'Ambush Land', types: ['Land', 'Creature'] },
      { fn: 'animate', target: 'Ambush Land', types: ['Land'] },
    ]);
    expect(cards.find((c) => c.name === 'Ambush Land')?.animatedTypes).toEqual(['Land']);
  });

  it('discard moves the real named card(s) to the graveyard, not just an event marker', () => {
    const cards = lastCards([
      { fn: 'enters', card: 'Hand Filler', instanceId: 1, zone: 'Hand' },
      { fn: 'discard', player: 'you', qty: 1, cards: ['Hand Filler'] },
    ]);
    expect(cards.find((c) => c.name === 'Hand Filler')?.zone).toBe('Graveyard');
  });

  it('drawCard/drawCards move the named card(s) from wherever they were into Hand', () => {
    const cards = lastCards([
      { fn: 'drawCard', player: 'you', card: 'you-library-0' },
      { fn: 'drawCards', player: 'you', n: 2, cards: ['you-library-1', 'you-library-2'] },
    ]);
    for (const name of ['you-library-0', 'you-library-1', 'you-library-2']) {
      expect(cards.find((c) => c.name === name)?.zone).toBe('Hand');
    }
  });

  it('attack/block set visual flags that clear on the next real phase entry', () => {
    const snapshots = replayTrace(
      trace([
        { fn: 'attack', card: 'Attacker' },
        { fn: 'block', blocker: 'Blocker', attacker: 'Attacker' },
        { fn: 'phase', phase: 'CombatDamage', turn: 1, player: 'you' },
      ]),
    );
    const midCombat = snapshots[2]!.cards;
    expect(midCombat.find((c) => c.name === 'Attacker')?.attacking).toBe(true);
    expect(midCombat.find((c) => c.name === 'Blocker')?.blocking).toBe(true);
    const afterPhase = snapshots[3]!.cards;
    expect(afterPhase.find((c) => c.name === 'Attacker')?.attacking).toBeFalsy();
    expect(afterPhase.find((c) => c.name === 'Blocker')?.blocking).toBeFalsy();
  });

  it('untap/tap/tapForMana each land a DIFFERENT same-named fungible instance, not the same one repeatedly', () => {
    // Real basic lands are seeded (setupPlayer/seedPlayerCards) as 3
    // genuinely distinct chips sharing the name "Island" — never logged via
    // their own `enters` (that's `ensureSelf`'s job, for the ONE tested
    // card only; using it for a fungible land would alias all three onto
    // one object, same collision this fix exists to avoid).
    const snapshots = replayTrace({
      scenario: { raw: { you: { basicLands: ['Island', 'Island', 'Island'] } } as never },
      log: [
        { fn: 'tapForMana', target: 'Island', for: 'Spell' },
        { fn: 'tapForMana', target: 'Island', for: 'Spell' },
      ],
    });
    const islands = snapshots.at(-1)!.cards.filter((c) => c.name === 'Island');
    expect(islands).toHaveLength(3);
    expect(islands.filter((c) => c.tapped)).toHaveLength(2);
    expect(islands.filter((c) => !c.tapped)).toHaveLength(1);
  });

  it('transform sets faceName forward and clears it on a transform back to the stable name', () => {
    const snapshots = replayTrace(
      trace([
        { fn: 'cast', card: 'Jill, Shiva\'s Dominant', instanceId: 1, from: 'hand', cost: '{2}{U}' },
        { fn: 'enters', card: 'Jill, Shiva\'s Dominant', instanceId: 1, zone: 'Battlefield' },
        { fn: 'transform', card: 'Jill, Shiva\'s Dominant', into: 'Shiva, Warden of Ice' },
        { fn: 'transform', card: 'Jill, Shiva\'s Dominant', into: 'Jill, Shiva\'s Dominant' },
      ]),
    );
    expect(snapshots[3]!.cards.find((c) => c.name === "Jill, Shiva's Dominant")?.faceName).toBe('Shiva, Warden of Ice');
    expect(snapshots[4]!.cards.find((c) => c.name === "Jill, Shiva's Dominant")?.faceName).toBeUndefined();
  });

  it('groupForDisplay does not merge two same-named cards that differ in pump/attacking state', () => {
    const cards = lastCards([
      { fn: 'enters', card: 'Bear-0', instanceId: 1, zone: 'Battlefield' },
      { fn: 'enters', card: 'Bear-1', instanceId: 2, zone: 'Battlefield' },
      { fn: 'pump', target: 'Bear-0', power: 1, toughness: 1 },
    ]);
    // groupNameOf strips a trailing -N for grouping, so these would collapse
    // if pump weren't part of groupKey too.
    const grouped = groupForDisplay(cards.filter((c) => c.name.startsWith('Bear')));
    expect(grouped).toHaveLength(2);
  });
});

describe('actionEndIndices', () => {
  it('maps each action to the START of the next one, or log length for the last', () => {
    expect(actionEndIndices([{ from: 0 }, { from: 3 }, { from: 7 }], 10)).toEqual([3, 7, 10]);
  });

  it('handles a single action spanning the whole log', () => {
    expect(actionEndIndices([{ from: 0 }], 5)).toEqual([5]);
  });
});
