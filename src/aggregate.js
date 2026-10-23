import { findExercise } from './catalog.js';

export const SECONDARY_WEIGHT = 0.5;
const SPLIT_CYCLE = ['push', 'pull', 'legs1', 'legs2'];
const E1RM_MAX_REPS = 12;
const DAY_MS = 86400000;

const toUTC = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const toISO = (ms) => new Date(ms).toISOString().slice(0, 10);

// 月曜始まりの週の初日（YYYY-MM-DD）
export function weekStart(iso) {
  const t = toUTC(iso);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // 月=0
  return toISO(t - dow * DAY_MS);
}

export const addDays = (iso, n) => toISO(toUTC(iso) + n * DAY_MS);

export const recentWeeks = (lastWeek, n) =>
  Array.from({ length: n }, (_, i) => addDays(lastWeek, (i - n + 1) * 7));

// 左右別種目は reps=左, repsR=右。左右1組で1セット、負荷量は左右の合計レップで計算
const totalReps = (set) => (set.reps ?? 0) + (set.repsR ?? 0) + (set.extra ?? 0);
const isCountedSet = (set) => !(set.reps === 0 && (set.repsR ?? 0) === 0);
const repsKnown = (set) => set.reps != null || set.repsR != null;
// 推定1RMは左右のうち多い方のレップで計算
const e1rmReps = (set) => Math.max(set.reps ?? 0, set.repsR ?? 0) + (set.extra ?? 0);

function setLoad(set, bodyweight, isBodyweight) {
  const w = (set.w ?? 0) + (isBodyweight ? bodyweight : 0);
  return repsKnown(set) ? w * totalReps(set) : 0;
}

/** 種目1つ分の合計セット数と総負荷量（kg×rep） */
export function exerciseTotals(entry, custom = [], bodyweight = 0) {
  const isBw = Boolean(findExercise(entry.exId, custom)?.bodyweight);
  return entry.sets.reduce(
    (acc, set) => (isCountedSet(set)
      ? { sets: acc.sets + 1, volume: acc.volume + setLoad(set, bodyweight, isBw) }
      : acc),
    { sets: 0, volume: 0 },
  );
}

function addTo(stats, muscle, sets, volume) {
  const prev = stats[muscle] ?? { sets: 0, volume: 0 };
  return { ...stats, [muscle]: { sets: prev.sets + sets, volume: prev.volume + volume } };
}

/** { 週初日: { 部位id: { sets, volume } } } 主動筋1.0／協働筋0.5で按分。bodyweight は数値か (date) => 数値 */
export function weeklyMuscleStats(sessions, custom = [], bodyweight = 0) {
  const bwFor = typeof bodyweight === 'function' ? bodyweight : () => bodyweight;
  return sessions.reduce((weeks, s) => {
    const wk = weekStart(s.date);
    let stats = weeks[wk] ?? {};
    if (!s.deleted) {
      for (const entry of s.exercises) {
        const def = findExercise(entry.exId, custom);
        if (!def) continue;
        const { sets, volume } = exerciseTotals(entry, custom, bwFor(s.date));
        if (!sets) continue;
        for (const m of def.primary) stats = addTo(stats, m, sets, volume);
        for (const m of def.secondary) stats = addTo(stats, m, sets * SECONDARY_WEIGHT, volume * SECONDARY_WEIGHT);
      }
    }
    return { ...weeks, [wk]: stats };
  }, {});
}

export const weekDelta = (current, previous) => (previous > 0 ? (current - previous) / previous : null);

/** Epley式 推定1RM。1〜12repのセットのみ対象 */
export function bestE1RM(sets) {
  const values = sets
    .filter((s) => s.w > 0 && e1rmReps(s) >= 1 && e1rmReps(s) <= E1RM_MAX_REPS)
    .map((s) => s.w * (1 + e1rmReps(s) / 30));
  return values.length ? Math.max(...values) : null;
}

/** 直近の分割から次の分割を提案 */
export function nextSplit(sessions) {
  const last = [...sessions]
    .filter((s) => !s.deleted && SPLIT_CYCLE.includes(s.split))
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
  if (!last) return SPLIT_CYCLE[0];
  return SPLIT_CYCLE[(SPLIT_CYCLE.indexOf(last.split) + 1) % SPLIT_CYCLE.length];
}

/** 指定種目の直近記録（date より前） */
export function lastPerformance(sessions, exId, beforeDate) {
  const hit = [...sessions]
    .filter((s) => !s.deleted && s.date < beforeDate)
    .sort((a, b) => b.date.localeCompare(a.date))
    .flatMap((s) => s.exercises.filter((e) => e.exId === exId).map((e) => ({ date: s.date, sets: e.sets, unit: e.unit, sided: e.sided })))
    .at(0);
  return hit ?? null;
}

/** 種目別：週ごとのベスト推定1RM */
export function weeklyE1RM(sessions, weeks) {
  const inWeeks = new Set(weeks);
  return sessions.reduce((acc, s) => {
    const wk = weekStart(s.date);
    if (s.deleted || !inWeeks.has(wk)) return acc;
    let next = acc;
    for (const e of s.exercises) {
      const v = bestE1RM(e.sets);
      if (v == null) continue;
      const row = next[e.exId] ?? {};
      next = { ...next, [e.exId]: { ...row, [wk]: Math.max(row[wk] ?? 0, v) } };
    }
    return next;
  }, {});
}

/** 同じ分割で date より前の最新記録（種目があるもの） */
export function lastSessionOfSplit(sessions, split, beforeDate) {
  return [...sessions]
    .filter((s) => !s.deleted && s.split === split && s.date < beforeDate && s.exercises.length)
    .sort((a, b) => b.date.localeCompare(a.date))
    .at(0) ?? null;
}

/** 前回記録の種目・セットを複製（メモは引き継がない） */
export const copyExercises = (session) => session.exercises.map((e) => ({
  exId: e.exId,
  ...(e.unit ? { unit: e.unit } : {}),
  ...(e.sided != null ? { sided: e.sided } : {}),
  memo: '',
  sets: e.sets.map((s) => ({ ...s })),
}));
