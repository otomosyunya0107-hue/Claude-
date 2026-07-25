"""派生データの永続層（SQLite）。requirements.md §8.2 / M2 に対応。

保存するのは派生データ（特徴量値・スコア・ラベル時刻・評価結果・ベースライン統計量）
のみ。**本文・実名・相手個人の時系列スコア・関係性総合スコアを保存しない**
（P0-ETH-03 / DAT-103）。本モジュールの API は本文（``str`` 本文）を受け取る関数を
公開しない。渡ってくるのは数値・バージョン文字列・時刻・列挙値のみである。
"""

from __future__ import annotations

import re
import sqlite3
from collections.abc import Mapping
from pathlib import Path

_SCHEMA = """
CREATE TABLE IF NOT EXISTS windows (
    id             INTEGER PRIMARY KEY,
    start_ts       TEXT NOT NULL,
    end_ts         TEXT NOT NULL,
    msg_count      INTEGER NOT NULL,
    feature_version TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS features (
    window_id  INTEGER NOT NULL REFERENCES windows(id),
    name       TEXT NOT NULL,
    raw_value  REAL NOT NULL,
    z_value    REAL NOT NULL,
    PRIMARY KEY (window_id, name)
);

CREATE TABLE IF NOT EXISTS scores (
    window_id         INTEGER PRIMARY KEY REFERENCES windows(id),
    heat_score        REAL NOT NULL,
    level             INTEGER NOT NULL,
    threshold_version TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS labels (
    interval_id INTEGER PRIMARY KEY,
    start_ts    TEXT NOT NULL,
    end_ts      TEXT NOT NULL,
    kind        TEXT NOT NULL,
    aware_ts    TEXT,
    source      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evaluations (
    run_id        TEXT PRIMARY KEY,
    config_hash   TEXT NOT NULL,
    auc           REAL,
    lead_time_p50 REAL,
    fp_rate       REAL,
    created_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS baseline (
    feature_name TEXT PRIMARY KEY,
    mean         REAL NOT NULL,
    std          REAL NOT NULL,
    p50          REAL NOT NULL,
    p90          REAL NOT NULL,
    computed_at  TEXT NOT NULL,
    sample_n     INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
    id           INTEGER PRIMARY KEY,
    ts           TEXT NOT NULL,
    level        INTEGER NOT NULL,
    template_id  TEXT NOT NULL,
    acknowledged INTEGER NOT NULL DEFAULT 0
);
"""

# P0-ETH-03: 永続層に持ち込んではならない列名パターン。
_FORBIDDEN_COLUMN = re.compile(
    r"(^|_)(content|body|text)$"  # 会話本文
    r"|sender_name|real_?name"  # 実名
    r"|partner_.*score"  # 相手個人スコア
    r"|relationship.*score",  # 関係性総合スコア
    re.IGNORECASE,
)


def connect(path: str | Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(path))
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(_SCHEMA)
    conn.commit()
    assert_no_forbidden_columns(conn)


def assert_no_forbidden_columns(conn: sqlite3.Connection) -> None:
    """スキーマに禁止列が存在しないことを検証する（P0-ETH-03）。"""
    offenders: list[str] = []
    tables = [
        r[0]
        for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    ]
    for table in tables:
        for row in conn.execute(f"PRAGMA table_info({table})").fetchall():
            col = row[1]
            if _FORBIDDEN_COLUMN.search(col):
                offenders.append(f"{table}.{col}")
    if offenders:
        raise AssertionError(f"禁止列が永続スキーマに存在する (P0-ETH-03): {offenders}")


def save_baseline(
    conn: sqlite3.Connection,
    stats: Mapping[str, Mapping[str, float]],
    computed_at: str,
) -> None:
    """ベースライン統計量を保存する（DEC-106）。``stats`` は本文を含まない数値のみ。"""
    conn.executemany(
        "INSERT OR REPLACE INTO baseline"
        " (feature_name, mean, std, p50, p90, computed_at, sample_n)"
        " VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
            (
                name,
                float(s["mean"]),
                float(s["std"]),
                float(s["p50"]),
                float(s["p90"]),
                computed_at,
                int(s["sample_n"]),
            )
            for name, s in stats.items()
        ],
    )
    conn.commit()


def save_evaluation(
    conn: sqlite3.Connection,
    run_id: str,
    config_hash: str,
    auc: float | None,
    lead_time_p50: float | None,
    fp_rate: float | None,
    created_at: str,
) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO evaluations"
        " (run_id, config_hash, auc, lead_time_p50, fp_rate, created_at)"
        " VALUES (?, ?, ?, ?, ?, ?)",
        (run_id, config_hash, auc, lead_time_p50, fp_rate, created_at),
    )
    conn.commit()


def holdout_eval_count(conn: sqlite3.Connection) -> int:
    """記録済み評価回数（EVA-106: 3 回超で警告）。"""
    return int(conn.execute("SELECT COUNT(*) FROM evaluations").fetchone()[0])
