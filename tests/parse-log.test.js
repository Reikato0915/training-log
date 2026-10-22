import { describe, it, expect } from 'vitest';
import { parseSets, parseLog, splitGym } from '../tools/parse-log.js';

const sets = (rest, opts) => parseSets(rest, opts).sets;

describe('parseSets', () => {
  it('reads alternating weight and reps', () => {
    expect(sets('122.5 0+1 102.5 6+1 95 8 90 8,5')).toEqual([
      { w: 122.5, reps: 0, extra: 1 }, { w: 102.5, reps: 6, extra: 1 }, { w: 95, reps: 8 }, { w: 90, reps: 8 }, { w: 90, reps: 5 },
    ]);
  });

  it('reads comma rep lists spread over spaces', () => {
    expect(sets('105 9 100 10, 7 90')).toEqual([
      { w: 105, reps: 9 }, { w: 100, reps: 10 }, { w: 100, reps: 7 }, { w: 90, reps: null },
    ]);
  });

  it('treats consecutive small numbers as more reps at the same weight', () => {
    expect(sets('165 8 154 10 10 8')).toEqual([
      { w: 165, reps: 8 }, { w: 154, reps: 10 }, { w: 154, reps: 10 }, { w: 154, reps: 8 },
    ]);
  });

  it('expands N set without reps', () => {
    expect(sets('20 2set 18 2set')).toEqual([
      { w: 20, reps: null }, { w: 20, reps: null }, { w: 18, reps: null }, { w: 18, reps: null },
    ]);
    expect(sets('4set')).toEqual(Array(4).fill({ w: null, reps: null }));
    expect(sets('130　3セット')).toHaveLength(3);
  });

  it('spreads arrow chains across sets', () => {
    expect(sets('12→10 4set').map((s) => s.w)).toEqual([12, 10, 10, 10]);
    expect(sets('30→25→20　4セット').map((s) => s.w)).toEqual([30, 25, 20, 20]);
  });

  it('treats big follow-up numbers as new weights', () => {
    expect(sets('90 5 85 80 75')).toEqual([
      { w: 90, reps: 5 }, { w: 85, reps: null }, { w: 80, reps: null }, { w: 75, reps: null },
    ]);
  });

  it('splits packed rep digits and flags it', () => {
    const r = parseSets('150 668 160 657');
    expect(r.sets.map((s) => s.reps)).toEqual([6, 6, 8, 6, 5, 7]);
    expect(r.flags).toContain('連結数字を分解');
  });

  it('reads w×r and converts lb', () => {
    expect(sets('25×6')).toEqual([{ w: 25, reps: 6 }]);
    expect(sets('150lb 4')[0].w).toBeCloseTo(68.04, 1);
  });

  it('keeps text as memo', () => {
    const r = parseSets('50 drop 4セット');
    expect(r.memo).toBe('drop');
    expect(r.sets).toHaveLength(4);
  });
});

const LOG = `#training

# 2026/01

2026/01/04@心斎橋

体重メモ

pull

チニング　22.5 1 12.5 7+1,6
振り子　45 3set
ABDADD 130

2/16@PHG

L2

PLC 65 10 70 3set
 抱え込み
add abd 99 165 3set
IHLE 220 2set
LE 140 2set

2026/03/07@PHG
push
BP 60 100 120 135
 110 7 105 8
謎種目 10 10
---
## テンプレ
BP 1 1
`;

describe('parseLog', () => {
  const { sessions, report } = parseLog(LOG);

  it('splits by date and reads split + location', () => {
    expect(sessions.map((s) => [s.date, s.split])).toEqual([
      ['2026-01-04', 'pull'], ['2026-02-16', 'legs2'], ['2026-03-07', 'push'],
    ]);
    expect(sessions[0].gym).toBe('心斎橋');
    expect(sessions[0].memo).toContain('体重メモ');
  });

  it('maps aliases to exercises and drops 振り子 into memo', () => {
    const ids = sessions[0].exercises.map((e) => e.exId);
    expect(ids).toEqual(['chinning', 'adduction', 'abduction']);
    expect(sessions[0].memo).toContain('振り子');
  });

  it('assigns add/abd pair weights', () => {
    const s = sessions[1];
    expect(s.exercises.find((e) => e.exId === 'adduction').sets).toEqual(Array(3).fill({ w: 99, reps: null }));
    expect(s.exercises.find((e) => e.exId === 'abduction').sets[0].w).toBe(165);
  });

  it('prefers the longer alias (IHLE over LE)', () => {
    expect(sessions[1].exercises.map((e) => e.exId)).toContain('ih_leg_ext');
    expect(sessions[1].exercises.map((e) => e.exId)).toContain('leg_ext');
  });

  it('attaches indented lines to the previous exercise', () => {
    expect(sessions[1].exercises[0].memo).toContain('抱え込み');
    const bp = sessions[2].exercises[0];
    expect(bp.sets.slice(-2)).toEqual([{ w: 110, reps: 7 }, { w: 105, reps: 8 }]);
  });

  it('stops at --- and reports unknown lines', () => {
    expect(sessions).toHaveLength(3);
    expect(report.some((r) => r.line.includes('謎種目') && r.flags.includes('不明'))).toBe(true);
  });

  it('stores the original line in each exercise', () => {
    expect(sessions[0].exercises[0].source).toContain('チニング');
  });
});

describe('lb exercises', () => {
  it('reads プリー as pulley row in lb and stores kg', () => {
    const { sessions } = parseLog('2026/01/04\npull\nプリー　190　180　4set\n');
    const e = sessions[0].exercises[0];
    expect(e.exId).toBe('pulley_row');
    expect(e.sets.map((x) => x.w)).toEqual([86.18, 81.65, 81.65, 81.65]);
  });

  it('keeps reps unconverted', () => {
    expect(parseSets('190 10', { defaultUnit: 'lb' }).sets).toEqual([{ w: 86.18, reps: 10 }]);
  });
});

describe('gym and BS', () => {
  it('extracts and normalizes gym names', () => {
    expect(splitGym('@PHG')).toEqual({ gym: 'パワーハウスジム大阪', rest: '' });
    expect(splitGym('＠PHG大阪').gym).toBe('パワーハウスジム大阪');
    expect(splitGym('@ノースwithAさん')).toEqual({ gym: 'パワーハウスジムノース大阪', rest: 'withAさん' });
    expect(splitGym(' 合トレ@Fitplace24 with Bさん')).toEqual({ gym: 'Fitplace24', rest: '合トレ with Bさん' });
    expect(splitGym(' L2')).toEqual({ gym: null, rest: 'L2' });
  });

  it('assigns BS by weight', () => {
    const { sessions } = parseLog('2026/01/08@心斎橋\nL2\nBS 20→16 4set\n2026/05/02@ノース\nL1\nBS 120 3set\n');
    expect(sessions[0].gym).toBe('心斎橋');
    expect(sessions[0].exercises[0].exId).toBe('bulgarian');
    expect(sessions[1].exercises[0].exId).toBe('belt_squat');
    expect(sessions[1].split).toBe('legs1');
  });
});

describe('parseDescending', async () => {
  const { parseDescending: pd } = await import('../tools/parse-log.js');
  it('reads strictly descending numbers as weights', () => {
    expect(pd('35　25　20').map((s) => s.w)).toEqual([35, 25, 20]);
    expect(pd('30 25 3set').map((s) => s.w)).toEqual([30, 25, 25]);
    expect(pd('20 15 10 0').map((s) => s.w)).toEqual([20, 15, 10, 0]);
  });

  it('ignores non-descending or mixed lines', () => {
    expect(pd('105 7 10')).toBeNull();
    expect(pd('12 12 10 10')).toBeNull();
    expect(pd('90 9,7')).toBeNull();
    expect(pd('130')).toBeNull();
    expect(pd('40 8')).toBeNull();
    expect(pd('112.5 5')).toBeNull();
  });

  it('is not applied to chinning', () => {
    const { sessions } = parseLog('2026/01/14\npull\nチニング12.5 9\nPD 35 25 20\n');
    expect(sessions[0].exercises[0].sets).toEqual([{ w: 12.5, reps: 9 }]);
    expect(sessions[0].exercises[1].sets.map((s) => s.w)).toEqual([35, 25, 20]);
  });
});
