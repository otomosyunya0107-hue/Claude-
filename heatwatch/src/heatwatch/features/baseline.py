"""ベースライン算出と正規化。requirements.md FEA-106 / §12.4 に対応。

ベースラインは ``normal`` 区間のウィンドウのみから一度だけ算出する固定定数
（DEC-106）。全特徴量を baseline を参照して [0,1] に正規化する（FEA-106）。
DOWN 方向（リアクション低下など）は反転する。numpy 非依存（stdlib のみ）。
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass

from .extractors import FEATURE_SPECS, SPEC_BY_NAME, Direction, Norm

_EPS = 1e-9
# RATE 特徴量の分母の下限（FEA-104: 稀語でも 1 件で飽和させない）。
_RATE_MIN_SCALE = 0.34


@dataclass(frozen=True)
class Stats:
    mean: float
    std: float
    p50: float
    p90: float
    sample_n: int

    def as_dict(self) -> dict[str, float]:
        return {
            "mean": self.mean,
            "std": self.std,
            "p50": self.p50,
            "p90": self.p90,
            "sample_n": float(self.sample_n),
        }


def _percentile(sorted_vals: Sequence[float], q: float) -> float:
    if not sorted_vals:
        return 0.0
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    pos = q * (len(sorted_vals) - 1)
    lo = math.floor(pos)
    hi = math.ceil(pos)
    if lo == hi:
        return sorted_vals[lo]
    frac = pos - lo
    return sorted_vals[lo] * (1 - frac) + sorted_vals[hi] * frac


def _stats(values: list[float]) -> Stats:
    n = len(values)
    if n == 0:
        return Stats(0.0, 0.0, 0.0, 0.0, 0)
    mean = sum(values) / n
    var = sum((v - mean) ** 2 for v in values) / n
    ordered = sorted(values)
    return Stats(
        mean=mean,
        std=math.sqrt(var),
        p50=_percentile(ordered, 0.5),
        p90=_percentile(ordered, 0.9),
        sample_n=n,
    )


def compute_baseline(normal_raw_rows: list[dict[str, float]]) -> dict[str, Stats]:
    """``normal`` 区間の生特徴量行からベースライン統計量を算出する。"""
    baseline: dict[str, Stats] = {}
    for spec in FEATURE_SPECS:
        col = [row.get(spec.name, 0.0) for row in normal_raw_rows]
        baseline[spec.name] = _stats(col)
    return baseline


def _sigmoid(x: float) -> float:
    if x >= 0:
        z = math.exp(-x)
        return 1.0 / (1.0 + z)
    z = math.exp(x)
    return z / (1.0 + z)


def _normalize_up(name: str, raw: float, s: Stats) -> float:
    spec = SPEC_BY_NAME[name]
    if spec.norm is Norm.RATE:
        denom = max(s.p90 + _EPS, _RATE_MIN_SCALE)
        return _clamp01(raw / denom)
    if spec.norm is Norm.QUANTILE:
        spread = max(s.p90 - s.p50, 0.5 * abs(s.p50) + _EPS)
        return _clamp01((raw - s.p50) / spread)
    # ROBUST_Z
    z = (raw - s.mean) / (s.std + _EPS)
    return _sigmoid(z)


def _clamp01(x: float) -> float:
    return 0.0 if x < 0 else 1.0 if x > 1 else x


def normalize(raw: dict[str, float], baseline: dict[str, Stats]) -> dict[str, float]:
    """生特徴量を baseline を参照して [0,1] へ正規化する（FEA-106）。"""
    out: dict[str, float] = {}
    for spec in FEATURE_SPECS:
        s = baseline.get(spec.name, Stats(0.0, 0.0, 0.0, 0.0, 0))
        up = _normalize_up(spec.name, raw.get(spec.name, 0.0), s)
        out[spec.name] = (1.0 - up) if spec.direction is Direction.DOWN else up
    return out
