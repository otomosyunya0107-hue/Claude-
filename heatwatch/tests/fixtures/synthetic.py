"""合成エクスポートの生成（本物の会話本文を一切含まない / CLAUDE.md Privacy）。

Instagram の JSON エクスポートを模す。文字列は「UTF-8 バイト列を Latin-1 として
解釈した」mojibake 形式で格納し、パーサの復元（PIT-01）を検証できるようにする。
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

SELF_NAME = "テスト自分"
PARTNER_NAME = "テスト相手"


def _mojibake(text: str) -> str:
    """UTF-8 バイト列を Latin-1 文字列として表現する（エクスポートの実挙動）。"""
    return text.encode("utf-8").decode("latin-1")


def _msg(
    sender: str,
    ts_ms: int,
    content: str | None = None,
    **extra: Any,
) -> dict[str, Any]:
    m: dict[str, Any] = {"sender_name": _mojibake(sender), "timestamp_ms": ts_ms}
    if content is not None:
        m["content"] = _mojibake(content)
    m.update(extra)
    return m


def write_export(root: Path, sentinel: str | None = None) -> Path:
    """合成エクスポートを ``root`` 配下に書き、スレッドディレクトリを返す。

    - 分割ファイル（message_1/message_2）
    - 降順格納（PIT-02）
    - 跨ファイル重複（PIT-03）
    - 非テキスト種別（写真・スタンプ・シェア・通話）と システム文（PIT-04/05）
    - リアクション
    """
    thread = root / "inbox" / "thread_test_123"
    thread.mkdir(parents=True, exist_ok=True)

    base = 1_750_000_000_000

    # 会話（時系列の意味順）。あとで降順に分割して格納する。
    convo: list[dict[str, Any]] = [
        _msg(PARTNER_NAME, base + 0, "おはよう"),
        _msg(SELF_NAME, base + 60_000, "おはよう、今日は早いね"),
        _msg(
            PARTNER_NAME,
            base + 120_000,
            "うん",
            reactions=[{"reaction": _mojibake("❤"), "actor": _mojibake(SELF_NAME)}],
        ),
        _msg(PARTNER_NAME, base + 180_000, None, photos=[{"uri": "photos/a.jpg"}]),
        _msg(SELF_NAME, base + 240_000, "かわいい"),
        _msg(PARTNER_NAME, base + 300_000, None, sticker={"uri": "stickers/x.png"}),
        _msg(SELF_NAME, base + 360_000, None, share={"link": "https://example.com"}),
        _msg(PARTNER_NAME, base + 420_000, "通話時間 5:12"),  # CALL
        _msg(SELF_NAME, base + 480_000, "テスト自分さんがいいねしました"),  # SYSTEM 風
    ]
    if sentinel is not None:
        convo.append(_msg(SELF_NAME, base + 540_000, f"合成本文 {sentinel} を含む"))

    # 降順に並べ、2 ファイルへ分割（PIT-02/03）。
    desc = list(reversed(convo))
    half = len(desc) // 2
    _dump(thread / "message_1.json", desc[:half])
    _dump(thread / "message_2.json", desc[half:])

    # 跨ファイル重複を message_2 の末尾に混ぜる（PIT-03）。
    dup = convo[1]
    _append(thread / "message_2.json", dup)
    return thread


def _dump(path: Path, messages: list[dict[str, Any]]) -> None:
    payload = {
        "participants": [{"name": _mojibake(SELF_NAME)}, {"name": _mojibake(PARTNER_NAME)}],
        "messages": messages,
        "title": _mojibake("テスト相手"),
        "thread_path": "inbox/thread_test_123",
    }
    path.write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")


def _append(path: Path, message: dict[str, Any]) -> None:
    payload = json.loads(path.read_text(encoding="utf-8"))
    payload["messages"].append(message)
    path.write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")
