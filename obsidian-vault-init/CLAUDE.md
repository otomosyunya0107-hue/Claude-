# CLAUDE.md（本ツール開発用）

> このファイルは **obsidian-vault-init を開発する Claude Code 向け** の指示です。
> `init` が **生成する** Vault 内の `CLAUDE.md`（`src/templates/claude-md.ts` が出力）とは別物。混同しないこと。

## このプロジェクトは何か
記事準拠の Obsidian「業務メモリ」Vault の初期構造を1コマンドで生成する Node.js/TypeScript 製 CLI。
責務は **scaffolding（足場づくり）に限定**。AI による継続的な読み書きは実行時の MCP に委ね、
初期化はローカル直書き（`node:fs`）で完結させる。

## 設計原則（変更時の判断基準）
1. **冪等性最優先** — 何度実行しても安全。既存ファイルは既定で絶対に上書きしない（`--force` 時のみ）。同じコマンドの2回目はすべて `skipped`、内容に差分を出さない。
2. **依存最小** — 重量級フレームワークを避け、`node:fs` / `node:util parseArgs` など標準モジュール中心。
3. **初期化は Obsidian/MCP に非依存** — scaffolding 段階で外部接続を要求しない（オフライン完結）。
4. **生成物は記事準拠** — フォルダ番号プレフィックス（`00_`〜`50_`）・命名規則・`00_Memory.md` の7項目を正確に再現する。
5. **wikilink 設計** — `00_Memory.md` を MOC（ハブ）とし、各項目は見出しで区切って AI がセクション単位で追記できる構造にする。
6. **パストラバーサル防止** — 全書き込みは `target-dir` 配下に正規化（`src/core/fs-safe.ts` の `resolveInside`）。
7. **出力の言語規約** — コード内の識別子・コメントは英語、ユーザーに見える出力（CLIメッセージ・生成 markdown）は日本語。

## ディレクトリ構成
- `src/cli.ts` — エントリポイント（引数解析 → コマンド呼び出し）
- `src/commands/init.ts` — `init` 本体（オプション解釈・ログ・サマリ・次の一手）
- `src/core/fs-safe.ts` — 安全な書き込み（既存スキップ／`--force`／パス正規化／LF 正規化）
- `src/core/scaffold.ts` — パス→内容マップを冪等に生成し `created/skipped/overwritten/planned` を返す
- `src/core/logger.ts` — 日本語 CLI 出力（色分け・`--quiet`）
- `src/templates/*.ts` — 生成される markdown 全文。`index.ts` が「相対パス→内容」マップを構築
- `test/` — 冪等性・生成物検証（vitest）

## 開発コマンド
```sh
npm install
npm run dev -- init ./tmp-vault --dry-run   # tsx でソース直接実行
npm run build                               # dist/ へ tsc ビルド
npm test                                    # vitest
```

## 変更時のチェックリスト
- テンプレートを変えたら、対応する受け入れ条件（`requirements.md` の 8 章 A1〜A15）を満たすか確認する。
- 生成物のパスやファイルを増減したら `src/templates/index.ts` と `test/` を同時に更新する。
- 新しいオプションは `src/cli.ts` のヘルプ（`HELP_TEXT`）と `README.md` の表に必ず反映する。
- `node:util parseArgs` は `--no-*` 否定フラグを自動展開しない。opt-out は `no-*` オプションを明示し反転させる（`src/cli.ts` 参照）。

## スコープ外（MVP では実装しない）
議事録の自動取り込み・connector 連携・専用セマンティック検索 MCP・MCP の自動インストール・同期セットアップ自動化。
詳細と将来拡張は `requirements.md` の 2.2 / 11 章を参照。
