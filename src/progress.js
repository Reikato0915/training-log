// 負荷漸増（プログレッシブオーバーロード）の判定。種目ごとに前回の同種目と比べる。
import { exerciseTotals, lastPerformance } from './aggregate.js';

const SPLIT_IDS = ['push', 'pull', 'legs1', 'legs2'];
const bestReps = (s) => Math.max(s.reps ?? 0, s.repsR ?? 0) + (s.extra ?? 0);
const valid = (sets) => sets.filter((s) => s.w != null && (s.reps ?? 0) + (s.repsR ?? 0) > 0);
const maxOf = (xs) => (xs.length ? Math.max(...xs) : null);

function repsByWeight(sets) {
  return valid(sets).reduce((m, s) => m.set(s.w, Math.max(m.get(s.w) ?? 0, bestReps(s))), new Map());
}

/**
 * 今回と前回のセットを比べる。
 * - maxWeight: 最大重量の更新
 * - repsAtWeight: 両日に使った重量のどれかで最大回数を更新
 * - volume: 重量×レップ×セットの合計（トレーニング負荷）の更新
 */
export function compareExercise(nowSets, prevSets, { exId = '', custom = [], bodyweight = 0 } = {}) {
  if (!prevSets) return null;
  const nowW = maxOf(valid(nowSets).map((s) => s.w));
  const prevW = maxOf(valid(prevSets).map((s) => s.w));
  const maxWeight = { now: nowW, prev: prevW, up: nowW != null && prevW != null && nowW > prevW };

  const nowR = repsByWeight(nowSets);
  const prevR = repsByWeight(prevSets);
  const gains = [...nowR].filter(([w, r]) => prevR.has(w) && r > prevR.get(w)).sort((a, b) => b[0] - a[0]);
  const repsAtWeight = gains.length
    ? { up: true, w: gains[0][0], now: gains[0][1], prev: prevR.get(gains[0][0]) }
    : { up: false };

  const vol = (sets) => exerciseTotals({ exId, sets }, custom, bodyweight).volume;
  const volume = { now: vol(nowSets), prev: vol(prevSets), up: false };
  volume.up = volume.now > volume.prev && volume.prev > 0;

  return { maxWeight, repsAtWeight, volume, any: maxWeight.up || repsAtWeight.up || volume.up };
}

/** 1回分の記録の全種目を、それぞれ前回の同種目と比較 */
export function sessionProgress(sessions, session, custom = [], bodyweightAt = () => 0) {
  const items = session.exercises.map((e) => {
    const prev = lastPerformance(sessions, e.exId, session.date);
    return {
      exId: e.exId,
      prevDate: prev?.date ?? null,
      result: compareExercise(e.sets, prev?.sets ?? null, { exId: e.exId, custom, bodyweight: bodyweightAt(session.date) }),
    };
  });
  const compared = items.filter((i) => i.result).length;
  const improved = items.filter((i) => i.result?.any).length;
  return { items, compared, improved };
}

/** 分割ごとの最新記録 */
export function latestBySplit(sessions) {
  return SPLIT_IDS.reduce((acc, split) => {
    const latest = sessions
      .filter((s) => !s.deleted && s.split === split && s.exercises.length)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    return latest ? { ...acc, [split]: latest } : acc;
  }, {});
}
