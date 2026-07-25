"""ラベルとデータ分割。requirements.md §12.1 / §12.2 に対応。

ラベルは本文を含まず、時刻と区間種別のみを保持する（EVA-103）。分割は時系列のみ
（ランダム分割禁止 / §12.1）。
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from ..model import Message


@dataclass(frozen=True)
class Interval:
    """ラベル区間。本文を含まない（EVA-103）。"""

    start_ts: datetime
    end_ts: datetime
    kind: str  # "conflict" | "normal"
    aware_ts: datetime | None = None  # §12.2: 自分が対立を言語化した最初の発話時刻

    def contains(self, ts: datetime) -> bool:
        return self.start_ts <= ts <= self.end_ts


def conflict_intervals(intervals: list[Interval]) -> list[Interval]:
    return [iv for iv in intervals if iv.kind == "conflict"]


def in_conflict(ts: datetime, intervals: list[Interval]) -> bool:
    return any(iv.kind == "conflict" and iv.contains(ts) for iv in intervals)


def load_intervals(path: str | Path) -> list[Interval]:
    """ラベル JSON を読み込む（本文を含まない / EVA-103）。

    形式: ``[{"start": ISO, "end": ISO, "kind": "conflict"|"normal",
    "aware": ISO?}, ...]``。時刻は tz-aware（Asia/Tokyo）を推奨。
    """
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    out: list[Interval] = []
    for row in data:
        out.append(
            Interval(
                start_ts=datetime.fromisoformat(row["start"]),
                end_ts=datetime.fromisoformat(row["end"]),
                kind=str(row["kind"]),
                aware_ts=datetime.fromisoformat(row["aware"]) if row.get("aware") else None,
            )
        )
    return out


def time_split(
    messages: list[Message], holdout_frac: float = 0.30
) -> tuple[list[Message], list[Message]]:
    """時系列で校正セット（古い側）とホールドアウト（直近）へ分割する（§12.1）。"""
    if not messages:
        return [], []
    cut = int(len(messages) * (1 - holdout_frac))
    return messages[:cut], messages[cut:]
