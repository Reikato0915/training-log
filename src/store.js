// 端末内保存（localStorage）と状態の純粋な更新関数。

const DATA_KEY = 'tlog.data.v1';
const SETTINGS_KEY = 'tlog.settings.v1';

export const emptyData = () => ({ version: 1, sessions: [], customExercises: [], gyms: [], bodyweights: [], profile: {} });

export const DEFAULT_GYMS = Object.freeze(['パワーハウスジム大阪', 'パワーハウスジムノース大阪', 'ゴールドジム京都烏丸']);
export const DEFAULT_GYM = DEFAULT_GYMS[0];

export const DEFAULT_SETTINGS = Object.freeze({
  bodyweight: 75,
  repo: 'Reikato0915/training-data',
  path: 'training.json',
  token: '',
  weightStep: 2.5,
  tokenExpires: '',
});

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const loadData = () => ({ ...emptyData(), ...readJSON(DATA_KEY, {}) });
export const saveData = (data) => writeJSON(DATA_KEY, data);
export function loadSettings() {
  const stored = readJSON(SETTINGS_KEY, {});
  return { ...DEFAULT_SETTINGS, ...stored, repo: stored.repo || DEFAULT_SETTINGS.repo };
}
export const saveSettings = (s) => writeJSON(SETTINGS_KEY, s);

export const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const now = () => new Date().toISOString();

export function newSession(date, split, gym = DEFAULT_GYM) {
  return { id: newId(), date, split, gym, memo: '', exercises: [], updatedAt: now() };
}

/** 選択肢に出すジム（既定＋手動追加。削除済みは除く） */
export const gymOptions = (data) =>
  [...DEFAULT_GYMS, ...(data.gyms ?? []).filter((g) => !g.deleted).map((g) => g.name)];

export function addGym(data, name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw new Error('ジム名を入力してください');
  if (gymOptions(data).includes(trimmed)) return data;
  return { ...data, gyms: [...(data.gyms ?? []), { id: newId(), name: trimmed, updatedAt: now() }] };
}

export const removeGym = (data, id) => ({
  ...data,
  gyms: (data.gyms ?? []).map((g) => (g.id === id ? { ...g, deleted: true, updatedAt: now() } : g)),
});

export const sessionForDate = (data, date) =>
  data.sessions.find((s) => s.date === date && !s.deleted) ?? null;

/** session を追加または置き換え（updatedAt を更新） */
export function upsertSession(data, session) {
  const stamped = { ...session, updatedAt: now() };
  const exists = data.sessions.some((s) => s.id === session.id);
  const sessions = exists
    ? data.sessions.map((s) => (s.id === session.id ? stamped : s))
    : [...data.sessions, stamped];
  return { ...data, sessions };
}

// 削除は同期のために墓標（deleted: true）として残す
export const deleteSession = (data, id) => {
  const target = data.sessions.find((s) => s.id === id);
  return target ? upsertSession(data, { ...target, deleted: true, exercises: [] }) : data;
};

export const addCustomExercise = (data, exercise) =>
  ({ ...data, customExercises: [...data.customExercises, { ...exercise, updatedAt: now() }] });

export const removeCustomExercise = (data, id) => ({
  ...data,
  customExercises: data.customExercises.map((e) => (e.id === id ? { ...e, deleted: true, updatedAt: now() } : e)),
});

export const activeCustom = (data) => data.customExercises.filter((e) => !e.deleted);

/** id 単位で updatedAt が新しい方を採用してマージ */
function mergeById(a = [], b = []) {
  const map = new Map(a.map((x) => [x.id, x]));
  for (const item of b) {
    const cur = map.get(item.id);
    if (!cur || (item.updatedAt ?? '') > (cur.updatedAt ?? '')) map.set(item.id, item);
  }
  return [...map.values()];
}

const newer = (a = {}, b = {}) => ((b.updatedAt ?? '') > (a.updatedAt ?? '') ? b : a);

export function mergeData(local, remote) {
  if (!remote) return local;
  return {
    version: 1,
    sessions: mergeById(local.sessions, remote.sessions).sort((x, y) => x.date.localeCompare(y.date)),
    customExercises: mergeById(local.customExercises, remote.customExercises),
    gyms: mergeById(local.gyms, remote.gyms),
    bodyweights: mergeById(local.bodyweights, remote.bodyweights).sort((x, y) => x.date.localeCompare(y.date)),
    profile: newer(local.profile, remote.profile),
  };
}

/** 外部から読んだ JSON の最低限の形チェック */
export function validateData(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('データ形式が不正です');
  if (!Array.isArray(obj.sessions)) throw new Error('sessions がありません');
  for (const s of obj.sessions) {
    if (typeof s.id !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s.date) || !Array.isArray(s.exercises)) {
      throw new Error(`不正なセッション: ${JSON.stringify(s).slice(0, 80)}`);
    }
  }
  return {
    version: 1,
    sessions: obj.sessions,
    customExercises: obj.customExercises ?? [],
    gyms: obj.gyms ?? [],
    bodyweights: Array.isArray(obj.bodyweights) ? obj.bodyweights : [],
    profile: obj.profile ?? {},
  };
}
