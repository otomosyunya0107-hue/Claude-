"""検知エンジン（状態機械）。requirements.md §10.2 に対応。

ウィンドウ列を走査し、発火条件（適格性・ヒステリシス・クールダウン・日次上限・
持続時間・スロープ・安全分岐）を適用してアラート列を生成する。オンライン学習を
行わない（DET-106）。安全語彙検知時は通常アラートを抑止する（Fail Closed / DET-104）。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from ..features.baseline import Stats, normalize
from ..features.extractors import extract_raw
from ..features.lexicon import Lexicons
from ..features.windowing import Window
from .config import DetectorConfig
from .safety import is_safety_triggered
from .scoring import active_feature_count, heat_score, level_for


@dataclass(frozen=True)
class WindowScore:
    index: int
    ts: datetime
    score: float
    active_count: int
    msg_count: int
    both_speakers: bool
    safety: bool


@dataclass(frozen=True)
class Alert:
    ts: datetime
    level: int
    window_index: int


@dataclass
class DetectionResult:
    scores: list[WindowScore] = field(default_factory=list)
    alerts: list[Alert] = field(default_factory=list)
    safety_events: list[datetime] = field(default_factory=list)
    suppressed_cooldown: int = 0
    suppressed_daily: int = 0

    @property
    def first_alert_ts(self) -> datetime | None:
        return self.alerts[0].ts if self.alerts else None


def score_windows(
    windows: list[Window],
    baseline: dict[str, Stats],
    lex: Lexicons,
    cfg: DetectorConfig,
) -> list[WindowScore]:
    out: list[WindowScore] = []
    for w in windows:
        norm = normalize(extract_raw(w, lex), baseline)
        out.append(
            WindowScore(
                index=w.messages[-1].idx,
                ts=w.end_ts,
                score=heat_score(norm, cfg),
                active_count=active_feature_count(norm, cfg),
                msg_count=w.msg_count,
                both_speakers=w.both_speakers,
                safety=is_safety_triggered(w, lex),
            )
        )
    return out


def _slope(scores: list[WindowScore], i: int) -> float:
    if i >= 2:
        return (scores[i].score - scores[i - 2].score) / 2
    if i >= 1:
        return scores[i].score - scores[i - 1].score
    return 0.0


def detect(
    window_scores: list[WindowScore],
    cfg: DetectorConfig,
    kill_switch: bool = False,
) -> DetectionResult:
    result = DetectionResult(scores=window_scores)
    if kill_switch:
        return result

    sustained_start: datetime | None = None
    episode_alerted = False
    last_alert_ts: datetime | None = None
    daily_count: dict[str, int] = {}

    for i, ws in enumerate(window_scores):
        # 安全分岐（Fail Closed）: 通常アラートを抑止し安全イベントのみ記録。
        if ws.safety:
            result.safety_events.append(ws.ts)
            sustained_start = None
            episode_alerted = False
            continue

        # ヒステリシス: エピソード管理（enter で開始、exit 未満で終了）。
        if ws.score >= cfg.enter and sustained_start is None:
            sustained_start = ws.ts
        elif ws.score < cfg.exit:
            sustained_start = None
            episode_alerted = False

        eligible = (
            ws.msg_count >= cfg.min_msg_count
            and ws.both_speakers
            and ws.active_count >= cfg.min_active_features
        )
        if not eligible or episode_alerted or sustained_start is None:
            continue

        cooldown_active = (
            last_alert_ts is not None
            and (ws.ts - last_alert_ts).total_seconds() < cfg.cooldown_min * 60
        )
        if cooldown_active:
            result.suppressed_cooldown += 1
            continue

        sustained_ok = (ws.ts - sustained_start).total_seconds() * 1000 >= cfg.sustained_ms
        slope_ok = _slope(window_scores, i) >= cfg.min_slope
        if not (ws.score >= cfg.enter and slope_ok and sustained_ok):
            continue

        # 日次上限（DET-103）。
        day = ws.ts.date().isoformat()
        if daily_count.get(day, 0) >= cfg.daily_max_alerts:
            result.suppressed_daily += 1
            episode_alerted = True
            continue

        result.alerts.append(Alert(ts=ws.ts, level=level_for(ws.score, cfg), window_index=ws.index))
        last_alert_ts = ws.ts
        daily_count[day] = daily_count.get(day, 0) + 1
        episode_alerted = True

    return result
