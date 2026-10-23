// 週集計の先頭：分割ごとの最新回で、種目ごとに前回からの負荷漸増を一覧
import { SPLITS, findExercise } from '../catalog.js';
import { sessionProgress, latestBySplit } from '../progress.js';
import { activeCustom } from '../store.js';
import { weightAt } from '../bodyweight.js';
import { h, fmtDate } from './dom.js';

const mark = (on) => h('td', { class: on ? 'pm up' : 'pm' }, on ? '▲' : '・');

export function renderProgressPanel(ctx) {
  const { data, settings } = ctx.state;
  const custom = activeCustom(data);
  const latest = latestBySplit(data.sessions);
  const blocks = SPLITS.filter((sp) => latest[sp.id]).map((sp) => {
    const s = latest[sp.id];
    const p = sessionProgress(data.sessions, s, custom, (d) => weightAt(data, d, settings.bodyweight));
    const rows = p.items.map((it) => h('tr', { class: it.result?.any ? 'hit' : '' },
      h('th', { scope: 'row' }, findExercise(it.exId, custom)?.name ?? it.exId),
      ...(it.result
        ? [mark(it.result.maxWeight.up), mark(it.result.repsAtWeight.up), mark(it.result.volume.up)]
        : [h('td', { class: 'pm first', colSpan: 3 }, '初回')])));
    return h('section', { class: `pp split-${sp.id}` },
      h('button', { class: 'pp-head', onclick: () => ctx.setDate(s.date) },
        h('b', {}, sp.name),
        h('span', {}, fmtDate(s.date)),
        h('span', { class: `pp-score${p.improved ? ' up' : ''}` }, `漸増 ${p.improved}/${p.compared}種目`)),
      h('table', { class: 'pp-table' },
        h('thead', {}, h('tr', {}, h('th', {}, '種目'), h('th', {}, '最大重量'), h('th', {}, '同重量回数'), h('th', {}, '総負荷'))),
        h('tbody', {}, rows)));
  });
  return h('section', { class: 'region progress-panel' },
    h('h2', {}, '負荷漸増チェック（各分割の最新回 vs 各種目の前回）'),
    blocks.length ? blocks : h('p', { class: 'muted' }, '記録がたまると表示されます'));
}
