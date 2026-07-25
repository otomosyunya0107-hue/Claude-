"""特徴量抽出 F-01〜F-13。requirements.md §9.2 に対応。

各抽出関数はウィンドウから生の scalar を返す。正規化（[0,1] / FEA-106）は
``normalize`` 層が baseline を参照して行う。テキスト特徴量は TEXT メッセージのみを
対象とし、非テキストは頻度特徴量にのみ算入する（FEA-105）。ネットワーク非依存。
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass
from enum import Enum

from ..model import Message, MessageType
from .lexicon import Lexicons
from .windowing import Window

# 直前メッセージがこの文字数以上なら「長文への短い返信」を逃避と見なす（F-06）。
_LONG_PREV_CHARS = 12
# 句読点強度（F-11）: 連続感嘆/疑問、全角強調。
_PUNCT_INTENSITY = re.compile(r"[!?！？]{2,}|[!！?？][!！?？]|…{2,}|。$")


class Direction(Enum):
    UP = "up"  # 値が大きいほど hot
    DOWN = "down"  # 値が小さいほど hot（例: リアクション低下）


class Norm(Enum):
    RATE = "rate"  # 既に ~[0,1]。baseline mean を基準に相対化
    QUANTILE = "quantile"  # baseline p50/p90 で写像
    ROBUST_Z = "robust_z"  # (x-mean)/std を sigmoid


def _text_messages(w: Window) -> list[Message]:
    return [m for m in w.messages if m.msg_type is MessageType.TEXT and m.text]


def _contains_any(text: str, words: tuple[str, ...]) -> bool:
    return any(word and word in text for word in words)


def _rate(count: int, total: int) -> float:
    return count / total if total else 0.0


def f_generalization(w: Window, lex: Lexicons) -> float:
    tm = _text_messages(w)
    return _rate(sum(_contains_any(m.text or "", lex.generalization) for m in tm), len(tm))


def f_second_person_blame(w: Window, lex: Lexicons) -> float:
    tm = _text_messages(w)
    hits = 0
    for m in tm:
        t = m.text or ""
        if _contains_any(t, lex.blame_predicates):
            hits += 1
    return _rate(hits, len(tm))


def f_contempt_markers(w: Window, lex: Lexicons) -> float:
    tm = _text_messages(w)
    return _rate(sum(_contains_any(m.text or "", lex.contempt) for m in tm), len(tm))


def f_counter_blame(w: Window, lex: Lexicons) -> float:
    tm = _text_messages(w)
    return _rate(sum(_contains_any(m.text or "", lex.counter_blame) for m in tm), len(tm))


def f_latency_spike(w: Window, lex: Lexicons) -> float:
    """メッセージ間隔（秒）の中央値。長いほど逃避傾向（生値、正規化で baseline 比）。"""
    gaps = [
        (b.ts - a.ts).total_seconds()
        for a, b in zip(w.messages, w.messages[1:], strict=False)
    ]
    if not gaps:
        return 0.0
    gaps.sort()
    mid = len(gaps) // 2
    return gaps[mid] if len(gaps) % 2 else (gaps[mid - 1] + gaps[mid]) / 2


def f_terse_reply(w: Window, lex: Lexicons) -> float:
    """直前が長文のときの短い相槌の割合（F-06）。"""
    msgs = w.messages
    tm_total = len(_text_messages(w))
    hits = 0
    for i in range(1, len(msgs)):
        cur, prev = msgs[i], msgs[i - 1]
        if cur.msg_type is not MessageType.TEXT or not cur.text:
            continue
        if cur.char_count <= lex.terse_max_chars and _contains_any(cur.text, lex.terse):
            if prev.char_count >= _LONG_PREV_CHARS:
                hits += 1
    return _rate(hits, tm_total)


def f_repair_attempt(w: Window, lex: Lexicons) -> float:
    tm = _text_messages(w)
    return _rate(sum(_contains_any(m.text or "", lex.repair) for m in tm), len(tm))


def f_message_velocity(w: Window, lex: Lexicons) -> float:
    """1 分あたりのメッセージ数（頻度特徴量: 全種別を算入 / FEA-105）。"""
    minutes = (w.end_ts - w.start_ts).total_seconds() / 60
    return w.msg_count / minutes if minutes > 0 else float(w.msg_count)


def f_alternation(w: Window, lex: Lexicons) -> float:
    msgs = w.messages
    if len(msgs) < 2:
        return 0.0
    switches = sum(
        1 for a, b in zip(msgs, msgs[1:], strict=False) if a.speaker != b.speaker
    )
    return switches / (len(msgs) - 1)


def f_length_escalation(w: Window, lex: Lexicons) -> float:
    """テキスト長の短期増加率（前半→後半の相対増加）。"""
    tm = _text_messages(w)
    if len(tm) < 4:
        return 0.0
    third = max(1, len(tm) // 3)
    head = sum(m.char_count for m in tm[:third]) / third
    tail = sum(m.char_count for m in tm[-third:]) / third
    return (tail - head) / (head + 1.0)


def f_punctuation_intensity(w: Window, lex: Lexicons) -> float:
    tm = _text_messages(w)
    return _rate(sum(bool(_PUNCT_INTENSITY.search(m.text or "")) for m in tm), len(tm))


def f_sentiment_delta(w: Window, lex: Lexicons) -> float:
    """純negative率（負方向差）。辞書ベース・ローカル推論（FEA-102）。"""
    tm = _text_messages(w)
    if not tm:
        return 0.0
    neg = sum(_contains_any(m.text or "", lex.sentiment_negative) for m in tm)
    pos = sum(_contains_any(m.text or "", lex.sentiment_positive) for m in tm)
    return (neg - pos) / len(tm)


def f_reaction_drop(w: Window, lex: Lexicons) -> float:
    """リアクション率（低いほど hot なので direction=DOWN）。"""
    total_reactions = sum(m.reaction_count for m in w.messages)
    return _rate(total_reactions, w.msg_count)


@dataclass(frozen=True)
class FeatureSpec:
    fid: str
    name: str
    extractor: Callable[[Window, Lexicons], float]
    direction: Direction
    norm: Norm
    is_repair: bool = False


# F-01〜F-13 の登録。順序は仕様表に一致（§9.2）。
FEATURE_SPECS: tuple[FeatureSpec, ...] = (
    FeatureSpec("F-01", "generalization", f_generalization, Direction.UP, Norm.RATE),
    FeatureSpec("F-02", "second_person_blame", f_second_person_blame, Direction.UP, Norm.RATE),
    FeatureSpec("F-03", "contempt_markers", f_contempt_markers, Direction.UP, Norm.RATE),
    FeatureSpec("F-04", "counter_blame", f_counter_blame, Direction.UP, Norm.RATE),
    FeatureSpec("F-05", "latency_spike", f_latency_spike, Direction.UP, Norm.QUANTILE),
    FeatureSpec("F-06", "terse_reply", f_terse_reply, Direction.UP, Norm.RATE),
    FeatureSpec(
        "F-07", "repair_attempt", f_repair_attempt, Direction.UP, Norm.RATE, is_repair=True
    ),
    FeatureSpec("F-08", "message_velocity", f_message_velocity, Direction.UP, Norm.QUANTILE),
    FeatureSpec("F-09", "alternation", f_alternation, Direction.UP, Norm.RATE),
    FeatureSpec("F-10", "length_escalation", f_length_escalation, Direction.UP, Norm.ROBUST_Z),
    FeatureSpec("F-11", "punctuation_intensity", f_punctuation_intensity, Direction.UP, Norm.RATE),
    FeatureSpec("F-12", "sentiment_delta", f_sentiment_delta, Direction.UP, Norm.ROBUST_Z),
    FeatureSpec("F-13", "reaction_drop", f_reaction_drop, Direction.DOWN, Norm.RATE),
)

SPEC_BY_NAME: dict[str, FeatureSpec] = {s.name: s for s in FEATURE_SPECS}


def extract_raw(w: Window, lex: Lexicons) -> dict[str, float]:
    """ウィンドウから全特徴量の生値を計算する。"""
    return {spec.name: spec.extractor(w, lex) for spec in FEATURE_SPECS}
