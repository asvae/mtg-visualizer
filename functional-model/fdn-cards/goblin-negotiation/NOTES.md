# Goblin Negotiation — authoring notes

## Authoring background

Was flagged as a capacity gap ("X damage with excess tracking and
proportional token creation") — stale by the time of the 2026-09-18
coverage-justification authoring pass: `EffectContext.xPaid` (a real,
already-declared field — "the value chosen for a card's own printed X in
its mana cost," `card.ts`, used live by `cards/doppelgang`/`cards/
rydia-summoner-of-mist`) already covers (1); `getNetToughness()` (real,
on the `Card` interface) plus a plain `Math.max(0, x -
target.getNetToughness())` covers (2) (an approximation — the `Card`
interface exposes no already-marked-damage getter, so this only accounts
for THIS spell's own X damage against the target's full toughness, not
any damage the target was already carrying before this resolves; no real
FDN scenario needs the finer case yet); `actions.createToken(...,
excess)` (a real, already-injectable action) covers (3). Modeled as a
single `custom` effect (X-then-conditional-token-count has no
declarative combinator shape yet, same class of "custom, not a schema
gap" call `cards/doppelgang`'s own X-target-then-loop effect already
makes) — not a `missingSchemaFunctionality` entry, since every real
primitive it needs already exists.
