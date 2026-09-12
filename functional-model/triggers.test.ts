import { describe, expect, it } from 'vitest';
import type { CardDefinition, Actions, EffectContext } from './card';
import { GameState, wrapCard, wrapPlayer } from './state';
import { fireTrigger } from './triggers';

// Same `{} as Actions` stub engine.test.ts/stack.test.ts already use — none
// of this file's test cards' effects call an `Actions` method (`custom`
// effects here only ever push onto a local `order` array).
const noopActions = {} as Actions;

/** A minimal CardDefinition with exactly one named trigger whose effect
 * records a firing in `order` — the same "count real firings via a `custom`
 * effect pushing to an array" pattern `engine.test.ts`'s own
 * "resolveCard dispatch collision"/"fireOnPhaseEnterTriggers" describe
 * blocks already establish. */
function triggerCard(name: string, order: string[]): CardDefinition {
  return {
    name,
    manaCost: '',
    typeLine: 'Creature — Test',
    triggers: [{ name: 'onX', effects: [{ kind: 'custom', describe: 'record firing', run: () => order.push(name) }] }],
  };
}

describe('fireTrigger (ENGINE_GAPS.md gap #13 — the real "Panharmonicon effect" chokepoint)', () => {
  it('baseline: fires once when no triggerDoubling grant is present anywhere on the battlefield', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const order: string[] = [];
    const real = state.addCard(you, 'Battlefield', { name: 'Plain Permanent' });
    const ctx: EffectContext = { self: wrapCard(state, real), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
    const doubled = fireTrigger(state, triggerCard('Plain Permanent', order), ctx, noopActions, 'onX');
    expect(order).toEqual(['Plain Permanent']);
    expect(doubled).toBe(false);
  });

  describe("Cloud, Midgar Mercenary's own gate — { scope: 'selfAndAttachedEquipment' }, no causedBy restriction", () => {
    it('doubles a trigger of the equipped permanent ITSELF once genuinely equipped', () => {
      const state = new GameState();
      const you = state.addPlayer('you');
      const order: string[] = [];
      const cloud = state.addCard(you, 'Battlefield', { name: 'Cloud', triggerDoubling: [{ scope: 'selfAndAttachedEquipment' }] });
      const equipment = state.addCard(you, 'Battlefield', { name: 'Some Equipment' });
      state.equip(equipment, cloud);
      const ctx: EffectContext = { self: wrapCard(state, cloud), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
      const doubled = fireTrigger(state, triggerCard('Cloud', order), ctx, noopActions, 'onX');
      expect(order).toEqual(['Cloud', 'Cloud']);
      expect(doubled).toBe(true);
    });

    it('ALSO doubles a triggered ability of the ATTACHED Equipment itself (real Forge text: "...or an Equipment attached to it")', () => {
      const state = new GameState();
      const you = state.addPlayer('you');
      const order: string[] = [];
      const cloud = state.addCard(you, 'Battlefield', { name: 'Cloud', triggerDoubling: [{ scope: 'selfAndAttachedEquipment' }] });
      const equipment = state.addCard(you, 'Battlefield', { name: 'Ultima Weapon' });
      state.equip(equipment, cloud);
      const ctx: EffectContext = { self: wrapCard(state, equipment), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
      const doubled = fireTrigger(state, triggerCard('Ultima Weapon', order), ctx, noopActions, 'onX');
      expect(order).toEqual(['Ultima Weapon', 'Ultima Weapon']);
      expect(doubled).toBe(true);
    });

    it('does NOT double while NOT yet equipped — the real "as long as this is equipped" precondition is genuinely enforced, not just the grant\'s presence', () => {
      const state = new GameState();
      const you = state.addPlayer('you');
      const order: string[] = [];
      // Cloud carries the doubling static from the moment he resolves (same
      // as the real card always has it printed) — but nothing is attached
      // to him yet, e.g. his own ETB tutor firing before any Equipment is
      // even cast.
      const cloud = state.addCard(you, 'Battlefield', { name: 'Cloud', triggerDoubling: [{ scope: 'selfAndAttachedEquipment' }] });
      const ctx: EffectContext = { self: wrapCard(state, cloud), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
      const doubled = fireTrigger(state, triggerCard('Cloud', order), ctx, noopActions, 'onX');
      expect(order).toEqual(['Cloud']);
      expect(doubled).toBe(false);
    });

    it('does NOT double an unrelated permanent\'s own trigger (not self, not attached to Cloud)', () => {
      const state = new GameState();
      const you = state.addPlayer('you');
      const order: string[] = [];
      const cloud = state.addCard(you, 'Battlefield', { name: 'Cloud', triggerDoubling: [{ scope: 'selfAndAttachedEquipment' }] });
      const equipment = state.addCard(you, 'Battlefield', { name: 'Some Equipment' });
      state.equip(equipment, cloud);
      const bystander = state.addCard(you, 'Battlefield', { name: 'Bystander' });
      const ctx: EffectContext = { self: wrapCard(state, bystander), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
      const doubled = fireTrigger(state, triggerCard('Bystander', order), ctx, noopActions, 'onX');
      expect(order).toEqual(['Bystander']);
      expect(doubled).toBe(false);
    });
  });

  describe("The Masamune's own gate — { scope: 'equippedSelf', causedBy: 'dying' }", () => {
    it('doubles a DYING-caused trigger of the equipped creature', () => {
      const state = new GameState();
      const you = state.addPlayer('you');
      const order: string[] = [];
      const masamune = state.addCard(you, 'Battlefield', { name: 'The Masamune', triggerDoubling: [{ scope: 'equippedSelf', causedBy: 'dying' }] });
      const wearer = state.addCard(you, 'Battlefield', { name: 'Al Bhed Salvagers' });
      state.equip(masamune, wearer);
      const ctx: EffectContext = { self: wrapCard(state, wearer), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
      const doubled = fireTrigger(state, triggerCard('Al Bhed Salvagers', order), ctx, noopActions, 'onX', { kind: 'dying' });
      expect(order).toEqual(['Al Bhed Salvagers', 'Al Bhed Salvagers']);
      expect(doubled).toBe(true);
    });

    it('does NOT double a trigger with no "dying" cause (real gate genuinely filters on cause, not just presence/equip)', () => {
      const state = new GameState();
      const you = state.addPlayer('you');
      const order: string[] = [];
      const masamune = state.addCard(you, 'Battlefield', { name: 'The Masamune', triggerDoubling: [{ scope: 'equippedSelf', causedBy: 'dying' }] });
      const wearer = state.addCard(you, 'Battlefield', { name: 'Al Bhed Salvagers' });
      state.equip(masamune, wearer);
      const ctx: EffectContext = { self: wrapCard(state, wearer), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
      const doubled = fireTrigger(state, triggerCard('Al Bhed Salvagers', order), ctx, noopActions, 'onX'); // no cause at all
      expect(order).toEqual(['Al Bhed Salvagers']);
      expect(doubled).toBe(false);
    });

    it('does NOT double a DIFFERENT creature\'s own dying trigger (not the one Masamune is actually equipped to)', () => {
      const state = new GameState();
      const you = state.addPlayer('you');
      const order: string[] = [];
      const masamune = state.addCard(you, 'Battlefield', { name: 'The Masamune', triggerDoubling: [{ scope: 'equippedSelf', causedBy: 'dying' }] });
      const wearer = state.addCard(you, 'Battlefield', { name: 'Al Bhed Salvagers' });
      state.equip(masamune, wearer);
      const bystander = state.addCard(you, 'Battlefield', { name: 'Bystander' });
      const ctx: EffectContext = { self: wrapCard(state, bystander), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
      const doubled = fireTrigger(state, triggerCard('Bystander', order), ctx, noopActions, 'onX', { kind: 'dying' });
      expect(order).toEqual(['Bystander']);
      expect(doubled).toBe(false);
    });
  });

  describe("Traveling Chocobo's own gate — { scope: 'anyPermanentYouControl', causedBy: 'entersBattlefield', entersMatch: [land, Bird] }", () => {
    function chocoboSetup() {
      const state = new GameState();
      const you = state.addPlayer('you');
      const opp = state.addPlayer('opp');
      state.addCard(you, 'Battlefield', {
        name: 'Traveling Chocobo',
        triggerDoubling: [{ scope: 'anyPermanentYouControl', causedBy: 'entersBattlefield', entersMatch: [{ isLand: true }, { subtype: 'Bird' }] }],
      });
      return { state, you, opp };
    }

    it('doubles ANOTHER permanent\'s own trigger when caused by a LAND entering under the same controller (not just Chocobo\'s own)', () => {
      const { state, you } = chocoboSetup();
      const order: string[] = [];
      const ambrosia = state.addCard(you, 'Battlefield', { name: 'Ambrosia Whiteheart' });
      const land = state.addCard(you, 'Battlefield', { name: 'Forest', types: ['Land'], subtypes: ['Forest'] });
      const ctx: EffectContext = { self: wrapCard(state, ambrosia), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
      const doubled = fireTrigger(state, triggerCard('Ambrosia Whiteheart', order), ctx, noopActions, 'onX', { kind: 'entersBattlefield', entered: land });
      expect(order).toEqual(['Ambrosia Whiteheart', 'Ambrosia Whiteheart']);
      expect(doubled).toBe(true);
    });

    it('doubles when caused by a BIRD (subtype match, not a land) entering', () => {
      const { state, you } = chocoboSetup();
      const order: string[] = [];
      const ambrosia = state.addCard(you, 'Battlefield', { name: 'Ambrosia Whiteheart' });
      const bird = state.addCard(you, 'Battlefield', { name: 'Some Bird', types: ['Creature'], subtypes: ['Bird'] });
      const ctx: EffectContext = { self: wrapCard(state, ambrosia), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
      const doubled = fireTrigger(state, triggerCard('Ambrosia Whiteheart', order), ctx, noopActions, 'onX', { kind: 'entersBattlefield', entered: bird });
      expect(doubled).toBe(true);
    });

    it('does NOT double when the entering permanent is neither a land nor a Bird', () => {
      const { state, you } = chocoboSetup();
      const order: string[] = [];
      const ambrosia = state.addCard(you, 'Battlefield', { name: 'Ambrosia Whiteheart' });
      const nonQualifying = state.addCard(you, 'Battlefield', { name: 'Some Bear', types: ['Creature'], subtypes: ['Bear'] });
      const ctx: EffectContext = { self: wrapCard(state, ambrosia), you: wrapPlayer(state, you), opponents: [], castFrom: 'hand' };
      const doubled = fireTrigger(state, triggerCard('Ambrosia Whiteheart', order), ctx, noopActions, 'onX', { kind: 'entersBattlefield', entered: nonQualifying });
      expect(order).toEqual(['Ambrosia Whiteheart']);
      expect(doubled).toBe(false);
    });

    it('does NOT double an OPPONENT\'s own permanent (real text: "a permanent you control," not any permanent)', () => {
      const { state, you, opp } = chocoboSetup();
      const order: string[] = [];
      const oppCreature = state.addCard(opp, 'Battlefield', { name: "Opponent's Creature" });
      const land = state.addCard(you, 'Battlefield', { name: 'Forest', types: ['Land'], subtypes: ['Forest'] });
      const ctx: EffectContext = { self: wrapCard(state, oppCreature), you: wrapPlayer(state, opp), opponents: [], castFrom: 'hand' };
      const doubled = fireTrigger(state, triggerCard("Opponent's Creature", order), ctx, noopActions, 'onX', { kind: 'entersBattlefield', entered: land });
      expect(order).toEqual(["Opponent's Creature"]);
      expect(doubled).toBe(false);
    });
  });
});
