"""M6: 自己介入（通知）層。Phase 2。

OS 通知を既定チャネルとし、テンプレートは静的定数のみ（NOT-101）。禁止語を
含めない（NOT-102）。本文・引用・相手の発言要約を通知に含めない。
"""

from __future__ import annotations

from .forbidden import FORBIDDEN_WORDS, assert_clean, contains_forbidden
from .notifier import MAX_LEN, Notifier, OSBackend, Outcome, RecordingBackend
from .templates import TEMPLATES, NotificationPayload, render

__all__ = [
    "FORBIDDEN_WORDS",
    "MAX_LEN",
    "NotificationPayload",
    "Notifier",
    "OSBackend",
    "Outcome",
    "RecordingBackend",
    "TEMPLATES",
    "assert_clean",
    "contains_forbidden",
    "render",
]
