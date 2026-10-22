// 旧メモで自動解釈できず、ユーザーに確認して確定した記録（2026-10-22）。
import { LB_TO_KG } from '../src/catalog.js';

const lb = (w) => Math.round(w * LB_TO_KG * 100) / 100;
const times = (n, set) => Array.from({ length: n }, () => ({ ...set }));

// 既存の種目記録のセットを置き換える
const REPLACE = {
  '2026-04-17|chinning': [{ w: 45, reps: 0 }, { w: 25, reps: 5 }, { w: 20, reps: 8 }, { w: 10, reps: 10 }, { w: 0, reps: 10 }],
  '2026-01-20|dips': [{ w: 10, reps: 5 }, ...times(4, { w: 0, reps: null })],
  '2026-04-06|pec_fly': [{ w: 60, reps: 9 }, { w: 60, reps: 9 }, { w: 55, reps: 10 }, { w: 55, reps: 9 }],
};

// 種目名が抜けていた行を記録として追加する
const ADD = {
  '2026-07-16': [{ exId: 'ih_leg_ext', unit: 'lb', memo: '', source: '231 8　4set', sets: times(4, { w: lb(231), reps: 8 }) }],
};

/** @returns {{ sessions: object[], applied: string[] }} */
export function applyOverrides(sessions) {
  const applied = [];
  const next = sessions.map((s) => {
    const exercises = s.exercises.map((e) => {
      const sets = REPLACE[`${s.date}|${e.exId}`];
      if (!sets) return e;
      applied.push(`${s.date}|${e.exId}`);
      return { ...e, sets };
    });
    const added = ADD[s.date] ?? [];
    if (added.length) applied.push(`${s.date}|+${added.map((a) => a.exId).join(',')}`);
    return { ...s, exercises: [...exercises, ...added] };
  });
  return { sessions: next, applied };
}
