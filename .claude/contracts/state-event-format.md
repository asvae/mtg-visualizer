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

## Self's own `id` field on `cast`/`activate`/`trigger`/`enters`/`playLand`/`move` (2026-09-12, additive)

The tested card's own real, stable per-object `id` (same `RealCard.id`/
`state.addCard`'s `nextObjectId++` the "Per-instance `id` fields" section
above already documents) now ALSO appears on every self-identifying
`harness.ts` entry (`lifecycleBefore`'s `cast`/`activate`/`trigger`/
`playLand`, `lifecycleAfter`'s `enters`/`move`, and the `sequence`-step
`trigger`/`activate` pushes) — alongside the pre-existing `instanceId`
(a SEPARATE, scenario-domain dedup concept `app/lib/scenarioReplay.ts`'s
own `ensureSelf`/`instanceCards` already keys on; `id` is the real object
identity `resolveInstance`/`idCards`/`claimedByOtherId` keys on instead).
Purely additive, `engine-trace.ts`'s own `cast`/`activate`/`trigger`/
`enters` pushes are NOT yet updated to match (a real gap, not touched this
pass — same field would be needed there for full parity).

**Why**: found live (magitek-infantry, fin/25) — a card whose own effect
finds/moves/taps ANOTHER real object sharing its exact name (a "search
your library for a card named X" tutor, e.g.) does so via the generic
`moveTo`/`tap` actions, which only ever carry the real per-instance `id`
(never `instanceId`). Until this fix, self's own `id` was never recorded
anywhere in the log, so the replay UI had no way to tell the two objects
apart — the second, genuinely distinct real copy's own `moveTo`+`tap`
silently aliased onto self's ALREADY-EXISTING chip (`ensure()`'s `byName`
lookup), instead of rendering as its own separate, correctly-tapped card.
Confirmed live: the original, untouched permanent visibly flipped tapped.

## `damagePrevented`, `coinFlip`, and `gainLife`'s `requestedAmount` (2026-09-12, additive; ENGINE_GAPS.md gaps #8/#8b/#15)

- **`fn:'damagePrevented'`** — REPLACES `fn:'dealDamage'` (never both) when
  a real 614.2-style prevention shield (`DamagePrevention`/
  `CombatDamagePrevention` keyword, checked at `state.dealDamage`'s own
  chokepoint) fires. Same "replace, don't append" shape `destroy`/
  `destroyPrevented` already established. Carries `target`/`id` (the
  card that would have taken damage) and `amount` (the prevented amount);
  `engine-trace.ts`'s own `pilotResolveCombatDamage` variant additionally
  carries `cause: 'combat'`.
- **`fn:'coinFlip'`** — a real coin-flip resolution (`state.flipCoin`).
  Carries `player`, `won` (the REAL outcome after any replacement),
  `requestedWin` (what the caller asked for), and `forced` (`won !==
  requestedWin` — true when a replacement like Two-Headed Coin overrode
  the request). A renderer can describe a flip generically from `won`
  alone; `forced` is there for a renderer that wants to call out the
  override specifically.
- **`gainLife`'s new `requestedAmount` field** — additive, OMITTED unless
  the real applied amount differs from what was asked for (e.g. a
  `LifegainDouble` replacement doubling it). Existing consumers reading
  `amount` alone are unaffected; a renderer that wants to show "would have
  gained N, actually gained M" can key off `requestedAmount`'s presence.

**This is additive-only and currently INERT on the consumer side** — `card`
agent's own `app/lib/scenarioReplay.ts` needs a follow-up: `ensureSelf`
should also register the resolved self chip's `id` (when its entry carries
one) into the shared `idCards`/`claimedByOtherId` bookkeeping `moveTo`/
`tap`/etc. already use, so a LATER entry naming a genuinely different `id`
for the same card name correctly creates a new chip instead of aliasing
through `ensure`'s name-only lookup. Not done as part of this change (out
of `engine`'s own lane) — confirmed live the merge bug is still present
pending that consumer-side fix.

## `grantKeyword`'s own `untilEndOfTurn` field + real Cleanup removal (2026-09-12, additive)

A `grantKeyword` entry now optionally carries `untilEndOfTurn: true` (only
present when true, omitted otherwise) — real CR 514.2 "until end of turn"
duration, opt-in per `Effect` (`card.ts`'s `grantKeywordTarget`/
`grantKeywordAll`/`grantKeywordSelf` own `untilEndOfTurn` field), tracked
game-wide in `GameState.untilEndOfTurnKeywordGrants` and drained by
`state.ts`'s `clearUntilEndOfTurnKeywordGrants()` at every real Cleanup
phase entry (`turn.ts`'s `runPhaseEntryAction`, alongside the pre-existing
`clearAllDamage()` call). **No new discrete log entry marks the removal**
— same "recalculated at render/query time, not a discrete action" shape
`continuousKeywordGrants`' own doc comment already established for a
different mechanism (ENGINE_GAPS.md gap #14) — the keyword is just gone
from the card's own `keywords` array (and therefore from any later
`grantKeyword`/`keywords`-derived render) once the next real `fn:'phase',
phase:'Cleanup'` entry (engine-trace.ts) has passed in the log. A replay
renderer keying a card's current keyword badges off "every `grantKeyword`
entry seen so far, minus none" will now be WRONG past that point for any
`untilEndOfTurn: true` grant — needs to also drop it once a later
Cleanup-phase entry (for ANY player, real 514.2 is game-wide, not just the
active player's) has been crossed. Found+fixed as the real root cause of a
live regression report (Dion, Bahamut's Dominant, fin/16): Bahamut's own
"Wings of Light... gain flying until end of turn" chapter effect had been
wired to a real, permanent `grantKeywordAll` call (no expiry), so its
Knight token kept showing Flying in the replay UI through the opponent's
own subsequent turns forever, once fired — unrelated to (and initially
mistaken for) `continuousKeywordGrants`' own turn-conditional toggle
(gap #14), which was independently re-verified live and is NOT regressed.
