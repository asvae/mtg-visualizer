import { describe, expect, it } from 'vitest';
import { LayerSet, nextLayerTimestamp } from './layers';

describe('LayerSet', () => {
  it('applies two same-layer P/T effects in timestamp order, both persisting (not last-write-wins)', () => {
    const layers = new LayerSet();
    const t1 = nextLayerTimestamp();
    const t2 = nextLayerTimestamp();
    // Added out of timestamp order on purpose — sorting must be by
    // timestamp, not insertion order into the internal array.
    layers.add({ layer: 7, timestamp: t2, apply: (p, t) => [p * 2, t] });
    layers.add({ layer: 7, timestamp: t1, apply: (p, t) => [p + 1, t + 1] });

    // t1 (+1/+1) applies first: (2,2) -> (3,3). t2 (*2 power) applies second: (3,3) -> (6,3).
    expect(layers.computePT(2, 2)).toEqual([6, 3]);
  });

  it('layer 4 (type) and layer 7 (P/T) apply independently — neither overwrites the other', () => {
    const layers = new LayerSet();
    layers.add({ layer: 4, timestamp: nextLayerTimestamp(), apply: (types) => [...types, 'Creature'] });
    layers.add({ layer: 7, timestamp: nextLayerTimestamp(), apply: (p, t) => [p + 1, t + 1] });

    expect(layers.computeTypes(['Artifact'])).toEqual(['Artifact', 'Creature']);
    expect(layers.computePT(1, 1)).toEqual([2, 2]);
  });

  it('computeTypes never duplicates a type already present', () => {
    const layers = new LayerSet();
    layers.add({ layer: 4, timestamp: nextLayerTimestamp(), apply: (types) => [...new Set([...types, 'Creature'])] });
    expect(layers.computeTypes(['Creature', 'Artifact'])).toEqual(['Creature', 'Artifact']);
  });

  it('layer 6 (abilities) is independent of layers 4 and 7', () => {
    const layers = new LayerSet();
    layers.add({ layer: 6, timestamp: nextLayerTimestamp(), apply: (abilities) => [...abilities, 'Flying'] });
    expect(layers.computeAbilities([])).toEqual(['Flying']);
    expect(layers.computeTypes(['Creature'])).toEqual(['Creature']);
  });

  it('isEmpty reflects whether any effect has been added', () => {
    const layers = new LayerSet();
    expect(layers.isEmpty).toBe(true);
    layers.add({ layer: 7, timestamp: nextLayerTimestamp(), apply: (p, t) => [p, t] });
    expect(layers.isEmpty).toBe(false);
  });

  it('an empty LayerSet leaves base values unchanged', () => {
    const layers = new LayerSet();
    expect(layers.computePT(3, 4)).toEqual([3, 4]);
    expect(layers.computeTypes(['Land'])).toEqual(['Land']);
  });
});

describe('nextLayerTimestamp', () => {
  it('is real-timestamp-shaped: strictly increasing across calls', () => {
    const a = nextLayerTimestamp();
    const b = nextLayerTimestamp();
    const c = nextLayerTimestamp();
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });
});
