import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  // ONE consolidated scenario (2026-09-12, unified Fact model migration),
  // same "chain the real abilities into one continuous story" shape
  // paladin-s-arms's own corrected scenario already established: Job select
  // creates the Hero token and auto-attaches (top-level `trigger:'onEnter'`,
  // which also correctly SKIPS the automatic cast/enters lifecycle this
  // card's own `activationCost` would otherwise force — see
  // isActivationCostPermanentBaselineFact in verify-synergy.mjs), then a
  // real Equip {3} activation re-attaches it to the other creature already
  // on the battlefield (`you: {creaturesCount: 1}`, present BEFORE the
  // trigger creates the Hero token, so it's `getCreaturesInPlay()`'s own
  // first/default candidate), then the granted "whenever this creature
  // attacks, untap target attacking creature" ability fires
  // (`onEquippedAttacks`, modeled as Sage's Nouliths' own trigger — see
  // definition.ts) and untaps that same creature. This single chain gives
  // real trace evidence for both sink wants at once: `onEquippedAttacks`'s
  // own `chooseTarget` pool reads BOTH `you.getCreaturesInPlay()` (the
  // Equip-target want) and every opponent's `getCreaturesInPlay()` (the
  // "or an attacking creature an opponent controls" want) even though no
  // opponent creature is present here (a real `read:getCreaturesInPlay`
  // line with `count:0` still counts as real evidence — verify-synergy.mjs
  // never checks `controller` on a sink's own supporting read).
  {
    result:
      'Job select creates a 1/1 colorless Hero creature token and attaches itself to it, then an Equip {3} activation re-attaches it to the other creature already on the battlefield, whose attack then untaps a target attacking creature',
    trigger: 'onEnter',
    you: { creaturesCount: 1 },
    sequence: [{ activate: true }, 'onEquippedAttacks'],
  },
];
