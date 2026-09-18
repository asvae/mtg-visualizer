# FDN trigger-dispatch-cluster pass (2026-09-18, later still)

Closed the FDN pool's biggest recurring purple/`engineSupport:'on'` gap
shape — name-only `Trigger`s with no real `on` value — by clustering the
~28 given gate reasons against real Forge ground truth (`tmp/mtg-forge`)
rather than guessing which ones share an underlying event.

## New vocabulary (`card.ts`)

**`Trigger.on` gained 10 new members** (all Ward-pattern: declared,
Forge-cited, NOT dispatched by `engine.ts` — one bundled
`engine-support-registry.ts` entry, `fdn-trigger-cluster-not-enforced`,
covers all 10):
- `'lifeGained'` — `TriggerLifeGained`/`Mode$ LifeGained | ValidPlayer$
  You`. Cat Collector's "first time each turn" variant reuses the
  pre-existing `activationLimit: 1` field instead of a second `on` value
  (functionally identical to Forge's own `FirstTime$ True`).
- `'dies'` (self, `Mode$ ChangesZone | Origin$ Battlefield | Destination$
  Graveyard | ValidCard$ Card.Self`) and `'otherCreatureDies'` (board-wide,
  see `otherCreatureDiesMatch`) — genuinely different real triggers,
  confirmed via Forge scripts (`Card.Self` vs `Creature.!token+Other`, no
  `YouCtrl` on the latter — high-society-hunter's own "another nontoken
  creature" is NOT scoped to the controller at all).
- `'attackersDeclared'` (+ `attackersDeclaredMinCount?: number`, omitted =
  GE1) — `TriggerAttackersDeclared`. Confirmed battlesong-berserker and
  armasaur-guide are the SAME real trigger family (just
  `ValidAttackersAmount$ GE3` vs the Forge-default `GE1`), genuinely
  distinct from the pre-existing `'attacks'` (`TriggerAttacks`, THIS
  creature's own individual attack).
- `'drawNthCardThisTurn'` (+ `drawNthCardThisTurnNumber?: number`, omitted
  = every draw) — `TriggerDrawn`. Used the EXACT name `card.ts`'s own
  `'equippedAttacks'` doc comment had already anticipated for this gap.
  Clinquant Skymage (no `Number$`) confirmed via Forge to be the SAME
  trigger family as the `Number$ 2` cards, not a separate "any draw" value.
- `'castNoncreatureSpell'` / `'castInstantOrSorcery'` —
  `TriggerSpellAbilityCastOrCopy`/`Mode$ SpellCast`, two different real
  `ValidCard$` filters (`Card.nonCreature` vs `Instant,Sorcery`), kept as
  separate fixed values rather than one filter-object (matches the
  `'attacks'`/`'equippedAttacks'` sibling-value precedent). Also used
  `'castNoncreatureSpell'`'s exact anticipated name.
- `'dealsCombatDamageToPlayer'` (self, `TriggerDamageDone`/`ValidSource$
  Card.Self`) / `'creatureYouControlDealsCombatDamageToPlayer'`
  (board-wide, `ValidSource$ Creature.YouCtrl`) — confirmed genuinely
  different real triggers (task's own hint that these might not be the
  same shape was correct).
- `'opponentLifeLost'` — `TriggerLifeLost`/`Mode$ LifeLost | ValidPlayer$
  Opponent`. Single real FDN card (bloodthirsty-conqueror) but a clearly
  general "drain" archetype — closed per the task's own "1-2 cards OK if
  clearly general" guidance.

**`otherPermanentEntersMatch` gained `isLand?: boolean`** — checked Forge
first: Landfall is NOT its own `TriggerType`, it's the exact same `Mode$
ChangesZone | Destination$ Battlefield` shape as the pre-existing
`otherPermanentEnters`, just `ValidCard$ Land.YouCtrl` instead of a
creature subtype — same field name/semantics `TriggerDoublingGrant
.entersMatch`'s own `isLand` already established. No new registry entry
needed (the pre-existing `other-permanent-enters-trigger-not-enforced`
already matches on `t.on === 'otherPermanentEnters'` regardless of the
match-filter shape). Beast-Kin Ranger/Dazzling Angel reuse
skyknight-squire's own already-accepted `{sameController: true}` looseness
(no dedicated "must be Creature" filter exists or was needed).

**`BoardStateCondition` gained 2 kinds** (no new registry entry needed —
`board-state-condition-not-enforced` already matches generically on `t
.condition` presence): `controlsCreaturePowerAtLeast` (courageous-goblin's
"while you control a creature with power 4 or greater," real Forge
`IsPresent$ Creature.YouCtrl+powerGE4`) and `selfLacksType` (infernal-
vessel's "if it wasn't a Demon," real `ValidCard$ Card.Self+nonDemon`).
infernal-vessel ALSO got a REAL functional guard (`if
(ctx.self.hasSubtype('Demon')) return;`) inside its `kind:'custom'`
closure, since a custom closure has real `ctx.self` access — genuinely
enforced, not just declared, unlike the `condition` field itself.

**`SpellCostReductionGrant` gained `cardTypes?: string[]`** — additive
sibling to `colors` (OR semantics between the two, not AND). New registry
entry `spell-cost-reduction-card-type-gate-not-enforced`: this field is
NOT a Ward-pattern "usually right" gap — `state.ts`'s `activeSpellCost
Discount` only ever checks `grant.colors.some(...)`, so a `cardTypes`-only
grant (`colors: []`, archmage-of-runes's real shape) currently contributes
literally ZERO discount despite being declared. Flagged explicitly in both
the field's own doc comment and the justification.json reasoning — do not
let a future pass assume `cardTypes` "mostly works."

## Cards re-authored (25 total)

21 landed fully **blue**: ajani-s-pridemate, cat-collector, fiendish-panda,
armasaur-guide, battlesong-berserker, elfsworn-giant, grappling-kraken,
mossborn-hydra, beast-kin-ranger, dazzling-angel, eager-trufflesnout,
infestation-sage, infernal-vessel, high-society-hunter, erudite-wizard,
mischievous-mystic, clinquant-skymage, crackling-cyclops, archmage-of-runes,
bloodthirsty-conqueror, courageous-goblin. All with `engineSupport: 'off'`
(correct — the new `on`/`condition`/`cardTypes` vocabulary isn't
engine-dispatched yet).

4 stay **purple** (trigger gate closed, but capped by a genuinely
different, out-of-scope gap): exemplar-of-light (2nd trigger
`onCounterAdded` — single-occurrence, not part of any named cluster, left
open), kaito-cunning-infiltrator (emblem mechanic), nine-lives-familiar
("if you cast it" cast-history gate), homunculus-horde (copy-permanent).

`justification.json` edited for exactly 3 cards whose
`missingSchemaFunctionality` entry was actually removed: infernal-vessel,
courageous-goblin, archmage-of-runes (each `type:'rules'` span with a
`missingSchemaFunctionality` `definitionKeys` ref rewritten to
`type:'definition'` + a real `trigger`/`field` ref). Every other touched
card needed zero justification.json changes (trigger `name` unchanged,
only `on`/`condition`/companion fields added).

## Deliberately left alone

- `exemplar-of-light`'s `onCounterAdded` — single occurrence pool-wide,
  not named in the task's clusters, not touched.
- `kykar-zephyr-awakener` (a DIFFERENT card, not in this task's given
  list) has the exact same `onCastNoncreatureSpell` name-only-trigger gap
  — now trivially closable with `on:'castNoncreatureSpell'` — flagged as
  a freebie for a future pass, not touched (out of the given scope).
- Everything on the task's explicit out-of-scope list (copy-permanent,
  emblem, pile+opponent-choice, disjunctive target restriction, CR 614.2
  death-replacement, flash-casting-permission grant, dynamic type-change+
  ability-installation, discard-then-conditional-draw, cast-history gate,
  activated-ability timing restriction, counter-presence-conditional
  grant, "can't be countered") — untouched, per instruction not to race
  the concurrent `engine` triage pass.

## Verification

`npx vitest run functional-model`: 122 files / 1328 passed / 5 skipped,
clean. `npm run typecheck`: identical 7 pre-existing diagnostics (same
files/lines as the known baseline). `gate-and-write-status.mjs` re-run
against all 25 touched slugs: 21 blue / 4 purple, matching the plan
exactly.
