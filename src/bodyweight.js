// 体重記録（日付ごと1件）と身長。集計は純粋関数。
import { weekStart } from './aggregate.js';

const MIN_KG = 20;
const MAX_KG = 300;
const now = () => new Date().toISOString();

export const activeWeights = (data) =>
  (data.bodyweights ?? []).filter((w) => !w.deleted).sort((a, b) => a.date.localeCompare(b.date));

export function validWeight(kg) {
  const n = Number(kg);
  if (!Number.isFinite(n) || n < MIN_KG || n > MAX_KG) throw new Error(`体重は ${MIN_KG}〜${MAX_KG} kg で入力してください`);
  return Math.round(n * 10) / 10;
}

/** 日付ごとに1件（id = 日付）。同じ日は上書き */
export function upsertWeight(data, date, kg) {
  const entry = { id: date, date, kg: validWeight(kg), updatedAt: now() };
  const list = data.bodyweights ?? [];
  const exists = list.some((w) => w.id === date);
  return { ...data, bodyweights: exists ? list.map((w) => (w.id === date ? entry : w)) : [...list, entry] };
}

export const deleteWeight = (data, date) => ({
  ...data,
  bodyweights: (data.bodyweights ?? []).map((w) => (w.id === date ? { ...w, deleted: true, updatedAt: now() } : w)),
});

/** date 以前で最も新しい体重。無ければ fallback */
export function weightAt(data, date, fallback) {
  const hit = activeWeights(data).filter((w) => w.date <= date).at(-1);
  return hit?.kg ?? fallback;
}

/** { 週初日: 平均kg } */
export function weeklyAverages(weights) {
  const groups = weights.reduce((acc, w) => {
    const wk = weekStart(w.date);
    return { ...acc, [wk]: [...(acc[wk] ?? []), w.kg] };
  }, {});
  return Object.fromEntries(Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([wk, v]) => [wk, Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100]));
}

const toISODate = (raw) => {
  const m = String(raw).trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null;
};

/** CSV のバイト列を文字列に（UTF-8 で読めなければ Shift_JIS。体組成計アプリの書き出しに多い） */
export function decodeCSV(buffer) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('shift_jis').decode(buffer);
  }
}

const splitRow = (line) => line.split(/[,\t;]/).map((c) => c.trim().replace(/^"|"$/g, ''));
const isTime = (v) => /^\d{1,2}:\d{2}/.test(v);
const padTime = (v) => (isTime(v) ? v.padStart(5, '0') : '');
const findCol = (header, re) => header.findIndex((c) => re.test(c));

/**
 * CSV を読む。「日付,体重」のほか、見出しに「体重」列がある書き出し（例：ECLEAR の 年月日,時刻,体重,…）にも対応。
 * 同じ日に複数あれば最も早い時刻（朝）の値を使う。
 * @returns {{ rows: {date:string, kg:number}[], errors: string[] }}
 */
export function parseWeightCSV(text) {
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/);
  const firstIdx = lines.findIndex((l) => l.trim());
  const header = firstIdx >= 0 ? splitRow(lines[firstIdx]) : [];
  const hasHeader = header.length > 0 && !toISODate(header[0]);
  const cols = {
    date: hasHeader ? Math.max(0, findCol(header, /年月日|日付|date/i)) : 0,
    time: hasHeader ? findCol(header, /時刻|time/i) : -1,
    kg: hasHeader ? findCol(header, /体重|weight/i) : -1,
  };

  const best = new Map();
  const errors = [];
  lines.forEach((line, i) => {
    if (!line.trim() || (hasHeader && i === firstIdx)) return;
    const cells = splitRow(line);
    const date = toISODate(cells[cols.date] ?? '');
    if (!date) { errors.push(`${i + 1}行目: 日付が読めません（${line.slice(0, 30)}）`); return; }
    const raw = cols.kg >= 0 ? cells[cols.kg] : cells.find((c, j) => j !== cols.date && c && !isTime(c));
    try {
      const kg = validWeight(String(raw ?? '').replace(/kg$/i, ''));
      const time = padTime(cols.time >= 0 ? cells[cols.time] : (cells.find(isTime) ?? ''));
      const prev = best.get(date);
      if (!prev || time < prev.time) best.set(date, { date, kg, time });
    } catch (err) {
      errors.push(`${i + 1}行目: ${err.message}`);
    }
  });
  const rows = [...best.values()].sort((a, b) => a.date.localeCompare(b.date)).map(({ date, kg }) => ({ date, kg }));
  return { rows, errors };
}

export const importWeights = (data, rows) => rows.reduce((acc, r) => upsertWeight(acc, r.date, r.kg), data);

/** 身長（cm）。プロフィールは同期対象 */
export function setHeight(data, cm) {
  const n = Number(cm);
  if (!Number.isFinite(n) || n < 100 || n > 250) throw new Error('身長は 100〜250 cm で入力してください');
  return { ...data, profile: { ...(data.profile ?? {}), height: Math.round(n * 10) / 10, updatedAt: now() } };
}

export const bmi = (kg, heightCm) => (kg && heightCm ? Math.round((kg / (heightCm / 100) ** 2) * 10) / 10 : null);
