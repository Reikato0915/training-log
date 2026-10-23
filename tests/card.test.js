import { describe, it, expect } from 'vitest';
import { toggleSided, isSided, moveItem } from '../src/ui/card.js';
import { findExercise } from '../src/catalog.js';

describe('left/right toggle', () => {
  it('turns on by copying left reps to the right', () => {
    const e = toggleSided({ exId: 'bench', sets: [{ w: 20, reps: 10 }, { w: 20, reps: null }] }, true);
    expect(e.sided).toBe(true);
    expect(e.sets).toEqual([{ w: 20, reps: 10, repsR: 10 }, { w: 20, reps: null, repsR: null }]);
  });

  it('turns off by dropping right reps', () => {
    const e = toggleSided({ exId: 'bulgarian', sets: [{ w: 20, reps: 10, repsR: 9 }] }, false);
    expect(e).toEqual({ exId: 'bulgarian', sided: false, sets: [{ w: 20, reps: 10 }] });
  });

  it('prefers the per-record setting over the exercise default', () => {
    expect(isSided({ sets: [] }, findExercise('bulgarian'))).toBe(true);
    expect(isSided({ sided: false, sets: [] }, findExercise('bulgarian'))).toBe(false);
    expect(isSided({ sided: true, sets: [] }, findExercise('bench'))).toBe(true);
  });
});

describe('moveItem', () => {
  it('moves an item to a new position without mutating', () => {
    const list = ['a', 'b', 'c', 'd'];
    expect(moveItem(list, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(list, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(list, 1, 3)).toEqual(['a', 'c', 'd', 'b']);
    expect(list).toEqual(['a', 'b', 'c', 'd']);
  });
});
