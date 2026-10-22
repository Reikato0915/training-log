// 記録画面の日付まわり：時間帯の選択と、その日の体重入力
import { TIME_SLOTS, slotLabel } from '../timeslot.js';
import { activeWeights, upsertWeight } from '../bodyweight.js';
import { h, toast } from './dom.js';

const WEIGHT_STEP = 0.1;

export function renderTimeSlot(session, save, current) {
  const slot = session.timeSlot ?? '';
  return h('label', { class: 'slot-field' },
    h('span', { class: 'gym-icon', 'aria-hidden': 'true' }, '🕒'),
    h('select', {
      class: 'gym-select', 'aria-label': '時間帯',
      // 空を選んだら null（手動で未設定）。自動入力で上書きされない
      onchange: (e) => save({ ...current(), timeSlot: e.target.value || null }),
    },
    h('option', { value: '', selected: !slot }, '時間帯'),
    TIME_SLOTS.map((s) => h('option', { value: s, selected: s === slot }, slotLabel(s)))));
}

export function renderDayWeight(ctx, date) {
  const weights = activeWeights(ctx.state.data);
  const onDate = weights.find((w) => w.date === date);
  const prev = weights.filter((w) => w.date < date).at(-1);
  const input = h('input', {
    class: 'num', type: 'text', inputMode: 'decimal', value: onDate?.kg ?? '', placeholder: prev ? String(prev.kg) : 'kg',
    'aria-label': '体重 kg', onfocus: (e) => e.target.select(),
  });
  const bump = (d) => () => {
    const base = Number(input.value) || prev?.kg || 0;
    input.value = (Math.round((base + d) * 10) / 10).toFixed(1);
  };
  const save = () => {
    const v = (input.value || '').replace(',', '.');
    if (!v) { toast('体重を入力してください'); return; }
    try {
      ctx.commit(upsertWeight(ctx.state.data, date, v));
      toast(`体重 ${Number(v).toFixed(1)} kg を記録しました`);
    } catch (err) {
      toast(err.message);
    }
  };
  return h('div', { class: `day-weight${onDate ? ' done' : ''}` },
    h('span', { class: 'dw-label' }, '体重'),
    h('div', { class: 'stepper' },
      h('button', { class: 'step', 'aria-label': '0.1kg減らす', onclick: bump(-WEIGHT_STEP) }, '−'),
      input,
      h('button', { class: 'step', 'aria-label': '0.1kg増やす', onclick: bump(WEIGHT_STEP) }, '+')),
    h('button', { class: onDate ? 'text-btn' : 'primary', onclick: save }, onDate ? '更新' : '記録'));
}
