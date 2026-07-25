"""ウィンドウ設計。requirements.md §9.4 に対応。

直近 20 メッセージ または 30 分のいずれか短い方を 1 ウィンドウとし、1 メッセージ
ごとにスライドする。発火の最小要件（≥6 件かつ両話者）は検知側で判定するため、
ここでは全ウィンドウを生成する。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from ..model import Message

DEFAULT_MAX_MSGS = 20
DEFAULT_MAX_MINUTES = 30


@dataclass(frozen=True)
class Window:
    """解析単位。末尾（最新）メッセージ基準のスライディングウィンドウ。"""

    messages: tuple[Message, ...]

    @property
    def start_ts(self) -> datetime:
        return self.messages[0].ts

    @property
    def end_ts(self) -> datetime:
        return self.messages[-1].ts

    @property
    def msg_count(self) -> int:
        return len(self.messages)

    @property
    def both_speakers(self) -> bool:
        return len({m.speaker for m in self.messages}) >= 2


def build_windows(
    messages: list[Message],
    max_msgs: int = DEFAULT_MAX_MSGS,
    max_minutes: int = DEFAULT_MAX_MINUTES,
) -> list[Window]:
    """昇順のメッセージ列からスライディングウィンドウ列を生成する。"""
    span = timedelta(minutes=max_minutes)
    windows: list[Window] = []
    for end in range(len(messages)):
        newest = messages[end]
        start = max(0, end - max_msgs + 1)
        # 30 分制約: 末尾から遡って範囲外を切る。
        while start < end and newest.ts - messages[start].ts > span:
            start += 1
        windows.append(Window(messages=tuple(messages[start : end + 1])))
    return windows
