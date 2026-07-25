"""禁止語チェック。requirements.md NOT-102 / P0-ETH-04 に対応。

通知文は「あなたが悪い」「落ち着いて」等の責任帰属・行動指示を含まない。禁止語を
検出したら通知を組み立てさせない（Fail Closed）。
"""

from __future__ import annotations

# NOT-102 の禁止語（部分一致）。責任帰属・行動指示・自己抑制の語彙。
FORBIDDEN_WORDS: tuple[str, ...] = (
    "悪い",
    "落ち着",
    "感情的",
    "責め",
    "我慢",
    "謝",
)


def contains_forbidden(text: str) -> list[str]:
    """禁止語の一覧を返す（空ならクリーン）。"""
    return [w for w in FORBIDDEN_WORDS if w in text]


def assert_clean(text: str) -> None:
    hits = contains_forbidden(text)
    if hits:
        raise ValueError(f"通知文が禁止語を含む (NOT-102): {hits}")
