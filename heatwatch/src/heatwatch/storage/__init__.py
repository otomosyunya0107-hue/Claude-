"""M2: 永続層（SQLite、派生データのみ）。

requirements.md §8.2 のスキーマを実装する。本文・実名・相手個人スコア・
関係性総合スコアのカラムを持たない（P0-ETH-03, 禁止列）。本文を受け取る
インターフェースを持たない（§15.1）。
"""

from __future__ import annotations

from .db import (
    assert_no_forbidden_columns,
    connect,
    holdout_eval_count,
    init_schema,
    save_baseline,
    save_evaluation,
)

__all__ = [
    "assert_no_forbidden_columns",
    "connect",
    "holdout_eval_count",
    "init_schema",
    "save_baseline",
    "save_evaluation",
]
