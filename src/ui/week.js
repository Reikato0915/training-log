// 週ダッシュボード：部位別セット数・総負荷量・前週比・8週推移、種目別推定1RM
import { MUSCLES, findExercise } from '../catalog.js';
import { weeklyMuscleStats, weekStart, recentWeeks, weekDelta, weeklyE1RM, addDays } from '../aggregate.js';
import { activeCustom } from '../store.js';
import { weightAt } from '../bodyweight.js';
import { h, svg, fmtKg, fmtSets, fmtDate, toast } from './dom.js';

const TREND_WEEKS = 8;
const REGIONS = [['push', 'PUSH'], ['pull', 'PULL'], ['legs', 'LEGS・体幹']];

function deltaBadge(delta) {
  if (delta == null) return h('span', { class: 'delta none' }, '—');
  const pct = Math.round(delta * 100);
  const cls = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '±';
  return h('span', { class: `delta ${cls}` }, `${arrow}${Math.abs(pct)}%`);
}

function sparkline(values, label) {
  const W = 72; const H = 22; const gap = 2;
  const max = Math.max(...values, 1);
  const bw = (W - gap * (values.length - 1)) / values.length;
  return svg('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'spark', role: 'img', 'aria-label': label },
    values.map((v, i) => svg('rect', {
      x: (i * (bw + gap)).toFixed(1), y: (H - (v / max) * H).toFixed(1),
      width: bw.toFixed(1), height: Math.max((v / max) * H, v > 0 ? 1.5 : 0.5).toFixed(1),
      class: i === values.length - 1 ? 'bar now' : 'bar',
    })));
}

export function buildWeekMarkdown(week, stats, prev) {
  const lines = [`## 週 ${week}〜${addDays(week, 6)}`, '', '| 部位 | セット | 前週比 | 総負荷量(kg) | 前週比 |', '|---|---:|---:|---:|---:|'];
  const pct = (d) => (d == null ? '—' : `${d >= 0 ? '+' : ''}${Math.round(d * 100)}%`);
  for (const m of MUSCLES) {
    const cur = stats[m.id]; if (!cur) continue;
    const p = prev[m.id] ?? { sets: 0, volume: 0 };
    lines.push(`| ${m.name} | ${fmtSets(cur.sets)} | ${pct(weekDelta(cur.sets, p.sets))} | ${Math.round(cur.volume)} | ${pct(weekDelta(cur.volume, p.volume))} |`);
  }
  return lines.join('\n');
}

export function renderWeek(ctx) {
  const { data, settings } = ctx.state;
  const custom = activeCustom(data);
  const week = ctx.state.week ?? weekStart(ctx.state.date);
  const weeks = recentWeeks(week, TREND_WEEKS);
  const all = weeklyMuscleStats(data.sessions, custom, (d) => weightAt(data, d, settings.bodyweight));
  const stats = all[week] ?? {};
  const prev = all[addDays(week, -7)] ?? {};
  const metric = ctx.state.metric ?? 'sets';

  const totalSets = Object.values(stats).reduce((a, s) => a + s.sets, 0);
  const sessionsInWeek = data.sessions.filter((s) => !s.deleted && weekStart(s.date) === week && s.exercises.length);

  const head = h('section', { class: 'week-head' },
    h('div', { class: 'date-nav' },
      h('button', { class: 'icon-btn', 'aria-label': '前週', onclick: () => ctx.setWeek(addDays(week, -7)) }, '‹'),
      h('div', { class: 'week-title' }, h('span', { class: 'date-big' }, `${fmtDate(week).replace(/\(.\)/, '')}〜${fmtDate(addDays(week, 6)).replace(/\(.\)/, '')}`),
        h('span', { class: 'week-sub' }, `${sessionsInWeek.length} 回 · 計 ${fmtSets(totalSets)} 部位セット`)),
      h('button', { class: 'icon-btn', 'aria-label': '翌週', onclick: () => ctx.setWeek(addDays(week, 7)) }, '›')),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': '推移グラフの指標' },
      [['sets', 'セット数'], ['volume', '総負荷量']].map(([k, label]) => h('button', {
        class: metric === k ? 'on' : '', role: 'radio', 'aria-checked': String(metric === k), onclick: () => ctx.setMetric(k),
      }, label))));

  const regionBlocks = REGIONS.map(([region, title]) => {
    const rows = MUSCLES.filter((m) => m.region === region).map((m) => {
      const cur = stats[m.id] ?? { sets: 0, volume: 0 };
      const p = prev[m.id] ?? { sets: 0, volume: 0 };
      const trend = weeks.map((w) => all[w]?.[m.id]?.[metric] ?? 0);
      return h('tr', { class: cur.sets ? '' : 'idle' },
        h('th', { scope: 'row' }, m.name),
        h('td', { class: 'n' }, fmtSets(cur.sets), deltaBadge(weekDelta(cur.sets, p.sets))),
        h('td', { class: 'n' }, cur.volume ? fmtKg(cur.volume) : '—', deltaBadge(weekDelta(cur.volume, p.volume))),
        h('td', { class: 'trend' }, sparkline(trend, `${m.name}の${TREND_WEEKS}週推移`)));
    });
    return h('section', { class: `region region-${region}` },
      h('h2', {}, title),
      h('table', { class: 'muscle-table' },
        h('thead', {}, h('tr', {}, h('th', {}, '部位'), h('th', {}, 'セット'), h('th', {}, '総負荷量'), h('th', {}, `${TREND_WEEKS}週`))),
        h('tbody', {}, rows)));
  });

  const e1rm = weeklyE1RM(data.sessions, weeks);
  const doneIds = [...new Set(sessionsInWeek.flatMap((s) => s.exercises.map((e) => e.exId)))];
  const e1rmRows = doneIds.map((id) => {
    const row = e1rm[id] ?? {};
    const now = row[week];
    const before = weeks.slice(0, -1).reverse().map((w) => row[w]).find((v) => v != null);
    if (now == null) return null;
    return h('li', {},
      h('span', { class: 'e1rm-name' }, findExercise(id, custom)?.name ?? id),
      h('span', { class: 'n' }, `${now.toFixed(1)} kg`),
      deltaBadge(before ? weekDelta(now, before) : null));
  }).filter(Boolean);

  const copy = h('button', {
    class: 'text-btn', onclick: async () => {
      const md = buildWeekMarkdown(week, stats, prev);
      try {
        if (navigator.share) await navigator.share({ text: md });
        else { await navigator.clipboard.writeText(md); toast('Markdown をコピーしました'); }
      } catch (err) {
        if (err?.name !== 'AbortError') toast('共有できませんでした');
      }
    },
  }, 'Obsidian 用 Markdown を共有');

  return h('div', { class: 'view-week' }, head, regionBlocks,
    h('section', { class: 'region e1rm' },
      h('h2', {}, '推定1RM（Epley）前回比'),
      e1rmRows.length ? h('ul', { class: 'e1rm-list' }, e1rmRows) : h('p', { class: 'muted' }, '1〜12rep のセットがあると表示されます')),
    h('p', { class: 'note' }, 'セット数は主動筋1.0／協働筋0.5で按分。総負荷量＝重量×レップ（自重種目は体重を加算）。'),
    copy);
}
