import type { CardDefinition, Effect } from '../../card';

export const stuckInSummonersSanctum: CardDefinition = {
  name: "Stuck in Summoner's Sanctum",
  manaCost: '{2}{U}',
  typeLine: 'Enchantment — Aura',

  // Flash affects CAST TIMING only, not board state — same "no fact needed,
  // it's a bare printed keyword" treatment as "can't be countered" elsewhere
  // in this pool (`engine.ts`'s `canCastAtSorcerySpeed`, line ~210, is the
  // real timing hook this keyword feeds).
  keywords: ['Flash'],

  // "Enchant artifact or creature" / "doesn't untap during its controller's
  // untap step and its activated abilities can't be activated" — same
  // "real continuous facts, not resolvable effects — text only" treatment
  // sleep-magic's own definition.ts already established for its own,
  // narrower "doesn't untap" line (no Fact authored for either clause here
  // either, same reasoning). Checked BOTH restrictions against this
  // engine's real machinery, not assumed unsupported:
  // - "doesn't untap" — `state.ts`'s `untap()` only special-cases a real
  //   STUN counter replacement (CR 122.1d); it has no general per-object
  //   "can't untap" lock, so this half of the line is genuinely
  //   unenforced, same as sleep-magic's own identical clause.
  // - "activated abilities can't be activated" — a real, ADDITIONAL
  //   restriction sleep-magic's own card doesn't have. Checked
  //   `engine.ts`'s `canActivateAbility` end-to-end: it has no hook at all
  //   for "is this permanent's own activation locked by another
  //   permanent's static ability" — every check there is about the
  //   ACTIVATOR's own state (control, tap-cost payability, summoning
  //   sickness, mana), never a lock imposed on the target permanent by a
  //   third party. Genuinely unenforced, not just undemonstrated.
  staticAbilities: [
    'Enchant artifact or creature',
    "Enchanted permanent doesn't untap during its controller's untap step and its activated abilities can't be activated.",
  ],

  triggers: [
    {
      // "When this Aura enters, tap enchanted permanent" — same `tapTarget`
      // stand-in sleep-magic's own onEnter trigger uses (this model has no
      // separate "which permanent did this Aura's own cast target" tracking
      // distinct from a fresh `chooseTarget` pool pick — Auras have no
      // dedicated attach-state here). `validType: 'creature-or-artifact'`
      // (not `'any'`) — checked `card.ts`'s `battlefieldPool`/
      // `matchesValidType`: `tapTarget`'s resolution pool passes
      // `effect.validType` straight through with no creature-only default
      // (unlike `grantKeywordTarget`'s own explicit `?? 'creature'`
      // fallback), so an artifact-or-creature restriction IS reachable
      // here — a prior version of this comment claimed the pool was
      // "always creatures regardless of validType," which doesn't hold up
      // against the real resolver; corrected rather than left stale.
      name: 'onEnter',
      effects: [{ kind: 'tapTarget', validType: 'creature-or-artifact' } satisfies Effect],
    },
  ],
};
