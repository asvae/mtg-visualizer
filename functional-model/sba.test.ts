import { describe, expect, it } from 'vitest';
import { GameState } from './state';
import { checkStateBasedActions } from './sba';

describe('checkStateBasedActions (704)', () => {
  it('a healthy creature (no damage, positive toughness) is untouched', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    const creature = state.addCard(you, 'Battlefield', { name: 'Fine Bear', types: ['Creature'], basePower: 2, baseToughness: 2 });
    const result = checkStateBasedActions(state, [you, opp]);
    expect(result).toEqual({ destroyed: [], putIntoGraveyard: [], legendRuleRemoved: [] });
    expect(creature.zone).toBe('Battlefield');
  });

  it('704.5f: a creature with toughness <= 0 is put into the graveyard, bypassing Indestructible', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    const creature = state.addCard(you, 'Battlefield', { name: 'Shrunk Bear', types: ['Creature'], basePower: 2, baseToughness: 0, keywords: ['Indestructible'] });
    const result = checkStateBasedActions(state, [you, opp]);
    expect(result.putIntoGraveyard).toEqual([creature]);
    expect(result.destroyed).toEqual([]);
    expect(creature.zone).toBe('Graveyard');
  });

  it('704.5g: lethal marked damage destroys a creature', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    const creature = state.addCard(you, 'Battlefield', { name: 'Doomed Bear', types: ['Creature'], basePower: 2, baseToughness: 2 });
    state.dealDamage(creature, 2);
    const result = checkStateBasedActions(state, [you, opp]);
    expect(result.destroyed).toEqual([creature]);
    expect(creature.zone).toBe('Graveyard');
  });

  it('704.5g respects Indestructible (702.12b): a lethally damaged Indestructible creature is NOT destroyed', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    const creature = state.addCard(you, 'Battlefield', { name: 'Tough Bear', types: ['Creature'], basePower: 2, baseToughness: 2, keywords: ['Indestructible'] });
    state.dealDamage(creature, 5);
    const result = checkStateBasedActions(state, [you, opp]);
    expect(result.destroyed).toEqual([]);
    expect(creature.zone).toBe('Battlefield');
  });

  it('non-lethal damage does not destroy a creature', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    const creature = state.addCard(you, 'Battlefield', { name: 'Bruised Bear', types: ['Creature'], basePower: 2, baseToughness: 4 });
    state.dealDamage(creature, 2);
    const result = checkStateBasedActions(state, [you, opp]);
    expect(result.destroyed).toEqual([]);
    expect(creature.zone).toBe('Battlefield');
  });

  it('704.5h: any nonzero Deathtouch damage destroys a creature regardless of toughness', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    const source = state.addCard(opp, 'Battlefield', { name: 'Toucher', types: ['Creature'], keywords: ['Deathtouch'] });
    const creature = state.addCard(you, 'Battlefield', { name: 'Huge Bear', types: ['Creature'], basePower: 2, baseToughness: 10 });
    state.dealDamage(creature, 1, source);
    const result = checkStateBasedActions(state, [you, opp]);
    expect(result.destroyed).toEqual([creature]);
    expect(creature.zone).toBe('Graveyard');
  });

  it('704.5j: the legend rule keeps only one of two same-named Legendary permanents', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    const first = state.addCard(you, 'Battlefield', { name: 'Jill, Shiva\'s Dominant', types: ['Creature'], subtypes: ['Legendary'] });
    const second = state.addCard(you, 'Battlefield', { name: 'Jill, Shiva\'s Dominant', types: ['Creature'], subtypes: ['Legendary'] });
    const result = checkStateBasedActions(state, [you, opp]);
    expect(result.legendRuleRemoved).toHaveLength(1);
    expect(you.battlefield.filter((c) => c.name === 'Jill, Shiva\'s Dominant')).toHaveLength(1);
    expect(you.battlefield).toContain(first);
    expect(second.zone).toBe('Graveyard');
  });

  it('two different Legendary permanents by different names are both kept', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    state.addCard(you, 'Battlefield', { name: 'Jill, Shiva\'s Dominant', types: ['Creature'], subtypes: ['Legendary'] });
    state.addCard(you, 'Battlefield', { name: 'Dion, Bahamut\'s Dominant', types: ['Creature'], subtypes: ['Legendary'] });
    const result = checkStateBasedActions(state, [you, opp]);
    expect(result.legendRuleRemoved).toEqual([]);
    expect(you.battlefield).toHaveLength(2);
  });

  it('a lethally damaged creature AND a legend-rule duplicate both resolve in one call (704.3 loop)', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    const lethal = state.addCard(you, 'Battlefield', { name: 'Doomed Bear', types: ['Creature'], basePower: 2, baseToughness: 2 });
    state.dealDamage(lethal, 2);
    state.addCard(you, 'Battlefield', { name: 'Jill, Shiva\'s Dominant', types: ['Creature'], subtypes: ['Legendary'] });
    state.addCard(you, 'Battlefield', { name: 'Jill, Shiva\'s Dominant', types: ['Creature'], subtypes: ['Legendary'] });
    const result = checkStateBasedActions(state, [you, opp]);
    expect(result.destroyed).toEqual([lethal]);
    expect(result.legendRuleRemoved).toHaveLength(1);
    expect(you.battlefield).toHaveLength(1);
  });

  it('a noncreature permanent is never checked for lethal damage or toughness', () => {
    const state = new GameState();
    const you = state.addPlayer('you');
    const opp = state.addPlayer('opp');
    const artifact = state.addCard(you, 'Battlefield', { name: 'Sword', types: ['Artifact'], basePower: 0, baseToughness: 0 });
    const result = checkStateBasedActions(state, [you, opp]);
    expect(result).toEqual({ destroyed: [], putIntoGraveyard: [], legendRuleRemoved: [] });
    expect(artifact.zone).toBe('Battlefield');
  });
});
