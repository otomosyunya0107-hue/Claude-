"""安全分岐。requirements.md P0-ETH-05 / DET-104 に対応（Fail Closed）。

脅迫・暴力・強要・自傷他害の語彙を検知した場合、通常のヒート通知を抑止し、
静的な安全案内のみを提示する。判定はローカルの安全辞書のみに依存する。
"""

from __future__ import annotations

from ..features.lexicon import Lexicons
from ..features.windowing import Window
from ..model import MessageType


def is_safety_triggered(window: Window, lex: Lexicons) -> bool:
    """ウィンドウ内のテキストに安全語彙が含まれるか。"""
    for m in window.messages:
        if m.msg_type is MessageType.TEXT and m.text:
            if any(word and word in m.text for word in lex.safety):
                return True
    return False
