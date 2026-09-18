# Cheap-tier (Haiku) FDN authoring: recurring vocabulary mistakes

Fixed 37 FDN cards (2026-09-18) that failed the deterministic gate with
real TypeScript errors after a Haiku authoring batch. Recurring mistake
patterns, useful for triaging future cheap-tier batches without
re-deriving each one from scratch:

- **Invented `Keyword` strings that don't exist**: `"First Strike"`/
  `"Double Strike"` (real: `FirstStrike`/`DoubleStrike`, no space),
  `"Prowess"`/`"Surveil"`/`"Threshold"`/`"Morbid"`/`"Flashback ..."`/
  `"Kicker"` — NONE of these are in `card.ts`'s closed `Keyword` union.
  Real fallback for a printed keyword the union doesn't have: freeform
  `staticAbilities` text (established precedent: `queen-brahne`/
  `raubahn-bull-of-ala-mhigo` for Prowess/Ward-with-a-cost). Flashback is
  never a `keywords` entry at all — always `alternateCosts:
  [flashback(cost)]` (the shared `flashback.ts` factory).
- **Invented `Trigger.on` values**: `'attack'`/`'death'`/`'creatureDies'`
  don't exist. Real closed union: `'enter'|'upkeep'|'endStep'|
  'tapLandForMana'|'attacks'|'equippedAttacks'`. `'attacks'` ONLY means
  "this permanent itself attacks" (`ValidCard$ Card.Self`) — a card whose
  real Forge trigger is broader (`Mode$ AttackersDeclared|
  AttackingPlayer$You`, i.e. "whenever YOU attack" — Battlesong Berserker
  is the real example) must NOT get `on:'attacks'`; check the real Forge
  script's own `Mode$`/`ValidCard$` before assuming. No matching `on`
  value at all (dies, life-lost, drawn-Nth-card, combat-damage-to-player,
  etc.) is NOT a capacity gap — a bare name-only trigger (no `on`) is a
  long-established, legitimate pattern (`namazu-trader`, `ajani-s-
  pridemate`), just not auto-fired.
- **Invented `TokenInfo` fields**: `colors`, `typeLine`, `pt: [n,n]` don't
  exist. Real required shape: `name`, `manaCost`, `types: string[]`,
  `basePower`, `baseToughness`, optional `keywords`. A missing `.name` on
  a token literal doesn't just fail `tsc` — it CRASHES
  `validate-card-definition.mjs`'s vocabulary-walk phase (`synergyTags`
  calls `effect.token.name.toLowerCase()` unconditionally at `card.ts`
  ~line 2848, phase 1 runs on untyped transpiled JS, before `tsc` would
  ever catch the missing field) with a generic "unexpected error while
  walking effects/program tree" `other`-classified message — a real,
  reproducible crash signature, NOT a bug in the validator itself. Fix
  root cause (add the missing field) rather than treating the crash
  message as a validator bug.
- **Invented `Actions`/`EffectContext`/`Card`/`Player` members**:
  `actions.pumpTarget` (real: `actions.pump(target, power, toughness,
  opts)`), `actions.gainLife`/`drawCard` (real: call `Player.gainLife()`/
  `.drawCard()` directly, they're real `Player` methods, not `Actions`
  members), `ctx.targets`/`ctx.lifeGainedThisTurn` (don't exist —
  per-trigger caller-supplied facts go through `ctx.triggerInput`, e.g.
  `hope-estheim`'s `lifeGainedThisTurn` precedent), `Card.name`/`.getPower()`/
  `.typeLine` (real: `.getName()`/`.getNetPower()`/`.isCreature()`),
  `Player.getPermanentsInPlay()` (doesn't exist — real: `getCardsIn
  ('Battlefield')`), `Player.graveyard` (real: `getCardsIn('Graveyard')`).
- **`AlternateCost` misused for Kicker**: that shape is fixed to `from:
  'graveyard'|'exile'` (Flashback/Jump-start only) — Kicker is an
  additional, optional cost paid from hand, not a cost replacement. Real
  established convention: `modal` + `ctx.mode` (mode 0 = not kicked, mode
  1 = kicked) — same as `divine-resilience`/`vayne-s-treachery`/
  `chocobo-kick`.
- **`abilities[].cost` as `'Loyalty:N'`**: no loyalty-ability
  cost/activation vocabulary exists (Planeswalkers). `cost` is a plain,
  unparsed string — fine to use descriptive text (`'Loyalty: +1'`) since
  nothing mechanically enforces it either way, matching the existing
  "not every free-text cost is enforced" convention (`gogo-master-of-
  mimicry`'s `{X}{X}, {T}`).

Real capacity gaps surfaced by this batch (correctly reclassified purple,
not forced into wrong vocabulary): **kaito-cunning-infiltrator** (no
emblem mechanic — CR 701.42 — anywhere in this engine; everything else on
that card, including the other two loyalty abilities, IS real, only the
-9 ultimate's emblem grant is a no-op), **tragic-banshee** (Morbid — "did
a creature die this turn" — has zero tracking anywhere, confirmed via a
pool-wide grep before concluding this), **zul-ashur-lich-lord** (a
standing "you may cast this from your graveyard later this turn"
MayPlay-style permission grant is a genuinely different, narrower-scoped
primitive than `play()`, which is tied specifically to
`EffectContext.topLibraryCard`/library-top special actions).

Ground truth for all of this batch came straight from the real Forge
checkout (`tmp/mtg-forge/forge-gui/res/cardsfolder/<letter>/<slug>.txt`) —
every one of the 37 cards had a real script there (FDN, despite being
2026-current, is already in this checkout).
