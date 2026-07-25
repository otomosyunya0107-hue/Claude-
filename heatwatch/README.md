# HeatWatch

会話ヒート自己検知システム（個人利用 / Instagram DM / ローカル実行）。

自分とパートナーの Instagram DM を解析し、会話の対立温度が普段の水準から逸脱した
時点で **自分自身にのみ** 通知する、ローカル実行型の早期警告システム。

> 本システムは関係の判定装置ではなく、自分自身への早期警告装置である。
> 相手を評価・採点・診断せず、相手向けの出力を一切生成しない。

North Star は **Lead Time**（自覚時刻 − 初回アラート時刻）。自分が対立に気づく
より前に鳴るかどうかだけを成功指標とする。

## ステータス

Phase 1（M1〜M5）と M6 の P0 部分をローカル完結・オフラインで実装済み。すべて
合成データでテストする（実データは不要・不使用）。M5 が Go/No-Go 判定点（G-C）。

| M | 内容 | 状態 |
| --- | --- | --- |
| M1 | Ingest（エクスポート解析・mojibake 復元・正規化） | 実装済み |
| M2 | 基盤（SQLite・config・センチネル試験） | 実装済み |
| M3 | Labeling（ラベル JSON・時系列分割） | 部分（JSON ローダ・分割。対話 CLI は将来） |
| M4 | Features（F-01〜F-13・辞書・ベースライン） | 実装済み |
| M5 | Detector + Eval（スコアリング・Lead Time 評価・レポート） | 実装済み |
| M6 | Notify（静的テンプレート・禁止語・Kill Switch・静音時間） | P0 部分実装済み（OS 配信含む） |
| M7 | Realtime（Chrome 拡張・localhost API） | 未着手（G-C 合格を前提 / §14） |

初期重み・閾値（`config/weights.yaml` / `thresholds.yaml`）は仮説であり、
実データでの校正（§12）で確定する。合成シナリオでは AUC ≈ 0.93 / Lead Time 中央値
+3.2 分 / 誤報 0 を確認しているが、G-C の成否は実データで判定される。

## セットアップ

```
uv sync
uv run heatwatch --help
```

Phase 1 はネットワーク遮断下で動作する（NFR-101）。実データはリポジトリ配下に
置かない（DAT-101）。

## ドキュメント

- `docs/requirements.md` — 要件定義書 v2.0（本プロジェクトの唯一の仕様書）
- `docs/adr/` — 設計判断の記録（P0 不変条件の変更には ADR が必須）
- `docs/privacy-notes.md` — プライバシー設計メモ
- `CLAUDE.md` — 実装時の必須指示

## 開発

```
uv run ruff check
uv run mypy
uv run pytest
```
