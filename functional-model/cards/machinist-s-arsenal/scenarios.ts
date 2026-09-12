import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  // ONE consolidated scenario (2026-09-12, user: "1st scen is enough" —
  // drop the separate standalone Equip{4}-activation scenario). Same
  // "chain the real abilities into one continuous story" shape
  // paladin-s-arms's own corrected scenario already established for this
  // exact family (Job select ETB + a bare activationCost equip, no granted
  // ability): a bare single scenario here would have LOST real trace
  // evidence for the "wants a creature you control" sink — dropping the
  // old second scenario outright produces a real
  // `read:getCreaturesInPlay` hard failure in verify-synergy.mjs (checked:
  // the Hero token's own creation is a real creature entering the
  // battlefield, but the sink specifically wants a `read:getCreaturesIn
  // Play`/equivalent read, which only the Equip {4} activation's own
  // `chooseTarget(ctx.you.getCreaturesInPlay())` call produces). Fixed by
  // chaining the real Equip {4} activation onto the SAME scenario instead
  // of reintroducing a second one: top-level `trigger:'onEnter'` (Job
  // select creates the Hero token and auto-attaches, also correctly SKIPS
  // the automatic top-level `activate` this card's own `activationCost`
  // would otherwise force), then `sequence: [{activate:true}]` re-attaches
  // this Equipment to the OTHER real creature already on the battlefield
  // (a real vanilla Grizzly Bears, `you: {creaturesCount: 1}` — present
  // BEFORE the trigger creates the Hero token, so it's
  // `getCreaturesInPlay()`'s own first/default candidate, genuinely
  // different from the Hero token Job select already attached to, not a
  // no-op re-target). One dropped demonstration, documented not preserved:
  // the old second scenario's own `artifactsCount: 1` setup was never
  // real evidence for anything either — the per-artifact-count SCALING
  // factor on the static pump clause has no live-recalculated CDA/layer-7c
  // pipeline anywhere in this model (see definition.ts's own comment), so
  // varying the artifact count demonstrated nothing an engine trace could
  // show either way; dropped per the user's explicit "1 scenario is
  // enough regardless" instruction. See progress.json's knownGaps.
  {
    result:
      'Job select creates a 1/1 colorless Hero creature token and attaches itself to it, then an Equip {4} activation re-attaches it to the other creature already on the battlefield instead',
    trigger: 'onEnter',
    you: { creaturesCount: 1 },
    sequence: [{ activate: true }],
  },
];
