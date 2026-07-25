"""自己通知。requirements.md §11 / M6 に対応。

アラートを静的テンプレートの通知ペイロードへ写像し、Kill Switch（P1-ETH-08）・
静音時間帯（NOT-105）・長さ制限（NOT-103）・禁止語（NOT-102）を適用する。
ペイロードに会話本文・引用を含めない（NOT-101）。相手が閲覧しうる経路へ送らない。
"""

from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass
from datetime import datetime, time
from enum import Enum
from typing import Protocol

from ..detector.engine import Alert
from .forbidden import assert_clean
from .templates import NotificationPayload, render

MAX_LEN = 40  # NOT-103
_TITLE = "HeatWatch"


class Outcome(Enum):
    DELIVERED = "delivered"
    SUPPRESSED_KILL = "suppressed_kill"
    SUPPRESSED_QUIET = "suppressed_quiet"


class Backend(Protocol):
    def deliver(self, title: str, text: str) -> None: ...


class RecordingBackend:
    """テスト・ドライラン用。ペイロードのみ保持（本文なし）。"""

    def __init__(self) -> None:
        self.sent: list[tuple[str, str]] = []

    def deliver(self, title: str, text: str) -> None:
        self.sent.append((title, text))


class OSBackend:
    """OS 通知（macOS osascript / Linux notify-send）。ローカル完結（§11.1）。"""

    def deliver(self, title: str, text: str) -> None:  # pragma: no cover - OS 依存
        if shutil.which("notify-send"):
            subprocess.run(["notify-send", title, text], check=False)
        elif shutil.which("osascript"):
            script = f'display notification {text!r} with title {title!r}'
            subprocess.run(["osascript", "-e", script], check=False)


def _parse_hhmm(s: str) -> time:
    h, m = s.split(":")
    return time(int(h), int(m))


@dataclass
class Notifier:
    backend: Backend
    kill_switch: bool = False
    quiet_start: str = "23:00"
    quiet_end: str = "08:00"

    def in_quiet_hours(self, ts: datetime) -> bool:
        start = _parse_hhmm(self.quiet_start)
        end = _parse_hhmm(self.quiet_end)
        now = ts.timetz().replace(tzinfo=None)
        if start <= end:
            return start <= now < end
        return now >= start or now < end  # 日跨ぎ（23:00-08:00）

    def build_payload(
        self, alert: Alert, sustained_minutes: int | None = None, safety: bool = False
    ) -> NotificationPayload:
        if safety:
            tid = "T-04"
        elif alert.level >= 3:
            tid = "T-02"
        else:
            tid = "T-01"
        text = render(tid, minutes=sustained_minutes)
        assert_clean(text)  # NOT-102
        if len(text) > MAX_LEN:
            raise ValueError(f"通知文が {MAX_LEN} 字を超える (NOT-103): {len(text)}")
        return NotificationPayload(template_id=tid, text=text, level=alert.level)

    def notify(self, payload: NotificationPayload, ts: datetime) -> Outcome:
        if self.kill_switch:  # P1-ETH-08
            return Outcome.SUPPRESSED_KILL
        if self.in_quiet_hours(ts):  # NOT-105: 抑制し記録のみ
            return Outcome.SUPPRESSED_QUIET
        self.backend.deliver(_TITLE, payload.text)
        return Outcome.DELIVERED
