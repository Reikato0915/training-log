import { describe, it, expect } from 'vitest';
import { searchExercises, makeCustomExercise, exercisesForSplit, findExercise, muscleName } from '../src/catalog.js';
import { lastPerformance, weeklyE1RM } from '../src/aggregate.js';

describe('catalog', () => {
  it('searches by name and alias ignoring case/space', () => {
    expect(searchExercises('bp').map((e) => e.id)).toContain('bench');
    expect(searchExercises('ラット').map((e) => e.id)).toContain('lat_pulldown');
    expect(searchExercises('').length).toBeGreaterThan(40);
  });

  it('filters by split; legs1/legs2 share legs, other shows all', () => {
    expect(exercisesForSplit('legs2').every((e) => e.split === 'legs')).toBe(true);
    expect(exercisesForSplit('other').length).toBe(searchExercises('').length);
  });

  it('validates custom exercises', () => {
    expect(() => makeCustomExercise({ name: ' ', split: 'push', primary: ['triceps'] })).toThrow('種目名');
    expect(() => makeCustomExercise({ name: 'x', split: 'push', primary: [] })).toThrow('部位');
    expect(() => makeCustomExercise({ name: 'x', split: 'push', primary: ['nope'] })).toThrow('不明');
    const e = makeCustomExercise({ name: 'ケーブルクロス', split: 'push', primary: ['chest_mid'], secondary: ['chest_mid', 'delt_front'] });
    expect(e.secondary).toEqual(['delt_front']);
    expect(findExercise(e.id, [e]).name).toBe('ケーブルクロス');
    expect(muscleName('quads')).toBe('大腿四頭筋');
  });
});

describe('history helpers', () => {
  const sessions = [
    { id: 'a', date: '2026-10-05', exercises: [{ exId: 'bench', sets: [{ w: 100, reps: 5 }] }] },
    { id: 'b', date: '2026-10-12', exercises: [{ exId: 'bench', sets: [{ w: 100, reps: 8 }] }] },
    { id: 'c', date: '2026-10-19', deleted: true, exercises: [{ exId: 'bench', sets: [{ w: 200, reps: 8 }] }] },
  ];

  it('finds the most recent earlier performance', () => {
    expect(lastPerformance(sessions, 'bench', '2026-10-20')).toEqual({ date: '2026-10-12', sets: [{ w: 100, reps: 8 }] });
    expect(lastPerformance(sessions, 'bench', '2026-10-05')).toBeNull();
  });

  it('tracks weekly best e1RM', () => {
    const r = weeklyE1RM(sessions, ['2026-10-05', '2026-10-12', '2026-10-19']);
    expect(r.bench['2026-10-12']).toBeCloseTo(126.67, 1);
    expect(r.bench['2026-10-19']).toBeUndefined();
  });
});

describe('weight units', async () => {
  const { toDisplayWeight, fromDisplayWeight, unitOf, findExercise: find } = await import('../src/catalog.js');
  it('round-trips lb display and passes kg through', () => {
    expect(toDisplayWeight(fromDisplayWeight(190, 'lb'), 'lb')).toBe(190);
    expect(fromDisplayWeight(220, 'lb')).toBeCloseTo(99.79, 2);
    expect(toDisplayWeight(100, 'kg')).toBe(100);
    expect(toDisplayWeight(null, 'lb')).toBeNull();
    expect(unitOf(find('pulley_row'))).toBe('lb');
    expect(unitOf(find('bench'))).toBe('kg');
  });
});
