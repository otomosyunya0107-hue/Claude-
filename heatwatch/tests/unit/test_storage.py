"""M2 storage の検証（§8.2, P0-ETH-03）。"""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from heatwatch import storage


def _db(tmp_path: Path) -> sqlite3.Connection:
    conn = storage.connect(tmp_path / "derived.sqlite")
    storage.init_schema(conn)
    return conn


def test_schema_has_no_forbidden_columns(tmp_path: Path) -> None:
    conn = _db(tmp_path)
    # init_schema 内で検査済みだが、明示的にも通す（P0-ETH-03）。
    storage.assert_no_forbidden_columns(conn)


def test_forbidden_column_guard_detects_body(tmp_path: Path) -> None:
    conn = _db(tmp_path)
    conn.execute("CREATE TABLE leak (window_id INTEGER, content TEXT)")
    with pytest.raises(AssertionError):
        storage.assert_no_forbidden_columns(conn)


def test_forbidden_column_guard_detects_partner_score(tmp_path: Path) -> None:
    conn = _db(tmp_path)
    conn.execute("CREATE TABLE leak2 (ts TEXT, partner_anger_score REAL)")
    with pytest.raises(AssertionError):
        storage.assert_no_forbidden_columns(conn)


def test_save_and_count_baseline_evaluation(tmp_path: Path) -> None:
    conn = _db(tmp_path)
    storage.save_baseline(
        conn,
        {"message_velocity": {"mean": 1.0, "std": 0.5, "p50": 1.0, "p90": 2.0, "sample_n": 100}},
        computed_at="2026-01-01T00:00:00+09:00",
    )
    storage.save_evaluation(
        conn, "run-1", "cfg-abc", auc=0.8, lead_time_p50=12.0, fp_rate=0.003,
        created_at="2026-01-01T00:00:00+09:00",
    )
    assert storage.holdout_eval_count(conn) == 1
    row = conn.execute("SELECT mean, p90, sample_n FROM baseline").fetchone()
    assert row == (1.0, 2.0, 100)
