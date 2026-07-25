"""中間表現（メモリ内）。requirements.md §8.1 に対応。

``Message.text`` は復元済み本文を保持しうるが、これはプロセスメモリ上のみで
扱う（DAT-104）。永続層（storage）はこの型を本文ごと受け取らない（§15.1）。
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Literal

Speaker = Literal["SELF", "PARTNER"]
"""話者。実名を保持しない（§8.1）。"""


class MessageType(Enum):
    """メッセージ種別。PIT-04 で content 欠損時に導出する。"""

    TEXT = "TEXT"
    PHOTO = "PHOTO"
    STICKER = "STICKER"
    SHARE = "SHARE"
    CALL = "CALL"
    SYSTEM = "SYSTEM"
    UNSENT = "UNSENT"


# テキスト特徴量の対象となる種別（FEA-105）。
# TEXT 以外は頻度特徴量にのみ算入し、テキスト特徴量からは除外する。
TEXT_BEARING_TYPES: frozenset[MessageType] = frozenset({MessageType.TEXT})


@dataclass(frozen=True)
class Message:
    """正規化済みの単一メッセージ（昇順・tz-aware）。"""

    idx: int
    ts: datetime
    speaker: Speaker
    text: str | None
    msg_type: MessageType
    char_count: int
    reaction_count: int

    @property
    def is_text_bearing(self) -> bool:
        """テキスト特徴量の対象か（FEA-105）。"""
        return self.msg_type in TEXT_BEARING_TYPES
