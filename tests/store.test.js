import { describe, it, expect } from 'vitest';
import {
  emptyData, upsertSession, deleteSession, mergeData, validateData, sessionForDate, newSession, gymOptions, addGym, removeGym,
} from '../src/store.js';

const s = (id, date, updatedAt, extra = {}) => ({ id, date, split: 'push', memo: '', exercises: [], updatedAt, ...extra });

describe('upsertSession', () => {
  it('adds without mutating the original', () => {
    const data = emptyData();
    const next = upsertSession(data, s('a', '2026-10-22'));
    expect(data.sessions).toHaveLength(0);
    expect(next.sessions).toHaveLength(1);
    expect(next.sessions[0].updatedAt).toBeTruthy();
  });

  it('replaces by id', () => {
    const data = upsertSession(emptyData(), s('a', '2026-10-22'));
    const next = upsertSession(data, { ...data.sessions[0], memo: 'x' });
    expect(next.sessions).toHaveLength(1);
    expect(next.sessions[0].memo).toBe('x');
  });
});

describe('deleteSession', () => {
  it('leaves a tombstone hidden from sessionForDate', () => {
    const data = deleteSession(upsertSession(emptyData(), s('a', '2026-10-22')), 'a');
    expect(data.sessions[0].deleted).toBe(true);
    expect(sessionForDate(data, '2026-10-22')).toBeNull();
  });
});

describe('mergeData', () => {
  it('keeps the newer copy of each session and unions the rest', () => {
    const local = { ...emptyData(), sessions: [s('a', '2026-10-01', '2026-10-01T10:00Z', { memo: 'local' }), s('b', '2026-10-02', 'x')] };
    const remote = { ...emptyData(), sessions: [s('a', '2026-10-01', '2026-10-01T12:00Z', { memo: 'remote' }), s('c', '2026-09-30', 'x')] };
    const merged = mergeData(local, remote);
    expect(merged.sessions.map((x) => x.id)).toEqual(['c', 'a', 'b']);
    expect(merged.sessions.find((x) => x.id === 'a').memo).toBe('remote');
  });

  it('returns local when remote is missing', () => {
    const local = emptyData();
    expect(mergeData(local, null)).toBe(local);
  });
});

describe('validateData', () => {
  it('rejects malformed input', () => {
    expect(() => validateData(null)).toThrow();
    expect(() => validateData({ sessions: [{ id: 1 }] })).toThrow();
  });

  it('fills defaults', () => {
    expect(validateData({ sessions: [] })).toEqual({ version: 1, sessions: [], customExercises: [], gyms: [], bodyweights: [], profile: {} });
  });
});

describe('gyms', () => {
  it('defaults new sessions to パワーハウスジム大阪', () => {
    expect(newSession('2026-10-22', 'push').gym).toBe('パワーハウスジム大阪');
  });

  it('adds, dedupes and removes custom gyms', () => {
    let d = addGym(emptyData(), ' ゴールドジム梅田 ');
    expect(gymOptions(d)).toEqual(['パワーハウスジム大阪', 'パワーハウスジムノース大阪', 'ゴールドジム京都烏丸', 'ゴールドジム梅田']);
    expect(addGym(d, 'パワーハウスジム大阪')).toBe(d);
    expect(() => addGym(d, '')).toThrow();
    d = removeGym(d, d.gyms[0].id);
    expect(gymOptions(d)).toHaveLength(3);
  });
});
