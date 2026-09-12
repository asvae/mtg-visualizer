// Real engine-piloted trace (engine-trace.ts's own header) — this card's
// P/T grant ("Equipped creature gets +1/+1") and type grant ("is a Rogue in
// addition to its other types") are now real, executable machinery
// (continuousPTGrants/continuousTypeGrants, ENGINE_GAPS.md gap #14's own
// follow-up, closed 2026-09-12) — same real mechanism dragoon-s-lance/
// paladin-s-arms/white-mage-s-staff/sage-s-nouliths/machinist-s-arsenal/
// astrologian-s-planisphere already establish. THOSE 6 cards' own
// scenarios.ts are plain harness.ts Scenario[] arrays with no manual-log-
// injection field, so none of them can push the `read:getNetPower`/
// `read:hasSubtype` lines that would constitute real trace evidence
// (verify-synergy.mjs's own isEquippedPTGrantFact/isEquippedTypeGrantFact
// shape-scoped exemptions cover them instead). Thief's Knife migrates to a
// real engine-trace.ts pilot here — same style crystal-fragments-summon-
// alexander already uses for its own analogous (pump-only) fact — so BOTH
// grants get real evidence, not just real mechanism: the first card in this
// family to exercise `read:hasSubtype` for real (verify-synergy.mjs's own
// hasSubtypeReadEvidence check was wired for this in the gap #14 pass but
// had no real exerciser until now).

import { thiefsKnife } from './definition';
import { basicLandsFor } from '../../mana';
import { typesFromTypeLine, subtypesFromTypeLine } from '../../harness';
import type { TraceResult } from '../../harness';
import { effectivePT, effectiveSubtypes } from '../../state';
import { setupEnginePilot, pilotActions, pilotCast, pilotResolveTop, pilotFireTrigger, pilotActivate, finishEnginePilotTrace, type EnginePilotSetup } from '../../engine-trace';

export function runEngineScenarios(): TraceResult[] {
  const setup: EnginePilotSetup = {
    // {2}{U} to cast, {4} to activate Equip later — 7 total, all Islands
    // (generic can be paid by any color, same convention crystal-fragments-
    // summon-alexander's own setup already establishes).
    you: { basicLands: [...basicLandsFor('{2}{U}'), 'Island', 'Island', 'Island', 'Island'], libraryCount: 10 },
    opponents: [{ basicLands: ['Forest'], libraryCount: 10 }],
  };
  const pilot = setupEnginePilot(setup);

  // A second real creature already on the battlefield (301.5c) — Equip {4}
  // re-attaches Thief's Knife onto this one below, off the Job-select Hero
  // token, so the grant's own live re-equip-following behavior gets real
  // evidence too (same functional behavior state.test.ts's "continuous,
  // query-time grants" describe block already covers structurally). Real
  // FIN card, not invented filler.
  const otherCreature = pilot.state.addCard(pilot.you, 'Battlefield', {
    name: 'Qiqirn Merchant',
    types: ['Creature'],
    subtypes: ['Beast', 'Citizen'],
    basePower: 1,
    baseToughness: 4,
    cmc: 3,
  });
  pilot.log.push({ fn: 'enters', card: otherCreature.name, zone: 'Battlefield', power: otherCreature.basePower, toughness: otherCreature.baseToughness, controller: pilot.you.name });

  const tkReal = pilot.state.addCard(pilot.you, 'Hand', {
    name: thiefsKnife.name,
    types: typesFromTypeLine(thiefsKnife.typeLine),
    subtypes: subtypesFromTypeLine(thiefsKnife.typeLine),
  });
  const actions = pilotActions(pilot, tkReal.id);
  const ctx = pilot.ctxFor(tkReal);

  // Cast Thief's Knife from hand (601)
  pilotCast(pilot, tkReal, thiefsKnife, ctx, actions);
  pilotResolveTop(pilot);

  // Job select — no auto-fire mechanism for this named ETB trigger exists in
  // engine.ts (`Trigger.on` is unset, same as every sibling Job-select
  // Equipment's own onEnter trigger — real, but not one of the 3 recognized
  // auto-fire kinds), so it's manually fired here, same treatment any other
  // non-auto-recognized trigger gets (`pilotFireTrigger`'s own doc comment).
  // Real effects: creates the 1/1 Hero token, then attaches Thief's Knife to
  // it (both via real `Actions` calls).
  pilotFireTrigger(pilot, thiefsKnife, ctx, actions, 'onEnter');

  const heroToken = pilot.you.battlefield.find((c) => c.name === 'Hero');
  if (!heroToken) throw new Error('Job select did not create the Hero token');

  // Real proof BOTH continuous grants genuinely apply to whatever Thief's
  // Knife is attached to (ENGINE_GAPS.md gap #14's own follow-up, closed
  // 2026-09-12) — same "manual CDA read" pattern adelbert-steiner's own
  // read:getNetPower line and crystal-fragments-summon-alexander's own
  // (pump-only) precedent already establish, extended here to ALSO cover the
  // type-grant half via a real read:hasSubtype line: the printed 1/1 Hero
  // genuinely becomes a live 2/2 Rogue the instant it's equipped.
  pilot.beginStep('Real layer-7c/layer-4 recalculation — Equipped creature gets +1/+1 and is a Rogue');
  {
    const [power, toughness] = effectivePT(pilot.state, heroToken);
    pilot.log.push({ fn: 'read:getNetPower', card: heroToken.name, power, toughness });
    const result = effectiveSubtypes(pilot.state, heroToken).includes('Rogue');
    pilot.log.push({ fn: 'read:hasSubtype', target: heroToken.name, subtype: 'Rogue', result });
  }

  // Real Equip {4} activation (602.1) — re-attaches Thief's Knife from the
  // Hero token onto the OTHER real creature already on the battlefield
  // (`chooseTarget`'s own real pool[0] default picks Qiqirn Merchant here,
  // since it was placed on the battlefield before the Hero token existed),
  // same real attach-to-a-chosen-creature shape dragoon-s-lance/paladin-s-
  // arms/machinist-s-arsenal share.
  pilotActivate(pilot, pilot.you, tkReal, thiefsKnife, ctx, actions);
  pilotResolveTop(pilot);

  // Real proof the grant genuinely FOLLOWS a live re-equip, not just the
  // original attachment: the Hero token drops back to its printed 1/1
  // non-Rogue now that Thief's Knife has moved on, and Qiqirn Merchant picks
  // up both grants in its place.
  pilot.beginStep('Real re-equip: the grant follows the live attachment, off the Hero token and onto Qiqirn Merchant');
  {
    const [heroPower, heroToughness] = effectivePT(pilot.state, heroToken);
    pilot.log.push({ fn: 'read:getNetPower', card: heroToken.name, power: heroPower, toughness: heroToughness });
    pilot.log.push({ fn: 'read:hasSubtype', target: heroToken.name, subtype: 'Rogue', result: effectiveSubtypes(pilot.state, heroToken).includes('Rogue') });
    const [otherPower, otherToughness] = effectivePT(pilot.state, otherCreature);
    pilot.log.push({ fn: 'read:getNetPower', card: otherCreature.name, power: otherPower, toughness: otherToughness });
    pilot.log.push({ fn: 'read:hasSubtype', target: otherCreature.name, subtype: 'Rogue', result: effectiveSubtypes(pilot.state, otherCreature).includes('Rogue') });
  }

  // The granted "whenever this creature deals combat damage to a player,
  // draw a card" — no auto-fire mechanism for a combat-damage trigger exists
  // in engine.ts (Trigger.on only recognizes enter/upkeep/endStep), so
  // manually fired, same onEquippedDealsDamage-as-self simplification
  // buster-sword/genji-glove/this card's own pre-migration draft already
  // established (the real source is whichever creature is equipped —
  // Qiqirn Merchant, now — not Thief's Knife itself).
  pilotFireTrigger(pilot, thiefsKnife, ctx, actions, 'onEquippedDealsDamage');

  const result =
    "Thief's Knife enters, Job select creates a 1/1 colorless Hero token and attaches itself to it — the Hero genuinely recalculates to a 2/2 Rogue the instant it's equipped (real read:getNetPower/read:hasSubtype evidence); Equip {4} then re-attaches it to Qiqirn Merchant instead, and the grant genuinely follows: the Hero drops back to a 1/1 non-Rogue, Qiqirn Merchant picks up +1/+1 and Rogue in its place; the granted 'whenever this creature deals combat damage to a player, draw a card' then fires for real, drawing a card.";

  return [
    finishEnginePilotTrace(
      pilot,
      setup,
      'real engine playthrough: cast -> Job select ETB -> equip recalculation -> re-equip via Equip {4} -> granted combat-damage draw',
      result,
    ),
  ];
}
