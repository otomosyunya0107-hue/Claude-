"""M5: 検知エンジン層。

スコアリング（§10.1）、発火条件・ヒステリシス（§10.2, DET-101）、クールダウン
（DET-102）、日次上限（DET-103）、Safety 分岐（DET-104, Fail Closed）を担う。
オンライン学習を行わない（DET-106）。
"""

from __future__ import annotations

from .config import DetectorConfig, load_config, with_weights
from .engine import Alert, DetectionResult, WindowScore, detect, score_windows
from .safety import is_safety_triggered
from .scoring import active_feature_count, heat_score, level_for

__all__ = [
    "Alert",
    "DetectionResult",
    "DetectorConfig",
    "WindowScore",
    "active_feature_count",
    "detect",
    "heat_score",
    "is_safety_triggered",
    "level_for",
    "load_config",
    "score_windows",
    "with_weights",
]
