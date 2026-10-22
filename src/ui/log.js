// 記録画面：日付・分割・種目・セット入力
import {
  SPLITS, exercisesForSplit, findExercise, allExercises, MUSCLES, makeCustomExercise, unitOf, toDisplayWeight, fromDisplayWeight, UNITS,
  DEFAULT_MENUS,
} from '../catalog.js';
import {
  exerciseTotals, lastPerformance, nextSplit, addDays, lastSessionOfSplit, copyExercises,
} from '../aggregate.js';
import {
  newSession, sessionForDate, upsertSession, deleteSession, activeCustom, addCustomExercise, gymOptions, addGym,
} from '../store.js';
import { h, fmtKg, fmtDate, toast, todayISO } from './dom.js';
import { weightAt } from '../bodyweight.js';
import { isConfigured } from '../sync.js';
import { expiryMessage } from '../token-expiry.js';
import { renderCalendar } from './calendar.js';
import { renderTimeSlot, renderDayWeight } from './day-extras.js';
import { withAutoSlot } from '../timeslot.js';

const CHIP_COUNT = 8;
const NEW_EXERCISE = '__new__';
const NEW_GYM = '__new_gym__';

const roundStep = (v) => Math.round(v * 100) / 100;
const fmtSet = (s, unit) => `${toDisplayWeight(s.w, unit) ?? '自重'}×${s.reps ?? '?'}${s.repsR != null ? `/${s.repsR}` : ''}${s.extra ? `+${s.extra}` : ''}`;

/** 候補ボタン：分割ごとの定番メニュー＋自分で登録した種目。その他は使用頻度順 */
function menuExercises(data, split) {
  const custom = activeCustom(data);
  const menu = DEFAULT_MENUS[split];
  if (menu) {
    const category = split.startsWith('legs') ? 'legs' : split;
    return [...menu.map((id) => findExercise(id, custom)).filter(Boolean), ...custom.filter((e) => e.split === category)];
  }
  return frequentExercises(data, split);
}

function frequentExercises(data, split) {
  const category = (sp) => (sp.startsWith('legs') ? 'legs' : sp);
  const key = category(split);
  const counts = {};
  for (const s of data.sessions) {
    if (s.deleted || (key !== 'other' && category(s.split) !== key)) continue;
    for (const e of s.exercises) counts[e.exId] = (counts[e.exId] ?? 0) + 1;
  }
  const custom = activeCustom(data);
  const pool = exercisesForSplit(split, custom);
  return [...pool].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0)).slice(0, CHIP_COUNT);
}

export function renderLog(ctx) {
  const { data, settings, date } = ctx.state;
  const custom = activeCustom(data);
  const existing = sessionForDate(data, date);
  const session = existing ?? newSession(date, nextSplit(data.sessions));

  // 変更を保存。structural=true なら再描画
  // 当日の初回入力時に時間帯を自動で付ける
  const save = (next, structural = true) =>
    ctx.commit(upsertSession(ctx.state.data, withAutoSlot(next, todayISO())), structural);
  const current = () => sessionForDate(ctx.state.data, date) ?? session;
  const updateEntry = (idx, fn, structural = true) => {
    const s = current();
    save({ ...s, exercises: s.exercises.map((e, i) => (i === idx ? fn(e) : e)) }, structural);
  };

  const addExercise = (exId) => {
    const s = current();
    const prev = lastPerformance(ctx.state.data.sessions, exId, date);
    const def = findExercise(exId, activeCustom(ctx.state.data));
    const first = prev?.sets.find((x) => x.reps !== 0) ?? { w: null, reps: null };
    const unit = prev?.unit ?? unitOf(def);
    const set = def?.sided ? { w: first.w, reps: first.reps, repsR: first.repsR ?? first.reps } : { w: first.w, reps: first.reps };
    save({ ...s, exercises: [...s.exercises, { exId, unit, memo: '', sets: [set] }] });
  };

  const header = h('section', { class: 'day-head' },
    h('div', { class: 'date-nav' },
      h('button', { class: 'icon-btn', 'aria-label': '前日', onclick: () => ctx.setDate(addDays(date, -1)) }, '‹'),
      h('label', { class: 'date-label' },
        h('span', { class: 'date-big' }, fmtDate(date)),
        h('input', { type: 'date', value: date, class: 'date-input', 'aria-label': '日付', onchange: (e) => e.target.value && ctx.setDate(e.target.value) })),
      h('button', { class: 'icon-btn', 'aria-label': '翌日', onclick: () => ctx.setDate(addDays(date, 1)) }, '›')),
    renderCalendar(ctx),
    h('div', { class: 'split-row', role: 'radiogroup', 'aria-label': '分割' },
      SPLITS.map((sp) => h('button', {
        class: `chip split-${sp.id}${session.split === sp.id ? ' on' : ''}`,
        role: 'radio', 'aria-checked': String(session.split === sp.id),
        onclick: () => save({ ...current(), split: sp.id }),
      }, sp.name))),
    h('div', { class: 'place-row' }, renderGymSelect(ctx, session, save, current), renderTimeSlot(session, save, current)),
    renderDayWeight(ctx, date),
    h('textarea', {
      class: 'memo day-memo', rows: 1, placeholder: '日メモ（体調・合トレ等）', value: session.memo,
      oninput: (e) => save({ ...current(), memo: e.target.value }, false),
    }));

  const cards = session.exercises.map((entry, idx) => renderCard(ctx, entry, idx, { custom, date, updateEntry, save, current }));

  // 記録がある日は記録を主役にし、種目追加はボタン1つに畳む
  const collapsed = session.exercises.length > 0 && !ctx.state.pickerOpen;
  const picker = collapsed
    ? h('button', { class: 'add-exercise', onclick: () => ctx.setPickerOpen(true) }, '＋ 種目を追加')
    : renderPicker(ctx, session.split, custom, addExercise);

  // 記録が空の日は、同じ分割の前回メニューをワンタッチで複製できる
  const lastSame = session.exercises.length ? null : lastSessionOfSplit(ctx.state.data.sessions, session.split, date);
  const copyBtn = lastSame
    ? h('button', {
      class: `copy-last split-${session.split}`,
      onclick: () => save({ ...current(), exercises: copyExercises(lastSame) }),
    }, h('b', {}, `前回の${SPLITS.find((x) => x.id === session.split)?.name}をコピー`),
    h('span', {}, `${fmtDate(lastSame.date)}・${lastSame.exercises.length}種目（重量・レップも複製）`))
    : null;

  const footer = existing
    ? h('button', {
      class: 'text-btn danger', onclick: () => {
        if (confirm(`${fmtDate(date)} の記録を削除しますか？`)) ctx.commit(deleteSession(ctx.state.data, existing.id));
      },
    }, 'この日の記録を削除')
    : null;

  return h('div', { class: 'view-log' }, renderSyncBanner(ctx), header, copyBtn, h('div', { class: 'cards' }, cards), picker, footer);
}

function renderSyncBanner(ctx) {
  const { settings, sync, syncError } = ctx.state;
  const expiry = settings.token ? expiryMessage(settings.tokenExpires, todayISO()) : null;
  if (expiry && sync !== 'error') {
    return h('button', { class: `sync-banner ${expiry.level}`, onclick: () => ctx.setView('settings') }, expiry.text, h('b', {}, ' 設定を開く ›'));
  }
  if (isConfigured(settings) && sync !== 'error') return null;
  const msg = isConfigured(settings)
    ? `同期エラー：${syncError}`
    : '同期が未設定です。設定でトークンを入れると、過去の記録もこの端末に読み込まれます。';
  return h('button', { class: 'sync-banner', onclick: () => ctx.setView('settings') }, msg, h('b', {}, ' 設定を開く ›'));
}

function renderGymSelect(ctx, session, save, current) {
  const options = gymOptions(ctx.state.data);
  // 過去データの旧ジム名（選択肢に無いもの）もそのまま表示する
  const names = session.gym && !options.includes(session.gym) ? [...options, session.gym] : options;
  return h('label', { class: 'gym-field' },
    h('span', { class: 'gym-icon', 'aria-hidden': 'true' }, '📍'),
    h('select', {
      class: 'gym-select', 'aria-label': 'ジム',
      onchange: (e) => {
        const v = e.target.value;
        if (v !== NEW_GYM) { save({ ...current(), gym: v || null }); return; }
        const name = prompt('ジム名を入力');
        if (!name?.trim()) { e.target.value = session.gym ?? ''; return; }
        try {
          ctx.commit(addGym(ctx.state.data, name), false);
          save({ ...current(), gym: name.trim() });
        } catch (err) {
          toast(err.message);
        }
      },
    },
    session.gym ? null : h('option', { value: '', selected: true }, '（未設定）'),
    names.map((g) => h('option', { value: g, selected: g === session.gym }, g)),
    h('option', { value: NEW_GYM }, '＋ ジムを追加…')));
}

function renderCard(ctx, entry, idx, { custom, date, updateEntry, save, current }) {
  const def = findExercise(entry.exId, custom);
  const bw = weightAt(ctx.state.data, date, ctx.state.settings.bodyweight);
  const totals = exerciseTotals(entry, custom, bw);
  const totalEl = h('span', { class: 'ex-total' }, `${totals.sets} set · ${fmtKg(totals.volume)}`);
  const refreshTotals = () => {
    const e = current().exercises[idx];
    const t = exerciseTotals(e, custom, bw);
    totalEl.textContent = `${t.sets} set · ${fmtKg(t.volume)}`;
  };
  const prev = lastPerformance(ctx.state.data.sessions, entry.exId, date);
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
  const sided = Boolean(def?.sided) || entry.sets.some((x) => x.repsR != null);
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

  return h('article', { class: `card split-${def?.split ?? 'other'}` },
    h('header', { class: 'card-head' },
      h('div', {},
        h('h3', { class: 'ex-name' }, def?.name ?? entry.exId),
        h('span', { class: 'ex-muscles' }, muscles)),
      h('div', { class: 'head-right' },
        totalEl,
        h('div', { class: 'unit-toggle', role: 'radiogroup', 'aria-label': '重量の単位' },
          UNITS.map((u) => h('button', {
            class: u === unit ? 'on' : '', role: 'radio', 'aria-checked': String(u === unit),
            // 単位切替は入力済みの数字をそのまま新しい単位として読み替える（例：100kg→100lb）
            onclick: () => u !== unit && updateEntry(idx, (e) => ({
              ...e,
              unit: u,
              sets: e.sets.map((st) => ({ ...st, w: fromDisplayWeight(toDisplayWeight(st.w, unit), u) })),
            })),
          }, u)))),
      h('button', {
        class: 'icon-btn small', 'aria-label': '種目を削除', onclick: () => {
          if (!confirm(`${def?.name ?? '種目'} を削除しますか？`)) return;
          const s = current();
          save({ ...s, exercises: s.exercises.filter((_, i) => i !== idx) });
        },
      }, '×')),
    prev ? h('p', { class: 'prev' }, `前回 ${fmtDate(prev.date)}：${prev.sets.map((x) => fmtSet(x, unit)).join(' / ')} ${unit}`) : null,
    h('div', { class: 'sets' }, sidedHead, rows),
    h('div', { class: 'card-foot' },
      h('button', { class: 'add-set', onclick: addSet }, '＋ セット'),
      h('input', {
        class: 'memo ex-memo', type: 'text', placeholder: '種目メモ', value: entry.memo ?? '',
        oninput: (e) => updateEntry(idx, (x) => ({ ...x, memo: e.target.value }), false),
      })));
}

function renderPicker(ctx, split, custom, addExercise) {
  const chips = menuExercises(ctx.state.data, split).map((e) =>
    h('button', { class: `chip ex-chip split-${e.split}`, onclick: () => addExercise(e.id) }, e.name));

  // その日の分割のカテゴリを先頭に。カテゴリ内は定番メニュー順→その他
  const category = split.startsWith('legs') ? 'legs' : split;
  const order = ['push', 'pull', 'legs'].sort((a, b) => (b === category) - (a === category));
  const menu = DEFAULT_MENUS[split] ?? [];
  const rank = (id) => (menu.includes(id) ? menu.indexOf(id) : menu.length);
  const groups = order.map((key) => h('optgroup', { label: key === category ? `${key.toUpperCase()}（今日）` : key.toUpperCase() },
    allExercises(custom).filter((e) => e.split === key)
      .sort((a, b) => (key === category ? rank(a.id) - rank(b.id) : 0))
      .map((e) => h('option', { value: e.id }, e.aliases.length ? `${e.name}（${e.aliases[0]}）` : e.name))));

  const select = h('select', {
    class: 'ex-select', 'aria-label': '種目を追加',
    onchange: (e) => {
      const v = e.target.value;
      e.target.value = '';
      if (v === NEW_EXERCISE) openNewExerciseDialog(ctx, split, addExercise);
      else if (v) addExercise(v);
    },
  }, h('option', { value: '' }, '種目を選んで追加…'), groups, h('option', { value: NEW_EXERCISE }, '＋ 新しい種目を登録…'));

  return h('section', { class: 'picker' }, h('div', { class: 'chips' }, chips), select);
}

function openNewExerciseDialog(ctx, split, addExercise) {
  const defaultSplit = split.startsWith('legs') ? 'legs' : split === 'other' ? 'push' : split;
  const checks = (name) => h('div', { class: 'muscle-grid' }, MUSCLES.map((m) =>
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name, value: m.id }), m.name)));
  const form = h('form', { method: 'dialog', class: 'dialog-form' },
    h('h2', {}, '新しい種目'),
    h('label', { class: 'field' }, '種目名', h('input', { name: 'name', required: true, autocomplete: 'off' })),
    h('label', { class: 'field' }, '分類', h('select', { name: 'split' },
      ['push', 'pull', 'legs'].map((s) => h('option', { value: s, selected: s === defaultSplit }, s.toUpperCase())))),
    h('fieldset', {}, h('legend', {}, '主に使う部位（セット1.0換算）'), checks('primary')),
    h('fieldset', {}, h('legend', {}, '補助的に使う部位（0.5換算）'), checks('secondary')),
    h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'bodyweight' }), '自重種目（体重を負荷に加算）'),
    h('p', { class: 'error', role: 'alert' }),
    h('div', { class: 'dialog-actions' },
      h('button', { type: 'button', class: 'text-btn', onclick: () => dialog.close() }, 'キャンセル'),
      h('button', { type: 'submit', class: 'primary' }, '登録して追加')));
  const dialog = h('dialog', { class: 'dialog' }, form);
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const fd = new FormData(form);
    try {
      const exercise = makeCustomExercise({
        name: fd.get('name'), split: fd.get('split'),
        primary: fd.getAll('primary'), secondary: fd.getAll('secondary'), bodyweight: fd.has('bodyweight'),
      });
      ctx.commit(addCustomExercise(ctx.state.data, exercise), false);
      dialog.close();
      addExercise(exercise.id);
      toast(`${exercise.name} を登録しました`);
    } catch (err) {
      form.querySelector('.error').textContent = err.message;
    }
  });
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}
