// GitHub 私的リポジトリの1ファイルへ JSON を保存・取得する。
import { mergeData, validateData } from './store.js';

const API = 'https://api.github.com';

const b64encode = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0)));

export const isConfigured = (settings) => Boolean(settings.token && /^[\w.-]+\/[\w.-]+$/.test(settings.repo) && settings.path);

function headers(settings, accept = 'application/vnd.github+json') {
  return { Authorization: `Bearer ${settings.token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' };
}

const contentsUrl = (settings) =>
  `${API}/repos/${settings.repo}/contents/${settings.path.split('/').map(encodeURIComponent).join('/')}`;

function describeError(status) {
  if (status === 401) return 'トークンが無効です';
  if (status === 403) return '権限不足（Contents の Read and write を許可してください）';
  if (status === 404) return 'リポジトリが見つかりません（名前・トークンの対象リポを確認）';
  return `GitHub エラー (${status})`;
}

/** remote を取得。ファイル未作成なら { data: null, sha: null } */
export async function pull(settings) {
  const res = await fetch(contentsUrl(settings), { headers: headers(settings), cache: 'no-store' });
  if (res.status === 404) {
    // ファイル未作成とリポジトリ不在を区別する
    const repo = await fetch(`${API}/repos/${settings.repo}`, { headers: headers(settings) });
    if (repo.ok) return { data: null, sha: null };
    throw new Error(describeError(repo.status));
  }
  if (!res.ok) throw new Error(describeError(res.status));
  const meta = await res.json();
  let text;
  if (meta.content) {
    text = b64decode(meta.content);
  } else {
    // 1MB 超は content が空になるため raw で取り直す
    const raw = await fetch(contentsUrl(settings), { headers: headers(settings, 'application/vnd.github.raw+json'), cache: 'no-store' });
    if (!raw.ok) throw new Error(describeError(raw.status));
    text = await raw.text();
  }
  return { data: validateData(JSON.parse(text)), sha: meta.sha };
}

async function put(settings, data, sha) {
  const body = {
    message: `log: ${new Date().toISOString().slice(0, 16)}`,
    content: b64encode(JSON.stringify(data, null, 1)),
    ...(sha ? { sha } : {}),
  };
  const res = await fetch(contentsUrl(settings), { method: 'PUT', headers: headers(settings), body: JSON.stringify(body) });
  if (res.status === 409 || res.status === 422) return { conflict: true };
  if (!res.ok) throw new Error(describeError(res.status));
  const json = await res.json();
  return { sha: json.content.sha };
}

/**
 * remote と local をマージして保存。競合したら取り直して1回だけ再試行。
 * @returns {Promise<{ data: object, sha: string }>} マージ後のデータ
 */
export async function syncNow(settings, local) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const remote = await pull(settings);
    const merged = mergeData(local, remote.data);
    if (remote.data && JSON.stringify(merged) === JSON.stringify(mergeData(remote.data, null))) {
      return { data: merged, sha: remote.sha };
    }
    const result = await put(settings, merged, remote.sha);
    if (!result.conflict) return { data: merged, sha: result.sha };
  }
  throw new Error('同期が競合しました。少し待って再試行してください');
}
