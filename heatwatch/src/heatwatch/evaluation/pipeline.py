"""評価オーケストレーション。requirements.md §12.4 に対応。

ベースラインを ``normal`` 区間のみから算出し（§12.4-1）、ウィンドウをスコアリングして
検知を実行し、指標を計算する。本文を扱わない。
"""

from __future__ import annotations

from dataclasses import dataclass

from ..detector.config import DetectorConfig
from ..detector.engine import DetectionResult, detect, score_windows
from ..features.baseline import Stats, compute_baseline
from ..features.extractors import extract_raw
from ..features.lexicon import Lexicons
from ..features.windowing import build_windows
from ..model import Message
from .labels import Interval, in_conflict
from .metrics import Metrics, compute_metrics


@dataclass(frozen=True)
class EvaluationOutput:
    metrics: Metrics
    result: DetectionResult
    baseline: dict[str, Stats]
    config_hash: str


def build_normal_baseline(
    messages: list[Message], intervals: list[Interval], lex: Lexicons
) -> dict[str, Stats]:
    """``normal`` 区間のウィンドウのみからベースラインを算出する（DEC-106 / §12.4-1）。"""
    windows = build_windows(messages)
    normal_rows = [
        extract_raw(w, lex) for w in windows if not in_conflict(w.end_ts, intervals)
    ]
    return compute_baseline(normal_rows)


def run_evaluation(
    messages: list[Message],
    intervals: list[Interval],
    cfg: DetectorConfig,
    lex: Lexicons,
    baseline: dict[str, Stats] | None = None,
    kill_switch: bool = False,
) -> EvaluationOutput:
    if baseline is None:
        baseline = build_normal_baseline(messages, intervals, lex)
    windows = build_windows(messages)
    scores = score_windows(windows, baseline, lex, cfg)
    result = detect(scores, cfg, kill_switch=kill_switch)
    metrics = compute_metrics(result, intervals)
    return EvaluationOutput(
        metrics=metrics, result=result, baseline=baseline, config_hash=cfg.config_hash()
    )
