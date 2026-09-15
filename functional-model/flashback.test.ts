import { describe, expect, it } from 'vitest';
import { flashback } from './flashback';

describe('flashback', () => {
  it('builds the real, closed Flashback alternate-cost shape (from/thenExile baked in)', () => {
    expect(flashback('{3}{U}')).toEqual({ name: 'Flashback', cost: '{3}{U}', from: 'graveyard', thenExile: true });
  });

  it('varies cost only, shape otherwise identical', () => {
    expect(flashback('{6}{R}{R}')).toEqual({ name: 'Flashback', cost: '{6}{R}{R}', from: 'graveyard', thenExile: true });
  });
});
