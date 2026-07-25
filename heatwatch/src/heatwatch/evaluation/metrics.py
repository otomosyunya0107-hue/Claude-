"""評価指標。requirements.md §12.3 に対応。

Lead Time（North Star）、Detection Rate、False Alert Rate、AUC、Time-to-Detect。
本文を扱わない（時刻とスコアのみ）。
"""

from __future__ import annotations

import math
from dataclasses import dataclass

from ..detector.engine import DetectionResult, WindowScore
from .labels import Interval, conflict_intervals, in_conflict


def percentile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    pos = q * (len(ordered) - 1)
    lo = math.floor(pos)
    hi = math.ceil(pos)
    if lo == hi:
        return ordered[lo]
    frac = pos - lo
    return ordered[lo] * (1 - frac) + ordered[hi] * frac


def auc(window_scores: list[WindowScore], intervals: list[Interval]) -> float | None:
    """窓単位の対立/通常の分離度（Mann–Whitney U / §12.3）。"""
    pos = [ws.score for ws in window_scores if in_conflict(ws.ts, intervals)]
    neg = [ws.score for ws in window_scores if not in_conflict(ws.ts, intervals)]
    if not pos or not neg:
        return None
    wins = 0.0
    for p in pos:
        for n in neg:
            if p > n:
                wins += 1
            elif p == n:
                wins += 0.5
    return wins / (len(pos) * len(neg))


def lead_times_minutes(result: DetectionResult, intervals: list[Interval]) -> list[float]:
    """対立ごとの Lead Time（分）= aware_ts − 初回アラート時刻（§12.3）。"""
    leads: list[float] = []
    for iv in conflict_intervals(intervals):
        if iv.aware_ts is None:
            continue
        alerts_in = [a for a in result.alerts if iv.start_ts <= a.ts <= iv.end_ts]
        if not alerts_in:
            continue
        first = min(alerts_in, key=lambda a: a.ts)
        leads.append((iv.aware_ts - first.ts).total_seconds() / 60.0)
    return leads


def detection_rate(result: DetectionResult, intervals: list[Interval]) -> float | None:
    convo = conflict_intervals(intervals)
    if not convo:
        return None
    detected = 0
    for iv in convo:
        if any(iv.start_ts <= a.ts <= iv.end_ts for a in result.alerts):
            detected += 1
    return detected / len(convo)


def false_alert_rate(result: DetectionResult, intervals: list[Interval]) -> float | None:
    """通常区間の発火数 / 通常ウィンドウ数（§12.3）。"""
    normal_windows = [ws for ws in result.scores if not in_conflict(ws.ts, intervals)]
    if not normal_windows:
        return None
    false_alerts = sum(1 for a in result.alerts if not in_conflict(a.ts, intervals))
    return false_alerts / len(normal_windows)


@dataclass(frozen=True)
class Metrics:
    auc: float | None
    lead_p25: float | None
    lead_p50: float | None
    lead_p75: float | None
    detection_rate: float | None
    false_alert_rate: float | None
    n_conflict: int
    n_windows: int
    n_alerts: int
    n_safety: int
    suppressed_cooldown: int
    suppressed_daily: int


def compute_metrics(result: DetectionResult, intervals: list[Interval]) -> Metrics:
    leads = lead_times_minutes(result, intervals)
    return Metrics(
        auc=auc(result.scores, intervals),
        lead_p25=percentile(leads, 0.25),
        lead_p50=percentile(leads, 0.50),
        lead_p75=percentile(leads, 0.75),
        detection_rate=detection_rate(result, intervals),
        false_alert_rate=false_alert_rate(result, intervals),
        n_conflict=len(conflict_intervals(intervals)),
        n_windows=len(result.scores),
        n_alerts=len(result.alerts),
        n_safety=len(result.safety_events),
        suppressed_cooldown=result.suppressed_cooldown,
        suppressed_daily=result.suppressed_daily,
    )
