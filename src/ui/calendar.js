// 月カレンダー：記録がある日に分割色のドット。タップでその日の記録を開く
import { h } from './dom.js';
import { todayISO } from './dom.js';

const pad = (n) => String(n).padStart(2, '0');
const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

export function renderCalendar(ctx) {
  const { data, date } = ctx.state;
  const ym = ctx.state.calMonth ?? date.slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const today = todayISO();

  const byDate = new Map(data.sessions
    .filter((s) => !s.deleted && s.date.startsWith(ym) && (s.exercises.length || s.memo))
    .map((s) => [s.date, s]));
  const weighed = new Set((data.bodyweights ?? []).filter((w) => !w.deleted && w.date.startsWith(ym)).map((w) => w.date));

  const cells = [
    ...Array.from({ length: lead }, () => h('span', { class: 'cal-cell empty' })),
    ...Array.from({ length: days }, (_, i) => {
      const iso = `${ym}-${pad(i + 1)}`;
      const s = byDate.get(iso);
      const cls = ['cal-cell', s ? `has split-${s.split}` : '', iso === date ? 'sel' : '', iso === today ? 'today' : ''].join(' ');
      return h('button', {
        class: cls, 'aria-label': `${m}月${i + 1}日${s ? ' 記録あり' : ''}`, 'aria-pressed': String(iso === date),
        onclick: () => { ctx.setDate(iso); window.scrollTo({ top: 0, behavior: 'smooth' }); },
      }, String(i + 1), s ? h('i', { class: 'dot' }) : null, weighed.has(iso) ? h('i', { class: 'wdot' }) : null);
    }),
  ];

  return h('section', { class: 'calendar', 'aria-label': '記録カレンダー' },
    h('div', { class: 'cal-head' },
      h('button', { class: 'icon-btn small', 'aria-label': '前の月', onclick: () => ctx.setCalMonth(shiftMonth(ym, -1)) }, '‹'),
      h('span', {}, `${y}年${m}月`, h('small', {}, ` ${byDate.size}日`)),
      h('button', { class: 'icon-btn small', 'aria-label': '次の月', onclick: () => ctx.setCalMonth(shiftMonth(ym, 1)) }, '›')),
    h('div', { class: 'cal-grid' }, WEEKDAYS.map((d) => h('span', { class: 'cal-wd' }, d)), cells));
}
