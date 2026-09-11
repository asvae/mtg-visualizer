# Contract: Engine ↔ Replay/UI trace boundary

Owner: **engine** agent (`functional-model/harness.ts`,
`engine-trace.ts`). Consumer: **card** agent
(`ScenarioReplay.vue`/`ScenarioReplayTrace.vue`).

## Shape (`harness.ts`)

```ts
interface LogEntry {
  fn: string;
  [key: string]: unknown; // action-specific fields, e.g. moveTo/grantKeyword/putCounter args
}

interface TraceResult {
  scenario: {
    setup: string;   // always computed from scenario's own structured fields
    action: string;  // always computed
    result: string;  // scenario.result, else legacy scenario.label, else placeholder
  };
  log: LogEntry[];
}
```

Both generation paths produce this SAME shape:
- **harness path** (`harness.ts`'s `Scenario`/`runScenario`/`sequence`) —
  fires named triggers on a fresh board, no real turn passage / mana
  payment / summoning sickness / Saga automation. Cheap, correct for
  "does this card's effect do X" in isolation. Default path.
- **engine-trace path** (`engine-trace.ts`) — pilots a card through real
  `engine.ts`/`saga.ts` machinery (real cast, real mana via `payMana`, real
  wait states, real Saga chapter triggers), opt-in per card via
  `runEngineScenarios()` export in `scenarios.ts`. Reuses harness.ts's own
  `loggingActions`/`loggingPlayer`/`loggingCard` so entry shapes for shared
  actions never drift between the two paths; adds its own bracketing
  entries (`cast`/`activate`/`transform`) for real-engine-only events.

## What `card` (consumer) must not assume

- Don't assume every card has `runEngineScenarios` — dispatch on which
  export `scenarios.ts` has, don't guess from card type.
- `setup`/`action` strings are pre-computed — never re-derive them
  client-side from `log`.
- `log` entries are heterogeneous (`fn` + arbitrary fields) — render
  generically off `fn`, don't hardcode an exhaustive union; new `fn` kinds
  will appear as the engine grows.

## What `engine` (producer) must not break

- Any new `fn` kind must carry enough in its own fields for a generic
  renderer to describe it (no renderer-specific side-channel needed).
- Changing an existing entry's field names/shape is a breaking change to
  `card`'s renderer — flag it, don't just ship it.

## Per-instance `id` fields (2026-09-12, additive)

Every per-instance action entry (`pump`, `moveTo`/`ceasesToExist`,
`putCounter`, `equip`, `animate`, `gainControl`, `destroy`/
`destroyPrevented`, `dealDamage`, `tap`, `untap`, `grantKeyword`, dig's own
`moveTo`, and `engine-trace.ts`'s `tap`/`attack`/`block`) now ALSO carries
a real, stable per-instance `id` (`RealCard.id`/`Card.getId()` — the same
id `state.cards.get(id)` already keys on internally) alongside its
existing `name`/`target`-style field — `equipmentId`/`sourceId` on `equip`/
`dealDamage` for their own second real-card party, `blockerId`/
`attackerId` on `block`. This is purely additive (no existing field
renamed/removed) — added because `name`-only target resolution silently
breaks once 2+ real, distinct board instances share a name
(`GENERIC_FILLER_CREATURE`, dynamically created tokens, e.g. 2 Grizzly
Bears both under the same controller) — a real regression (The Crystal's
Chosen, fin/14: a `putCounter`-each-creature effect landed unevenly, 2
counters on one Grizzly Bears/0 on the other, instead of 1 each).

**`card` (consumer) should**: have `ensureForZone`/`ensureForTap`
(`app/lib/scenarioReplay.ts`) prefer matching on `id` when present, falling
back to the existing name(+owner/zone)-only match for older/id-less
entries — the existing `owner`-scoping fix there (`ensureForTap`'s own
`owner` param) narrows but does NOT fully resolve this collision class
(same-owner, same-name, multiple instances still collide under
owner-scoping alone).
