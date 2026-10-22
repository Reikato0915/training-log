// 画面の状態管理・保存・同期のつなぎ込み
import { loadData, saveData, loadSettings, saveSettings, mergeData } from './store.js';
import { isConfigured, syncNow } from './sync.js';
import { renderLog } from './ui/log.js';
import { renderWeek } from './ui/week.js';
import { renderSettings } from './ui/settings.js';
import { renderWeight } from './ui/weight.js';
import { todayISO, toast } from './ui/dom.js';

const SYNC_DELAY_MS = 4000;
const VIEWS = { log: renderLog, week: renderWeek, weight: renderWeight, settings: renderSettings };
const SYNC_LABELS = {
  off: '未設定', idle: '同期済み', pending: '未送信あり', syncing: '同期中…', offline: 'オフライン（後で送信）', error: 'エラー',
};

const state = {
  data: loadData(),
  settings: loadSettings(),
  view: 'log',
  date: todayISO(),
  week: null,
  metric: 'sets',
  calMonth: null,
  pickerOpen: false,
  weightRange: 12,
  sync: 'off',
  syncError: '',
  dirty: false,
};

let syncTimer = null;
const root = document.getElementById('app');
const statusEl = document.getElementById('sync-status');

function renderStatus() {
  const s = isConfigured(state.settings) ? state.sync : 'off';
  statusEl.className = `sync-dot sync-${s}`;
  statusEl.title = ctx.syncLabel();
  statusEl.setAttribute('aria-label', `同期：${ctx.syncLabel()}`);
}

function render() {
  const scrollY = window.scrollY;
  root.replaceChildren(VIEWS[state.view](ctx));
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-current', String(t.dataset.view === state.view)));
  renderStatus();
  window.scrollTo(0, scrollY);
}

function scheduleSync(delay = SYNC_DELAY_MS) {
  if (!isConfigured(state.settings)) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => ctx.syncNow(), delay);
}

const ctx = {
  state,
  commit(data, structural = true) {
    state.data = data;
    state.dirty = true;
    if (!saveData(data)) toast('端末への保存に失敗しました（容量不足の可能性）');
    if (isConfigured(state.settings)) state.sync = 'pending';
    scheduleSync();
    if (structural) render(); else renderStatus();
  },
  setDate(date) {
    state.date = date;
    state.view = 'log';
    state.pickerOpen = false;
    state.calMonth = date.slice(0, 7);
    render();
  },
  setCalMonth(ym) { state.calMonth = ym; render(); },
  setPickerOpen(open) { state.pickerOpen = open; render(); },
  setView(view) { state.view = view; render(); window.scrollTo(0, 0); },
  setWeek(week) { state.week = week; render(); },
  setMetric(metric) { state.metric = metric; render(); },
  setWeightRange(n) { state.weightRange = n; render(); },
  setWeightDate(d) { state.weightDate = d; render(); },
  setSettings(settings) { state.settings = settings; saveSettings(settings); render(); },
  syncLabel() {
    const s = isConfigured(state.settings) ? state.sync : 'off';
    return s === 'error' ? `エラー：${state.syncError}` : SYNC_LABELS[s];
  },
  async syncNow() {
    if (!isConfigured(state.settings) || state.sync === 'syncing') return;
    if (!navigator.onLine) { state.sync = 'offline'; renderStatus(); return; }
    clearTimeout(syncTimer);
    state.sync = 'syncing';
    renderStatus();
    const sent = state.data;
    try {
      const { data } = await syncNow(state.settings, sent);
      // 同期中に入力があれば、その分を残してもう一度送る
      const changedMeanwhile = state.data !== sent;
      state.data = changedMeanwhile ? mergeData(data, state.data) : data;
      saveData(state.data);
      state.dirty = changedMeanwhile;
      state.sync = changedMeanwhile ? 'pending' : 'idle';
      if (changedMeanwhile) scheduleSync(); else if (!document.activeElement?.matches('input, textarea')) render();
      renderStatus();
    } catch (err) {
      state.sync = navigator.onLine ? 'error' : 'offline';
      if (/トークンが無効/.test(err.message)) err.message += '（期限切れの可能性。新しいトークンを設定してください）';
      state.syncError = err.message;
      renderStatus();
    }
  },
};

document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => {
  state.view = tab.dataset.view;
  if (state.view === 'week') state.week = null;
  render();
  window.scrollTo(0, 0);
}));
statusEl.addEventListener('click', () => (isConfigured(state.settings) ? ctx.syncNow() : (state.view = 'settings', render())));

// 画面を離れる前に即送信、復帰時に最新を取得
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && state.dirty) ctx.syncNow();
  if (document.visibilityState === 'visible') ctx.syncNow();
});
window.addEventListener('online', () => ctx.syncNow());

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  // 新しい版が有効になったら一度だけ読み直して最新画面にする
  const hadController = Boolean(navigator.serviceWorker.controller);
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController) location.reload(); });
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

render();
ctx.syncNow();

