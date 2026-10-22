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

/**
 * CSV（日付,体重）を読む。見出し行・空行は飛ばす。区切りはカンマ/タブ/セミコロン。
 * @returns {{ rows: {date:string, kg:number}[], errors: string[] }}
 */
export function parseWeightCSV(text) {
  const rows = [];
  const errors = [];
  String(text).replace(/^﻿/, '').split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const [d, w] = line.split(/[,\t;]/).map((c) => c.trim().replace(/^"|"$/g, ''));
    const date = toISODate(d);
    if (!date) {
      if (i > 0) errors.push(`${i + 1}行目: 日付が読めません（${line.slice(0, 30)}）`);
      return;
    }
    try {
      rows.push({ date, kg: validWeight(String(w).replace(/kg$/i, '')) });
    } catch (err) {
      errors.push(`${i + 1}行目: ${err.message}`);
    }
  });
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
