import { describe, it, expect } from 'vitest';
import { applyUnitRules } from '../tools/unit-rules.js';

const sess = (date, exId, ws, extra = {}) => ({ id: date, date, exercises: [{ exId, sets: ws.map((w) => ({ w, reps: 8 })), ...extra }] });

describe('applyUnitRules', () => {
  it('converts confirmed lb cases to kg and marks unit', () => {
    const { sessions, converted } = applyUnitRules([
      sess('2026-02-19', 'leg_ext', [165, 154]),
      sess('2026-01-05', 'lying_leg_curl', [90, 80]),
      sess('2026-01-05', 'leg_press', [320, 240]),
      sess('2026-03-01', 'adduction', [110]),
    ]);
    expect(converted).toHaveLength(4);
    expect(sessions[0].exercises[0]).toMatchObject({ unit: 'lb', sets: [{ w: 74.84 }, { w: 69.85 }] });
    expect(sessions[2].exercises[0].sets[1].w).toBeCloseTo(108.86, 2);
  });

  it('leaves plausible kg values alone', () => {
    const { converted } = applyUnitRules([
      sess('2026-05-02', 'leg_ext', [102.5]),
      sess('2026-02-04', 'lying_leg_curl', [100]),
      sess('2026-04-07', 'leg_press', [220]),
      sess('2026-04-09', 'pushdown', [35]),
      sess('2026-07-02', 'hack_squat', [190]),
      sess('2026-01-04', 'pulley_row', [86.18], { unit: 'lb' }),
    ]);
    expect(converted).toEqual([]);
  });
});
