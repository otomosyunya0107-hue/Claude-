"""M3/M5: 評価・校正層。

ラベリング CLI（EVA-101）、Lead Time など指標（§12.3）、校正手順（§12.4）、
校正レポート生成（EVA-105）。ホールドアウトは校正に用いない（§12.1）。
"""

from __future__ import annotations

from .labels import Interval, conflict_intervals, in_conflict, load_intervals, time_split
from .metrics import Metrics, compute_metrics
from .pipeline import EvaluationOutput, build_normal_baseline, run_evaluation
from .report import render_markdown

__all__ = [
    "EvaluationOutput",
    "Interval",
    "Metrics",
    "build_normal_baseline",
    "compute_metrics",
    "conflict_intervals",
    "in_conflict",
    "load_intervals",
    "render_markdown",
    "run_evaluation",
    "time_split",
]
