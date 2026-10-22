import { describe, it, expect } from 'vitest';
import { applyOverrides } from '../tools/overrides.js';

describe('applyOverrides', () => {
  it('replaces confirmed sets and adds missing entries', () => {
    const { sessions, applied } = applyOverrides([
      { date: '2026-04-17', exercises: [{ exId: 'chinning', sets: [] }] },
      { date: '2026-07-16', exercises: [] },
      { date: '2026-07-17', exercises: [{ exId: 'chinning', sets: [{ w: 1, reps: 1 }] }] },
    ]);
    expect(sessions[0].exercises[0].sets.at(-1)).toEqual({ w: 0, reps: 10 });
    expect(sessions[1].exercises[0]).toMatchObject({ exId: 'ih_leg_ext', unit: 'lb' });
    expect(sessions[1].exercises[0].sets).toHaveLength(4);
    expect(sessions[2].exercises[0].sets).toEqual([{ w: 1, reps: 1 }]);
    expect(applied).toHaveLength(2);
  });
});
