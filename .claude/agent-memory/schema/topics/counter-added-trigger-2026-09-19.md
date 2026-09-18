# Trigger.on:'counterAdded' + counterAddedMatch (2026-09-19)

Real schema addition closing the wall the user hit live-rewriting
`sink-model/catalog/counters.test.ts`: a mock/definition with ONLY a
consumer trigger (no co-located producer effect) couldn't tell
`CountersSink` what counter type it cared about, since `Trigger.on` had no
member for "a counter of type X was put on this permanent" — only the
free-text `name: 'onCounterAdded'` convention.

**Landed shape** (`functional-model/card.ts`):
```ts
on?: ... | 'counterAdded';
counterAddedMatch?: { counterType?: string };
```
Self-only scope (mirrors `'dies'`, not `'otherCreatureDies'`'s board-wide
pattern) — real Forge `TriggerCounterAdded`/`TriggerCounterAddedOnce`
(`ValidCard$ Card.Self`), Exemplar of Light's own real script
(`res/cardsfolder/e/exemplar_of_light.txt`): `Mode$ CounterAddedOnce |
CounterType$ P1P1 | ValidSource$ You | ValidCard$ Card.Self |
ActivationLimit$ 1`.

**Explicitly NOT a default-plus-named-exception pair** (unlike
`enter`/`otherPermanentEnters`, `dies`/`otherCreatureDies`) — considered and
rejected per a live coordinator design-fork question. Real Forge's own
un-parameterized `CounterType$` case is a genuine WILDCARD ("any type"),
not "assume +1/+1" — those default/exception pairs split on SCOPE where the
bare case has exactly one unambiguous meaning (self); counter TYPE has no
such single default without colliding with the real wildcard case. Also
checked real distribution before assuming `+1/+1` was even safe as a
default: dominant among producer `Effect.counterType` USES (21/26 FDN,
25/37 FIN) but genuinely not exclusive (`stun`/`revival`/`loyalty`/
`incubation`/`SOUL` FDN; `stun`/`LORE`/`CHARGE`/`finality`/`blight`/
`Indestructible` FIN) — and on the CONSUMER-trigger side specifically,
Exemplar of Light is the ONLY real card using `on:'counterAdded'` at all
(n=1, not a basis for an empirical default the way dozens of real
self-only triggers justified splitting out `otherPermanentEnters`). Full
reasoning: `counterAddedMatch`'s own doc comment in `card.ts`, and
`.claude/contracts/card-schema.md`'s new dated section.

**`CountersSink` widened** (`sink-model/catalog/families/counters.ts`,
additive not replacement): `deriveCounterTypes` now unions its pre-existing
producer-effect walk with a new `counterTypesFromConsumerTrigger` (reads
`trigger.on==='counterAdded' && counterAddedMatch?.counterType`) — only
throws when BOTH are empty. New `deriveConsumerTriggerOn` (mirrors
`etb.ts`'s `consumerTriggerOn` precedent, safer than the free-text
`consumerTriggerNames` path) — threaded onto the built entry, already read
generically by `card-interactions.ts`'s `matchEntry` with zero further
plumbing. Old `COUNTER_ADDED_TRIGGER_NAMES`/`deriveConsumerTriggerNames`
kept alive unchanged as the fallback for a hypothetical future differently-
spelled name-only convention — Exemplar of Light's own trigger no longer
resolves through it (it now sets a real `on` value, which that function's
pre-existing logic already excludes on purpose).

**Real card updated**: `exemplar-of-light/definition.ts`'s `onCounterAdded`
trigger now real (`on`+`counterAddedMatch`), `name` KEPT (still the
`Scenario.trigger` handle + the fallback-path key). Re-gated: flips
`pipeline-status.json` `purple`→`blue`. `justification.json` needed NO
rewrite — re-verified `OK` unchanged (span already covered the same
clause).

**Wrong citation corrected**: `families/counters.ts`'s own pre-existing
header comment claimed this gap was "tracked — ENGINE_GAPS.md"; verified
false (grepped, zero hits) before this pass — corrected in that file's
comment, not backfilled as a real numbered entry.

**engine-support-registry.ts**: new `counter-added-trigger-not-enforced`
entry, ordinary Ward-pattern shape (no `gapRef`), same posture as every
other `Trigger.on` addition already in this registry — did NOT get a new
`ENGINE_GAPS.md` numbered entry, matching precedent
(`other-permanent-enters-trigger-not-enforced`/`fdn-trigger-cluster-not-
enforced`/`spell-cost-reduction-card-type-gate-not-enforced` none did
either).

**Engine consult**: task instructions required consulting `engine` before
finalizing the gap classification. This subagent invocation had NO
SendMessage/ListAgents tool available (only Read/Edit/Write/Bash/
SubagentHandback) — could not perform the consult directly. Classified by
strong precedent instead (identical Ward-pattern shape to 3 prior
schema-only additions that also never got engine sign-off beyond this same
precedent) and flagged to the orchestrator to relay/confirm with `engine`
before treating it as fully settled.

**Left untouched on purpose**: `functional-model/sink-model/catalog/
counters.test.ts` (and its already-staged `.old` sibling) — a concurrent
session's own live, in-progress rewrite; confirmed backward-compat instead
by copying the PRE-rewrite (git-historical, 289-line) test content to a
throwaway filename, running it against the widened `families/counters.ts`
(20/20 pass), then deleting the throwaway file. Committed via `git commit
-- <explicit paths>` specifically to avoid sweeping the pre-existing staged
`counters.test.ts.old` or the unstaged live WIP `counters.test.ts` into
this commit.

Full detail: `.claude/contracts/card-schema.md`'s own new dated section
("New `Trigger.on: 'counterAdded'` + `counterAddedMatch`").

## Follow-up: `counterAddedMatch.source` (2026-09-19, later still)

Orchestrator caught a real gap this same field left open right after
landing: real Forge `ValidSource$` (who caused the counter to be added —
board-wide, ANY player's effect could cause it, unlike `'enter'`/`'dies'`'s
own unambiguous self-scope) had zero representation anywhere in `card.ts`.
User confirmed directly: source should be present, add now.

**Landed shape**: `counterAddedMatch?: { counterType?: string; source?:
'you' }` — additive, `counterType` untouched.

**Grounding**: `TriggerCounterAdded(Once|All).performTest` all gate on
`matchesValidParam("ValidSource", runParams.get(AbilityKey.Source))`;
`AbilityKey.Source` for this event is set from `Card.addCounterInternal`'s
`final Player source` (a PLAYER, not a card). `matchesValidParam` treats an
absent param as always-true → omitted = any source (same wildcard posture
`counterType` already has). Grepped all 72 real cardsfolder scripts
combining `Mode$ CounterAdded(Once|All)` + `ValidSource$` pool-wide: every
one uses `You`, zero `Opponent`/other-player examples exist for this
specific trigger mode (even though Forge's generic `Player.isValid` vocab
supports more) — `source` typed as the literal `'you'` only, not an open
`string`, same "required-in-practice" discipline as `counterType`. Presence
of `ValidSource$` correlates exactly with "whenever YOU put..." phrasing
vs. its absence correlating with source-agnostic phrasing, across the same
sample.

**Exemplar of Light**: `counterAddedMatch: { counterType: '+1/+1', source:
'you' }`. Re-gated, unchanged `blue`. No `justification.json` change
(span-level, not text-level).

**`CountersSink` NOT touched** — confirmed by grep, only `counterType` is
read anywhere; `source` is schema-completeness-only today, no consumer
yet.

**`counters.test.ts` left untouched** (per task instructions — user/
orchestrator live-rebuilding it); reported the exact field shape back for
them to apply.

**No new engine-support-registry/ENGINE_GAPS.md entry** — this is a
structural refinement of an already-tracked, already-unenforced trigger
(`counter-added-trigger-not-enforced`), not a new capability; flagged for
`engine`/orchestrator confirmation rather than asserted outright, same
precedent as the original field's own unresolved engine-consult.

Full detail: `.claude/contracts/card-schema.md`'s new dated section
("`counterAddedMatch.source` — real `ValidSource$` gap closed").

## Follow-up 2: `Trigger`/`TriggerOld`/`TriggerCause` split (2026-09-19, even later still)

Mid-task course correction (3 successive orchestrator-relayed refinements)
on top of the `source` field above: real Forge genuinely separates a `T:`
line's condition params from its `Execute$`-pointed effect (two real
objects, not one flat blob) — user wanted this reflected structurally, but
STRICTLY narrow/additive: no migration anywhere else (FIN's 139 files, rest
of FDN untouched), new shape ONLY for exemplar-of-light's two triggers.
Final naming direction: OLD flat interface renamed `TriggerOld`; NEW
`cause`/`effects`-nested shape takes the clean unsuffixed `Trigger` name
(the preferred-going-forward one) — coexist via `CardDefinition.triggers?:
(Trigger | TriggerOld)[]`.

**Shape**: `TriggerCause { on: TriggerOnValue; condition?; otherPermanentEntersMatch?;
otherCreatureDiesMatch?; counterAddedMatch?; attackersDeclaredMinCount?;
drawNthCardThisTurnNumber?; tapLandForManaColor?; activationLimit?; }`;
new `Trigger { name; effects; annotation?; cause?: TriggerCause }`. New
exported `TriggerOnValue = NonNullable<TriggerOld['on']>` alias (single
source of truth for the closed `on` union — any external `Trigger['on']`
reference now resolves to the WRONG, new interface and needs swapping to
this alias instead). New exported narrowing helpers: `triggerOn`,
`triggerCondition`, `triggerCounterAddedMatch`, `triggerActivationLimit`,
`triggerTapLandForManaColor` — plain `cause ? cause.field : field` duck-
checks, safe for either real shape.

**Real regression caught+fixed**: widening `CardDefinition.triggers` broke
`validate-card-definition.mjs`'s `findNameOnlyTriggerGapReasons` (plain
runtime `trigger.on` check, blind to `cause.on`) — exemplar-of-light
flipped back to `purple` immediately after the restructure. Fixed:
`trigger.on || trigger.cause?.on`. Re-gated, back to `blue`. Additive-only
fix, not re-run `--all` (would only touch other cards' `computedAt`
timestamps for zero real status change).

**In-lane fixes** (own the type-checking fallout from widening
`CardDefinition.triggers`): `sink-model/catalog/entry.ts`,
`sink-model/match-sink.ts`, `sink-model/catalog/families/counters.ts`,
`engine-support-registry.ts` (schema-owned per this agent's own brief) —
all switched from direct `.on`/`.condition`/`.counterAddedMatch` access to
the new helpers.

**Out-of-lane, flagged for `engine`, NOT fixed**: 9 real `tsc` diagnostics
in `engine.ts` (lines 582, 1114, 1154, 1204×3, 1249, 1256) and
`triggers.ts` (lines 85, 86) — all mechanical one-line swaps to the same
new helpers. Runtime unaffected (vitest doesn't type-check; full suite
confirmed green throughout). Full precise line list + exact fix pattern:
`.claude/contracts/card-schema.md`'s new dated section ("New nested
`Trigger`/`TriggerCause` shape, `TriggerOld` split off").
