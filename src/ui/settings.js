// 設定：体重・刻み幅・GitHub同期・カスタム種目・バックアップ
import { MUSCLES, muscleName } from '../catalog.js';
import {
  activeCustom, removeCustomExercise, validateData, mergeData, addGym, removeGym, DEFAULT_GYMS,
} from '../store.js';
import { isConfigured } from '../sync.js';
import { h, toast } from './dom.js';

export function renderSettings(ctx) {
  const { settings, data } = ctx.state;

  const num = (key, label, step) => h('label', { class: 'field' }, label,
    h('input', {
      type: 'number', inputMode: 'decimal', step, value: settings[key],
      onchange: (e) => {
        const v = Number(e.target.value);
        if (Number.isFinite(v) && v > 0) ctx.setSettings({ ...ctx.state.settings, [key]: v });
        else toast('正の数を入力してください');
      },
    }));

  const syncForm = h('form', { class: 'settings-block', onsubmit: (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const token = String(fd.get('token') ?? '').trim();
    const next = {
      ...ctx.state.settings,
      repo: String(fd.get('repo')).trim(),
      path: String(fd.get('path')).trim() || 'training.json',
      ...(token ? { token } : {}),
    };
    if (!isConfigured(next)) { toast('リポジトリ名（owner/name）とトークンを入力してください'); return; }
    ctx.setSettings(next);
    ctx.syncNow();
  } },
  h('h2', {}, 'GitHub 同期'),
  h('p', { class: 'muted' }, '記録を私的リポジトリの JSON に自動保存します。トークンはこの端末内だけに保存されます。'),
  h('label', { class: 'field' }, 'リポジトリ（owner/name）', h('input', { name: 'repo', value: settings.repo, placeholder: 'Reikato0915/training-data', autocapitalize: 'off', autocomplete: 'off' })),
  h('label', { class: 'field' }, 'ファイル', h('input', { name: 'path', value: settings.path, autocapitalize: 'off' })),
  h('label', { class: 'field' }, `トークン${settings.token ? '（設定済み・変更時のみ入力）' : ''}`,
    h('input', { name: 'token', type: 'password', autocomplete: 'off', placeholder: 'github_pat_…' })),
  h('div', { class: 'row' },
    h('button', { type: 'submit', class: 'primary' }, '保存して同期'),
    settings.token ? h('button', {
      type: 'button', class: 'text-btn danger', onclick: () => {
        if (confirm('この端末からトークンを消しますか？')) ctx.setSettings({ ...ctx.state.settings, token: '' });
      },
    }, 'トークン削除') : null),
  h('p', { class: 'muted small' }, `状態：${ctx.syncLabel()}`));

  const customs = activeCustom(data);
  const customBlock = h('section', { class: 'settings-block' },
    h('h2', {}, '登録した種目'),
    customs.length
      ? h('ul', { class: 'custom-list' }, customs.map((e) => h('li', {},
        h('span', {}, e.name, h('small', {}, ` ${e.primary.map(muscleName).join('・')}${e.secondary.length ? ` / ${e.secondary.map(muscleName).join('・')}` : ''}`)),
        h('button', {
          class: 'icon-btn small', 'aria-label': `${e.name}を削除`, onclick: () => {
            if (confirm(`${e.name} を種目リストから外しますか？（過去の記録は残ります）`)) ctx.commit(removeCustomExercise(ctx.state.data, e.id));
          },
        }, '×'))))
      : h('p', { class: 'muted' }, '記録画面の「＋ 新しい種目を登録…」から追加できます'));

  const gyms = (data.gyms ?? []).filter((g) => !g.deleted);
  const gymBlock = h('form', {
    class: 'settings-block', onsubmit: (e) => {
      e.preventDefault();
      try {
        ctx.commit(addGym(ctx.state.data, new FormData(e.target).get('gym')));
      } catch (err) {
        toast(err.message);
      }
    },
  },
  h('h2', {}, 'ジム'),
  h('p', { class: 'muted small' }, `既定：${DEFAULT_GYMS.join('、')}（新しい記録は ${DEFAULT_GYMS[0]}）`),
  gyms.length ? h('ul', { class: 'custom-list' }, gyms.map((g) => h('li', {}, h('span', {}, g.name),
    h('button', {
      type: 'button', class: 'icon-btn small', 'aria-label': `${g.name}を削除`,
      onclick: () => confirm(`${g.name} を選択肢から外しますか？`) && ctx.commit(removeGym(ctx.state.data, g.id)),
    }, '×')))) : null,
  h('div', { class: 'row' },
    h('input', { name: 'gym', class: 'grow', placeholder: 'ジム名を追加', autocomplete: 'off' }),
    h('button', { type: 'submit', class: 'text-btn' }, '追加')));

  const fileInput = h('input', {
    type: 'file', accept: 'application/json', hidden: true, onchange: async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const incoming = validateData(JSON.parse(await file.text()));
        ctx.commit(mergeData(ctx.state.data, incoming));
        toast(`${incoming.sessions.length} 件を読み込みました`);
      } catch (err) {
        toast(`読み込み失敗：${err.message}`);
      }
    },
  });

  const backup = h('section', { class: 'settings-block' },
    h('h2', {}, 'バックアップ'),
    h('div', { class: 'row' },
      h('button', {
        class: 'text-btn', onclick: () => {
          const blob = new Blob([JSON.stringify(ctx.state.data, null, 1)], { type: 'application/json' });
          const a = h('a', { href: URL.createObjectURL(blob), download: `training-${new Date().toISOString().slice(0, 10)}.json` });
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        },
      }, 'JSON を書き出す'),
      h('button', { class: 'text-btn', onclick: () => fileInput.click() }, 'JSON を読み込む（マージ）'),
      fileInput),
    h('p', { class: 'muted small' }, `記録 ${data.sessions.filter((s) => !s.deleted).length} 日分 · 部位 ${MUSCLES.length}`));

  return h('div', { class: 'view-settings' },
    h('section', { class: 'settings-block' },
      h('h2', {}, '基本'),
      num('bodyweight', '体重 kg（自重種目の負荷計算に使用）', 0.1),
      num('weightStep', '重量ボタンの刻み kg', 0.5)),
    gymBlock, syncForm, customBlock, backup);
}
