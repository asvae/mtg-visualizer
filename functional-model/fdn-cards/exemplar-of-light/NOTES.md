# Exemplar of Light — authoring notes

## Real Forge script (ground truth)

`tmp/mtg-forge/forge-gui/res/cardsfolder/e/exemplar_of_light.txt`:

```
Name:Exemplar of Light
ManaCost:2 W W
Types:Creature Angel
PT:3/3
K:Flying
T:Mode$ LifeGained | ValidPlayer$ You | TriggerZones$ Battlefield | Execute$ TrigPutCounter | TriggerDescription$ Whenever you gain life, put a +1/+1 counter on this creature.
SVar:TrigPutCounter:DB$ PutCounter | Defined$ Self | CounterType$ P1P1 | CounterNum$ 1
T:Mode$ CounterAddedOnce | CounterType$ P1P1 | ValidSource$ You | ValidCard$ Card.Self | TriggerZones$ Battlefield | ActivationLimit$ 1 | Execute$ TrigDraw | TriggerDescription$ Whenever you put one or more +1/+1 counters on this creature, draw a card. This ability triggers only once each turn.
SVar:TrigDraw:DB$ Draw
DeckHas:Ability$Counters
DeckHints:Ability$LifeGain
```

## Param-by-param audit (2026-09-19, even later still #3)

Every real param on both `T:` lines and both `SVar:` effects, checked
against what this card's `definition.ts` represents. Nothing here is
silently dropped.

| Real Forge param | Represented as |
| --- | --- |
| `Name` / `ManaCost:2 W W` / `Types:Creature Angel` / `PT:3/3` / `K:Flying` | `name` / `manaCost` / `typeLine` / `pt` / `keywords` |
| **Trigger 1** `Mode$ LifeGained` | `cause.on: 'lifeGained'` |
| `ValidPlayer$ You` | Baked into the `'lifeGained'` `on` value itself — NOT a missing param. Verified against the real pool-wide distribution (all 104 `Mode$ LifeGained` lines: 100 `You`, 2 `Opponent`, 1 bare `Player`, 1 compound, zero omitted); this schema's convention puts the who-does-it scope in the value name (`'opponentLifeLost'` is the same axis's other side). Full reasoning + citations: `card.ts`'s own `'lifeGained'` doc comment. |
| `TriggerZones$ Battlefield` | Structural, not a field: triggers only ever dispatch off a permanent on the battlefield in this model. Forge's own absent-`TriggerZones$` = every zone (`TriggerReplacementBase.zonesCheck`), so this line's restriction IS what the model already does. Non-battlefield zones are a documented known schema gap (no FDN card needs one) — see `TriggerCause`'s own doc comment. |
| `Execute$ TrigPutCounter` | The `cause`/`effects` split itself — `effects` IS the `SVar:` this points at. |
| `TriggerDescription$` | Printed oracle text; covered by `justification.json`'s span for this sentence. |
| **SVar `TrigPutCounter`** `DB$ PutCounter` | `effects[0].kind: 'putCounter'`. (`DB$` needs no tag — every trigger's `effects` is DB$-shaped by construction, see `CardDefinition.abilityType`'s doc comment.) |
| `Defined$ Self` | `target: 'self'` (the non-`chosen` fork of the unified `putCounter`). |
| `CounterType$ P1P1` | `counterType: '+1/+1'` |
| `CounterNum$ 1` | `amount: 1` |
| **Trigger 2** `Mode$ CounterAddedOnce` | `cause.on: 'counterAdded'`. The `Once`/`All`/plain three-class Forge distinction is deliberately not modeled yet (only the `Once` shape has a real card) — declared in `card.ts`'s own `'counterAdded'` doc comment. |
| `CounterType$ P1P1` | `cause.counterAddedMatch.counterType: '+1/+1'` |
| `ValidSource$ You` | `cause.counterAddedMatch.source: 'you'` |
| `ValidCard$ Card.Self` | Baked into the `'counterAdded'` value's own self-only scope (documented there). |
| `TriggerZones$ Battlefield` | Same as trigger 1 above. |
| `ActivationLimit$ 1` | `cause.activationLimit: 1` — real per-turn cap, Cleanup-reset. |
| `Execute$ TrigDraw` | `effects`, same as trigger 1. |
| **SVar `TrigDraw`** `DB$ Draw` | `effects[0].kind: 'drawCard', amount: 1`. Forge's `DrawEffect` defaults an absent `NumCards$` to 1 and an absent `Defined$` to the controller — matching this effect's explicit `amount: 1` and its omitted `owner` (implicit `'you'`). |
| `DeckHas:` / `DeckHints:` | Forge deck-builder hints, not game rules — nothing to model. |
| `Oracle:` | Real printed text; the durable copy this pool verifies spans against lives in `data/fdn/fdn_scryfall.json`, not here. |

No `missingSchemaFunctionality` entry: every real clause of this card is
genuinely represented. `abilityType` is correctly omitted — this card has
no top-level `effects` at all, all behavior lives in `triggers`.

## Shape

Both triggers use the newer nested `cause`/`effects` `Trigger` shape
(2026-09-19); this card is the first real user of it.
