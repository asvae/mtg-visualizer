// Simplified layers system (613) — real layer ORDER, verified against
// `../mtg-forge`'s actual `StaticAbilityLayer` enum
// (forge-game/src/main/java/forge/game/staticability/StaticAbilityLayer.java
// lines 5-34): COPY=1, CONTROL=2, TEXT=3, TYPE=4, COLOR=5, ABILITIES=6, then
// P/T sublayers (CHARACTERISTIC/SETPT=7b/MODIFYPT=7c). Applied by layer,
// then by TIMESTAMP within a layer (613.1/613.6 — creation order), on top
// of `state.ts`'s real mutable objects. This is the "later" state.ts's own
// header pointed at: `pump`/`animate` used to be direct, permanent
// mutations; this replaces that with a real (if narrow) continuous-effect
// list, recalculated on read rather than baked in at write time.
//
// Explicit scope, agreed in conversation ("simplify, don't skip"):
//   - Only layers 4 (TYPE), 6 (ABILITIES), and 7 (P/T) are implemented —
//     the three this prototype's cards actually need (`animate`, a
//     hypothetical keyword grant, `pump`/counters).
//   - Layers 1 (COPY), 2 (CONTROL), 3 (TEXT), 5 (COLOR) are NOT
//     implemented at all. A real, plainly-flagged gap.
//   - DEPENDENCY-based reordering WITHIN a layer (613.8 — the genuinely
//     hard part: one effect's own application can depend on whether
//     another applies first) is explicitly out of scope. Only timestamp
//     order is modeled — correct for the common case (two independent
//     pumps), wrong for a real dependency chain (rare, and out of scope
//     here on purpose).
//   - Duration ("until end of turn") is NOT tracked by this file's OWN
//     effect-application logic — an added `LayerEffect` never expires on
//     its own, still the same simplification state.ts's old direct-mutation
//     version documented. The narrow exception: `remove(timestamp)` below
//     lets a CALLER (`state.ts`'s own `clearUntilEndOfTurnPumps`, mirroring
//     the pre-existing `clearUntilEndOfTurnKeywordGrants` treatment for a
//     granted keyword) drain a specific, individually-tracked entry at a
//     real Cleanup — this file still has no OWN duration concept; it's just
//     no longer impossible for a caller to build one on top.

export type LayerEffect =
  | { layer: 4; timestamp: number; apply: (types: string[]) => string[] }
  | { layer: 6; timestamp: number; apply: (abilities: string[]) => string[] }
  | { layer: 7; timestamp: number; apply: (power: number, toughness: number) => [number, number] };

let nextTimestamp = 1;
/** A real timestamp source (613.1's own "the order effects were created") — every LayerEffect gets one so `LayerSet` can apply same-layer effects in creation order. */
export function nextLayerTimestamp(): number {
  return nextTimestamp++;
}

/** One card's own accumulated continuous effects — recalculated on every read (`compute*`), never baked into a stored value. Two effects in the SAME layer both persist and apply in timestamp order (neither overwrites the other) — the concrete case this replaces state.ts's old `powerDelta +=`/`toughnessDelta +=` fields for. */
export class LayerSet {
  private effects: LayerEffect[] = [];

  add(effect: LayerEffect): void {
    this.effects.push(effect);
  }

  /**
   * Real 514.2's "until end of turn" half — removes the ONE effect added
   * with this exact `timestamp` (each `add` call gets a fresh, unique one
   * via `nextLayerTimestamp`, so this is a precise single-entry removal, not
   * a broad sweep). Mirrors `state.ts`'s existing
   * `clearUntilEndOfTurnKeywordGrants` treatment for a granted keyword — a
   * real mutation of the card's own continuous-effect list, not a
   * duration flag checked at read time. See `state.ts`'s `pump`/
   * `untilEndOfTurnPumps` for the one real caller (`GameState
   * .clearUntilEndOfTurnPumps`, drained at every real Cleanup).
   */
  remove(timestamp: number): void {
    this.effects = this.effects.filter((e) => e.timestamp !== timestamp);
  }

  private sorted<L extends LayerEffect['layer']>(layer: L): Extract<LayerEffect, { layer: L }>[] {
    return this.effects.filter((e): e is Extract<LayerEffect, { layer: L }> => e.layer === layer).sort((a, b) => a.timestamp - b.timestamp);
  }

  computeTypes(baseTypes: string[]): string[] {
    let types = baseTypes;
    for (const e of this.sorted(4)) types = e.apply(types);
    return types;
  }

  computeAbilities(baseAbilities: string[]): string[] {
    let abilities = baseAbilities;
    for (const e of this.sorted(6)) abilities = e.apply(abilities);
    return abilities;
  }

  computePT(basePower: number, baseToughness: number): [number, number] {
    let p = basePower;
    let t = baseToughness;
    for (const e of this.sorted(7)) [p, t] = e.apply(p, t);
    return [p, t];
  }

  get isEmpty(): boolean {
    return this.effects.length === 0;
  }
}
