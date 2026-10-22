import { describe, it, expect } from 'vitest';
import {
  decodeCSV, upsertWeight, deleteWeight, activeWeights, weightAt, weeklyAverages, parseWeightCSV, importWeights, setHeight, bmi,
} from '../src/bodyweight.js';
import { emptyData, mergeData } from '../src/store.js';

describe('bodyweight records', () => {
  it('keeps one entry per date and overwrites', () => {
    let d = upsertWeight(emptyData(), '2026-10-22', 77.3);
    d = upsertWeight(d, '2026-10-22', '77.25');
    expect(activeWeights(d)).toEqual([expect.objectContaining({ date: '2026-10-22', kg: 77.3 })]);
  });

  it('rejects implausible values', () => {
    expect(() => upsertWeight(emptyData(), '2026-10-22', 7)).toThrow();
    expect(() => upsertWeight(emptyData(), '2026-10-22', 'abc')).toThrow();
  });

  it('deletes with a tombstone and survives merge', () => {
    const d = deleteWeight(upsertWeight(emptyData(), '2026-10-22', 77), '2026-10-22');
    expect(activeWeights(d)).toEqual([]);
    expect(mergeData(d, emptyData()).bodyweights).toHaveLength(1);
  });

  it('finds weight on or before a date', () => {
    const d = importWeights(emptyData(), [{ date: '2026-10-01', kg: 78 }, { date: '2026-10-10', kg: 77 }]);
    expect(weightAt(d, '2026-10-05', 75)).toBe(78);
    expect(weightAt(d, '2026-09-01', 75)).toBe(75);
  });

  it('averages by Monday-start week', () => {
    expect(weeklyAverages([
      { date: '2026-10-19', kg: 77 }, { date: '2026-10-21', kg: 78 }, { date: '2026-10-26', kg: 76.5 },
    ])).toEqual({ '2026-10-19': 77.5, '2026-10-26': 76.5 });
  });
});

describe('parseWeightCSV', () => {
  it('reads common formats and skips a header', () => {
    const { rows, errors } = parseWeightCSV('﻿日付,体重\n2026/10/20,77.4\n2026-10-21\t77.1kg\n"2026.10.22";76.9\n\n');
    expect(rows).toEqual([
      { date: '2026-10-20', kg: 77.4 }, { date: '2026-10-21', kg: 77.1 }, { date: '2026-10-22', kg: 76.9 },
    ]);
    expect(errors).toEqual([]);
  });

  it('reports bad rows with line numbers', () => {
    const { rows, errors } = parseWeightCSV('2026/10/20,77\nあ,1\n2026/10/21,5');
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/^2行目/);
  });
});

describe('ECLEAR export', () => {
  const csv = '年月日,時刻,体重,体脂肪率,骨格筋率,BMI\n2021/01/17,18:50,90.55,28.4,35.9,31.3\n2021/01/18,21:00,89.5,0,0,0\n2021/01/18,6:28,89.05,27.3,37.1,29.1\n';

  it('uses the 体重 column, skips time, keeps the earliest reading per day', () => {
    const { rows, errors } = parseWeightCSV(csv);
    expect(errors).toEqual([]);
    expect(rows).toEqual([{ date: '2021-01-17', kg: 90.6 }, { date: '2021-01-18', kg: 89.1 }]);
  });

  it('reads headerless date,time,weight rows', () => {
    expect(parseWeightCSV('2021/01/17,18:50,90.5').rows).toEqual([{ date: '2021-01-17', kg: 90.5 }]);
  });

  it('decodes Shift_JIS when not valid UTF-8', () => {
    const sjis = new Uint8Array([0x91, 0xcc, 0x8f, 0x64]); // 「体重」
    expect(decodeCSV(sjis)).toBe('体重');
    expect(decodeCSV(new TextEncoder().encode('体重'))).toBe('体重');
  });
});

describe('height and BMI', () => {
  it('stores height in profile', () => {
    expect(setHeight(emptyData(), 175.5).profile.height).toBe(175.5);
    expect(() => setHeight(emptyData(), 17)).toThrow();
  });

  it('computes BMI', () => {
    expect(bmi(77, 175.5)).toBe(25);
    expect(bmi(null, 175.5)).toBeNull();
  });
});
