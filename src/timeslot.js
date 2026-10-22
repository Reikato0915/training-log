// トレーニングの時間帯（6〜22時の2時間幅）。当日の初回入力時に自動で付け、手動でも変更できる。

const FIRST = 6;
const LAST = 22;
const WIDTH = 2;
const pad = (n) => String(n).padStart(2, '0');

export const TIME_SLOTS = Array.from({ length: (LAST - FIRST) / WIDTH }, (_, i) => {
  const start = FIRST + i * WIDTH;
  return `${pad(start)}-${pad(start + WIDTH)}`;
});

export function slotForHour(hour) {
  const i = Math.floor((hour - FIRST) / WIDTH);
  return TIME_SLOTS[Math.min(Math.max(i, 0), TIME_SLOTS.length - 1)];
}

export const slotLabel = (slot) => {
  const [a, b] = slot.split('-').map(Number);
  return `${a}〜${b}時`;
};

/** 当日の記録で時間帯が未設定（undefined）なら現在時刻から付ける。null は「手動で未設定にした」なので触らない */
export function withAutoSlot(session, today, now = new Date()) {
  if (session.date !== today || session.timeSlot !== undefined) return session;
  return { ...session, timeSlot: slotForHour(now.getHours()) };
}
