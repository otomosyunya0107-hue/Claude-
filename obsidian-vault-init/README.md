# obsidian-vault-init

AIエージェント（Claude）に毎回ゼロから自社・顧客・案件を説明する状態をやめ、
**「記憶を持った業務エージェント」** を作るための第一歩。
Obsidian Vault を業務メモリ（引き継ぎ書）として構造化する初期構造を、
**1コマンド** で再現可能に生成する CLI です。

記事「【Claude × Obsidian】本物のAI社員を作る方法」（東大ClaudeCode研究所）が定義する
最小構成（6フォルダ + 起点ファイル + 7項目の Memory）を、手作業ではなくツールで再現します。

## インストール不要で実行

```sh
npx obsidian-vault-init init ./my-vault
```

グローバルインストールは不要です。`npx` でそのまま実行できます。

## 何が生成されるか

```
my-vault/
├── 00_Memory.md              # ★起点ファイル（7項目の MOC / 引き継ぎ書）
├── 10_Clients/
│   └── _template.md          # 顧客1社あたりの雛形
├── 20_Actions.md             # オープンなタスク一覧
├── 30_Library/
│   ├── _index.md             # 本棚の目次
│   ├── frameworks.md         # フレームワーク・SOP
│   ├── pricing.md            # 価格表
│   └── faq.md                # よくある質問
├── 40_Templates/
│   ├── meeting-minutes.md    # 議事録テンプレ
│   ├── proposal.md           # 提案書テンプレ
│   └── followup-email.md     # フォローアップメールテンプレ
├── 50_Transcripts/
│   └── _template.md          # 文字起こし保管の雛形（命名規則の見本）
├── CLAUDE.md                 # Claude Code に「回答前に Vault を検索」させる指示
└── SETUP_MCP.md              # MCP 接続手順（Local REST API プラグイン）
```

フォルダ頭の番号（`00_` `10_` …）は、Obsidian サイドバーの並び順を固定して
「よく見るものを上」に置くための命名規則です。

## 使い方

```
npx obsidian-vault-init init [target-dir] [options]
```

| フラグ | 説明 |
|---|---|
| `--name <name>` | Vault 名（既定: ディレクトリ名） |
| `--force` | 既存ファイルを上書きする（既定: 既存はスキップ） |
| `--dry-run` | 書き込まず、生成予定の一覧のみ表示する |
| `--no-claude-md` | `CLAUDE.md` を生成しない |
| `--no-setup-guide` | `SETUP_MCP.md` を生成しない |
| `--quiet` | 進捗ログを抑制し、結果サマリのみ表示する |
| `-h, --help` | ヘルプを表示する |
| `-v, --version` | バージョンを表示する |

### 例

```sh
# カレントディレクトリに生成
npx obsidian-vault-init init

# 生成予定を確認だけする（書き込まない）
npx obsidian-vault-init init ./my-vault --dry-run

# 既存ファイルも上書きして作り直す
npx obsidian-vault-init init ./my-vault --force
```

## 安全性・冪等性

- **既存ファイルは既定で絶対に上書きしません。** `--force` を付けたときだけ上書きします。
- 同じコマンドを2回実行しても、2回目はすべて `skipped` になり、内容に差分は出ません。
- 生成先（`target-dir`）の外（`../` など）へは書き込みません（パストラバーサル防止）。
- 初期化処理はオフラインで完結します（Obsidian / MCP の起動は不要）。

## 生成後の3ステップ

1. **Obsidian でこのフォルダを Vault として開く**
2. `SETUP_MCP.md` に従って **Local REST API プラグインと MCP 接続を設定する**
3. `00_Memory.md` の **7項目を自分の情報で埋める**

## 開発

```sh
npm install        # 依存をインストール
npm run dev -- init ./tmp-vault --dry-run   # ソースを直接実行（tsx）
npm run build      # dist/ にビルド
npm test           # 冪等性・生成物検証テスト（vitest）
```

- Node.js >= 18（`node:util` の `parseArgs` を使用）
- TypeScript / ESM。依存は最小（重量級フレームワークは不使用）

## ライセンス

MIT
