// 体重：日々の入力、日次＋週平均グラフ、CSV一括取り込み
import {
  activeWeights, upsertWeight, deleteWeight, decodeCSV, weeklyAverages, parseWeightCSV, importWeights, bmi,
} from '../bodyweight.js';
import { weekStart, addDays } from '../aggregate.js';
import { h, svg, fmtDate, todayISO, toast } from './dom.js';

const RANGES = [[4, '4週'], [12, '12週'], [26, '半年'], [0, '全期間']];
const STEP = 0.1;
const LIST_COUNT = 14;

function renderChart(weights, rangeWeeks) {
  const last = todayISO();
  const rangeStart = rangeWeeks ? addDays(weekStart(last), -7 * (rangeWeeks - 1)) : '';
  const from = [rangeStart, weights[0]?.date ?? ''].sort().at(-1);
  const pts = weights.filter((w) => w.date >= from);
  if (pts.length < 2) return h('p', { class: 'muted' }, 'グラフは2日分以上の記録で表示されます');

  const avgs = Object.entries(weeklyAverages(pts)).map(([wk, kg]) => ({ date: addDays(wk, 3), kg }));
  const W = 340; const H = 180; const L = 34; const R = 8; const T = 10; const B = 22;
  const t0 = Date.parse(from); const t1 = Math.max(Date.parse(last), Date.parse(pts.at(-1).date));
  const all = [...pts.map((p) => p.kg), ...avgs.map((a) => a.kg)];
  const lo = Math.floor(Math.min(...all) - 0.5); const hi = Math.ceil(Math.max(...all) + 0.5);
  const x = (d) => L + ((Date.parse(d) - t0) / Math.max(t1 - t0, 1)) * (W - L - R);
  const y = (kg) => T + (1 - (kg - lo) / (hi - lo)) * (H - T - B);
  const step = Math.max(1, Math.ceil((hi - lo) / 4));
  const ticks = [];
  for (let v = lo; v <= hi; v += step) ticks.push(v);

  const label = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  return svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'wchart', role: 'img', 'aria-label': `体重の推移 ${label(from)}〜${label(last)}` },
    ticks.map((v) => [
      svg('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'grid' }),
      svg('text', { x: L - 6, y: y(v) + 3, 'text-anchor': 'end', class: 'axis' }, document.createTextNode(String(v))),
    ]),
    svg('text', { x: L, y: H - 6, class: 'axis' }, document.createTextNode(label(from))),
    svg('text', { x: W - R, y: H - 6, 'text-anchor': 'end', class: 'axis' }, document.createTextNode(label(last))),
    pts.map((p) => svg('circle', { cx: x(p.date).toFixed(1), cy: y(p.kg).toFixed(1), r: 2.4, class: 'daily' })),
    svg('polyline', { points: avgs.map((a) => `${x(a.date).toFixed(1)},${y(a.kg).toFixed(1)}`).join(' '), class: 'avg' }),
    avgs.map((a) => svg('circle', { cx: x(a.date).toFixed(1), cy: y(a.kg).toFixed(1), r: 3.5, class: 'avg-pt' })));
}

export function renderWeight(ctx) {
  const { data } = ctx.state;
  const weights = activeWeights(data);
  const latest = weights.at(-1);
  const date = ctx.state.weightDate ?? todayISO();
  const onDate = weights.find((w) => w.date === date);
  const avgs = weeklyAverages(weights);
  const thisWk = avgs[weekStart(todayISO())];
  const prevWk = avgs[addDays(weekStart(todayISO()), -7)];
  const height = data.profile?.height;

  const input = h('input', {
    class: 'num', type: 'text', inputMode: 'decimal', value: onDate?.kg ?? latest?.kg ?? '', placeholder: 'kg', 'aria-label': '体重 kg',
    onfocus: (e) => e.target.select(),
  });
  const bump = (d) => () => { input.value = (Math.round(((Number(input.value) || 0) + d) * 10) / 10).toFixed(1); };
  const save = () => {
    try {
      ctx.commit(upsertWeight(ctx.state.data, date, input.value.replace(',', '.')));
      toast(`${fmtDate(date)} ${input.value} kg を記録しました`);
    } catch (err) {
      toast(err.message);
    }
  };

  const fileInput = h('input', {
    type: 'file', accept: '.csv,text/csv,text/plain', hidden: true, onchange: async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const { rows, errors } = parseWeightCSV(decodeCSV(await file.arrayBuffer()));
      if (!rows.length) { toast(errors[0] ?? '読み込める行がありません'); return; }
      const msg = `${rows.length} 件を取り込みます（同じ日付は上書き）${errors.length ? `\n読めなかった行 ${errors.length} 件:\n${errors.slice(0, 5).join('\n')}` : ''}`;
      if (confirm(msg)) ctx.commit(importWeights(ctx.state.data, rows));
      e.target.value = '';
    },
  });

  const delta = thisWk && prevWk ? Math.round((thisWk - prevWk) * 10) / 10 : null;

  return h('div', { class: 'view-weight' },
    h('section', { class: 'settings-block' },
      h('div', { class: 'weight-entry' },
        h('label', { class: 'field' }, h('span', {}, '日付'),
          h('input', { type: 'date', value: date, onchange: (e) => e.target.value && ctx.setWeightDate(e.target.value) })),
        h('div', { class: 'stepper' },
          h('button', { class: 'step', 'aria-label': '0.1kg減らす', onclick: bump(-STEP) }, '−'),
          input,
          h('button', { class: 'step', 'aria-label': '0.1kg増やす', onclick: bump(STEP) }, '+')),
        h('button', { class: 'primary', onclick: save }, onDate ? '更新' : '記録'))),

    h('div', { class: 'weight-stats' },
      h('div', { class: 'stat' }, h('span', {}, '最新'), h('b', {}, latest ? `${latest.kg}` : '—'), h('span', {}, latest ? fmtDate(latest.date) : '')),
      h('div', { class: 'stat' }, h('span', {}, '今週平均'), h('b', {}, thisWk ? thisWk.toFixed(1) : '—'),
        h('span', {}, delta == null ? '前週比 —' : `前週比 ${delta > 0 ? '+' : ''}${delta}`)),
      h('div', { class: 'stat' }, h('span', {}, 'BMI'), h('b', {}, bmi(latest?.kg, height) ?? '—'), h('span', {}, height ? `身長 ${height}cm` : '設定で身長を入力'))),

    h('div', { class: 'seg seg-4', role: 'radiogroup', 'aria-label': '表示期間' },
      RANGES.map(([n, label]) => h('button', {
        class: ctx.state.weightRange === n ? 'on' : '', role: 'radio', 'aria-checked': String(ctx.state.weightRange === n),
        onclick: () => ctx.setWeightRange(n),
      }, label))),
    renderChart(weights, ctx.state.weightRange),
    h('div', { class: 'legend' },
      h('span', {}, h('i', { class: 'lg-daily' }), '日々の体重'),
      h('span', {}, h('i', { class: 'lg-avg' }), '週平均')),

    h('section', { class: 'region' },
      h('h2', {}, '最近の記録'),
      weights.length
        ? h('ul', { class: 'weight-list' }, weights.slice(-LIST_COUNT).reverse().map((w) => h('li', {},
          h('button', { class: 'text-btn plain', onclick: () => ctx.setWeightDate(w.date) }, fmtDate(w.date)),
          h('b', {}, `${w.kg} kg`),
          h('button', {
            class: 'icon-btn small', 'aria-label': `${fmtDate(w.date)}を削除`,
            onclick: () => confirm(`${fmtDate(w.date)} の体重を削除しますか？`) && ctx.commit(deleteWeight(ctx.state.data, w.date)),
          }, '×'))))
        : h('p', { class: 'muted' }, 'まだ記録がありません')),

    h('section', { class: 'settings-block' },
      h('h2', {}, 'CSV から一括取り込み'),
      h('p', { class: 'muted small' }, '「日付,体重」の形式か、体組成計アプリ（ECLEAR等）の書き出しをそのまま選べます。同じ日に複数あれば朝の値、既存の日付は上書きします。'),
      h('div', { class: 'row' }, h('button', { class: 'text-btn', onclick: () => fileInput.click() }, 'CSV ファイルを選ぶ'), fileInput)));
}
