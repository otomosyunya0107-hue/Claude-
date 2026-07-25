# HeatWatch

会話ヒート自己検知システム（個人利用 / Instagram DM / ローカル実行）。

自分とパートナーの Instagram DM を解析し、会話の対立温度が普段の水準から逸脱した
時点で **自分自身にのみ** 通知する、ローカル実行型の早期警告システム。

> 本システムは関係の判定装置ではなく、自分自身への早期警告装置である。
> 相手を評価・採点・診断せず、相手向けの出力を一切生成しない。

North Star は **Lead Time**（自覚時刻 − 初回アラート時刻）。自分が対立に気づく
より前に鳴るかどうかだけを成功指標とする。

## ステータス

本リポジトリは要件確定（`docs/requirements.md` v2.0）とプロジェクト骨組みの段階。
機能実装は §16 のマイルストーン M1〜M7 で進める。M1〜M5 が Phase 1、M5 が
Go/No-Go 判定点（G-C）。

| M | 内容 | 状態 |
| --- | --- | --- |
| M1 | Ingest（エクスポート解析・mojibake 復元・正規化） | 未着手 |
| M2 | 基盤（SQLite・config・センチネル試験・CI） | 骨組み |
| M3 | Labeling（ラベリング CLI・二重ラベリング） | 未着手 |
| M4 | Features（F-01〜F-13・辞書・ベースライン） | 未着手 |
| M5 | Detector + Eval（スコアリング・Lead Time 評価） | 未着手 |
| M6 | Notify（OS 通知・禁止語テスト・Kill Switch） | 未着手 |
| M7 | Realtime（Chrome 拡張・localhost API） | 未着手 |

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
