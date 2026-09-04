import type { Scenario } from '../../harness';

export const scenarios: Scenario[] = [
  { result: 'destroys up to one target creature', trigger: 'onEnter', opponents: [{ creaturesCount: 1 }] },
  { result: 'no legal target, nothing destroyed', trigger: 'onEnter', opponents: [{ creaturesCount: 0 }] },
  {
    // The "3+ Treasures -> transform" branch isn't independently exercisable
    // here: `PlayerState` has no field to seed PRE-EXISTING Treasure-
    // subtyped artifacts on the battlefield (only `equipmentCount`/generic
    // `artifactsCount`, neither of which carries the real 'Treasure'
    // subtype `hasSubtype('Treasure')` checks for) — only the token this
    // trigger itself creates ever actually counts. Genuinely covers the
    // "still below 3" branch; the "reaches 3" branch is a real scenario-
    // setup gap, not exercised.
    result: 'creates a Treasure token; below three Treasures controlled (only the one just created), no transform',
    trigger: 'onEndStep',
  },
  {
    result: 'sacrifices another creature or artifact, Yiazmat gains indestructible until end of turn, then taps itself',
    face: 'back',
    you: { creaturesCount: 1 },
  },
  { result: 'a second Yiazmat entering triggers the legend rule; the newer copy is put into the graveyard', face: 'back', duplicateLegendaryEnters: true },
];
