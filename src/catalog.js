// 部位マスタと種目マスタ。種目の aliases は既存メモの略記と検索に使う。

export const MUSCLES = [
  { id: 'chest_upper', name: '大胸筋上部', region: 'push' },
  { id: 'chest_mid', name: '大胸筋中下部', region: 'push' },
  { id: 'delt_front', name: '三角筋前部', region: 'push' },
  { id: 'delt_side', name: '三角筋中部', region: 'push' },
  { id: 'triceps', name: '上腕三頭筋', region: 'push' },
  { id: 'lat_upper', name: '広背筋上部・大円筋', region: 'pull' },
  { id: 'lat_lower', name: '広背筋中下部・僧帽筋中下部', region: 'pull' },
  { id: 'trap_upper', name: '僧帽筋上部', region: 'pull' },
  { id: 'delt_rear', name: '三角筋後部', region: 'pull' },
  { id: 'biceps', name: '上腕二頭筋', region: 'pull' },
  { id: 'forearm', name: '前腕', region: 'pull' },
  { id: 'erector', name: '脊柱起立筋', region: 'legs' },
  { id: 'quads', name: '大腿四頭筋', region: 'legs' },
  { id: 'hams', name: 'ハムストリングス', region: 'legs' },
  { id: 'glute_max', name: '大殿筋', region: 'legs' },
  { id: 'glute_med', name: '中殿筋・外転筋群', region: 'legs' },
  { id: 'adductor', name: '内転筋群', region: 'legs' },
  { id: 'calves', name: '下腿三頭筋', region: 'legs' },
  { id: 'abs', name: '腹筋群', region: 'legs' },
];

export const SPLITS = [
  { id: 'push', name: 'Push' },
  { id: 'pull', name: 'Pull' },
  { id: 'legs1', name: 'Legs1' },
  { id: 'legs2', name: 'Legs2' },
  { id: 'other', name: 'その他' },
];

// 種目の分類（split）は候補表示用。legs1/legs2 はどちらも 'legs' の種目を出す。
const ex = (id, name, split, primary, secondary = [], aliases = [], extra = {}) =>
  Object.freeze({ id, name, split, primary, secondary, aliases, bodyweight: false, ...extra });

export const BUILTIN_EXERCISES = [
  // push
  ex('bench', 'ベンチプレス', 'push', ['chest_mid'], ['chest_upper', 'delt_front', 'triceps'], ['BP', 'ベンチ', 'bench']),
  ex('incline_bench', 'インクラインベンチプレス', 'push', ['chest_upper'], ['delt_front', 'triceps'], ['IBP']),
  ex('db_press', 'ダンベルプレス', 'push', ['chest_mid'], ['chest_upper', 'delt_front', 'triceps'], ['DBP']),
  ex('dips', 'ディップス', 'push', ['chest_mid'], ['triceps', 'delt_front'], ['dips', 'Dips wide'], { bodyweight: true }),
  ex('chest_press', 'チェストプレス', 'push', ['chest_mid'], ['delt_front', 'triceps'], ['CP']),
  ex('incline_cp', 'インクラインチェストプレス', 'push', ['chest_upper'], ['delt_front', 'triceps'], ['ICP']),
  ex('decline_cp', 'デクラインチェストプレス', 'push', ['chest_mid'], ['triceps'], ['DCP']),
  ex('pec_fly', 'ペックフライ（マシン）', 'push', ['chest_mid'], ['chest_upper'], ['PM', 'ペックデック']),
  ex('cable_fly', 'ケーブルフライ', 'push', ['chest_mid'], ['chest_upper'], ['CF']),
  ex('shoulder_press', 'ショルダープレス', 'push', ['delt_front'], ['delt_side', 'triceps'], ['SP']),
  ex('side_raise', 'サイドレイズ', 'push', ['delt_side'], [], ['SR']),
  ex('lateral_raise', 'ラテラルレイズ', 'push', ['delt_side'], [], ['LR']),
  ex('cable_side_raise', 'ケーブルサイドレイズ', 'push', ['delt_side'], [], ['CSR']),
  ex('front_raise', 'フロントレイズ', 'push', ['delt_front'], [], ['FR']),
  ex('upright_row', 'アップライトロウ', 'push', ['delt_side'], ['trap_upper'], ['URR']),
  ex('skull_crusher', 'スカルクラッシャー', 'push', ['triceps'], [], ['SC']),
  ex('pushdown', 'プレスダウン', 'push', ['triceps'], [], ['PD']),
  ex('triceps_ext', 'トライセプスエクステンション', 'push', ['triceps'], [], ['TE']),
  // pull
  ex('chinning', 'チニング', 'pull', ['lat_upper'], ['lat_lower', 'biceps'], ['chinning', 'チンニング', '懸垂'], { bodyweight: true }),
  ex('lat_pulldown', 'ラットプルダウン', 'pull', ['lat_upper'], ['lat_lower', 'biceps'],
    ['ラット', 'Lat', 'LPD', 'レバレッジラット', 'レバレッジ', '片側ラット']),
  ex('wide_pulldown', 'ワイドプルダウン', 'pull', ['lat_upper'], ['lat_lower', 'biceps'], ['ハンマー　ワイドプルダウン', 'ハンマー ワイドプルダウン']),
  ex('tbar_row', 'Tバーロウ', 'pull', ['lat_lower'], ['lat_upper', 'delt_rear', 'biceps'], ['Tバー', 'T bar', 'Tbar']),
  ex('cable_row', 'ケーブルロー', 'pull', ['lat_lower'], ['lat_upper', 'biceps'], ['シーテッドロー']),
  ex('pulley_row', 'プーリーロウ', 'pull', ['lat_lower'], ['lat_upper', 'biceps'], ['プリーロウ', 'プリー', 'プーリー'], { unit: 'lb' }),
  ex('mid_row', 'ミッドロー', 'pull', ['lat_lower'], ['lat_upper', 'biceps']),
  ex('one_hand_row', 'ワンハンドロー', 'pull', ['lat_lower'], ['lat_upper', 'biceps']),
  ex('ih_row', 'IH式ロー', 'pull', ['lat_lower'], ['lat_upper', 'biceps']),
  ex('shrug', 'シュラッグ', 'pull', ['trap_upper'], ['forearm'], ['shrug']),
  ex('face_pull', 'フェイスプル', 'pull', ['delt_rear'], ['lat_lower'], ['FP']),
  ex('rear_delt', 'リアデルト', 'pull', ['delt_rear'], [], ['リアデルトフライ', 'RD']),
  ex('arm_curl', 'アームカール', 'pull', ['biceps'], ['forearm'], ['AC']),
  ex('incline_curl', 'インクラインダンベルカール', 'pull', ['biceps'], [], ['IAC']),
  ex('hammer_curl', 'ハンマーカール', 'pull', ['biceps'], ['forearm']),
  ex('deadlift', 'デッドリフト', 'pull', ['erector'], ['glute_max', 'hams', 'trap_upper'], ['DL']),
  // legs
  ex('squat', 'スクワット', 'legs', ['quads'], ['glute_max', 'adductor', 'erector'], ['SQ']),
  ex('belt_squat', 'ベルトスクワット', 'legs', ['quads'], ['glute_max'], ['Belt', 'BSQ']),
  ex('hack_squat', 'ハックスクワット', 'legs', ['quads'], ['glute_max'], ['HS']),
  ex('bulgarian', 'ブルガリアンスクワット', 'legs', ['quads'], ['glute_max', 'adductor'], ['BS']),
  ex('leg_press', 'レッグプレス', 'legs', ['quads'], ['glute_max'], ['LP', '45LP', '45 LP']),
  ex('leg_ext', 'レッグエクステンション', 'legs', ['quads'], [], ['LE']),
  ex('ih_leg_ext', 'IH式レッグエクステンション', 'legs', ['quads'], [], ['IHLE', 'IH LE', 'IH式LE']),
  ex('lying_leg_curl', 'ライイングレッグカール', 'legs', ['hams'], [], ['PLC']),
  ex('seated_leg_curl', 'シーテッドレッグカール', 'legs', ['hams'], [], ['LC']),
  ex('rdl', 'ルーマニアンデッドリフト', 'legs', ['hams'], ['glute_max', 'erector'], ['RDL']),
  ex('hip_thrust', 'ヒップスラスト', 'legs', ['glute_max'], ['hams'], ['HT', 'Hip thrust']),
  ex('calf_raise', 'カーフレイズ', 'legs', ['calves'], [], ['CR']),
  ex('adduction', 'アダクション', 'legs', ['adductor'], [], ['add']),
  ex('abduction', 'アブダクション', 'legs', ['glute_med'], [], ['abd']),
  ex('dragon_flag', 'ドラゴンフラッグ', 'legs', ['abs'], [], ['DF']),
  ex('ab_crunch', 'アブドミナルクランチ', 'legs', ['abs'], [], ['クランチ']),
];

// 重量は常に kg で保存し、lb 表示の種目（プレート式マシン等）は入出力時だけ換算する
export const LB_TO_KG = 0.45359237;
export const UNITS = ['kg', 'lb'];
/** 種目の既定単位（記録ごとの entry.unit が優先） */
export const unitOf = (exercise) => exercise?.unit ?? 'kg';
export const toDisplayWeight = (kg, unit) =>
  (kg == null || unit !== 'lb' ? kg : Math.round((kg / LB_TO_KG) * 10) / 10);
export const fromDisplayWeight = (v, unit) =>
  (v == null || unit !== 'lb' ? v : Math.round(v * LB_TO_KG * 1000) / 1000);

export const muscleName = (id) => MUSCLES.find((m) => m.id === id)?.name ?? id;

export const allExercises = (custom = []) => [...BUILTIN_EXERCISES, ...custom];

export const findExercise = (id, custom = []) => allExercises(custom).find((e) => e.id === id);

// 分割に合う種目。legs1/legs2 は legs、other は全種目。
export function exercisesForSplit(split, custom = []) {
  const list = allExercises(custom);
  if (split === 'other') return list;
  const key = split.startsWith('legs') ? 'legs' : split;
  return list.filter((e) => e.split === key);
}

const normalize = (s) => s.toLowerCase().replace(/[\s　]+/g, '');

// 検索：名称・略語の部分一致（大文字小文字・空白無視）
export function searchExercises(query, custom = []) {
  const q = normalize(query);
  if (!q) return allExercises(custom);
  return allExercises(custom).filter((e) =>
    [e.name, ...e.aliases].some((s) => normalize(s).includes(q)));
}

export function makeCustomExercise({ name, split, primary, secondary = [], bodyweight = false }) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw new Error('種目名を入力してください');
  if (!primary?.length) throw new Error('主に使う部位を1つ以上選んでください');
  const valid = new Set(MUSCLES.map((m) => m.id));
  const bad = [...primary, ...secondary].filter((m) => !valid.has(m));
  if (bad.length) throw new Error(`不明な部位: ${bad.join(', ')}`);
  return ex(`custom_${Date.now().toString(36)}`, trimmed, split, [...primary],
    secondary.filter((m) => !primary.includes(m)), [], { bodyweight, custom: true });
}
