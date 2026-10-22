# IRONLOG（筋トレ記録PWA）

iPhoneのホーム画面から即起動する筋トレ記録アプリ。PPL×種目×セット（重量・レップ）を記録し、週ごと・部位ごとのセット数／総負荷量／前週比／8週推移、種目別推定1RMを自動集計する。ビルド不要の素のHTML/JS。

## 構成

| ファイル | 役割 |
|---|---|
| `src/catalog.js` | 部位マスタ（19部位）・種目マスタ（略語付き） |
| `src/aggregate.js` | 週集計（主動筋1.0／協働筋0.5）、e1RM（Epley）、次の分割提案 |
| `src/store.js` | localStorage 保存、マージ |
| `src/sync.js` | GitHub Contents API で私的リポの `training.json` と同期 |
| `src/ui/*.js` | 記録・週集計・設定画面 |
| `sw.js` | オフライン起動用キャッシュ（更新時は `CACHE` の版を上げる） |
| `tools/import-md.mjs` | 旧 `2026筋トレ記録.md` → `training.json` 変換＋要確認レポート |

## 開発

```bash
npm test
python3 -m http.server 5178
```

## 同期の初期設定（iPhoneで1回だけ）

1. GitHub で私的リポジトリ（例 `training-data`）を作る
2. Settings → Developer settings → Fine-grained tokens → 対象をそのリポジトリだけ、Permissions は **Contents: Read and write** のみで発行
3. アプリの「設定」→ リポジトリ名・トークンを入れて「保存して同期」

トークンは端末の localStorage にのみ保存される。

## 旧メモの取り込み

```bash
node tools/import-md.mjs "<Obsidian>/2026筋トレ記録.md"
```

`import-out/training.json` をアプリの「設定 → JSON を読み込む」で取り込む。推測を含む行は `import-out/import-report.md` の「要確認」に一覧化される。
