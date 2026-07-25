"""M5 evaluation の補助関数（§12.1/12.3, EVA-103）。"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

from heatwatch.constants import TOKYO
from heatwatch.evaluation import load_intervals, time_split
from heatwatch.evaluation.metrics import percentile
from tests.fixtures.conversations import calm_conversation


def test_time_split_is_chronological() -> None:
    msgs = calm_conversation(50)
    calib, holdout = time_split(msgs, holdout_frac=0.3)
    assert len(calib) + len(holdout) == 50
    assert len(holdout) == 15
    # 時系列分割: 校正セットは古い側（§12.1）。
    assert calib[-1].ts <= holdout[0].ts


def test_time_split_empty() -> None:
    assert time_split([]) == ([], [])


def test_percentile_edges() -> None:
    assert percentile([], 0.5) is None
    assert percentile([5.0], 0.9) == 5.0
    assert percentile([0.0, 10.0], 0.5) == 5.0


def test_load_intervals_no_body(tmp_path: Path) -> None:
    """EVA-103: ラベルは時刻と種別のみ（本文なし）。"""
    t = datetime(2026, 5, 1, 12, 0, tzinfo=TOKYO)
    path = tmp_path / "labels.json"
    path.write_text(
        json.dumps(
            [
                {
                    "start": t.isoformat(),
                    "end": t.replace(hour=13).isoformat(),
                    "kind": "conflict",
                    "aware": t.replace(hour=12, minute=30).isoformat(),
                },
                {
                    "start": t.replace(hour=14).isoformat(),
                    "end": t.replace(hour=15).isoformat(),
                    "kind": "normal",
                },
            ]
        ),
        encoding="utf-8",
    )
    intervals = load_intervals(path)
    assert len(intervals) == 2
    assert intervals[0].kind == "conflict"
    assert intervals[0].aware_ts is not None
    assert intervals[1].aware_ts is None
