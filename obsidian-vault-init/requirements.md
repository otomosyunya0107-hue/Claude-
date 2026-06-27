# 要件定義書 / 実装指示書：Obsidian 業務メモリ Vault 初期化ツール（MVP）

> **このドキュメントの使い方（Claude Code向け）**
> これは実装指示書である。本書をプロジェクトルートに置き、本書の指示に従って実装すること。
> 仕様に曖昧な点があれば、本書の「設計原則」と「受け入れ条件」を優先的な判断基準とすること。
> 実装は「9. 実装順序」のフェーズ順に進めること。各フェーズ完了時に「8. 受け入れ条件」の該当項目を満たしているか自己検証してから次へ進むこと。
> コード内の識別子・コメントは英語、ユーザーに見える出力（CLIメッセージ・生成されるVault内のmarkdown）は日本語とする。

---

## 1. プロジェクト概要とゴール

### 1.1 背景
AIエージェント（Claude）に毎回ゼロから自社・顧客・進行中案件を説明している状態を脱却し、「記憶を持った業務エージェント」を作る。そのために、Obsidian Vault を**業務メモリ（引き継ぎ書）**として構造化し、Claude がそれを読み書きできるようにする。

本ツールは、その第一歩である **「Vault の初期構造を一発で生成する CLI」** を実装するものである。記事（出典：東大ClaudeCode研究所「【Claude × Obsidian】本物のAI社員を作る方法」）が定義する最小構成を、手作業ではなくツールで再現可能にする。

### 1.2 このツールが解決する課題
- Vault のディレクトリ構成・命名規則・Memory ファイルの 7 項目雛形を、毎回手で作るのは再現性がなく面倒。
- 記事の構成を正確に再現したいが、フォルダのプレフィックス番号や wikilink 設計などの細部を覚えていられない。
- Claude Code 側の `CLAUDE.md`（Vault を読みに行かせる 1 行）や、MCP 接続の前提を、毎回調べ直すのが非効率。

### 1.3 ゴール（MVP の完成定義）
次の 3 つが 1 コマンドで揃うこと。
1. 記事準拠の Vault ディレクトリ構造（6 フォルダ構成 + 起点ファイル）と、各雛形 markdown が生成される。
2. `00_Memory.md` が 7 項目の見出しを持つ MOC（Map of Content）として生成され、`[[wikilink]]` のプレースホルダが入っている。
3. Claude Code 用の `CLAUDE.md`（Vault を検索してから回答させる指示）と、MCP セットアップ手順書が生成される。

---

## 2. スコープ（MVP の線引き）

### 2.1 MVP に含めるもの（IN SCOPE）
| # | 項目 | 概要 |
|---|---|---|
| S1 | Vault 初期化 CLI 本体 | `init` コマンドで Vault 構造を生成する Node.js/TypeScript 製 CLI |
| S2 | ディレクトリ scaffolding | 記事の 6 フォルダ構成 + 起点ファイルをローカルファイルシステムに直接生成 |
| S3 | Memory 雛形生成 | `00_Memory.md` を 7 項目の MOC として生成（wikilink プレースホルダ入り） |
| S4 | 各フォルダの雛形ファイル生成 | `10_Clients/` `20_Actions.md` `30_Library/` `40_Templates/` `50_Transcripts/` の雛形 |
| S5 | `CLAUDE.md` 生成 | Claude Code に「回答前に Vault を検索させる」指示を含むファイルを生成 |
| S6 | MCP セットアップ手順書生成 | `SETUP_MCP.md` を生成し、Local REST API プラグイン導入と `claude mcp add` 手順を記載 |
| S7 | 冪等性・安全性 | 既存ファイルを破壊しない。`--dry-run` で事前確認できる |

### 2.2 MVP に含めないもの（OUT OF SCOPE：将来拡張として記載のみ）
| # | 項目 | 理由 |
|---|---|---|
| O1 | 議事録の自動取り込み（Notta/tl;dv → Google Drive → Vault） | 外部サービス連携・認証が必要。MVP の「3 ステップ最小構成」外 |
| O2 | Slack / Gmail / Calendar connector 連携 | 同上。記事も「必要を感じてから順に足す」としている |
| O3 | セマンティック検索専用 MCP サーバー | 記事が挙げた obsidian-mcp-tools はアーカイブ済み。MVP は全文検索で足りる |
| O4 | MCP サーバーの自動インストール・自動設定 | Obsidian 起動・プラグイン導入・証明書信頼が絡み環境依存が大きい。MVP では手順書提示にとどめる |
| O5 | Vault の同期セットアップ自動化 | 同期は環境ごとに方針が異なるため、制約条件の提示にとどめる |

> **設計判断の根拠**：本ツールの責務は「Vault の足場づくり（scaffolding）」に限定する。AI による継続的な読み書きは MCP 経由（実行時）に委ね、初期化はローカル直書きで完結させる。この役割分担により、Obsidian 未起動・プラグイン未設定の状態でも初期化が成立する。

---

## 3. 技術スタックの確定

| 領域 | 採用技術 | 確定理由 |
|---|---|---|
| CLI ランタイム | **Node.js（>= 18）/ TypeScript** | `npx` でインストール不要のワンショット実行が可能 |
| 配布方法 | **npx 実行前提**（`bin` エントリを持つ npm パッケージ） | グローバルインストール不要。`npx <pkg> init` で即実行 |
| Vault 生成方式 | **ローカルファイルシステムへ直接書き込み**（`node:fs`） | 初期化時に Obsidian/MCP に依存しない。冪等な `mkdir` + `writeFile` で完結 |
| AI 連携（実行時） | **coddingtonbear/obsidian-local-rest-api 同梱の公式 MCP サーバー** に Claude Code から HTTP 直結 | プラグイン本体が MCP を内蔵。外部サーバー不要 |
| Claude Code 指示 | **プロジェクトルートの `CLAUDE.md`** | セッション開始時に全文がロードされる公式仕様 |
| 引数パーサ | **軽量実装または最小依存**（`node:util` の `parseArgs`） | 依存を最小化 |
| テスト | **Vitest または node:test** | scaffolding の冪等性・生成物の検証に使用 |

> **重要な前提情報（調査で判明）**
> - jacksteamdev/obsidian-mcp-tools は 2026-05-13 にアーカイブ（read-only）化されており、新規採用しない。
> - Local REST API プラグインが公式 MCP サーバーを同梱したため、Claude Code から `https://127.0.0.1:27124/mcp/` に直結できる。これを MVP の標準経路とする。

---

## 4. 成果物（リポジトリ構成）

```
obsidian-vault-init/
├── package.json                # bin エントリ・依存・scripts
├── tsconfig.json
├── README.md                   # ツールの使い方
├── requirements.md             # 本書
├── CLAUDE.md                   # （本ツール開発用。Claude Code への開発指示）
├── src/
│   ├── cli.ts                  # エントリポイント（引数解析 → コマンド呼び出し）
│   ├── commands/
│   │   └── init.ts             # init コマンドの実装本体
│   ├── core/
│   │   ├── scaffold.ts         # ディレクトリ・ファイル生成ロジック（冪等）
│   │   ├── fs-safe.ts          # 安全な書き込み（既存スキップ／--force 制御）
│   │   └── logger.ts           # CLI 出力（日本語メッセージ・色分け・--quiet 対応）
│   ├── templates/
│   │   ├── index.ts            # テンプレート定義の集約（パス → 内容のマップ）
│   │   ├── memory.ts           # 00_Memory.md（7 項目 MOC）
│   │   ├── actions.ts          # 20_Actions.md
│   │   ├── client.ts           # 10_Clients/_template.md（顧客 1 社雛形）
│   │   ├── library.ts          # 30_Library/ の雛形群
│   │   ├── meeting-template.ts # 40_Templates/ の雛形群
│   │   ├── transcript.ts       # 50_Transcripts/_template.md
│   │   ├── claude-md.ts        # 生成される Vault 用 CLAUDE.md
│   │   └── setup-mcp.ts        # SETUP_MCP.md
│   └── types.ts                # 型定義（InitOptions など）
└── test/
    ├── scaffold.test.ts        # 冪等性・生成物検証
    └── idempotency.test.ts     # 2 回実行で差分が出ないこと
```

> **注意**：プロジェクトルートの `CLAUDE.md` は「本ツールを開発する Claude Code 向け」の指示ファイル。生成物として Vault 内に置かれる `CLAUDE.md`（`src/templates/claude-md.ts` が出力）とは別物。

---

## 5. CLI 詳細仕様

### 5.1 コマンド体系
```
npx obsidian-vault-init init [target-dir] [options]
```
- `target-dir`（位置引数、省略可）：Vault を生成するディレクトリ。省略時はカレントディレクトリ（`.`）。
- MVP では `init` のみ実装する。将来 `add-client` 等を足せるようサブコマンド方式で設計する。

### 5.2 オプション
| フラグ | 型 | 既定値 | 説明 |
|---|---|---|---|
| `--name <name>` | string | ディレクトリ名 | Vault 名 |
| `--force` | boolean | false | 既存ファイルを上書きする |
| `--dry-run` | boolean | false | 書き込まず生成予定一覧のみ表示 |
| `--no-claude-md` | boolean | false（=生成する） | `CLAUDE.md` を生成しない |
| `--no-setup-guide` | boolean | false（=生成する） | `SETUP_MCP.md` を生成しない |
| `--quiet` | boolean | false | 進捗ログを抑制 |
| `--help` / `-h` | boolean | - | ヘルプ表示 |
| `--version` / `-v` | boolean | - | バージョン表示 |

### 5.3 冪等性と安全性（最重要・設計原則）
- 既存ファイルは既定で絶対に上書きしない。`--force` 指定時のみ上書き。
- ディレクトリは存在すれば再利用（`recursive: true`）。
- 各ファイルを `created` / `skipped` / `overwritten` で分類しログ表示する。
- 同じコマンドを 2 回実行しても、2 回目はすべて `skipped` となり差分が出ないこと（A5）。
- パスは必ず `target-dir` 配下に正規化し、`..` による外部書き込みを防ぐ。

### 5.4 終了コード
| コード | 意味 |
|---|---|
| 0 | 正常終了 |
| 1 | 引数エラー・想定内のバリデーション失敗 |
| 2 | 予期しない実行時エラー |

### 5.5 出力（ユーザー向け、日本語）
- 実行時：`✓ 作成: 00_Memory.md` / `- スキップ（既存）: 20_Actions.md` のように 1 行ずつ。
- 完了時サマリ：作成数・スキップ数・上書き数、生成先の絶対パス、次の一手を表示する。
- 完了メッセージ末尾に次のアクションを必ず案内する：(1) Obsidian で Vault として開く (2) `SETUP_MCP.md` に従い MCP 接続を設定 (3) `00_Memory.md` の 7 項目を埋める。

---

## 6. 生成される Vault 構造の完全定義

```
<target-dir>/
├── 00_Memory.md                      # 起点ファイル（7項目MOC）★最重要
├── 10_Clients/
│   └── _template.md
├── 20_Actions.md
├── 30_Library/
│   ├── _index.md
│   ├── frameworks.md
│   ├── pricing.md
│   └── faq.md
├── 40_Templates/
│   ├── meeting-minutes.md
│   ├── proposal.md
│   └── followup-email.md
├── 50_Transcripts/
│   └── _template.md
├── CLAUDE.md                         # --no-claude-md で抑制
└── SETUP_MCP.md                      # --no-setup-guide で抑制
```

### 6.2 命名規則（記事準拠・厳守）
- フォルダ名の頭に `00_` `10_` `20_`… の番号を付ける（Obsidian サイドバーの並び順固定のため）。
- `50_Transcripts/` 配下の実ファイルは `YYYY-MM-DD_クライアント名_種別.md`。
- `_template.md` / `_index.md` の先頭アンダースコアは「雛形・目次」を示す慣習。

各ファイルのテンプレート全文は `src/templates/*.ts` を参照（実装と一致させること）。

---

## 7. 設計原則（実装時の判断基準）
1. 冪等性最優先。既存ファイルは壊さない。
2. 依存最小（`node:fs` 等の標準モジュール中心）。
3. 初期化は Obsidian/MCP に非依存。
4. 生成物は記事準拠（番号プレフィックス・命名規則・7 項目）。
5. wikilink 設計：`00_Memory.md` を MOC とし、見出し区切りで AI がセクション単位に追記できる構造。
6. ユーザーの手を止めない（完了時に「次の一手」）。
7. コードは英語、ユーザーに見える文字列は日本語。

---

## 8. 受け入れ条件（Acceptance Criteria）

| ID | 条件 |
|---|---|
| A1 | `init ./test-vault` で 6.1 の全ファイル・ディレクトリが生成される |
| A2 | `00_Memory.md` に 7 項目の見出しがこの順で存在する |
| A3 | `00_Memory.md` に `[[20_Actions]]` `[[30_Library/_index]]` `[[10_Clients/_template]]` が含まれる |
| A4 | フォルダ名が `00_`〜`50_` のプレフィックスを持つ |
| A5 | 2 回実行で 2 回目はすべて `skipped`、内容に差分が出ない |
| A6 | `--force` なしでは既存ファイルを上書きせず `skipped` 表示 |
| A7 | `--force` で既存ファイルを上書きし `overwritten` 表示 |
| A8 | `--dry-run` では 1 ファイルも書き込まれず、生成予定一覧のみ表示 |
| A9 | `--no-claude-md` / `--no-setup-guide` で各ファイルが生成されない |
| A10 | `target-dir` 配下以外へは書き込まれない（パストラバーサル防止） |
| A11 | 生成 `CLAUDE.md` に「回答の前に、必ず Obsidian vault の関連ノートを検索」が含まれる |
| A12 | 生成 `SETUP_MCP.md` に `claude mcp add --transport http` と同期競合の制約注記が含まれる |
| A13 | 生成 markdown が Obsidian で開いてエラーなく表示できる（手動確認） |
| A14 | 書き込み権限がないディレクトリ指定時、終了コード 1 で日本語エラーを表示 |
| A15 | `--help` でオプション一覧が日本語で表示される |

---

## 9. 実装順序（フェーズ分割）
- **Phase 0**：プロジェクト初期化（`package.json` / `tsconfig.json` / 構成）。
- **Phase 1**：scaffolding コア（`fs-safe.ts` / `scaffold.ts`）。検証 A1, A5, A6, A7, A10。
- **Phase 2**：テンプレート実装（`templates/*.ts` / `index.ts`）。検証 A2, A3, A4, A11, A12, A13。
- **Phase 3**：CLI 配線（`cli.ts` / `commands/init.ts` / `logger.ts`）。検証 A8, A9, A14, A15。
- **Phase 4**：テスト・仕上げ（`test/` / `README.md`）。全 A 項目を通しで確認。

---

## 10. 非機能要件・制約条件

| 項目 | 要件 |
|---|---|
| 対応 OS | macOS / Windows / Linux（パス区切りは `node:path` で吸収） |
| Node バージョン | >= 18 |
| ネットワーク | 初期化処理はオフラインで完結 |
| 文字コード | UTF-8（BOM なし）、改行は LF |
| 破壊的操作 | 既定で禁止。削除は一切行わない |
| Vault 同期 | 本ツールは同期に関与しない。`SETUP_MCP.md` で「複数クラウド同時同期の禁止」を明示 |
| ライセンス | MIT |

---

## 11. 将来拡張（記載のみ・MVP では実装しない）
1. `add-client <name>` サブコマンド。
2. 議事録自動取り込みパイプライン。
3. connector 連携（Slack / Gmail / Calendar）。
4. セマンティック検索の追加。
5. デュアルトランスポート対応 MCP（iansinnott/obsidian-claude-code-mcp）の検討。

---

## 付録：参照した一次情報（要点のみ）
- Local REST API プラグイン（coddingtonbear）：REST API と MCP サーバーを内蔵。既定 HTTPS 27124、API キー 64 文字 hex、`Authorization: Bearer`。MIT。
- mcp-obsidian（MarkusPfundstein）：Python（uvx）、MIT、外部サーバー方式。MVP では不採用。
- obsidian-mcp-tools（jacksteamdev）：2026-05-13 アーカイブ済み。新規採用不可。
- obsidian-claude-code-mcp（iansinnott）：0BSD、デュアルトランスポート。将来候補。
- Claude Code：`CLAUDE.md` はセッション開始時に全文ロード。MCP は `claude mcp add`。
- Obsidian 同期：複数クラウド同時同期は競合事故の主因。単一手段への統一を推奨。
