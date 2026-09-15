import { describe, expect, it } from 'vitest';
import { basicLandcycling } from './cycling';

describe('basicLandcycling', () => {
  it('builds the real, structured basic-Landcycling ability shape (cost + discard-self boilerplate baked in)', () => {
    expect(basicLandcycling('Plains', '{2}')).toEqual({
      name: 'cycling',
      cost: '{2}, Discard this card',
      effects: [{ kind: 'move', owner: 'you', from: 'Library', to: 'Hand', qty: 1, validType: 'land', subtype: 'Plains', shuffleAfter: true }],
    });
  });

  it('varies subtype/cost independently, same shape otherwise', () => {
    const island = basicLandcycling('Island', '{1}{U}');
    expect(island.cost).toBe('{1}{U}, Discard this card');
    expect(island.effects).toEqual([{ kind: 'move', owner: 'you', from: 'Library', to: 'Hand', qty: 1, validType: 'land', subtype: 'Island', shuffleAfter: true }]);
  });
});
