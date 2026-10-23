// 種目カード：セット入力、kg/lb、左右あり切替、前回比の負荷漸増バッジ、並べ替えハンドル
import {
  findExercise, MUSCLES, unitOf, toDisplayWeight, fromDisplayWeight, UNITS,
} from '../catalog.js';
import { exerciseTotals, lastPerformance } from '../aggregate.js';
import { compareExercise } from '../progress.js';
import { weightAt } from '../bodyweight.js';
import { h, fmtKg, fmtDate } from './dom.js';

const roundStep = (v) => Math.round(v * 100) / 100;
const EDGE_PX = 90;
const SCROLL_STEP = 14;
export const fmtSet = (s, unit) =>
  `${toDisplayWeight(s.w, unit) ?? '自重'}×${s.reps ?? '?'}${s.repsR != null ? `/${s.repsR}` : ''}${s.extra ? `+${s.extra}` : ''}`;

/** その記録が左右別かどうか（記録ごとの指定 → 種目の既定 → 右レップの有無） */
export const isSided = (entry, def) => entry.sided ?? (Boolean(def?.sided) || entry.sets.some((x) => x.repsR != null));

/** 左右ありの切替。オンは右レップを左と同じ値で補い、オフは右レップを外す */
export function toggleSided(entry, on) {
  const sets = entry.sets.map(({ repsR, ...rest }) => (on ? { ...rest, repsR: repsR ?? rest.reps } : rest));
  return { ...entry, sided: on, sets };
}

function progressBadges(entry, prev, custom, bw) {
  const r = compareExercise(entry.sets, prev?.sets ?? null, { exId: entry.exId, custom, bodyweight: bw });
  if (!r) return h('div', { class: 'progress none' }, '初回の記録');
  const badge = (on, label, title) => h('span', { class: `pbadge${on ? ' up' : ''}`, title }, `${on ? '▲' : '・'}${label}`);
  return h('div', { class: `progress${r.any ? ' up' : ''}`, 'aria-label': r.any ? '前回から負荷漸増あり' : '前回から更新なし' },
    badge(r.maxWeight.up, '最大重量', `最大 ${r.maxWeight.prev ?? '-'}→${r.maxWeight.now ?? '-'}kg`),
    badge(r.repsAtWeight.up, '同重量回数', r.repsAtWeight.up ? `${r.repsAtWeight.w}kg で ${r.repsAtWeight.prev}→${r.repsAtWeight.now}回` : ''),
    badge(r.volume.up, '総負荷', `${Math.round(r.volume.prev)}→${Math.round(r.volume.now)}kg`));
}

export function renderCard(ctx, entry, idx, { custom, date, updateEntry, save, current }) {
  const def = findExercise(entry.exId, custom);
  const bw = weightAt(ctx.state.data, date, ctx.state.settings.bodyweight);
  const prev = lastPerformance(ctx.state.data.sessions, entry.exId, date);
  const totals = exerciseTotals(entry, custom, bw);
  const totalEl = h('span', { class: 'ex-total' }, `${totals.sets} set · ${fmtKg(totals.volume)}`);
  let badgesEl = progressBadges(entry, prev, custom, bw);
  // 数字入力中は再描画しないので、合計と前回比だけ差し替える
  const refreshTotals = () => {
    const e = current().exercises[idx];
    const t = exerciseTotals(e, custom, bw);
    totalEl.textContent = `${t.sets} set · ${fmtKg(t.volume)}`;
    const next = progressBadges(e, prev, custom, bw);
    badgesEl.replaceWith(next);
    badgesEl = next;
  };
  const unit = entry.unit ?? unitOf(def);
  const step = unit === 'lb' ? 5 : ctx.state.settings.weightStep;
  const toStored = (field, v) => (field === 'w' ? fromDisplayWeight(v, unit) : v);

  const setField = (si, field, value, structural = false) => {
    updateEntry(idx, (e) => ({ ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, [field]: value } : s)) }), structural);
    if (!structural) refreshTotals();
  };

  const stepper = (si, field, value, delta, mode, label) => {
    const input = h('input', {
      class: `num num-${field}`, type: 'text', inputMode: mode, value: (field === 'w' ? toDisplayWeight(value, unit) : value) ?? '', placeholder: field === 'w' ? (def?.bodyweight ? '自重' : unit) : 'rep',
      'aria-label': `${si + 1}セット目 ${label}`,
      onfocus: (e) => e.target.select(),
      oninput: (e) => {
        const v = e.target.value.trim();
        const n = v === '' ? null : Number(v.replace(',', '.'));
        if (v === '' || Number.isFinite(n)) setField(si, field, toStored(field, n));
      },
    });
    const bump = (d) => () => {
      const cur = Number(input.value) || 0;
      const next = Math.max(0, roundStep(cur + d));
      input.value = String(next);
      setField(si, field, toStored(field, next));
    };
    return h('div', { class: 'stepper' },
      h('button', { class: 'step', tabIndex: -1, 'aria-label': `${label}を減らす`, onclick: bump(-delta) }, '−'),
      input,
      h('button', { class: 'step', tabIndex: -1, 'aria-label': `${label}を増やす`, onclick: bump(delta) }, '+'));
  };

  // 左右別種目は「重量｜左｜右」で1セット
  const sided = isSided(entry, def);
  const repCells = (s, si) => (sided
    ? [stepper(si, 'reps', s.reps, 1, 'numeric', '左レップ'), stepper(si, 'repsR', s.repsR, 1, 'numeric', '右レップ')]
    : [h('span', { class: 'times' }, '×'), stepper(si, 'reps', s.reps, 1, 'numeric', 'レップ')]);
  const sidedHead = sided
    ? h('div', { class: 'set-row sided head', 'aria-hidden': 'true' }, h('span'), h('span', {}, unit), h('span', {}, '左'), h('span', {}, '右'), h('span'))
    : null;

  const rows = entry.sets.map((s, si) => h('div', { class: `set-row${sided ? ' sided' : ''}${s.reps === 0 ? ' failed' : ''}` },
    h('span', { class: 'set-no' }, si + 1),
    stepper(si, 'w', s.w, step, 'decimal', `重量(${unit})`),
    repCells(s, si),
    sided ? null : (s.extra ? h('span', { class: 'extra' }, `+${s.extra}`) : h('span')),
    h('button', {
      class: 'icon-btn small', 'aria-label': `${si + 1}セット目を削除`,
      onclick: () => updateEntry(idx, (e) => ({ ...e, sets: e.sets.filter((_, j) => j !== si) })),
    }, '×')));

  const addSet = () => updateEntry(idx, (e) => {
    const last = e.sets.at(-1) ?? prev?.sets[0] ?? { w: null, reps: null };
    const next = { w: last.w, reps: last.reps };
    return { ...e, sets: [...e.sets, sided ? { ...next, repsR: last.repsR ?? last.reps } : next] };
  });

  const muscles = def ? def.primary.map((m) => MUSCLES.find((x) => x.id === m)?.name).join('・') : '不明な種目';

  return h('article', { class: `card split-${def?.split ?? 'other'}`, dataset: { idx: String(idx) } },
    h('header', { class: 'card-head' },
      h('button', { class: 'drag-handle', 'aria-label': `${def?.name ?? '種目'}を並べ替え（ドラッグ）`, title: 'ドラッグで並べ替え' }, '⠿'),
      h('div', {},
        h('h3', { class: 'ex-name' }, def?.name ?? entry.exId),
        h('span', { class: 'ex-muscles' }, muscles)),
      h('div', { class: 'head-right' },
        totalEl,
        h('div', { class: 'toggles' },
          h('button', {
            class: `side-toggle${sided ? ' on' : ''}`, 'aria-pressed': String(sided), title: '左右別に記録',
            onclick: () => updateEntry(idx, (e) => toggleSided(e, !sided)),
          }, '左右'),
          h('div', { class: 'unit-toggle', role: 'radiogroup', 'aria-label': '重量の単位' },
            UNITS.map((u) => h('button', {
              class: u === unit ? 'on' : '', role: 'radio', 'aria-checked': String(u === unit),
              // 単位切替は入力済みの数字をそのまま新しい単位として読み替える（例：100kg→100lb）
              onclick: () => u !== unit && updateEntry(idx, (e) => ({
                ...e,
                unit: u,
                sets: e.sets.map((st) => ({ ...st, w: fromDisplayWeight(toDisplayWeight(st.w, unit), u) })),
              })),
            }, u))))),
      h('button', {
        class: 'icon-btn small', 'aria-label': '種目を削除', onclick: () => {
          if (!confirm(`${def?.name ?? '種目'} を削除しますか？`)) return;
          const s = current();
          save({ ...s, exercises: s.exercises.filter((_, i) => i !== idx) });
        },
      }, '×')),
    prev ? h('p', { class: 'prev' }, `前回 ${fmtDate(prev.date)}：${prev.sets.map((x) => fmtSet(x, unit)).join(' / ')} ${unit}`) : null,
    badgesEl,
    h('div', { class: 'sets' }, sidedHead, rows),
    h('div', { class: 'card-foot' },
      h('button', { class: 'add-set', onclick: addSet }, '＋ セット'),
      h('input', {
        class: 'memo ex-memo', type: 'text', placeholder: '種目メモ', value: entry.memo ?? '',
        oninput: (e) => updateEntry(idx, (x) => ({ ...x, memo: e.target.value }), false),
      })));
}

/**
 * ハンドル（⠿）をドラッグしてカードを並べ替える。指を離した位置の前に挿入。
 * @param {HTMLElement} list カードの親
 * @param {(from:number, to:number) => void} onMove
 */
export function enableReorder(list, onMove) {
  list.addEventListener('pointerdown', (ev) => {
    const handle = ev.target.closest('.drag-handle');
    if (!handle) return;
    ev.preventDefault();
    const card = handle.closest('.card');
    const cards = [...list.querySelectorAll(':scope > .card')];
    const from = cards.indexOf(card);
    const startY = ev.clientY;
    const startScroll = window.scrollY;
    let lastY = ev.clientY;
    let to = from;
    handle.setPointerCapture(ev.pointerId);
    card.classList.add('dragging');

    const update = () => {
      card.style.transform = `translateY(${lastY - startY + window.scrollY - startScroll}px)`;
      const others = cards.filter((c) => c !== card);
      const before = others.findIndex((c) => { const r = c.getBoundingClientRect(); return lastY < r.top + r.height / 2; });
      const slot = before === -1 ? others.length : before;
      to = slot;
      others.forEach((c, i) => c.classList.toggle('drop-before', i === slot));
      list.classList.toggle('drop-end', slot === others.length);
    };
    // 画面の上端・下端に指を置いている間は自動でスクロール
    const autoScroll = setInterval(() => {
      const edge = EDGE_PX;
      const dy = lastY < edge ? -SCROLL_STEP : lastY > window.innerHeight - edge ? SCROLL_STEP : 0;
      if (dy) { window.scrollBy(0, dy); update(); }
    }, 16);
    const move = (e) => { lastY = e.clientY; update(); };
    const end = () => {
      clearInterval(autoScroll);
      handle.removeEventListener('pointermove', move);
      card.classList.remove('dragging');
      card.style.transform = '';
      cards.forEach((c) => c.classList.remove('drop-before'));
      list.classList.remove('drop-end');
      if (to !== from) onMove(from, to);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end, { once: true });
    handle.addEventListener('pointercancel', end, { once: true });
  });
}

/** 並べ替え（from を取り出して、残りの配列の to 番目に入れる） */
export function moveItem(list, from, to) {
  const rest = list.filter((_, i) => i !== from);
  return [...rest.slice(0, to), list[from], ...rest.slice(to)];
}
