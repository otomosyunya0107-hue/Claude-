"""M5 detector + evaluation の検証（§10, §12, FEA-104, P0-ETH-05）。"""

from __future__ import annotations

from datetime import datetime, timedelta

from heatwatch.constants import TOKYO
from heatwatch.detector import detect, load_config, score_windows, with_weights
from heatwatch.detector.engine import WindowScore
from heatwatch.evaluation import render_markdown, run_evaluation
from heatwatch.features import build_windows, load_lexicons
from tests.fixtures.conversations import (
    calm_conversation,
    conflict_conversation,
    labeled_scenario,
    with_safety_phrase,
)

LEX = load_lexicons()
CFG = load_config()


def _ws(i: int, minute: float, score: float, active: int = 3, safety: bool = False) -> WindowScore:
    return WindowScore(
        index=i,
        ts=datetime(2026, 5, 1, 12, 0, tzinfo=TOKYO) + timedelta(minutes=minute),
        score=score,
        active_count=active,
        msg_count=8,
        both_speakers=True,
        safety=safety,
    )


def test_hot_sequence_triggers_after_sustained() -> None:
    seq = [_ws(i, i * 0.6, 0.7) for i in range(6)]
    result = detect(seq, CFG)
    assert len(result.alerts) == 1
    # sustained 90 秒を満たすまで発火しない。
    assert (result.alerts[0].ts - seq[0].ts).total_seconds() >= CFG.sustained_ms / 1000


def test_single_message_ineligible_fea104() -> None:
    """FEA-104: 単一メッセージ窓は適格性を満たさず発火しない。"""
    from heatwatch.features import compute_baseline, extract_raw
    from heatwatch.model import Message, MessageType

    text = "最悪だ絶対むかつく"
    one = [Message(0, datetime(2026, 5, 1, tzinfo=TOKYO), "SELF", text, MessageType.TEXT, 9, 0)]
    baseline = compute_baseline(
        [extract_raw(w, LEX) for w in build_windows(calm_conversation(40))]
    )
    scores = score_windows(build_windows(one), baseline, LEX, CFG)
    result = detect(scores, CFG)
    assert result.alerts == []


def test_safety_gate_suppresses_normal_alert() -> None:
    """P0-ETH-05 / DET-104: 安全語彙窓では通常アラートを出さず安全イベントのみ。"""
    seq = [_ws(i, i * 0.6, 0.9, safety=True) for i in range(6)]
    result = detect(seq, CFG)
    assert result.alerts == []
    assert len(result.safety_events) == 6


def test_safety_lexicon_detected_in_pipeline() -> None:
    from heatwatch.detector import is_safety_triggered

    msgs = with_safety_phrase(conflict_conversation())
    windows = build_windows(msgs)
    assert any(is_safety_triggered(w, LEX) for w in windows)


def test_kill_switch_stops_all_alerts() -> None:
    seq = [_ws(i, i * 0.6, 0.9) for i in range(6)]
    assert detect(seq, CFG, kill_switch=True).alerts == []


def test_calm_conversation_no_alert() -> None:
    msgs = calm_conversation(60)
    out = run_evaluation(msgs, [], CFG, LEX)
    assert out.result.alerts == []


def test_conflict_detected_with_positive_lead_time() -> None:
    """H-1/H-2 の下地: 対立を検知し、Lead Time 中央値が正になる。"""
    messages, interval = labeled_scenario()
    out = run_evaluation(messages, [interval], CFG, LEX)
    assert out.metrics.detection_rate == 1.0
    assert out.metrics.lead_p50 is not None
    assert out.metrics.lead_p50 > 0
    # G-B の下地: 対立/通常の分離度が偶然（0.5）を上回る。
    assert out.metrics.auc is not None and out.metrics.auc > 0.75


def _episode(start_min: float, n: int = 6, score: float = 0.7) -> list[WindowScore]:
    return [_ws(i, start_min + i * 0.6, score) for i in range(n)]


def test_cooldown_suppresses_reentry() -> None:
    """DET-102: クールダウン中の同一対立は再通知しない。"""
    seq = _episode(0.0)  # 発火
    seq += [_ws(100 + i, 5 + i * 0.6, 0.1) for i in range(3)]  # exit 未満でエピソード終了
    seq += _episode(30.0)  # 30 分後（cooldown 90 分内）→ 抑制
    for i, ws in enumerate(seq):
        object.__setattr__(ws, "index", i)
    result = detect(seq, CFG)
    assert len(result.alerts) == 1
    assert result.suppressed_cooldown >= 1


def test_daily_cap_and_hysteresis() -> None:
    """DET-101/103: エピソード再発火とヒステリシス、日次上限。"""
    from dataclasses import replace

    cfg = replace(CFG, cooldown_min=0, daily_max_alerts=2, sustained_ms=0)
    seq: list[WindowScore] = []
    t = 0.0
    for _ in range(3):  # 3 エピソード（cooldown=0 なので各々発火可能）
        seq += _episode(t, n=4, score=0.7)
        t += 5
        seq += [_ws(0, t, 0.1), _ws(0, t + 0.6, 0.1)]  # exit 未満でリセット
        t += 5
    for i, ws in enumerate(seq):
        object.__setattr__(ws, "index", i)
    result = detect(seq, cfg)
    assert len(result.alerts) == 2  # 日次上限 2
    assert result.suppressed_daily >= 1


def test_config_hash_stable_and_sensitive() -> None:
    assert CFG.config_hash() == load_config().config_hash()
    bumped = with_weights(CFG, {**CFG.weights, "contempt_markers": 0.99})
    assert bumped.config_hash() != CFG.config_hash()


def test_report_contains_no_body() -> None:
    messages, interval = labeled_scenario()
    out = run_evaluation(messages, [interval], CFG, LEX)
    md = render_markdown(out, CFG, [interval])
    for body in ("いつも", "は？", "なんでそんな", "おはよう"):
        assert body not in md
    assert "config_hash" in md
    assert "Lead Time" in md
