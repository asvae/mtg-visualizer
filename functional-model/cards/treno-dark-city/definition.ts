import type { CardDefinition, Effect } from '../../card';

// Real script (treno_dark_city.txt): "This land enters tapped" — a real
// replacement effect, modeled as an onEnter trigger tapping self, same
// pool-based `tapTarget` convention elixir's own onEnter trigger uses
// (self is genuinely already on the battlefield by the time a named
// trigger's effects run — see harness.ts's own selfZone rule — so
// `owner: 'you'` finds exactly self as long as the scenario sets up no
// other land for "you"). `validType: 'land'` since Treno is a Land, not
// elixir's own Artifact.
//
// "{T}: Add {U} or {B}" is a real mana ability — deliberately staticAbilities
// text only, never a resolvable effect: no mana-producing Effect/Action
// exists anywhere in this model (no mana pool tracked), a documented,
// deliberate STILL-DEFERRED gap, not an oversight.
export const trenoDarkCity: CardDefinition = {
  name: 'Treno, Dark City',
  manaCost: '',
  typeLine: 'Land — Town',

  triggers: [
    {
      name: 'onEnter',
      effects: [{ kind: 'tapTarget', validType: 'land', owner: 'you' } satisfies Effect],
    },
  ],

  staticAbilities: ['{T}: Add {U} or {B}.'],
};
