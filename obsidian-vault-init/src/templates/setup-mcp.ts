/** SETUP_MCP.md — how to connect this vault to Claude via the Local REST API MCP. */
export const setupMcpTemplate = `# MCP 接続セットアップ手順

このVaultを Claude（Claude Code / Claude Desktop）から読み書きできるようにする手順です。
初期化（このファイルの生成）まではObsidian不要ですが、ここから先はObsidianの起動とプラグイン導入が前提になります。

## 1. Obsidian でこのフォルダを Vault として開く

## 2. Local REST API プラグインを導入する
1. Obsidian の Settings → Community plugins → Browse
2. 「Local REST API」（作者：coddingtonbear）を検索してインストール・有効化
3. プラグイン設定画面で API Key（64文字）を控える
4. このプラグインは REST API と MCP サーバーの両方を内蔵している

### 接続情報（既定）
- HTTPS エンドポイント：\`https://127.0.0.1:27124/\`
- MCP エンドポイント：\`https://127.0.0.1:27124/mcp/\`
- 認証：\`Authorization: Bearer <APIキー>\`

## 3. Claude Code に MCP を登録する
\`\`\`
claude mcp add --transport http obsidian https://127.0.0.1:27124/mcp/ \\
  --header "Authorization: Bearer <あなたのAPIキー>"
\`\`\`
登録後、Claude Code 内で \`/mcp\` を実行して接続状態を確認する。

### 自己署名証明書でつまずいた場合のフォールバック
Local REST API は自己署名証明書を使うため、ランタイムが証明書を信頼せず接続に失敗することがあります。その場合は以下のいずれか：
- (a) 証明書 \`https://127.0.0.1:27124/obsidian-local-rest-api.crt\` を OS のキーチェーンに信頼登録する
- (b) プラグイン設定で HTTP エンドポイント（ポート 27123）を有効化し、\`http://127.0.0.1:27123/mcp/\` に接続する

## 4. CLAUDE.md を効かせる
このVaultのルートにある \`CLAUDE.md\` を Claude Code がセッション開始時に読み込みます。
\`/memory\` コマンドで読み込み状態を確認できます。

---

## 制約・注意（重要）
- **1つの Vault を2つ以上のクラウドサービスに同時に同期させないこと。** 同期競合で Vault が壊れる事故の主因です。同期は単一手段に統一してください（Apple端末のみなら iCloud Drive、複数OSなら公式の Obsidian Sync が安全）。
- MCP 経由の読み書きは Obsidian が起動していることが前提です。
- Local REST API プラグインは最新版を維持してください（過去にパストラバーサル脆弱性が修正されています）。

## 将来拡張（MVP対象外）
- 議事録の自動取り込み（Notta / tl;dv → Google Drive → Vault）
- Slack / Gmail / Calendar connector の有効化
- セマンティック検索の追加
`;
