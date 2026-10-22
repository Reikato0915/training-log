// 使い方: node tools/import-md.mjs <2026筋トレ記録.md> [出力先ディレクトリ]
// training.json（アプリの「JSONを読み込む」で取り込める）と import-report.md を出力。元mdは変更しない。
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseLog } from './parse-log.js';
import { applyUnitRules } from './unit-rules.js';
import { applyOverrides } from './overrides.js';
import { BUILTIN_EXERCISES } from '../src/catalog.js';

const [src, outDir = 'import-out'] = process.argv.slice(2);
if (!src) {
  process.stderr.write('usage: node tools/import-md.mjs <md> [outDir]\n');
  process.exit(1);
}

const parsed = parseLog(readFileSync(src, 'utf8'));
const overridden = applyOverrides(parsed.sessions);
const { sessions, converted } = applyUnitRules(overridden.sessions);
const lbKeys = new Set(converted.map((c) => `${c.date}|${c.exId}`));
const report = parsed.report.map((r) => {
  const id = r.summary.match(/^(?:↑続き )?([a-z_]+):/)?.[1];
  return id && lbKeys.has(`${r.date}|${id}`) ? { ...r, flags: [...r.flags, 'lb→kg換算（ルール）'] } : r;
});
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'training.json'), JSON.stringify({ version: 1, sessions, customExercises: [] }, null, 1));

const nameOf = Object.fromEntries(BUILTIN_EXERCISES.map((e) => [e.id, e.name]));
const pretty = (s) => s.replace(/^([a-z_]+):/, (_, id) => `${nameOf[id] ?? id}:`).replace(/^↑続き ([a-z_]+):/, (_, id) => `↑続き ${nameOf[id] ?? id}:`);
const flagged = report.filter((r) => r.flags.length);
const lines = [
  '# 筋トレ記録 取り込みレポート', '',
  `- 取り込み日数: ${sessions.length}`,
  `- 種目行: ${report.length}（うち要確認 ${flagged.length}）`, '',
  '## 要確認（推測を含む行）', '',
  '| 日付 | 原文 | 解釈 | 理由 |', '|---|---|---|---|',
  ...flagged.map((r) => `| ${r.date} | \`${r.line.trim()}\` | ${pretty(r.summary)} | ${r.flags.join('、')} |`),
  '', '## 全行', '',
  '| 日付 | 原文 | 解釈 |', '|---|---|---|',
  ...report.map((r) => `| ${r.date} | \`${r.line.trim()}\` | ${pretty(r.summary)} |`),
];
writeFileSync(join(outDir, 'import-report.md'), lines.join('\n'));
process.stdout.write(`overrides: ${overridden.applied.join(' ')}\n${sessions.length} sessions, ${report.length} lines, ${flagged.length} flagged → ${outDir}\n`);
