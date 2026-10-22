// GitHub トークンの有効期限リマインダー。期限は API から取得できない（CORS で隠れる）ため発行時に入力してもらう。

export const REMIND_DAYS = 30;
const DAY_MS = 86400000;

/** 期限日（YYYY-MM-DD）まで何日か。期限日当日は 0、過ぎたら負 */
export function daysUntil(expires, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expires ?? '')) return null;
  return Math.round((Date.parse(`${expires}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
}

/** 表示するリマインダー文。30日より先なら null */
export function expiryMessage(expires, today) {
  const days = daysUntil(expires, today);
  if (days == null || days > REMIND_DAYS) return null;
  const md = `${Number(expires.slice(5, 7))}/${Number(expires.slice(8, 10))}`;
  if (days < 0) return { level: 'expired', text: `GitHubトークンの期限（${md}）が切れています。新しいトークンを発行して設定してください。` };
  if (days === 0) return { level: 'urgent', text: `GitHubトークンの期限は今日（${md}）までです。` };
  return { level: days <= 7 ? 'urgent' : 'soon', text: `GitHubトークンの期限まであと ${days} 日（${md}）です。` };
}
