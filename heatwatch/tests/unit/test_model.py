"""model.Message の基本的性質（§8.1, FEA-105）を検証する。"""

from __future__ import annotations

from datetime import datetime

from heatwatch.constants import TOKYO
from heatwatch.model import Message, MessageType


def _msg(msg_type: MessageType) -> Message:
    return Message(
        idx=0,
        ts=datetime(2026, 1, 1, tzinfo=TOKYO),
        speaker="SELF",
        text="synthetic" if msg_type is MessageType.TEXT else None,
        msg_type=msg_type,
        char_count=9 if msg_type is MessageType.TEXT else 0,
        reaction_count=0,
    )


def test_text_message_is_text_bearing() -> None:
    assert _msg(MessageType.TEXT).is_text_bearing is True


def test_non_text_types_excluded_from_text_features() -> None:
    # FEA-105: 非テキストはテキスト特徴量から除外する。
    for t in (
        MessageType.PHOTO,
        MessageType.STICKER,
        MessageType.SHARE,
        MessageType.CALL,
        MessageType.SYSTEM,
        MessageType.UNSENT,
    ):
        assert _msg(t).is_text_bearing is False


def test_message_is_frozen() -> None:
    import dataclasses

    m = _msg(MessageType.TEXT)
    try:
        m.idx = 1  # type: ignore[misc]
    except dataclasses.FrozenInstanceError:
        return
    raise AssertionError("Message は frozen であるべき")
