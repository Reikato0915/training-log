import { describe, it, expect } from 'vitest';
import {
  weekStart, exerciseTotals, weeklyMuscleStats, weekDelta, bestE1RM, nextSplit, recentWeeks,
} from '../src/aggregate.js';

const session = (date, exercises, extra = {}) => ({ id: date, date, split: 'push', memo: '', exercises, ...extra });

describe('weekStart', () => {
  it('returns the Monday of the week', () => {
    expect(weekStart('2026-10-22')).toBe('2026-10-19'); // 木
    expect(weekStart('2026-10-19')).toBe('2026-10-19'); // 月
    expect(weekStart('2026-10-25')).toBe('2026-10-19'); // 日
  });

  it('crosses month boundaries', () => {
    expect(weekStart('2026-03-01')).toBe('2026-02-23');
  });
});

describe('exerciseTotals', () => {
  it('sums weight×reps and counts sets', () => {
    const t = exerciseTotals({ exId: 'bench', sets: [{ w: 100, reps: 8 }, { w: 90, reps: 10 }] });
    expect(t).toEqual({ sets: 2, volume: 1700 });
  });

  it('does not count failed (0 rep) attempts as sets', () => {
    const t = exerciseTotals({ exId: 'bench', sets: [{ w: 140, reps: 0 }, { w: 110, reps: 8 }] });
    expect(t).toEqual({ sets: 1, volume: 880 });
  });

  it('counts sets with unknown reps but adds no volume', () => {
    const t = exerciseTotals({ exId: 'leg_ext', sets: [{ w: 140, reps: null }, { w: 140, reps: null }] });
    expect(t).toEqual({ sets: 2, volume: 0 });
  });

  it('includes assisted reps (extra) in volume', () => {
    const t = exerciseTotals({ exId: 'bench', sets: [{ w: 100, reps: 6, extra: 1 }] });
    expect(t.volume).toBe(700);
  });

  it('adds bodyweight for bodyweight exercises', () => {
    const t = exerciseTotals({ exId: 'chinning', sets: [{ w: 10, reps: 5 }] }, [], 75);
    expect(t.volume).toBe(425);
  });

  it('treats missing weight on bodyweight exercise as bodyweight only', () => {
    const t = exerciseTotals({ exId: 'dips', sets: [{ w: null, reps: 10 }] }, [], 70);
    expect(t.volume).toBe(700);
  });
});

describe('weeklyMuscleStats', () => {
  const sessions = [
    session('2026-10-19', [{ exId: 'bench', sets: [{ w: 100, reps: 10 }, { w: 100, reps: 10 }] }]),
    session('2026-10-21', [{ exId: 'side_raise', sets: [{ w: 10, reps: 15 }] }]),
    session('2026-10-12', [{ exId: 'bench', sets: [{ w: 100, reps: 8 }] }]),
  ];

  it('credits primary muscles fully and secondary at half', () => {
    const stats = weeklyMuscleStats(sessions)['2026-10-19'];
    expect(stats.chest_mid).toEqual({ sets: 2, volume: 2000 });
    expect(stats.triceps).toEqual({ sets: 1, volume: 1000 });
    expect(stats.delt_side).toEqual({ sets: 1, volume: 150 });
  });

  it('groups sessions by week', () => {
    const stats = weeklyMuscleStats(sessions);
    expect(stats['2026-10-12'].chest_mid).toEqual({ sets: 1, volume: 800 });
  });

  it('ignores deleted sessions and unknown exercises', () => {
    const stats = weeklyMuscleStats([
      session('2026-10-19', [{ exId: 'bench', sets: [{ w: 100, reps: 10 }] }], { deleted: true }),
      session('2026-10-20', [{ exId: 'nope', sets: [{ w: 1, reps: 1 }] }]),
    ]);
    expect(stats['2026-10-19']).toEqual({});
  });

  it('accepts bodyweight as a function of date', () => {
    const stats = weeklyMuscleStats([session('2026-10-19', [{ exId: 'chinning', sets: [{ w: 0, reps: 10 }] }])], [], (d) => (d === '2026-10-19' ? 80 : 0));
    expect(stats['2026-10-19'].lat_upper.volume).toBe(800);
  });

  it('uses custom exercises', () => {
    const custom = [{ id: 'c1', name: 'x', split: 'pull', primary: ['biceps'], secondary: [], bodyweight: false }];
    const stats = weeklyMuscleStats([session('2026-10-19', [{ exId: 'c1', sets: [{ w: 20, reps: 10 }] }])], custom);
    expect(stats['2026-10-19'].biceps).toEqual({ sets: 1, volume: 200 });
  });
});

describe('weekDelta', () => {
  it('returns ratio change from previous week', () => {
    expect(weekDelta(12, 10)).toBeCloseTo(0.2);
    expect(weekDelta(8, 10)).toBeCloseTo(-0.2);
  });

  it('returns null when previous is zero', () => {
    expect(weekDelta(5, 0)).toBeNull();
  });
});

describe('recentWeeks', () => {
  it('lists N week starts ending at the given week', () => {
    expect(recentWeeks('2026-10-19', 3)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);
  });
});

describe('bestE1RM', () => {
  it('uses Epley on the best set within 1-12 reps', () => {
    expect(bestE1RM([{ w: 100, reps: 10 }, { w: 120, reps: 1 }])).toBeCloseTo(133.33, 1);
  });

  it('returns null when no usable set', () => {
    expect(bestE1RM([{ w: 100, reps: 0 }, { w: 50, reps: 20 }, { w: null, reps: 5 }])).toBeNull();
  });
});

describe('nextSplit', () => {
  it('follows push → pull → legs1 → legs2 → push', () => {
    const s = (date, split) => ({ id: date, date, split, exercises: [] });
    expect(nextSplit([s('2026-10-01', 'push'), s('2026-10-02', 'pull')])).toBe('legs1');
    expect(nextSplit([s('2026-10-01', 'legs2')])).toBe('push');
    expect(nextSplit([])).toBe('push');
  });

  it('skips "other" sessions when deciding', () => {
    const s = (date, split) => ({ id: date, date, split, exercises: [] });
    expect(nextSplit([s('2026-10-01', 'pull'), s('2026-10-02', 'other')])).toBe('legs1');
  });
});
