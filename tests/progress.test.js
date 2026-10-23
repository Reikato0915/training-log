import { describe, it, expect } from 'vitest';
import { compareExercise, sessionProgress, latestBySplit } from '../src/progress.js';

const set = (w, reps, extra = {}) => ({ w, reps, ...extra });

describe('compareExercise', () => {
  it('detects a new top weight', () => {
    const r = compareExercise([set(105, 5)], [set(100, 8)]);
    expect(r.maxWeight).toEqual({ now: 105, prev: 100, up: true });
  });

  it('detects more reps at a weight used both times', () => {
    const r = compareExercise([set(100, 9), set(90, 8)], [set(100, 8), set(90, 10)]);
    expect(r.repsAtWeight).toEqual({ up: true, w: 100, now: 9, prev: 8 });
  });

  it('detects higher total load (weight × reps × sets)', () => {
    const r = compareExercise([set(100, 8), set(100, 8), set(100, 8)], [set(100, 8), set(100, 8)]);
    expect(r.volume).toEqual({ now: 2400, prev: 1600, up: true });
    expect(r.any).toBe(true);
  });

  it('reports no progress when everything matches or drops', () => {
    const r = compareExercise([set(100, 8)], [set(100, 8)]);
    expect([r.maxWeight.up, r.repsAtWeight.up, r.volume.up, r.any]).toEqual([false, false, false, false]);
  });

  it('uses the better side for reps and both sides for load', () => {
    const r = compareExercise([set(20, 10, { repsR: 12 })], [set(20, 11, { repsR: 11 })]);
    expect(r.repsAtWeight.up).toBe(true);
    expect(r.volume.up).toBe(false);
  });

  it('returns null without a previous record', () => {
    expect(compareExercise([set(100, 8)], null)).toBeNull();
  });
});

describe('sessionProgress', () => {
  const sessions = [
    { id: 'a', date: '2026-10-15', split: 'push', exercises: [{ exId: 'bench', sets: [set(100, 8)] }, { exId: 'dips', sets: [set(10, 8)] }] },
    { id: 'b', date: '2026-10-22', split: 'push', exercises: [{ exId: 'bench', sets: [set(102.5, 6)] }, { exId: 'dips', sets: [set(10, 8)] }, { exId: 'pec_fly', sets: [set(60, 10)] }] },
  ];

  it('compares each exercise with its previous performance', () => {
    const r = sessionProgress(sessions, sessions[1]);
    expect(r.items.map((i) => [i.exId, i.result?.any ?? null])).toEqual([['bench', true], ['dips', false], ['pec_fly', null]]);
    expect(r.improved).toBe(1);
    expect(r.compared).toBe(2);
  });

  it('finds the latest session for each split', () => {
    expect(latestBySplit(sessions).push.id).toBe('b');
  });
});
