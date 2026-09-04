import type { CardDefinition, Effect } from '../../card';

export const thePrimaVista: CardDefinition = {
  name: 'The Prima Vista',
  manaCost: '{4}{U}',
  typeLine: 'Legendary Artifact — Vehicle',
  pt: [5, 3],

  keywords: ['Flying'],

  triggers: [
    {
      // Real: "Whenever you cast a noncreature spell, if at least four
      // mana was spent to cast it, ... becomes an artifact creature until
      // end of turn." The noncreature/4-mana condition is documentary only
      // (this model has no mana-spent tracking) — same convention Minwu's
      // own onLifeGained trigger already uses for its own untracked
      // trigger condition.
      name: 'onCastNoncreatureSpell4Mana',
      effects: [{ kind: 'animate', target: 'self', types: ['Artifact', 'Creature'] } satisfies Effect],
    },
  ],

  // Real bare `K:Crew:2` — same explicit representation the-lunar-whale's
  // own identical bare-Crew case (and magitek-armor's) already establishes:
  // `crewCost` (the structured N) AND `activationCost` (drives harness.ts's
  // own activate-not-cast lifecycle) both set, `effects: [animate]`
  // standing in for Forge's own implicit crew-makes-it-a-creature rule.
  crewCost: 2,
  activationCost: 'Crew 2 (tap creatures with total power 2 or more)',
  effects: [{ kind: 'animate', target: 'self', types: ['Artifact', 'Creature'] } satisfies Effect],
};
