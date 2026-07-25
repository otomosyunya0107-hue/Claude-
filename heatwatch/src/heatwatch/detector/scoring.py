"""ヒートスコア算出。requirements.md §10.1 に対応。

    heat_raw   = Σ (w_i × f_i) − w_repair × F-07
    heat_score = clamp(heat_raw, 0, 1)

f_i は [0,1] 正規化済み特徴量（FEA-106）。repair(F-07) はスコアを下げる。
"""

from __future__ import annotations

from .config import DetectorConfig

_REPAIR = "repair_attempt"


def heat_score(normalized: dict[str, float], cfg: DetectorConfig) -> float:
    raw = 0.0
    for name, w in cfg.weights.items():
        raw += w * normalized.get(name, 0.0)
    raw -= cfg.w_repair * normalized.get(_REPAIR, 0.0)
    return _clamp01(raw)


def active_feature_count(normalized: dict[str, float], cfg: DetectorConfig) -> int:
    """活性（>= active_feature_level）な hot 特徴量の数（repair を除く / §10.2）。"""
    return sum(
        1
        for name, v in normalized.items()
        if name != _REPAIR and name in cfg.weights and v >= cfg.active_feature_level
    )


def level_for(score: float, cfg: DetectorConfig) -> int:
    if score >= cfg.level3_score:
        return 3
    if score >= cfg.enter:
        return 2
    return 0


def _clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x
