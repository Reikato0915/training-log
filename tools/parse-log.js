// 旧Obsidian略記メモ（2026筋トレ記録.md）を記録データへ変換する。
// 書式が揺れているため推測を含む。推測した行は report に flags を付けて返す。
import { BUILTIN_EXERCISES } from '../src/catalog.js';

const LB_TO_KG = 0.45359237;
const MAX_REPS = 30;
const NEW_WEIGHT_RATIO = 0.6;
const DEFAULT_YEAR = 2026;

const SPLIT_WORDS = [
  [/^push\b/i, 'push'], [/^pull\b/i, 'pull'], [/^l1\b/i, 'legs1'], [/^l2\b/i, 'legs2'],
  [/^u[12]\b/i, 'other'], [/^p$/i, 'push'], [/^上半身/, 'other'], [/^back・肩/, 'other'],
];

// 取り込みのみで使う別名。null は「記録対象外（日メモへ）」
const IMPORT_ALIASES = {
  ディップス: 'dips', ベンチ: 'bench', 45: 'leg_press', '45 CR': 'calf_raise', ラット: 'lat_pulldown', ハンマー: 'wide_pulldown',
  振り子: null, ろーふりこ: null, ロー振り子: null, OBかい: null, SCR: null, U: null,
};
const PAIR_ALIASES = ['ABDADD', 'ADDABD', 'ABBADD', 'addabd', 'add abd', 'Abd Add'];

const norm = (s) => s.replace(/[\s　]+/g, ' ').trim();

function buildAliasTable() {
  const rows = [];
  for (const e of BUILTIN_EXERCISES) for (const a of [e.name, ...e.aliases]) rows.push([norm(a), e.id]);
  for (const [a, id] of Object.entries(IMPORT_ALIASES)) rows.push([a, id]);
  for (const a of PAIR_ALIASES) rows.push([a, 'PAIR']);
  return rows.sort((x, y) => y[0].length - x[0].length);
}
const ALIASES = buildAliasTable();

/** 行頭の種目名を最長一致で探す。英字略語の直後に英字が続く場合は不一致 */
export function matchExercise(line) {
  const text = norm(line);
  const lower = text.toLowerCase();
  for (const [alias, id] of ALIASES) {
    if (!lower.startsWith(alias.toLowerCase())) continue;
    const next = text.charAt(alias.length);
    if (/[A-Za-z]/.test(alias.slice(-1)) && /[A-Za-z]/.test(next)) continue;
    if (/\d$/.test(alias) && /\d/.test(next)) continue;
    return { id, alias, rest: text.slice(alias.length).trim() };
  }
  return null;
}

const TOKEN_RE = new RegExp([
  String.raw`(?<goal>\d+(?:\.\d+)?[^\s\d]*へ)`,
  String.raw`(?<sets>\d+)\s*(?:sets?|セット|tet)`,
  String.raw`(?<arrow>\d+(?:\.\d+)?(?:\s*→\s*\d+(?:\.\d+)?)+)`,
  String.raw`(?<times>\d+(?:\.\d+)?)\s*[×x]\s*(?<timesR>\d+)`,
  String.raw`(?<list>\d+(?:\+\d+)?(?:\s*,\s*\d+(?:\+\d+)?)+),?`,
  String.raw`(?<numtext>\d+(?!\s*(?:kg|lb|sets?|セット|tet))[ぁ-んァ-ヶ一-龠a-zA-Z]+)`,
  String.raw`(?<num>\d+(?:\.\d+)?)(?:\+(?<plus>\d+))?\s*(?<unit>kg|lb)?,?`,
  String.raw`(?<text>[^\s\d]+)`,
].join('|'), 'gi');

const repOf = (s) => {
  const [r, extra] = s.split('+').map(Number);
  return extra ? { reps: r, extra } : { reps: r };
};

/**
 * 種目名の後ろの文字列からセットを読む。
 * @returns {{ sets: {w:number|null,reps:number|null,extra?:number}[], memo: string, flags: string[] }}
 */
export function parseSets(rest, { carryW = null, repsOnly = false, defaultUnit = 'kg' } = {}) {
  const sets = [];
  const memo = [];
  const flags = new Set();
  let w = carryW;
  let pending = false; // 重量だけ出てまだレップが無い
  let lastWasBareRep = false;

  const closePending = () => { if (pending) sets.push({ w, reps: null }); pending = false; };
  const setWeight = (v) => { closePending(); w = v; pending = true; };
  const pushReps = (list) => { for (const r of list) sets.push({ w, ...r }); pending = false; };

  const src = norm(rest);
  const re = new RegExp(TOKEN_RE.source, TOKEN_RE.flags);
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const g = m.groups;
    const prevBare = lastWasBareRep;
    lastWasBareRep = false;
    if (g.goal || g.numtext) {
      memo.push(g.goal ?? g.numtext);
    } else if (g.sets) {
      const n = Number(g.sets);
      if (pending || !sets.length || sets.at(-1).w !== w) {
        for (let i = 0; i < n; i += 1) sets.push({ w, reps: null });
      } else {
        // 「110 8 3set」= 同重量で計3セット
        const have = sets.filter((s) => s.w === w).length;
        for (let i = have; i < n; i += 1) sets.push({ w, reps: null });
        if (have > n) flags.add('セット数不一致');
      }
      pending = false;
    } else if (g.arrow) {
      const vals = g.arrow.split('→').map(Number);
      const after = src.slice(m.index + m[0].length).match(/^\s*(\d+)\s*(?:sets?|セット)/i);
      if (pending && vals.every((v) => v <= MAX_REPS && Number.isInteger(v)) && !after) {
        pushReps(vals.map((r) => ({ reps: r })));
      } else if (after) {
        closePending();
        const n = Number(after[1]);
        for (let i = 0; i < n; i += 1) sets.push({ w: vals[Math.min(i, vals.length - 1)], reps: null });
        re.lastIndex = m.index + m[0].length + after[0].length;
        w = vals.at(-1);
      } else {
        closePending();
        for (const v of vals) sets.push({ w: v, reps: null });
        w = vals.at(-1);
      }
    } else if (g.times) {
      closePending();
      w = Number(g.times);
      pushReps([{ reps: Number(g.timesR) }]);
    } else if (g.list) {
      pushReps(g.list.split(',').map((s) => repOf(s.trim())));
    } else if (g.num) {
      let v = Number(g.num);
      if (g.unit?.toLowerCase() === 'lb') { v = Math.round(v * LB_TO_KG * 100) / 100; flags.add('lb→kg換算'); }
      const isDecimal = g.num.includes('.');
      if (repsOnly && !g.unit) { pushReps([{ reps: v }]); continue; }
      if (w == null && !pending && !sets.length) { setWeight(v); continue; }
      if (pending) {
        if (!isDecimal && /^\d{3,4}$/.test(g.num) && v > 2 * (w ?? 0) && [...g.num].every((d) => d !== '0')) {
          pushReps([...g.num].map((d) => ({ reps: Number(d) })));
          flags.add('連結数字を分解');
        } else if (isDecimal && v <= MAX_REPS && !g.num.endsWith('.5')) {
          pushReps(g.num.split('.').map((d) => ({ reps: Number(d) })));
          flags.add('小数をレップ2つと解釈');
        } else if (!isDecimal && v <= MAX_REPS && !g.unit) {
          if (w != null && w <= 2 * MAX_REPS && v >= NEW_WEIGHT_RATIO * w) flags.add('重量/レップが曖昧');
          pushReps([g.plus ? { reps: v, extra: Number(g.plus) } : { reps: v }]);
          lastWasBareRep = true;
          continue;
        } else {
          setWeight(v);
          flags.add('重量のみ（レップ不明）');
        }
      } else {
        const afterFailed = sets.length > 0 && (sets.at(-1).reps ?? 2) <= 1;
        const looksWeight = isDecimal || v > MAX_REPS || g.unit || afterFailed || (w != null && v >= NEW_WEIGHT_RATIO * w);
        if (looksWeight) setWeight(v);
        else {
          if (prevBare) flags.add('レップ連続（重量の可能性）');
          pushReps([g.plus ? { reps: v, extra: Number(g.plus) } : { reps: v }]);
          lastWasBareRep = true;
          continue;
        }
      }
    } else if (g.text) {
      memo.push(g.text);
    }
  }
  closePending();
  if (defaultUnit === 'lb') {
    // lb 表記の種目は最後にまとめて kg へ換算（明示的に kg/lb と書いた値は換算済み扱いにしない簡易処理）
    flags.add('lb→kg換算');
    const toKg = (x) => (x == null ? x : Math.round(x * LB_TO_KG * 100) / 100);
    return { sets: sets.map((st) => ({ ...st, w: toKg(st.w) })), memo: memo.join(' '), flags: [...flags], lastW: toKg(w) };
  }
  return { sets, memo: memo.join(' '), flags: [...flags], lastW: w };
}

function parsePair(rest) {
  const n = Number(rest.match(/(\d+)\s*(?:sets?|セット)/i)?.[1] ?? 1);
  const nums = rest.replace(/(\d+)\s*(?:sets?|セット)/gi, '').match(/\d+(?:\.\d+)?/g) ?? [];
  const weights = nums.flatMap((x) => (/^\d{6}$/.test(x) ? [Number(x.slice(0, 3)), Number(x.slice(3))] : [Number(x)]));
  const flags = nums.some((x) => /^\d{6}$/.test(x)) ? ['連結数字を分解'] : [];
  const rep = (ws) => ws.flatMap((wt) => Array.from({ length: n }, () => ({ w: wt, reps: null })));
  const add = weights.length ? [weights[0]] : [null];
  const abd = weights.length > 1 ? weights.slice(1) : add;
  const memo = rest.replace(/[\d\s.]+|sets?|セット/gi, ' ').trim();
  return { entries: [['adduction', rep(add)], ['abduction', rep(abd)]], memo, flags };
}

const BELT_SQUAT_MIN_KG = 60; // 旧メモの「BS」は重量でブルガリアン/ベルトを判定
const GYM_MAP = [[/^PHG/i, 'パワーハウスジム大阪'], [/^ノース/, 'パワーハウスジムノース大阪'], [/^(ラスト|GG)?(烏丸|からすま)/i, 'ゴールドジム京都烏丸']];

/** 日付行の残りから「@ジム名」を取り出す */
export function splitGym(rest) {
  const m = rest.match(/[@＠]\s*(.+?)(?=\s*with|\s|$)/i);
  if (!m) return { gym: null, rest: rest.trim() };
  const gym = GYM_MAP.find(([re]) => re.test(m[1]))?.[1] ?? m[1];
  return { gym, rest: `${rest.slice(0, m.index)} ${rest.slice(m.index + m[0].length)}`.replace(/\s+/g, ' ').trim() };
}

const NO_DESC_RULE = new Set(['chinning']); // 「12.5 9」は加重×レップ

/** 「35 25 20」「30 25 3set」のような単調減少の数字列＝重量の降順（レップ不明） */
export function parseDescending(rest) {
  const m = norm(rest).match(/^((?:\d+(?:\.\d+)?\s+)+\d+(?:\.\d+)?)(?:\s+(\d+)\s*(?:sets?|セット))?$/i);
  if (!m) return null;
  const ws = m[1].split(/\s+/).map(Number);
  // 次の数字が前の半分未満なら「重量 レップ」とみなす（例 AC 40 8）
  if (ws.some((w, i) => i > 0 && (w >= ws[i - 1] || (w > 0 && w < ws[i - 1] / 2)))) return null;
  const n = Math.max(Number(m[2] ?? ws.length), ws.length);
  return Array.from({ length: n }, (_, i) => ({ w: ws[Math.min(i, ws.length - 1)], reps: null }));
}

const REPS_ONLY = new Set(['dragon_flag', 'ab_crunch']);
const DATE_RE = /^(?:(\d{4})\/)?(\d{1,2})\/(\d{1,2})(?!\d)\s*(.*)$/;

/** md全体 → { sessions, report } */
export function parseLog(text) {
  const sessions = [];
  const report = [];
  let cur = null;
  let lastEntry = null;

  const flush = () => { if (cur) sessions.push(cur); };
  const addMemo = (s) => { if (cur && s) cur.memo = cur.memo ? `${cur.memo}\n${s}` : s; };
  const note = (line, summary, flags) => report.push({ date: cur?.date ?? '', line, summary, flags });

  for (const raw of text.split('\n')) {
    if (/^---\s*$/.test(raw)) break;
    const line = norm(raw);
    if (!line || line.startsWith('#') || line.startsWith('[[')) continue;

    const d = line.match(DATE_RE);
    if (d) {
      flush();
      let year = Number(d[1] ?? DEFAULT_YEAR);
      const flags = [];
      if (year !== DEFAULT_YEAR) { flags.push(`年 ${year}→${DEFAULT_YEAR}`); year = DEFAULT_YEAR; }
      const date = `${year}-${d[2].padStart(2, '0')}-${d[3].padStart(2, '0')}`;
      const { gym, rest } = splitGym(d[4]);
      cur = { id: `import-${date}`, date, split: 'other', gym, memo: '', exercises: [], updatedAt: `${date}T00:00:00.000Z` };
      lastEntry = null;
      const sp = SPLIT_WORDS.find(([re]) => re.test(rest));
      if (sp) { cur.split = sp[1]; addMemo(rest.replace(sp[0], '').trim()); } else addMemo(rest);
      if (flags.length) note(raw, date, flags);
      continue;
    }
    if (!cur) continue;

    const sp = SPLIT_WORDS.find(([re]) => re.test(line));
    if (sp && cur.split === 'other' && !cur.exercises.length) {
      cur.split = sp[1];
      addMemo(line.replace(sp[0], '').replace(/^[、,\s]+/, '').trim());
      continue;
    }

    const isContinuation = /^[\s　]/.test(raw) || /^\d/.test(line);
    const hit = matchExercise(line);

    if (hit?.id === 'PAIR') {
      const p = parsePair(hit.rest);
      for (const [exId, sets] of p.entries) cur.exercises.push({ exId, memo: p.memo, sets, source: raw.trim() });
      lastEntry = cur.exercises.at(-1);
      note(raw, `アダクション ${fmt(p.entries[0][1])} / アブダクション ${fmt(p.entries[1][1])}`, p.flags);
    } else if (hit && hit.id === null) {
      addMemo(line);
      note(raw, '対象外 → 日メモ', []);
    } else if (hit) {
      const def = BUILTIN_EXERCISES.find((e) => e.id === hit.id);
      const desc = NO_DESC_RULE.has(hit.id) || REPS_ONLY.has(hit.id) ? null : parseDescending(hit.rest);
      const p = desc
        ? { sets: def?.unit === 'lb' ? desc.map((x) => ({ ...x, w: Math.round(x.w * LB_TO_KG * 100) / 100 })) : desc, memo: '', flags: ['重量の降順と解釈'], lastW: null }
        : parseSets(hit.rest, { repsOnly: REPS_ONLY.has(hit.id), defaultUnit: def?.unit ?? 'kg' });
      if (hit.alias.toUpperCase() === 'BS') {
        const maxW = Math.max(0, ...p.sets.map((x) => x.w ?? 0));
        hit.id = maxW >= BELT_SQUAT_MIN_KG ? 'belt_squat' : 'bulgarian';
        p.flags.push(`BSを重量${maxW}kgで${hit.id === 'belt_squat' ? 'ベルト' : 'ブルガリアン'}と判定`);
      }
      lastEntry = { exId: hit.id, ...(def?.unit ? { unit: def.unit } : {}), memo: p.memo, sets: p.sets, source: raw.trim(), lastW: p.lastW };
      cur.exercises.push(lastEntry);
      note(raw, `${hit.id}: ${fmt(p.sets)}`, p.flags);
    } else if (isContinuation && lastEntry) {
      const p = parseSets(line);
      lastEntry.sets.push(...p.sets);
      if (p.memo) lastEntry.memo = [lastEntry.memo, p.memo].filter(Boolean).join(' ');
      lastEntry.source += ` / ${line}`;
      note(raw, `↑続き ${lastEntry.exId}: ${fmt(p.sets)}`, ['前行の続きとして処理', ...p.flags]);
    } else {
      // 種目が特定できない行は日メモ。分割語を含めば分割も推定
      const inline = line.match(/(?:^|[^A-Za-z])(L1|L2|push|pull)(?![A-Za-z0-9])/i);
      if (inline && cur.split === 'other') {
        cur.split = SPLIT_WORDS.find(([re]) => re.test(inline[1]))[1];
      }
      addMemo(line);
      if (/\d/.test(line)) note(raw, '日メモへ', ['不明']);
    }
  }
  flush();
  for (const s of sessions) for (const e of s.exercises) delete e.lastW;
  return { sessions, report };
}

const fmt = (sets) => sets.map((s) => `${s.w ?? '-'}×${s.reps ?? '?'}${s.extra ? `+${s.extra}` : ''}`).join(', ') || '(セットなし)';
