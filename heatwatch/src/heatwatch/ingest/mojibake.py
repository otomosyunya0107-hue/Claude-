"""mojibake（文字化け）復元。requirements.md PIT-01 に対応。

Instagram の JSON エクスポートは、UTF-8 バイト列を Latin-1 として解釈した文字列を
``\\u00XX`` エスケープで格納する。復元は Latin-1 で再エンコードして UTF-8 として
デコードし直す。復元に失敗した文字列は原文を保持し、失敗を呼び出し側へ通知する
（本文をログへ出さないため、失敗は件数のみ集計する / NFR-106）。
"""

from __future__ import annotations


def recover(text: str) -> tuple[str, bool]:
    """mojibake を復元する。

    Returns:
        ``(復元後文字列, 復元を適用したか)``。復元不能な場合は原文と ``False``。
    """
    try:
        recovered = text.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        # 既に正しい UTF-8（Latin-1 で表現できない文字を含む）か、壊れている。
        return text, False
    if recovered == text:
        return text, False
    return recovered, True
