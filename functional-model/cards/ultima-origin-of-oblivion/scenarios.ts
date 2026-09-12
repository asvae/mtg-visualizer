// Real engine-piloted trace (see engine-trace.ts's own header). Neither
// onAttack nor onTapLandForC auto-fires in this engine (Trigger.on only
// recognizes 'enter'|'upkeep'|'endStep') — so this pilots a real attack
// declaration and a real land-tap-for-{C} activation, then fires each
// trigger manually right after.

import { ultimaOriginOfOblivion } from './definition';
import { adventurersInn } from '../adventurer-s-inn/definition';
import { basicLandsFor } from '../../mana';
import type { TraceResult } from '../../harness';
import type { CardDefinition, Effect } from '../../card';
import {
  setupEnginePilot,
  pilotActions,
  pilotCast,
  pilotResolveTop,
  pilotActivate,
  advanceToPlayersNextMain1,
  advanceToDeclareAttackersStep,
  pilotDeclareAttackers,
  pilotFireTrigger,
  finishEnginePilotTrace,
  type EnginePilotSetup,
} from '../../engine-trace';

// Adventurer's Inn's own real, single, unambiguous "{T}: Add {C}." line
// (its only static ability — see its own definition.ts) — no mana-producing
// Effect/Action exists on the REAL card (documented STILL-DEFERRED gap, same
// as every other plain Town-land mana ability pool-wide), so this is a
// throwaway, scenario-local CardDefinition pairing that one real printed
// line with a real `kind:'addMana'` Effect (the same shape Elvish
// Archdruid's own activated mana ability already proves executable),
// scoped entirely to this file — adventurer-s-inn's own definition.ts is
// untouched.
const adventurersInnManaAbility: CardDefinition = {
  name: adventurersInn.name,
  manaCost: '',
  typeLine: adventurersInn.typeLine,
  activationCost: '{T}',
  effects: [{ kind: 'addMana', color: 'C', amount: 1 } satisfies Effect],
};

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    you: { basicLands: basicLandsFor('{5}'), libraryCount: 5 },
    opponents: [{ basicLands: ['Forest'], libraryCount: 5 }],
  };
  const pilot = setupEnginePilot(setup);

  const ultimaReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: ultimaOriginOfOblivion.name,
    types: ['Creature'],
    subtypes: ['God', 'Legendary'],
    keywords: ultimaOriginOfOblivion.keywords,
  });
  const actions = pilotActions(pilot, ultimaReal.id);
  // "Target land" has no owner restriction at all (real oracle text) — the
  // real chooseTarget default (pool[0] of an unrestricted combined pool,
  // `you` always first) would otherwise blight YOUR OWN land instead of the
  // opponent's, contradicting this scenario's own story (a genuine, if
  // legal, choice this pilot script makes on purpose, same reasoning
  // Bahamut's own preferTarget uses).
  const opp = pilot.opponents[0]!;
  const ctx = pilot.ctxFor(ultimaReal, { preferTarget: (c) => c.getController().getId() === opp.id });

  // Cast Ultima ({5}), real mana payment
  pilotCast(pilot, ultimaReal, ultimaOriginOfOblivion, ctx, actions);
  // Resolves (no ETB trigger)
  pilotResolveTop(pilot);

  // Real turn passage — summoning sickness (302.6) clears
  advanceToPlayersNextMain1(pilot, pilot.you);

  // Real attack declaration (508.1)
  advanceToDeclareAttackersStep(pilot);
  pilotDeclareAttackers(pilot, [ultimaReal], 'Declare Ultima as attacker');

  // onAttack fired manually — puts a real blight counter on the opponent's only land
  pilotFireTrigger(pilot, ultimaOriginOfOblivion, ctx, actions, 'onAttack');

  // A real Adventurer's Inn, already resolved on your battlefield (added
  // directly, same "bystander permanent" convention every other scenario's
  // own non-protagonist permanents use — no `enteredThisTurn` stamp, so no
  // summoning-sickness gate applies to its own {T} cost either).
  const innReal = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: adventurersInn.name,
    types: ['Land'],
    subtypes: ['Town'],
    manaAbility: 'C',
  });
  const innCtx = pilot.ctxFor(innReal);
  const innActions = pilotActions(pilot, innReal.id);
  // Real {T}: Add {C} activation (602.1) — tap the Inn for its own {C}.
  pilotActivate(pilot, pilot.you, innReal, adventurersInnManaAbility, innCtx, innActions, "Tap Adventurer's Inn for {C}");
  pilotResolveTop(pilot);
  // Ultima's own real "Whenever you tap a land for {C}, add an additional
  // {C}" — fired manually right after the real land tap above, adding a
  // real second {C} via the same `kind:'addMana'` Effect shape.
  pilotFireTrigger(pilot, ultimaOriginOfOblivion, ctx, actions, 'onTapLandForC', "Ultima triggers: add an additional {C}");

  const result =
    'Ultima enters, turn passage clears summoning sickness, then attacks (508.1), putting a blight counter on the opponent\'s only land (whose granted "{T}: Add {C}" stays printed text with no engine machinery behind it). Separately, an Adventurer\'s Inn is tapped for its own {C}, and Ultima\'s own mana-doubling trigger fires right after, adding an additional {C}.';
  return [finishEnginePilotTrace(pilot, setup, 'real engine playthrough: cast -> turn passage -> real attack -> onAttack -> real land tap -> onTapLandForC', result)];
}
