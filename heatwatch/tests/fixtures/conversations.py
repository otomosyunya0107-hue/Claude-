"""合成会話の生成（本文は合成のみ / CLAUDE.md Privacy）。

特徴量・検知・評価のテストで使う、正常/対立のメッセージ列を組み立てる。
実データを一切含まない。
"""

from __future__ import annotations

from datetime import datetime, timedelta

from heatwatch.constants import TOKYO
from heatwatch.model import Message, MessageType

_T0 = datetime(2026, 5, 1, 12, 0, 0, tzinfo=TOKYO)


def _m(
    idx: int,
    minute_offset: float,
    speaker: str,
    text: str | None,
    msg_type: MessageType = MessageType.TEXT,
    reactions: int = 0,
) -> Message:
    return Message(
        idx=idx,
        ts=_T0 + timedelta(minutes=minute_offset),
        speaker=speaker,  # type: ignore[arg-type]
        text=text,
        msg_type=msg_type,
        char_count=len(text) if text else 0,
        reaction_count=reactions,
    )


def calm_conversation(n: int = 30, start_idx: int = 0, start_min: float = 0.0) -> list[Message]:
    """穏やかな往復。ゆったりした間隔・友好語・リアクションあり。"""
    friendly = ["おはよう", "今日はいい天気だね", "ありがとう、助かるよ", "楽しみだね", "そうだね"]
    msgs: list[Message] = []
    for i in range(n):
        speaker = "SELF" if i % 2 == 0 else "PARTNER"
        text = friendly[i % len(friendly)]
        react = 1 if i % 4 == 0 else 0
        msgs.append(_m(start_idx + i, start_min + i * 3.0, speaker, text, reactions=react))
    return msgs


def conflict_conversation(n: int = 24, start_idx: int = 0, start_min: float = 0.0) -> list[Message]:
    """対立の応酬。速い間隔・非難/侮辱/一般化・短い相槌・リアクションなし。"""
    lines = [
        "いつもそうやって後回しにするよね",
        "は？別にそんなつもりない",
        "毎回あなたのせいでこうなる",
        "そっちこそ勝手に決めてるじゃん",
        "もういい",
        "うん",
        "どうせ私の話なんて聞いてない",
        "はいはい",
    ]
    msgs: list[Message] = []
    t = start_min
    for i in range(n):
        speaker = "SELF" if i % 2 == 0 else "PARTNER"
        text = lines[i % len(lines)]
        msgs.append(_m(start_idx + i, t, speaker, text))
        t += 0.4  # 速い応酬（~24 秒間隔）
    return msgs


def labeled_scenario() -> tuple[list[Message], object]:
    """穏やか→対立の連続シナリオと、その対立ラベルを返す。

    aware_ts（§12.2）は対立の「最初の一撃」ではなく、SELF が対立を明示的に言語化した
    メタ発話に置く。検知は一撃の応酬を先に捉えるため、Lead Time は正になり得る。
    """
    from heatwatch.evaluation.labels import Interval

    calm = calm_conversation(n=20, start_idx=0, start_min=0.0)
    # 対立ブロック（速い応酬）。開始は 60 分。
    conflict_start_min = 60.0
    jabs = [
        "いつもそうやって後回しにするよね",
        "は？別にそんなつもりない",
        "毎回あなたのせいでこうなる",
        "そっちこそ勝手に決めてるじゃん",
        "どうせ私の話なんて聞いてない",
        "はいはい",
        "もういい",
        "うん",
    ]
    conflict: list[Message] = []
    t = conflict_start_min
    aware_ts = None
    for i in range(30):
        idx = 20 + i
        speaker = "SELF" if i % 2 == 0 else "PARTNER"
        if i == 26:  # SELF による対立のメタ言語化 = aware_ts（§12.2）
            # 現実の対立では、当事者が「対立している」と言語化するのは応酬の後。
            text = "なんでそんな怒ってるの"
            msg = _m(idx, t, "SELF", text)
            aware_ts = msg.ts
        else:
            text = jabs[i % len(jabs)]
            msg = _m(idx, t, speaker, text)
        conflict.append(msg)
        t += 0.4

    messages = calm + conflict
    interval = Interval(
        start_ts=conflict[0].ts,
        end_ts=conflict[-1].ts,
        kind="conflict",
        aware_ts=aware_ts,
    )
    return messages, interval


def with_safety_phrase(base: list[Message]) -> list[Message]:
    """末尾に安全語彙を含む合成メッセージを付す（P0-ETH-05 のテスト用）。"""
    last = base[-1]
    extra = _m(last.idx + 1, 0.0, "PARTNER", "殴るぞ")
    extra = Message(
        idx=extra.idx,
        ts=last.ts + timedelta(seconds=20),
        speaker="PARTNER",
        text="殴るぞ",
        msg_type=MessageType.TEXT,
        char_count=3,
        reaction_count=0,
    )
    return [*base, extra]
