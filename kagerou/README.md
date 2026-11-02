# Kagerou（カゲロウ）

読み返さない言葉が時間とともに風化し、30日で完全に消滅するメモアプリ。
Local-First（IndexedDB）/ PWA / モバイルファースト。

## 起動

```bash
npm install
npm run dev        # 開発（タイムマシン常時有効）
npm run build      # 型検査 + 本番ビルド（dist/ は静的ホスティング可）
npm test           # 単体テスト（風化エンジン・状態遷移・IndexedDB）
npm run e2e        # 受け入れテスト（要 build。Playwright/Chromium を使用）
```

本番ビルドでのタイムマシンは `?debug=1` を付けて開くと有効になります（`?debug=0` で解除）。

## 構成

| パス | 役割 |
| --- | --- |
| `src/core/decayEngine.ts` | 風化率計算・Seeded PRNG・文字耐久値・置換文字 |
| `src/core/stateMachine.ts` | ステータス遷移・手入れ/クールダウン・墓標化・時計巻き戻し検知（純粋関数） |
| `src/core/soundEngine.ts` | Web Audio によるプロシージャル効果音（砂払い／完了／石碑） |
| `src/db/` | Dexie スキーマ・リポジトリ・初回チュートリアル投入 |
| `src/hooks/useTimeOffset.ts` | 実効時刻（巻き戻し検知 + デバッグオフセット） |
| `src/hooks/useNotes.ts` | CRUD・起動時/1分ごと/時刻変更時の墓標化走査 |
| `src/components/note/` | カード（紙・石碑・墓標）、風化テキスト、長押しボタン、シェア画像 |
| `src/components/debug/TimeMachine.tsx` | +1/+7/+15/+30日 タイムトラベル |

## 仕様書からの意図的な差分

1. **滲み開始点の下限（§4.3）**: 表どおりだと耐久値 H<0.20 のひらがなは風化率 0%（作成直後）でも `BLURRED` になるため、滲み開始点を `max(H−0.20, 0.02)` にクランプ（線形換算で約2.6日までは全文字鮮明）。
2. **ステータス境界は線形風化率**で判定（§3.1 の「7日=23%」「24日=80%」と一致するのは線形値のため）。UI の「風化度」も線形値。描画のみ `R^1.6` を使用。
3. **decayedAt** は検知時刻ではなく実際に寿命が尽きた時刻（`lastPolishedAt + 30日`）を記録。長期間アプリを開かなかった場合も没日が正確になる。
4. **編集は風化の起算点を動かさない**（編集が「無料の手入れ」にならないように）。
5. **lastKnownTime は実時刻で記録**し、デバッグオフセットは別に加算。タイムマシンのリセットが巻き戻しと誤検知されない。
6. シェア画像は `html-to-image` を使わず Canvas で直接描画（依存削減）。
