// 旧メモの重量のうち lb 表記だったもの（2026-10-22 ユーザー確認済みのルール）を kg に換算する。
import { LB_TO_KG } from '../src/catalog.js';

const maxW = (entry) => Math.max(0, ...entry.sets.map((s) => s.w ?? 0));

// [種目, 判定] 判定が true の記録は lb として扱う
const RULES = [
  [['leg_ext', 'ih_leg_ext'], (e) => maxW(e) >= 130],
  [['adduction', 'abduction'], () => true],
  [['lying_leg_curl', 'seated_leg_curl'], (e, date) => date.startsWith('2026-01') && maxW(e) >= 90],
  [['upright_row', 'pushdown'], (e) => maxW(e) >= 50],
  [['mid_row'], () => true],
  [['calf_raise'], (e) => maxW(e) >= 250],
  [['leg_press'], (e) => maxW(e) >= 280],
];

export function isLbEntry(entry, date) {
  if (entry.unit) return false; // 既に単位が確定している（プーリーロウ・lb明記）
  return RULES.some(([ids, test]) => ids.includes(entry.exId) && test(entry, date));
}

const toKg = (w) => (w == null ? w : Math.round(w * LB_TO_KG * 100) / 100);

/** @returns {{ sessions: object[], converted: {date:string, exId:string}[] }} */
export function applyUnitRules(sessions) {
  const converted = [];
  const next = sessions.map((s) => ({
    ...s,
    exercises: s.exercises.map((e) => {
      if (!isLbEntry(e, s.date)) return e;
      converted.push({ date: s.date, exId: e.exId });
      return { ...e, unit: 'lb', sets: e.sets.map((x) => ({ ...x, w: toKg(x.w) })) };
    }),
  }));
  return { sessions: next, converted };
}
