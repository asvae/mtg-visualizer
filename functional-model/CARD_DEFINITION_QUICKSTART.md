# Card-definition quickstart (definition lane)

You write/fix `functional-model/cards/<slug>/definition.ts` +
`scenarios.ts` for a batch of cards, against real printed card text, using
**only vocabulary that already exists** in `functional-model/card.ts` and
`functional-model/combinator.ts`. You never invent a new `Effect` kind,
`ptFormula` variant, grant-field shape, combinator node/action, or engine
primitive yourself — if a mechanic genuinely has no existing vocab, you
escalate to the coordinator, who routes it to the **engine** agent. This
doc is deliberately narrow: card.ts/state.ts internals beyond what you
need to WRITE a definition, the Fact/synergy vocabulary, and the
recognizer pipeline are all out of scope for this lane — see
`CARD_RESULTS_QUICKSTART.md` for that side.

## Effect-authoring preference order — read this before writing any effect

For every clause you model, prefer in this order:

1. **A plain declarative `Effect` kind** (`kind: 'createToken'`,
   `'pumpAll'`, `'destroy'`, etc. — see "`Effect` — the resolvable-action
   vocabulary" below) if one already exists for your exact shape.
2. **`combinator.ts`'s `kind:'program'` DSL** (`Query`/`Filter`/`Each`/
   `SelectUpTo`/`ApplyToBound`/`Branch`/`Sequence`/`Aggregate` — see "The
   combinator DSL" below) — the project's own STANDING DEFAULT for
   anything that's genuinely a multi-step, query-then-act, or chained-
   selection shape and doesn't fit one single declarative kind. Reach for
   this before `kind:'custom'` whenever your logic is expressible as
   Query/Filter/Each/Branch/Sequence over real board state.
3. **`kind:'custom'`** (an opaque `run(ctx, actions)` closure) — true
   last resort, only when NEITHER of the above covers it.

**Why this order is not just style preference**: a `custom` closure is a
black box to every recognizer — `synergy.ts`'s parser-derived Fact
pipeline can never look inside a closure's own function body, so a
`custom` effect can only ever carry a hand-authored (unprovenanced, "ai")
fact, never a real recognizer-derived one. `kind:'program'`'s own AST is
real, inspectable DATA (`combinator.ts`'s own `walkProgram` reads the
identical structure with NO `ctx`/`actions`/board at all — the whole point
of the DSL) — a structural recognizer CAN read it and produce a genuine
provenanced fact instead. Proven this session, with zero behavior change:
migrating Jill, Shiva's Dominant's and Dion, Bahamut's Dominant's own
"exile self, then return to the battlefield" clauses off `kind:'custom'`
closures onto `sequence('Exile', 'Battlefield')` flipped 4 real facts from
unprovenanced (hand-authored) to real `sequenceExileReturn-effect-
structural`-provenanced ones — purely by changing HOW the exact same
effect was authored, not what it does. Choosing `program` over `custom`
when both are equally capable is a genuine, measurable improvement to the
card's own eventual review/verification cost, not a cosmetic choice.

## Ground truth: Forge primary, XMage secondary

Every mechanic you model must be checked against a **real** source, never
written from memory/trained knowledge:

- **`tmp/mtg-forge`** (a real, git-ignored checkout under this project's
  own `tmp/`, not a sibling directory) is the **sole primary source**. Its
  real card scripts live at
  `tmp/mtg-forge/forge-gui/res/cardsfolder/<a-z>/<normalized_name>.txt`.
- **`tmp/xmage`** (same location convention, cloned 2026-09-12) is a
  **secondary cross-check only** — for a hard case Forge doesn't resolve
  cleanly, never a replacement for reading Forge's own script first.
- Use **`npx tsx functional-model/scripts/forge-lookup.mjs "<card name>"`**
  instead of hand-grepping either checkout — it finds and prints both the
  real Forge script and (if present) the matching XMage class file for a
  given card name. Handles DFC/split names (`"Front // Back"`) by falling
  back to the front face's own name if the combined name isn't indexed
  either side.
- If both checkouts are somehow missing, check for a real Forge game
  install before falling back to trained-knowledge guesses — one has been
  found at `/mnt/c/Games/ForgeInstaller` on this machine (WSL), with real
  card scripts in `res/cardsfolder/cardsfolder.zip` and the scripting
  reference under `docs/Card-scripting-API/`.
- When you add or change anything that mirrors a real Forge script fact
  (a new field usage, a keyword, a cost shape), cite the real Forge
  file/line in your own comment, the way every existing card's
  `definition.ts` already does. Don't add an uncited claim.

## The shape you're writing

`CardDefinition` (`card.ts`) is **data, not a class** — one shared
interpreter (`resolveCard()`) dispatches on every `Effect`'s own `kind`
field. Your job is filling in that data correctly, never writing bespoke
per-card imperative logic beyond the narrow `custom`/`Computed` escape
hatches described below.

Top-level fields you'll touch most:

```ts
export interface CardDefinition {
  readonly name: string;
  readonly manaCost: string;       // '{2}{W}{W}', '' for a land, etc.
  readonly typeLine: string;       // 'Legendary Creature — Human Knight'
  readonly pt?: [power: number, toughness: number];
  readonly keywords?: Keyword[];   // real printed K: lines — Flying, Lifelink, Ward, etc.
  readonly staticAbilities?: string[]; // freeform text — see "staticAbilities" below
  readonly effects?: Effect[];     // a spell's cast effect, OR an activated ability's
                                    // effect (paired with activationCost)
  readonly activationCost?: string;  // '{2}', 'Equip {3}', 'Sacrifice a Frog', etc.
  readonly triggers?: Trigger[];   // named triggered abilities (see below)
  readonly abilities?: { name; cost; effects; costReduction? }[]; // 2+ independent
                                    // activated abilities on one permanent
  readonly backFace?: CardDefinition; // a transforming DFC / Adventure's own second half
  // Structured grant/formula fields — see "Known vocabulary families" below:
  readonly ptFormula?: ...;
  readonly continuousPTGrants?: ...;
  readonly continuousTypeGrants?: ...;
  readonly continuousKeywordGrants?: ...;
  readonly costReduction?: ...;
  readonly spellCostReductionGrants?: ...;
  readonly manaAbilities?: ManaAbility[];
  readonly triggerDoubling?: TriggerDoublingGrant[];
  readonly activatedAbilityLock?: ContinuousGrantTargeting[];
}
```

Every field has a full doc comment in `card.ts` itself — read that
field's own comment before using it; this doc only orients you to what
exists, it isn't a substitute for the real source.

### `Effect` — the resolvable-action vocabulary

`Effect` is a big discriminated union (`kind: '...'`). Common kinds you'll
reach for constantly: `createToken`, `gainLife`, `drawCard`, `discard`,
`mill`, `dig`, `surveil`, `pumpSelf`/`pumpTarget`/`pumpAll`,
`putCounter`/`putCounterTarget`/`putCounterAll`, `grantKeywordSelf`/
`grantKeywordTarget`/`grantKeywordAll`, `dealDamage`/`dealDamageTarget`/
`dealDamageAnyTarget`, `destroy`, `fightTarget`, `tapTarget`/`untapTarget`/
`tapAll`, `move` (generic zone change), `sacrifice`, `animate`, `counter`
(counterspell), `modal` (a real "choose one —" branch). Grep
`export type Effect =` in `card.ts` for the full, current list with every
field's own real Forge citation — don't guess a field name, read it.

One field-level escape hatch, and one whole-effect one — see the
preference order at the very top of this doc for how they rank against
`kind:'program'` (next section):
- **`Computed<T>`** (`T | ((ctx: EffectContext) => T)`) — a plain field
  (an `amount`, a `power`) that's a fixed value on MOST cards but a live
  board-state read on some (e.g. `amount: (ctx) =>
  ctx.you.getCreaturesInPlay().length`). Use only for the one field that
  genuinely can't be a static number. This one has no combinator
  equivalent — it stays the right tool even when the surrounding effect
  itself is a plain declarative kind.
- **`{ kind: 'custom'; describe: string; run: (ctx, actions) => void }`**
  — a real, executed closure, opaque to synergy matching (see the
  preference-order section above for why that matters) — true last
  resort, for a resolution shape neither a declarative `Effect` kind NOR
  the combinator DSL below covers (an Equip attach, e.g. — no `Effect`
  kind or combinator action wraps `Actions.equip` anywhere in this model
  today). `describe` must be a real, accurate English summary; `run`
  calls into `Actions` (see `card.ts`'s own `Actions` interface —
  `createToken`, `pump`, `moveTo`, `chooseTarget`, `equip`, `putCounter`,
  `dealDamage`, `grantKeyword`, etc., all real methods, not free-floating
  helpers you invent).

### The combinator DSL (`kind:'program'`) — tier 2, the default over `custom`

```ts
{ kind: 'program'; describe: string; program: ProgramNode }
```

`program` is a real, typed AST (`combinator.ts`) for effect logic that's
genuinely just Query/Filter/Aggregate/Each/Branch/Sequence/Selection over
real board state — DATA, not a closure, so (unlike `custom`) a structural
recognizer can read it directly. Import builder functions from
`../../combinator` rather than hand-writing raw AST object literals
(`selectUpTo`, `applyToBound`, `sequence`, `branch`, `compare`, `putCounter`,
`tap`, `untap`, `destroyEach`, `gainControl`, `grantKeyword`, `equipTo`,
the `you`/`opponents`/`anyPlayer` query-chain starters, etc.) — same
"named builder, not a raw literal" ergonomics `card.ts`'s own declarative
`Effect` kinds already have.

Core shapes, condensed (grep `combinator.ts` for the full doc comment on
whichever one you're using — every node has a real-card citation):
- **`Query`** — a source collection: `you.creaturesInPlay()` /
  `opponents.creaturesInPlay()` / `anyPlayer.creaturesInPlay()` (Battlefield
  creatures only) or the `.permanentsInPlay()` sibling (unfiltered by
  type — real Forge "another target permanent," broader than a creature).
- **`.filter(field, value)`** narrows a `Query` — `'subtype'` (a printed
  subtype string), `'excludeSelf'`, or `'cardType'` (`'creature'|
  'artifact'|'land'|'enchantment'`, a single value or an array for an
  OR-matched set — e.g. Ultima's own real "artifacts AND creatures":
  `.filter('cardType', ['artifact', 'creature'])`).
- **`.each(action)`** — a terminal: applies one `EachAction`
  (`putCounter`, `tap`, `untap`, `destroyEach`, `gainControl`,
  `grantKeyword`, `equip`-onto-a-second-binding via `equipTo`) to every
  item the chain matched.
- **`selectUpTo(from, max, as, then)`** / **`applyToBound(name, index,
  action)`** — for "choose target X, THEN do A/B/C to that SAME X" (a
  targeted pick reused across several actions) — `selectUpTo` picks up to
  `max` items and binds them under a name; nested `selectUpTo`s let a
  second selection (e.g. an Equipment to attach) reference the first via
  `equipTo('outerBindingName', 0)`.
- **`branch(condition, then, elseBranch?)`** / **`compare(left, op,
  right)`** — a real two-continuation split on a numeric comparison.
- **`sequence(...zones)`** — a plain, self-targeted ordered zone-move list
  (no query/filter/targeting at all) — see the worked example below.

**Worked example** (Jill, Shiva's Dominant's real "exile this, then return
it to the battlefield transformed," `cards/jill-shiva-s-dominant-shiva-
warden-of-ice/definition.ts`):
```ts
import { sequence } from '../../combinator';
// ...
effects: [
  {
    kind: 'program',
    describe: "exile Jill, then return it to the battlefield transformed under its owner's control",
    program: sequence('Exile', 'Battlefield'),
  } satisfies Effect,
],
```
This is the exact shape that flipped from an opaque `kind:'custom'`
closure to a real, `sequenceExileReturn-effect-structural`-provenanced
fact — same behavior, better authoring shape.

If your card's real logic needs a combinator node/action that doesn't
exist yet (check `combinator.ts`'s own exported types/functions first) —
same escalation rule as everything else in this doc: don't invent one,
flag it to the coordinator for the **engine** lane.

### `Trigger` — named triggered abilities

```ts
export interface Trigger {
  name: string;        // 'onEnter', 'onAttack', 'onDealsDamage', etc. — matches
                        // Scenario.trigger
  effects: Effect[];
  on?: 'enter' | 'upkeep' | 'endStep' | 'tapLandForMana'; // real AUTO-FIRED
                        // triggers engine.ts fires without a scenario naming them —
                        // omit for anything else (an attack/damage/cast trigger a
                        // scenario picks explicitly via its own `trigger` field)
  activationLimit?: number; // real "only once each turn" cap
}
```

### Known vocabulary families (check before reaching for the combinator DSL or `custom`)

These cover a LOT of real printed text — check whether your card's real
clause matches one of these shapes before reaching for the combinator DSL
above, `custom`, or a plain `staticAbilities` string:

- **`continuousPTGrants` / `continuousTypeGrants` / `continuousKeywordGrants`**
  — a continuous, query-time broadcast from one permanent onto
  itself/whatever it's equipped to/other permanents of a subtype. Shared
  `ContinuousGrantTargeting` shape: `{ includeSelf, subtype?,
  onlyDuringYourTurn?, equippedBySelf? }`. Real shapes seen in the pool:
  equipped-creature broadcast (`equippedBySelf: true`), same-subtype
  broadcast (`subtype: 'Elf'`, e.g.), self-only conditional (`includeSelf:
  true`, no subtype, e.g. "Jump — during your turn, has flying").
  `continuousPTGrants` also supports `scalePerType`/`scalePerSelfCounter`
  for a board/counter-scaled ADD instead of a fixed delta.
- **`ptFormula`** — a layer-7a CDA on the card's OWN P/T (never an
  equipped/broadcast target — that's `continuousPTGrants` above). Variants:
  `addPerEquipmentControlled`, `setToCreaturesControlled`,
  `thresholdBonus` (a fixed on/off bonus once a board-count threshold is
  met), `addPerGraveyardCount`, `setToGraveyardPermanentCount`,
  `addPerLandControlled`. Each is real, narrowly named per real Forge
  shape — check `card.ts`'s own doc comment on each before assuming your
  card's formula fits one; if it's genuinely a different count/filter,
  escalate rather than stretching an existing variant to fit.
- **`costReduction`** — a spell's own cast-cost discount, either
  target-conditional (`condition: 'tappedCreatureTarget'`) or board-
  counted (`perControlled: { amountPerMatch, subtype }` — `subtype` here
  matches a creature subtype OR a card type, e.g. `'Artifact'`, same as
  real Forge's own `Affinity` keyword).
- **`spellCostReductionGrants`** — a permanent broadcasting a flat,
  color-gated discount onto OTHER spells its controller casts (The Wind
  Crystal's own "White spells you cast cost {1} less").
- **`manaAbilities`** — a real `{T}: Add X` (or similar) mana ability;
  deliberately inert as a spendable resource (no mana-pool concept exists)
  but real, typed, checkable data, not free text.
- **`abilities[].costReduction`** (`ActivationCostReduction`) — the same
  board-counted discount shape as `costReduction.perControlled`, but on an
  ACTIVATED ability's own cost instead of a spell's cast cost.
- **`triggerDoubling`** — a real Panharmonicon-style "this triggers an
  additional time" grant.
- **`activatedAbilityLock`** — a real "can't be activated" static lock
  broadcast (CantBeActivated-style).

If your card's real clause doesn't match ANY of the above, there's no
`Effect` kind for it either, AND it doesn't fit the combinator DSL above
(check `combinator.ts`'s own exported node/action vocabulary too, not just
`card.ts`) — **stop, don't invent new field/kind/node/action vocabulary
yourself**. Leave the real, honest text in `staticAbilities` (see below),
write an accurate comment naming exactly what's missing and why (cite the
real Forge script line), and escalate to the coordinator so the
**engine** lane can decide whether to build it.

### `staticAbilities: string[]` — freeform text, last resort only

A string array for a real printed static ability that has **no matching
structured field**. Never a dumping ground for something that DOES have a
matching field — the single biggest bug class this whole project has
found repeatedly is a `staticAbilities` string sitting next to (or instead
of) real, already-existing structured machinery that was simply never
wired up. Before adding a new `staticAbilities` entry, actively check: is
there already a `continuousPTGrants`/`ptFormula`/`costReduction`/etc.
sibling card doing the exact same real thing? If your card's own comment
says "no mechanism exists for X" — verify that's still true today (grep
`card.ts` for the shape, don't trust an old comment on a SIBLING card
either). When a real field DOES cover the clause, keep the
`staticAbilities` string as human-readable documentation alongside the
real field — established, consistent pool-wide convention, not
redundant.

## Three worked examples (model your own definitions off these)

**Simple — one continuous grant + one custom Equip action**
(`cards/coral-sword/definition.ts`):
```ts
export const coralSword: CardDefinition = {
  name: 'Coral Sword',
  manaCost: '{R}',
  typeLine: 'Artifact — Equipment',
  keywords: ['Flash'],
  staticAbilities: ['Equipped creature gets +1/+0.'],
  continuousPTGrants: [{ power: 1, toughness: 0, includeSelf: false, equippedBySelf: true }],
  triggers: [
    {
      name: 'onEnter',
      effects: [
        {
          kind: 'custom',
          describe: 'attach to target creature you control',
          run: (ctx, actions) => {
            const target = actions.chooseTarget(ctx.you.getCreaturesInPlay());
            if (target) actions.equip(ctx.self, target);
          },
        } satisfies Effect,
        { kind: 'grantKeywordTarget', keyword: 'FirstStrike', validType: 'creature', untilEndOfTurn: true } satisfies Effect,
      ],
    },
  ],
  activationCost: 'Equip {1}',
  effects: [
    {
      kind: 'custom',
      describe: 'attach to target creature you control',
      run: (ctx, actions) => {
        const target = actions.chooseTarget(ctx.you.getCreaturesInPlay());
        if (target) actions.equip(ctx.self, target);
      },
    } satisfies Effect,
  ],
};
```
(Equip has NO declarative `Effect` kind anywhere in this model — every
real Equipment attach in the pool goes through this exact `custom` +
`actions.equip` shape. Don't invent a different one; reuse this pattern.)

**Moderate — three grant families + an ETB token trigger + a second,
differently-named activated ability** (`cards/dragoon-s-lance/
definition.ts`, condensed): a Job-select Equipment with
`continuousKeywordGrants`/`continuousPTGrants`/`continuousTypeGrants` all
three real and wired, an `onEnter` trigger creating a token and
auto-attaching to it, and a flavor-named Equip cost (`activationCost:
'{4}'` — the flavor name, "Gae Bolg," is just a comment, never modeled as
a separate field).

**Self-only conditional grant + a plain onEnter trigger**
(`cards/tonberry/definition.ts`):
```ts
export const tonberry: CardDefinition = {
  name: 'Tonberry',
  manaCost: '{B}',
  typeLine: 'Creature — Salamander Horror',
  pt: [2, 1],
  staticAbilities: ["Chef's Knife — During your turn, this creature has first strike and deathtouch."],
  continuousKeywordGrants: [{ keywords: ['FirstStrike', 'Deathtouch'], includeSelf: true, onlyDuringYourTurn: true }],
  triggers: [
    {
      name: 'onEnter',
      effects: [
        { kind: 'tapTarget', validType: 'creature', owner: 'you' } satisfies Effect,
        { kind: 'putCounter', target: 'self', counterType: 'stun', amount: 1 } satisfies Effect,
      ],
    },
  ],
};
```

## `scenarios.ts` — two real shapes

A card's `scenarios.ts` exports EITHER:
- **`scenarios: Scenario[]`** (the common case — see `harness.ts`'s own
  `Scenario` interface) — a flat, named-trigger/effect exerciser. Key
  fields: `result` (a real one-line summary of what happened), `trigger`
  (which `Trigger.name` this scenario exercises), `ability` (which
  `abilities[].name`, if more than one), `you`/`opponents` (board setup —
  see below), `castFrom`, `forceCast` (forces a real cast->enters
  lifecycle even for a permanent whose own `activationCost` would
  otherwise skip it).
- **`runEngineScenarios(): TraceResult[]`** — a REAL engine-piloted trace
  (`engine-trace.ts`'s `setupEnginePilot`/`pilotCast`/`pilotResolveTop`/
  etc.), for a card whose real behavior needs genuine engine mutation to
  demonstrate (a live CDA recalculation, a real board-state count) rather
  than the plain declarative harness. Reach for this when your card has a
  `ptFormula`/`continuousPTGrants` scaling clause or similar that needs a
  REAL before/after read to prove, not just a declared effect — see
  `cards/gaelicat/scenarios.ts` or `cards/xande-dark-mage/scenarios.ts`
  for real examples of this shape's exact structure.

### Real cards only — no invented filler, ever

Every board-state filler in a scenario (an opponent's creature, an
artifact you control to satisfy a count) must be a **real, playable
card**, never an invented placeholder. If a real bug surfaces because of
this, fix the real bug — don't curate the scenario to avoid it, and don't
collapse variety into generic filler for cleanliness either.

## Review status resets on content change

Any change to a card's authored content (`definition.ts`'s real facts,
not just a comment) resets its review flag from `"human"`/`"ai"` back to
`"ai"` (`progress.json`'s own `review` field) — a stale "reviewed" flag on
content you just changed must never survive. Don't hand-edit `review`
yourself either way; this is enforced by whichever downstream process
consumes it (the card-review loop) — just don't assume a card you touched
is still marked reviewed.

## Escalation — when to stop and hand off

- **A mechanic has no existing `Effect` kind / grant field / formula
  variant / combinator node or action, and it's genuinely a new shape**
  (not a stretch of something that already exists) → stop, leave real
  `staticAbilities` text with an accurate comment, escalate to the
  coordinator for the **engine** lane.
- **You find a stale comment on ANY card (not just yours) claiming a gap
  that's actually already closed elsewhere** → same bug class this whole
  project keeps re-finding; fix the comment/wire the field if it's a
  simple wiring job within your own vocabulary, or flag it if it needs new
  engine work.
- **You're not sure whether a shape already exists** → grep `card.ts` AND
  `combinator.ts` first (every field/node/action has a real doc comment
  with citations), then `forge-lookup.mjs` the card again to re-confirm
  the real text, before asking.

## Test-scope policy

Day to day, run only what your batch touches:
```
npx vitest run functional-model/<relevant test file(s)>
npx tsx functional-model/scripts/run-one-card.mjs <slug>          # quick single-card check
npx tsx functional-model/scripts/run-scenarios.mjs --slug=<slug>  # regenerate that card's trace.json
```
(Some older script header comments still say `npx vite-node ...` — `npx
tsx` is the actual standing, working convention project-wide; use `tsx`
regardless of what an individual script's own comment says.)

**`run-scenarios.mjs` takes `--slug=<slug>` — never a positional arg, and
never bare/no-arg either.** As of 2026-09-16 it HARD-FAILS if you pass
neither `--slug=<slug>` nor an explicit `--all` (a bare/missing/misspelled
arg used to silently fall through to a full-pool run instead of erroring
— that exact mistake has already bitten two different agents: it
renumbers every card's own object ID via a shared counter, producing a
huge, noisy diff across the WHOLE `cards/` tree, and a careless revert of
that can wipe out other agents' real in-flight work — always diff before
reverting a wide file list, regardless). `--all` exists for a genuine,
deliberate full-pool regen (rare from this lane) — don't reach for it by
habit or to "be safe," `--slug=` is the normal day-to-day form. Full `npx
vitest run functional-model` and the full-repo `npx vitest run` are for a
substantial/shared-file change (something in `card.ts`/`state.ts`/
`engine.ts` itself, which shouldn't happen from this
lane) or right before your final report to the coordinator — not a
per-card habit.

## Timing bracket

Run `date -u` once at the start of your task and once right before your
final report; include both timestamps + elapsed time in that report (a
simple start/end bracket, not per-subtask) — this is how the coordinator
compares time-cost across lanes.
