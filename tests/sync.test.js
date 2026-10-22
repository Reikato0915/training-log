import { describe, it, expect, vi, afterEach } from 'vitest';
import { syncNow, normalizeRepo, isConfigured } from '../src/sync.js';

const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');
const settings = { token: 't', repo: 'me/data', path: 'training.json' };

function mockGitHub(remote) {
  const state = { remote, sha: 'sha1', puts: [] };
  global.fetch = vi.fn(async (url, opts = {}) => {
    if (opts.method === 'PUT') {
      const body = JSON.parse(opts.body);
      state.puts.push(body);
      state.remote = JSON.parse(Buffer.from(body.content, 'base64').toString('utf8'));
      return { ok: true, status: 200, json: async () => ({ content: { sha: 'sha2' } }) };
    }
    if (state.remote == null) return { ok: url.endsWith('/repos/me/data'), status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => ({ sha: state.sha, content: b64(JSON.stringify(state.remote)) }) };
  });
  return state;
}

afterEach(() => { delete global.fetch; });

describe('syncNow', () => {
  const s = (id, date, memo = '') => ({ id, date, split: 'push', memo, exercises: [], updatedAt: `${date}T00:00:00Z` });

  it('pulls remote history and pushes local additions (UTF-8 safe)', async () => {
    const gh = mockGitHub({ version: 1, sessions: [s('import-1', '2026-01-04', '心斎橋')], customExercises: [] });
    const { data } = await syncNow(settings, { version: 1, sessions: [s('new', '2026-10-22', 'ベンチ')], customExercises: [], gyms: [] });
    expect(data.sessions.map((x) => x.id)).toEqual(['import-1', 'new']);
    expect(gh.puts).toHaveLength(1);
    expect(gh.remote.sessions[1].memo).toBe('ベンチ');
  });

  it('creates the file when missing', async () => {
    const gh = mockGitHub(null);
    await syncNow(settings, { version: 1, sessions: [s('a', '2026-10-22')], customExercises: [], gyms: [] });
    expect(gh.puts[0].sha).toBeUndefined();
  });

  it('reports auth errors in Japanese', async () => {
    global.fetch = vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
    await expect(syncNow(settings, { sessions: [] })).rejects.toThrow('トークンが無効');
  });
});

describe('normalizeRepo', () => {
  it('accepts name only, owner/name or URL', () => {
    expect(normalizeRepo('training-data')).toBe('Reikato0915/training-data');
    expect(normalizeRepo(' Reikato0915/training-data ')).toBe('Reikato0915/training-data');
    expect(normalizeRepo('https://github.com/Reikato0915/training-data.git')).toBe('Reikato0915/training-data');
    expect(isConfigured({ ...settings, repo: normalizeRepo('training-data') })).toBe(true);
  });
});
